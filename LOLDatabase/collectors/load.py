"""入库加载器：raw JSON → 规范化 SQLite（幂等，可反复执行）。

各阶段均以「源唯一键」upsert，重复执行安全。
"""

import json
import re
import sqlite3
from pathlib import Path

from collectors import config


# ---------- 取值工具 ----------

def s(v):
    """字符串；空串 → None。"""
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def i(v):
    """整数；空/非法 → None。"""
    v = s(v)
    if v is None:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def f(v):
    """浮点；空/非法 → None。"""
    v = s(v)
    if v is None:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def b(v):
    """布尔（Cargo 的 Yes/No）；空 → None。"""
    v = s(v)
    if v is None:
        return None
    return 1 if v.lower() in ("yes", "true", "1") else 0


def strip_wikilink(link: str) -> str:
    """'[[Ahri]]' → 'Ahri'；'[[Ahri|九尾妖狐]]' → 'Ahri'。"""
    link = (link or "").strip()
    if link.startswith("[[") and link.endswith("]]"):
        inner = link[2:-2].split("|")[0]
        return inner.strip()
    return link or ""


def norm_champ(name: str) -> str:
    """英雄名规范化：去非字母数字、小写，用于跨源匹配。"""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def parse_champ(line: str) -> str:
    """BP/选手行中的英雄单元格（可能是 wikilink / 原文）→ 页面名。"""
    return strip_wikilink(line)


def parse_vod_url(vod_wikitext) -> str | None:
    """从 VOD wikitext 提取第一个 http 链接。"""
    text = vod_wikitext or ""
    m = re.search(r"https?://[^\s\]\|\}]+", text)
    return m.group(0).rstrip("[]") if m else None


def parse_gamelength(v) -> float | None:
    """'27:52' → 27.87（分钟）。"""
    m = re.match(r"^(\d+):(\d{2})$", s(v) or "")
    return int(m.group(1)) + int(m.group(2)) / 60 if m else None


def parse_game_no(gamename) -> int | None:
    m = re.search(r"Game\s+(\d+)", s(gamename) or "")
    return int(m.group(1)) if m else None


def winner_side(v) -> int | None:
    v = s(v)
    if v in ("1", "Team1"):
        return 1
    if v in ("2", "Team2"):
        return 2
    return None


# ---------- 数据库 ----------

def init_db(db_path: Path | None = None) -> sqlite3.Connection:
    db_path = db_path or config.DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    exists = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='meta'"
    ).fetchone()
    if not exists:
        conn.executescript(config.SCHEMA_PATH.read_text(encoding="utf-8"))
    has_fixes = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='data_fixes'"
    ).fetchone()
    if not has_fixes:
        conn.execute(
            """CREATE TABLE data_fixes (
                id          INTEGER PRIMARY KEY,
                target_type TEXT NOT NULL,
                target_key  TEXT NOT NULL,
                action      TEXT NOT NULL,
                field       TEXT,
                fixed_value TEXT,
                reason      TEXT,
                applied_at  TEXT DEFAULT (datetime('now'))
            )"""
        )
        has_fixes = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='data_fixes'"
        ).fetchone()
    # 唯一的修正登记（重复运行不重复累计）
    conn.execute(
        "DELETE FROM data_fixes WHERE id NOT IN "
        "(SELECT MIN(id) FROM data_fixes GROUP BY target_key, action, COALESCE(field, ''))"
    )
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_data_fixes_key "
        "ON data_fixes(target_key, action, COALESCE(field, ''))"
    )
    # 图标资产表（召唤师技能/装备/饰品：以名称为键，无整数实体 ID）
    has_icons = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='icon_assets'"
    ).fetchone()
    if not has_icons:
        conn.execute(
            """CREATE TABLE icon_assets (
                kind       TEXT NOT NULL,  -- spell | item（饰品归入 item）
                name       TEXT NOT NULL,  -- 原始名称（Flash / Jak'Sho, The Protean）
                local_path TEXT NOT NULL,
                source_url TEXT,
                version    TEXT,
                sha256     TEXT,
                fetched_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (kind, name)
            )"""
        )
    # 迁移：media_assets.year（选手年代定妆照）+ 完整唯一索引
    # （SQLite 唯一索引中多个 NULL 互不冲突，故可覆盖无年份的旧行）
    has_year = conn.execute(
        "SELECT name FROM pragma_table_info('media_assets') WHERE name='year'"
    ).fetchone()
    if not has_year:
        conn.execute("ALTER TABLE media_assets ADD COLUMN year INTEGER")
    conn.execute("DROP INDEX IF EXISTS idx_media_year")
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_media_year "
        "ON media_assets(entity_type, entity_id, kind, year)"
    )
    if not has_year:
        print("  schema 迁移: media_assets.year 已添加", flush=True)
    # 迁移：picks_bans.slot 需为可空（补录数据可能无 BP 顺序）
    slot_notnull = conn.execute(
        "SELECT \"notnull\" FROM pragma_table_info('picks_bans') "
        "WHERE name='slot'"
    ).fetchone()
    if slot_notnull and slot_notnull[0]:
        conn.executescript(
            """
            ALTER TABLE picks_bans RENAME TO picks_bans_old;
            CREATE TABLE picks_bans (
                id          INTEGER PRIMARY KEY,
                game_id     INTEGER NOT NULL REFERENCES games(id),
                team_id     INTEGER REFERENCES teams(id),
                side        INTEGER NOT NULL,
                phase       TEXT NOT NULL,
                slot        INTEGER,
                champion_id INTEGER REFERENCES champions(id)
            );
            INSERT INTO picks_bans
                (id, game_id, team_id, side, phase, slot, champion_id)
                SELECT id, game_id, team_id, side, phase, slot, champion_id
                FROM picks_bans_old;
            DROP TABLE picks_bans_old;
            CREATE INDEX idx_pb_game ON picks_bans(game_id);
            """
        )
        print("  schema 迁移: picks_bans.slot 已放宽为可空", flush=True)
    return conn


def upsert(conn: sqlite3.Connection, table: str, key_cols: list, row: dict):
    """按 key_cols（需对应表的 UNIQUE 约束）upsert 一行。"""
    cols = list(row.keys())
    sets = ",".join(f"{c}=excluded.{c}" for c in cols if c not in key_cols)
    sql = (
        f"INSERT INTO {table}({','.join(cols)}) "
        f"VALUES({','.join('?' * len(cols))}) "
        f"ON CONFLICT({','.join(key_cols)}) DO UPDATE SET {sets}"
    )
    conn.execute(sql, [row[c] for c in cols])


def read_pages(rel_dir: str) -> list:
    """读取 raw 目录下所有 page_*.json 行（递归，兼容 batch_XXXX 子目录）。"""
    root = config.RAW_DIR / rel_dir
    if not root.exists():
        return []
    rows = []
    for pf in sorted(root.rglob("page_*.json")):
        for row in json.loads(pf.read_text(encoding="utf-8")):
            # 兼容旧版落盘文件中的转义键（空格→下划线）
            rows.append({k.replace(" ", "_"): v for k, v in row.items()})
    return rows


# ---------- 各阶段加载 ----------

class Loader:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.team_ids: dict[str, int] = {}
        self.player_ids: dict[str, int] = {}
        self.champ_ids: dict[str, int] = {}

    # -- 英雄 --

    def load_champions(self) -> int:
        data_file = config.RAW_DIR / "champions" / "communitydragon.json"
        if not data_file.exists():
            print("  ! 缺少 champions/communitydragon.json，跳过英雄", flush=True)
            return 0
        data = json.loads(data_file.read_text(encoding="utf-8"))
        for entry in data:
            alias_en = s(entry.get("alias")) or s(entry.get("name"))
            if not alias_en:
                continue
            upsert(
                self.conn,
                "champions",
                ["name"],
                {
                    "name": alias_en,
                    "name_cn": s(entry.get("name")),
                    "title": s(entry.get("title")),
                    "key_integer": i(entry.get("id")),
                },
            )
            self.champ_ids[norm_champ(alias_en)] = self._champ_id(alias_en)
        print(f"  champions: {len(data)} 个英雄（中文名已并入）", flush=True)
        return len(data)

    def _champ_id(self, name_en: str) -> int:
        row = self.conn.execute(
            "SELECT id FROM champions WHERE name=?", (name_en,)
        ).fetchone()
        assert row, f"英雄未入库: {name_en}"
        return row[0]

    def champ_id_by_page(self, page_name: str) -> int | None:
        """英雄页面名（如 'Kai'Sa' / 'Nunu & Willump'）→ 本库 champions.id。"""
        key = norm_champ(page_name)
        key = config.CHAMP_OVERRIDES.get(key, key)
        if key in self.champ_ids:
            return self.champ_ids[key]
        row = self.conn.execute(
            "SELECT id FROM champions WHERE name=?", (page_name,)
        ).fetchone()
        if row:
            self.champ_ids[key] = row[0]
            return row[0]
        return None

    # -- 联赛 / 赛段 --

    def load_leagues_tournaments(self) -> tuple[int, int]:
        league_ids: dict[str, int] = {}
        n_t = 0
        rows = read_pages("lpl/tournaments")
        for row in rows:
            # 联赛名以 OverviewPage 首段为准（'LPL/2025 Season/...' → LPL），
            # Cargo League 字段存的是 'Tencent LoL Pro League' 等非标准值，仅作兜底
            overview = s(row.get("OverviewPage")) or ""
            league_name = overview.split("/")[0] if overview else (
                s(row.get("League")) or config.LPL_LEAGUE
            )
            if league_name not in league_ids:
                region = s(row.get("Region")) or {
                    "LPL": "China", "LDL": "China",
                }.get(league_name)
                upsert(
                    self.conn, "leagues", ["name"],
                    {
                        "name": league_name,
                        "short_name": league_name,
                        "region": region,
                    },
                )
                league_ids[league_name] = self.conn.execute(
                    "SELECT id FROM leagues WHERE name=?", (league_name,)
                ).fetchone()[0]
            upsert(
                self.conn, "tournaments", ["overview_page"],
                {
                    "overview_page": overview,
                    "name": s(row.get("Name")),
                    "league_id": league_ids[league_name],
                    "date_start": s(row.get("DateStart")) or s(row.get("Date")),
                    "date_end": s(row.get("Date")),
                    "year": s(row.get("Year")),
                    "split_number": i(row.get("SplitNumber")),
                    "split": s(row.get("Split")),
                    "is_playoffs": b(row.get("IsPlayoffs")),
                    "is_qualifier": b(row.get("IsQualifier")),
                    "is_official": b(row.get("IsOfficial")),
                    "event_type": s(row.get("EventType")),
                    "tournament_level": s(row.get("TournamentLevel")),
                },
            )
            n_t += 1
        print(f"  leagues/tournaments: {len(league_ids)} 联赛 / {n_t} 赛段", flush=True)
        return len(league_ids), n_t

    # -- 战队 --

    def team_id(self, page_name: str) -> int | None:
        if not page_name or page_name.strip().upper() == "TBD":
            return None
        if page_name in self.team_ids:
            return self.team_ids[page_name]
        row = self.conn.execute(
            "SELECT id FROM teams WHERE overview_page=?", (page_name,)
        ).fetchone()
        if not row:
            cur = self.conn.execute(
                "INSERT INTO teams(overview_page, name) VALUES(?, ?)",
                (page_name, page_name),
            )
            row = (cur.lastrowid,)
        self.team_ids[page_name] = row[0]
        return row[0]

    # -- 系列赛 --

    def load_series(self) -> int:
        n = 0
        for pf in (config.RAW_DIR / "lpl" / "matchschedule").rglob("page_*.json"):
            for raw_row in json.loads(pf.read_text(encoding="utf-8")):
                row = {k.replace(" ", "_"): v for k, v in raw_row.items()}
                overview = s(row.get("OverviewPage"))
                tab = s(row.get("Tab"))
                n_in_tab = i(row.get("N_MatchInTab"))
                match_id = s(row.get("MatchId"))
                key = match_id or f"LP_FB:{overview}|{tab}|{n_in_tab}"
                t1, t2 = self.team_id(s(row.get("Team1"))), self.team_id(s(row.get("Team2")))
                side = winner_side(row.get("Winner"))
                w_raw = s(row.get("Winner"))
                if side is None and w_raw == s(row.get("Team1")):
                    side = 1
                elif side is None and w_raw == s(row.get("Team2")):
                    side = 2
                score1, score2 = i(row.get("Team1Score")), i(row.get("Team2Score"))
                winner = None
                if side == 1:
                    winner = t1
                elif side == 2:
                    winner = t2
                elif score1 is not None and score2 is not None:
                    if score1 > score2:
                        winner = t1
                    elif score2 > score1:
                        winner = t2
                mvp = s(row.get("MVP"))
                mvp_id = None
                if mvp:
                    mvp_id = self.player_id_by_link(strip_wikilink(mvp))
                upsert(
                    self.conn, "series", ["match_id_src"],
                    {
                        "match_id_src": key,
                        "unique_match": s(row.get("UniqueMatch")),
                        "tournament_id": self._tournament_id(overview),
                        "overview_page": overview,
                        "tab": tab,
                        "phase": s(row.get("Phase")),
                        "round": s(row.get("Round")),
                        "shown_round": s(row.get("ShownRound")),
                        "best_of": i(row.get("BestOf")),
                        "team1_id": t1, "team2_id": t2,
                        "score1": score1, "score2": score2,
                        "winner_id": winner,
                        "ff": i(row.get("FF")),
                        "is_nullified": b(row.get("IsNullified")),
                        "is_tiebreaker": b(row.get("IsTiebreaker")),
                        "start_time_utc": s(row.get("DateTime_UTC")),
                        "has_time": b(row.get("HasTime")),
                        "patch": s(row.get("Patch")),
                        "patch_page": s(row.get("PatchPage")),
                        "venue": s(row.get("Venue")),
                        "mvp_player_id": mvp_id,
                        "mvp_points": i(row.get("MVPPoints")),
                        "disabled_champions": s(row.get("DisabledChampions")),
                    },
                )
                self._sr("series", key, match_id, overview, row)
                n += 1
        print(f"  series: {n} 场", flush=True)
        return n

    def _tournament_id(self, overview: str) -> int | None:
        if not overview:
            return None
        row = self.conn.execute(
            "SELECT id FROM tournaments WHERE overview_page=?", (overview,)
        ).fetchone()
        return row[0] if row else None

    # -- 选手 --

    def player_id_by_link(self, link: str) -> int:
        """选手 Link（比赛当时 ID）→ players.id；未知时建占位行并登记别名。"""
        if link in self.player_ids:
            return self.player_ids[link]
        row = self.conn.execute(
            "SELECT id FROM players WHERE player_id=?", (link,)
        ).fetchone()
        if not row:
            row = self.conn.execute(
                "SELECT p.id FROM player_aliases a JOIN players p ON p.id=a.player_id "
                "WHERE a.alias=?",
                (link,),
            ).fetchone()
        if not row:
            cur = self.conn.execute(
                "INSERT INTO players(player_id, name) VALUES(?, ?)", (link, link)
            )
            pid = cur.lastrowid
            cur = self.conn.execute(
                "INSERT INTO player_aliases(player_id, alias, source) "
                "VALUES(?, ?, 'ScoreboardPlayers.Link')",
                (pid, link),
            )
        else:
            pid = row[0]
        self.player_ids[link] = pid
        return pid

    def _players_by_overview(self) -> dict:
        return {
            r[0]: r[1]
            for r in self.conn.execute("SELECT overview_page, id FROM players").fetchall()
        }

    def load_players_and_redirects(self) -> int:
        """Players 表档案更新 + PlayerRedirects → player_aliases。"""
        by_page = self._players_by_overview()
        n = 0
        # 重定向 → 别名
        for row in read_pages("lpl/players/redirects"):
            alias, page = s(row.get("AllName")), s(row.get("OverviewPage"))
            if not alias or not page:
                continue
            if page not in by_page:
                cur = self.conn.execute(
                    "INSERT INTO players(overview_page, player_id, name) "
                    "VALUES(?, ?, ?)",
                    (page, alias, alias),
                )
                by_page[page] = cur.lastrowid
            pid = by_page[page]
            if alias not in self.player_ids:
                exists = self.conn.execute(
                    "SELECT id FROM player_aliases WHERE player_id=? AND alias=?",
                    (pid, alias),
                ).fetchone()
                if not exists:
                    self.conn.execute(
                        "INSERT INTO player_aliases(player_id, alias, source) "
                        "VALUES(?, ?, 'PlayerRedirects')",
                        (pid, alias),
                    )
                self.player_ids[alias] = pid
        # Players 档案
        for row in read_pages("lpl/players/players"):
            page = s(row.get("OverviewPage"))
            if not page:
                continue
            if page not in by_page:
                cur = self.conn.execute(
                    "INSERT INTO players(overview_page, player_id, name) "
                    "VALUES(?, ?, ?)",
                    (page, s(row.get("ID")) or page, s(row.get("ID")) or page),
                )
                by_page[page] = cur.lastrowid
            pid = by_page[page]
            upsert(
                self.conn, "players", ["overview_page"],
                {
                    "overview_page": page,
                    "player_id": s(row.get("ID")) or s(row.get("Player")) or page,
                    "name": s(row.get("Name")),
                    "native_name": s(row.get("NativeName")),
                    "name_full": s(row.get("NameFull")),
                    "country": s(row.get("Country")),
                    "primary_nationality": s(row.get("NationalityPrimary")),
                    "birthdate": s(row.get("Birthdate")),
                    "residency": s(row.get("Residency")),
                    "role": _role_short(s(row.get("Role"))),
                    "team_last": s(row.get("TeamLast")),
                    "role_last": s(row.get("RoleLast")),
                    "is_retired": b(row.get("IsRetired")),
                    "image": s(row.get("Image")),
                    "is_personality": b(row.get("IsPersonality")),
                    "is_substitute": b(row.get("IsSubstitute")),
                    "is_trainee": b(row.get("IsTrainee")),
                    "is_low_content": b(row.get("IsLowContent")),
                },
            )
            self._sr("players", page, page, page, row)
            n += 1
        print(f"  players: {n} 份档案（含别名登记）", flush=True)
        self.merge_players()
        return n

    def merge_players(self) -> int:
        """把比赛 Link 产生的占位行合并进档案行：转移外键引用后删除占位行。

        占位行特征: overview_page IS NULL（只有 player_id=比赛当时 ID）。
        合并目标: 同 player_id 的档案行，或经重定向页名命中的档案行。
        """
        redirect_pages: dict[str, str] = {}
        for row in read_pages("lpl/players/redirects"):
            alias, page = s(row.get("AllName")), s(row.get("OverviewPage"))
            if alias and page:
                redirect_pages[alias] = page
        by_page = self._players_by_overview()
        merged = 0
        for ph_id, ph_name in self.conn.execute(
            "SELECT id, player_id FROM players WHERE overview_page IS NULL"
        ).fetchall():
            target = self.conn.execute(
                "SELECT id FROM players WHERE player_id=? AND overview_page IS NOT NULL "
                "LIMIT 1",
                (ph_name,),
            ).fetchone()
            if not target:
                page = redirect_pages.get(ph_name)
                if not page:
                    for (alias,) in self.conn.execute(
                        "SELECT alias FROM player_aliases WHERE player_id=?", (ph_id,)
                    ).fetchall():
                        page = redirect_pages.get(alias)
                        if page:
                            break
                if page and page in by_page:
                    target = (by_page[page],)
            if not target:
                continue
            tid = target[0]
            for table, col in (
                ("game_player_stats", "player_id"),
                ("series", "mvp_player_id"),
            ):
                self.conn.execute(
                    f"UPDATE {table} SET {col}=? WHERE {col}=?", (tid, ph_id)
                )
            self.conn.execute(
                "UPDATE player_aliases SET player_id=? WHERE player_id=?", (tid, ph_id)
            )
            self.conn.execute("DELETE FROM players WHERE id=?", (ph_id,))
            merged += 1
        if merged:
            print(f"  players: 占位行合并 {merged} 个", flush=True)
        return merged

    # -- 小局 --

    def load_games(self) -> tuple[int, int, int, int]:
        """games + picks_bans + game_team_stats；返回 (n_games, n_pb, n_stats)。"""
        series_map: dict[str, int] = {
            r[0]: r[1]
            for r in self.conn.execute("SELECT match_id_src, id FROM series").fetchall()
        }
        # 兜底映射：MatchId 缺失时按 (赛段页, 场内序号) 关联系列
        series_fallback: dict[tuple, int] = {}
        for r in self.conn.execute(
            "SELECT id, match_id_src, overview_page FROM series"
        ).fetchall():
            sid, key, overview = r
            if key and key.startswith("LP_FB:"):
                parts = key[len("LP_FB:"):].split("|")
                if len(parts) == 3:
                    series_fallback[(overview, int(parts[2]))] = sid
        n_g = n_pb = n_ts = 0
        for pf in (config.RAW_DIR / "lpl" / "scoreboardgames").rglob("page_*.json"):
            for raw_row in json.loads(pf.read_text(encoding="utf-8")):
                row = {k.replace(" ", "_"): v for k, v in raw_row.items()}
                overview = s(row.get("OverviewPage"))
                game_id = s(row.get("GameId")) or ("LP_GL:" + s(row.get("UniqueLine")) or "")
                t1, t2 = self.team_id(s(row.get("Team1"))), self.team_id(s(row.get("Team2")))
                match_id = s(row.get("MatchId"))
                series_id = series_map.get(match_id) if match_id else None
                if series_id is None:
                    series_id = series_fallback.get(
                        (overview, i(row.get("N_MatchInTab")))
                    )
                # 小局按源表原始布局存储（Team1/Team2/比分列如实落库），
                # 胜负由 win_team_side 表达（1=Team1 胜, 2=Team2 胜, NULL=源无胜负）
                win_name = s(row.get("WinTeam"))
                score1_raw, score2_raw = i(row.get("Team1Score")), i(row.get("Team2Score"))
                win_t = self.team_id(win_name) if win_name else None
                win_side = 1 if win_t == t1 else (2 if win_t == t2 else None)
                upsert(
                    self.conn, "games", ["game_id_src"],
                    {
                        "game_id_src": game_id,
                        "series_id": series_id,
                        "match_id_src": match_id,
                        "tournament_id": self._tournament_id(overview),
                        "overview_page": overview,
                        "game_no": i(row.get("N_GameInMatch"))
                        or parse_game_no(row.get("Gamename")),
                        "gamename": s(row.get("Gamename")),
                        "team1_id": t1, "team2_id": t2,
                        "win_team_side": win_side,
                        "score1_after": score1_raw, "score2_after": score2_raw,
                        "datetime_utc": s(row.get("DateTime_UTC")),
                        "game_length_min": f(row.get("Gamelength_Number"))
                        or parse_gamelength(row.get("Gamelength")),
                        "game_length_text": s(row.get("Gamelength")),
                        "patch": s(row.get("Patch")),
                        "legacy_patch": s(row.get("LegacyPatch")),
                        "match_history": s(row.get("MatchHistory")),
                        "vod_url": parse_vod_url(row.get("VOD")),
                        "riot_platform_game_id": s(row.get("RiotPlatformGameId")),
                    },
                )
                gid = self.conn.execute(
                    "SELECT id FROM games WHERE game_id_src=?", (game_id,)
                ).fetchone()[0]
                self._sr("games", game_id, game_id, overview, row)
                n_g += 1
                self.conn.execute("DELETE FROM picks_bans WHERE game_id=?", (gid,))
                self.conn.execute("DELETE FROM game_team_stats WHERE game_id=?", (gid,))
                pb_before = n_pb
                for raw_no in (1, 2):
                    team_id = t1 if raw_no == 1 else t2
                    side_no = raw_no  # 与源表列示一致
                    for phase, field in (("ban", f"Team{raw_no}Bans"),
                                         ("pick", f"Team{raw_no}Picks")):
                        raw_list = row.get(field) or ""
                        if not raw_list.strip():
                            continue
                        for slot, name in enumerate(_split_list(raw_list), start=1):
                            cid = self.champ_id_by_page(parse_champ(name))
                            self.conn.execute(
                                "INSERT INTO picks_bans"
                                "(game_id, team_id, side, phase, slot, champion_id) "
                                "VALUES(?, ?, ?, ?, ?, ?)",
                                (gid, team_id, side_no, phase, slot, cid),
                            )
                            n_pb += 1
                    stats = self._team_stats(row, raw_no)
                    if stats is not None:
                        self.conn.execute(
                            "INSERT INTO game_team_stats"
                            "(game_id, team_id, side, kills, gold, towers, inhibitors, "
                            "barons, rift_heralds, void_grubs, atakhans, dragons_total, "
                            "clouds, infernals, mountains, oceans, hextechs, chemtechs, elders) "
                            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            (gid, team_id, side_no, *stats),
                        )
                        n_ts += 1
                self.conn.execute(
                    "UPDATE games SET completeness=? WHERE id=?",
                    (1 if n_pb > pb_before else 0, gid),
                )
        print(
            f"  games: {n_g} 局 / picks_bans: {n_pb} 条 / game_team_stats: {n_ts} 条",
            flush=True,
        )
        return n_g, n_pb, n_ts

    def _team_stats(self, row: dict, side_no: int) -> list | None:
        p = f"Team{side_no}"
        vals = [
            i(row.get(f"{p}Kills")), f(row.get(f"{p}Gold")),
            i(row.get(f"{p}Towers")), i(row.get(f"{p}Inhibitors")),
            i(row.get(f"{p}Barons")), i(row.get(f"{p}RiftHeralds")),
            i(row.get(f"{p}VoidGrubs")), i(row.get(f"{p}Atakhans")),
            i(row.get(f"{p}Dragons")),
            i(row.get(f"{p}Clouds")), i(row.get(f"{p}Infernals")),
            i(row.get(f"{p}Mountains")), i(row.get(f"{p}Oceans")),
            i(row.get(f"{p}Hextechs")), i(row.get(f"{p}Chemtechs")),
            i(row.get(f"{p}Elders")),
        ]
        return vals if any(v is not None for v in vals) else None

    # -- 小局选手 --

    def load_game_player_stats(self) -> int:
        n = 0
        gp_cols = (
            "game_id", "player_id", "link_used", "team_id", "side", "role",
            "ingest_role", "role_number", "champion_id", "kills", "deaths",
            "assists", "gold", "cs", "damage_to_champions", "vision_score",
            "pentakills", "player_win", "team_kills", "team_gold",
            "summoner_spells", "items", "trinket", "keystone_rune",
            "primary_tree", "secondary_tree", "stats_page",
        )
        update_cols = [c for c in gp_cols if c != "unique_line"]
        for pf in (config.RAW_DIR / "lpl" / "scoreboardplayers").rglob("page_*.json"):
            for raw_row in json.loads(pf.read_text(encoding="utf-8")):
                row = {k.replace(" ", "_"): v for k, v in raw_row.items()}
                ul = s(row.get("UniqueLine"))
                if not ul:
                    continue
                game_id_src = s(row.get("GameId"))
                game_row = None
                if game_id_src:
                    game_row = self.conn.execute(
                        "SELECT id FROM games WHERE game_id_src=?", (game_id_src,)
                    ).fetchone()
                link = s(row.get("Link")) or s(row.get("Name")) or ""
                pid = self.player_id_by_link(strip_wikilink(link)) if link else None
                ch = s(row.get("Champion"))
                cid = self.champ_id_by_page(parse_champ(ch)) if ch else None
                team_id = self.team_id(s(row.get("Team")))
                values = {
                    "unique_line": ul,
                    "game_id": game_row[0] if game_row else None,
                    "player_id": pid,
                    "link_used": link,
                    "team_id": team_id,
                    "side": i(row.get("Side")),
                    "role": s(row.get("Role")),
                    "ingest_role": s(row.get("IngameRole")),
                    "role_number": i(row.get("Role_Number")),
                    "champion_id": cid,
                    "kills": i(row.get("Kills")),
                    "deaths": i(row.get("Deaths")),
                    "assists": i(row.get("Assists")),
                    "gold": i(row.get("Gold")),
                    "cs": i(row.get("CS")),
                    "damage_to_champions": i(row.get("DamageToChampions")),
                    "vision_score": i(row.get("VisionScore")),
                    "pentakills": i(row.get("Pentakills")),
                    "player_win": b(row.get("PlayerWin")),
                    "team_kills": i(row.get("TeamKills")),
                    "team_gold": i(row.get("TeamGold")),
                    "summoner_spells": s(row.get("SummonerSpells")),
                    "items": s(row.get("Items")),
                    "trinket": s(row.get("Trinket")),
                    "keystone_rune": s(row.get("KeystoneRune")),
                    "primary_tree": s(row.get("PrimaryTree")),
                    "secondary_tree": s(row.get("SecondaryTree")),
                    "stats_page": s(row.get("StatsPage")),
                }
                cols = ["unique_line"] + update_cols
                sets = ",".join(f"{c}=excluded.{c}" for c in update_cols)
                self.conn.execute(
                    f"INSERT INTO game_player_stats({','.join(cols)}) "
                    f"VALUES({','.join('?' * len(cols))}) "
                    f"ON CONFLICT(unique_line) DO UPDATE SET {sets}",
                    [values[c] for c in cols],
                )
                self._sr("game_player_stats", ul, ul, s(row.get("OverviewPage")), row)
                n += 1
        print(f"  game_player_stats: {n} 条", flush=True)
        return n

    # -- 溯源 --

    def _sr(self, record_type: str, source_key, source_id, overview, raw_row: dict):
        if source_key is None:
            return
        upsert(
            self.conn, "source_refs", ["record_type", "source", "source_key"],
            {
                "record_type": record_type,
                "record_id": self._record_id(record_type, source_key, source_id,
                                             overview),
                "source": "Leaguepedia_Cargo",
                "source_key": source_key,
                "fetched_at": None,
                "raw_json": json.dumps(raw_row, ensure_ascii=False),
            },
        )

    def _record_id(self, record_type: str, source_key, source_id, overview):
        table = {
            "tournaments": ("tournaments", "overview_page"),
            "series": ("series", "match_id_src"),
            "games": ("games", "game_id_src"),
            "game_player_stats": ("game_player_stats", "unique_line"),
            "players": ("players", "overview_page"),
        }[record_type]
        row = self.conn.execute(
            f"SELECT id FROM {table[0]} WHERE {table[1]}=?", (source_key,)
        ).fetchone()
        return row[0] if row else None


def _role_short(role: str) -> str:
    """Role 值可能是长描述，截取主位置词。"""
    if not role:
        return None
    for key in ("Top", "Jungle", "Mid", "Bot", "Support"):
        if role.lower().startswith(key.lower()):
            return key
    return role


def _split_list(raw: str) -> list:
    """Cargo 列表字段原文按逗号拆开（wikilink 内的逗号已由 Cargo 分隔符机制处理）。"""
    return [x.strip() for x in (raw or "").split(",") if x.strip()]


# ---------- 源数据修正 ----------

FIX_ALLOWED_FIELDS = {
    "score1_after", "score2_after", "game_no", "gamename",
    "win_team_side", "completeness", "patch",
}
SERIES_FIX_ALLOWED_FIELDS = {"score1", "score2", "best_of"}


def apply_data_fixes(loader: "Loader") -> int:
    """应用 data/fixes/*.json 中的受控修正（幂等）。

    - game_updates: 对已入库 games 行的指定字段做 UPDATE；
    - game_inserts: 源站缺行时补「壳行」（胜负/比分由系列结果唯一确定），
      时长/BP 等未知字段留空，completeness=0；
    - game_imports: 从其它渠道补全整局（更新小局字段/BP/队伍统计/选手数据）。
    """
    n = 0
    for fpath in sorted((config.ROOT / "data" / "fixes").glob("*.json")):
        spec = json.loads(fpath.read_text(encoding="utf-8"))
        n += _apply_fix_spec(loader, spec, fpath.name)
    if n:
        print(f"  data_fixes: 应用 {n} 条受控修正", flush=True)
    return n


def _apply_fix_spec(loader: "Loader", spec: dict, fname: str) -> int:
    conn = loader.conn
    n = 0

    for item in spec.get("series_updates", []):
        key, field = item["target_key"], item["field"]
        if field not in SERIES_FIX_ALLOWED_FIELDS:
            raise ValueError(f"非法系列修正字段: {field}")
        exists = conn.execute(
            "SELECT id FROM series WHERE match_id_src=?", (key,)
        ).fetchone()
        if not exists:
            print(f"  ! 系列修正目标不存在，跳过: {key}", flush=True)
            continue
        conn.execute(
            f"UPDATE series SET {field}=? WHERE match_id_src=?",
            (item["fixed_value"], key),
        )
        conn.execute(
            "INSERT OR IGNORE INTO data_fixes"
            "(target_type, target_key, action, field, fixed_value, reason) "
            "VALUES('series', ?, 'update', ?, ?, ?)",
            (key, field, json.dumps(item["fixed_value"]), item.get("reason")),
        )
        n += 1

    for item in spec.get("game_updates", []):
        key, field = item["target_key"], item["field"]
        if field not in FIX_ALLOWED_FIELDS:
            raise ValueError(f"非法修正字段: {field}")
        exists = conn.execute(
            "SELECT id FROM games WHERE game_id_src=?", (key,)
        ).fetchone()
        if not exists:
            print(f"  ! 修正目标不存在，跳过: {key}", flush=True)
            continue
        conn.execute(
            f"UPDATE games SET {field}=? WHERE game_id_src=?",
            (item["fixed_value"], key),
        )
        conn.execute(
            "INSERT OR IGNORE INTO data_fixes"
            "(target_type, target_key, action, field, fixed_value, reason) "
            "VALUES('game', ?, 'update', ?, ?, ?)",
            (key, field, json.dumps(item["fixed_value"]), item.get("reason")),
        )
        n += 1

    for item in spec.get("game_inserts", []):
        key = item["game_id_src"]
        exists = conn.execute(
            "SELECT id FROM games WHERE game_id_src=?", (key,)
        ).fetchone()
        if exists:
            continue
        sid = conn.execute(
            "SELECT id FROM series WHERE match_id_src=?", (item["match_id_src"],)
        ).fetchone()
        t1 = loader.team_id(item["team1"])
        t2 = loader.team_id(item["team2"])
        conn.execute(
            "INSERT OR IGNORE INTO games"
            "(game_id_src, series_id, match_id_src, tournament_id, overview_page, "
            "game_no, gamename, team1_id, team2_id, win_team_side, "
            "score1_after, score2_after, completeness) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                key,
                sid[0] if sid else None,
                item["match_id_src"],
                loader._tournament_id(item.get("overview_page")),
                item.get("overview_page"),
                item.get("game_no"),
                item.get("gamename"),
                t1, t2,
                item.get("win_team_side"),
                item.get("score1_after"), item.get("score2_after"),
                item.get("completeness", 0),
            ),
        )
        conn.execute(
            "INSERT OR IGNORE INTO source_refs(record_type, record_id, source, "
            "source_key, raw_json) VALUES('games', "
            "(SELECT id FROM games WHERE game_id_src=?), 'manual_fix', ?, ?)",
            (key, key, json.dumps(item, ensure_ascii=False)),
        )
        conn.execute(
            "INSERT OR IGNORE INTO data_fixes(target_type, target_key, action, reason) "
            "VALUES('game', ?, 'insert', ?)",
            (key, item.get("reason")),
        )
        n += 1

    for item in spec.get("game_imports", []):
        key = item["game_id_src"]
        gid_row = conn.execute(
            "SELECT id, team1_id FROM games WHERE game_id_src=?", (key,)
        ).fetchone()
        if not gid_row:
            print(f"  ! 导入目标小局不存在，跳过: {key}", flush=True)
            continue
        gid = gid_row[0]

        # 1) 小局字段更新
        updates: dict = {"completeness": 1}
        if item.get("game_length_min") is not None:
            updates["game_length_min"] = item["game_length_min"]
        for f in ("game_length_text", "datetime_utc", "patch"):
            if item.get(f) is not None:
                updates[f] = item[f]
        conn.execute(
            "UPDATE games SET " + ",".join(f"{f}=?" for f in updates)
            + " WHERE id=?",
            [*updates.values(), gid],
        )

        # 2) BP 补缺（已有 BP 则不覆盖——wiki 的 pick 顺序更完整；ban 有顺序，pick 顺序未知→slot NULL）
        n_pb = conn.execute(
            "SELECT COUNT(*) FROM picks_bans WHERE game_id=?", (gid,)
        ).fetchone()[0]
        if n_pb == 0:
            for side_key, side in item.get("sides", {}).items():
                team_id = loader.team_id(side["team"])
                for slot, name in enumerate(side.get("bans", []), start=1):
                    cid = loader.champ_id_by_page(name)
                    conn.execute(
                        "INSERT INTO picks_bans"
                        "(game_id, team_id, side, phase, slot, champion_id) "
                        "VALUES(?,?,?,?,?,?)",
                        (gid, team_id, int(side_key), "ban", slot, cid),
                    )
                for name in side.get("picks", []):
                    cid = loader.champ_id_by_page(name)
                    conn.execute(
                        "INSERT INTO picks_bans"
                        "(game_id, team_id, side, phase, slot, champion_id) "
                        "VALUES(?,?,?,?,?,?)",
                        (gid, team_id, int(side_key), "pick", None, cid),
                    )

        # 3) 队伍统计（仅补缺/对齐击杀，不删已有数据）
        for side_key, kills in item.get("kills_by_side", {}).items():
            team_name = item["sides"][str(side_key)]["team"]
            row = conn.execute(
                "SELECT id FROM game_team_stats WHERE game_id=? AND side=?",
                (gid, int(side_key)),
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE game_team_stats SET kills=? WHERE id=?",
                    (kills, row[0]),
                )
            else:
                conn.execute(
                    "INSERT INTO game_team_stats(game_id, team_id, side, kills) "
                    "VALUES(?,?,?,?)",
                    (gid, loader.team_id(team_name), int(side_key), kills),
                )

        # 4) 选手数据（已有选手行则不覆盖）
        n_gps = conn.execute(
            "SELECT COUNT(*) FROM game_player_stats WHERE game_id=?", (gid,)
        ).fetchone()[0]
        if n_gps == 0:
            role_map = {"top": "Top", "jng": "Jungle", "mid": "Mid",
                        "bot": "Bot", "sup": "Support"}
            role_no = {"top": 1, "jng": 2, "mid": 3, "bot": 4, "sup": 5}
            for p in item.get("players", []):
                pid = loader.player_id_by_link(p["player"])
                cid = (
                    loader.champ_id_by_page(p["champion"])
                    if p.get("champion") else None
                )
                conn.execute(
                    "INSERT INTO game_player_stats(unique_line, game_id, player_id, "
                    "link_used, team_id, side, role, role_number, champion_id, "
                    "kills, deaths, assists, gold, cs) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        f"{key}|{p['player']}", gid, pid, p["player"],
                        loader.team_id(p["team"]), int(p["side"]),
                        role_map.get(p["role"]), role_no.get(p["role"]),
                        cid, p.get("kills"), p.get("deaths"), p.get("assists"),
                        p.get("gold"), p.get("cs"),
                    ),
                )
        conn.execute(
            "INSERT OR IGNORE INTO data_fixes(target_type, target_key, action, reason) "
            "VALUES('game', ?, 'import', ?)",
            (key, item.get("reason")),
        )
        n += 1

    return n


# ---------- 入口 ----------

def run() -> dict:
    """按依赖顺序执行全部加载阶段，返回各表计数。"""
    counts = {}
    with init_db() as conn:
        loader = Loader(conn)
        counts["champions"] = loader.load_champions()
        counts["leagues_tournaments"] = loader.load_leagues_tournaments()
        counts["series"] = loader.load_series()
        n_g, n_pb, n_ts = loader.load_games()
        counts.update(games=n_g, picks_bans=n_pb, game_team_stats=n_ts)
        counts["data_fixes"] = apply_data_fixes(loader)
        counts["game_player_stats"] = loader.load_game_player_stats()
        counts["players"] = loader.load_players_and_redirects()
        conn.commit()
    return counts


def summary(conn: sqlite3.Connection) -> str:
    tables = [
        "leagues", "tournaments", "teams", "players", "player_aliases",
        "series", "games", "picks_bans", "game_team_stats",
        "game_player_stats", "champions", "media_assets", "source_refs",
    ]
    lines = []
    for t in tables:
        n = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        lines.append(f"  {t:<22}{n:>8}")
    return "\n".join(lines)