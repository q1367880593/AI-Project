"""LOL 数据库查询 API（FastAPI，只读 SQLite）。

组合查询入口: /api/series（赛段/队伍/选手/年份筛选 + 分页）。
"""

import json
import re
import sqlite3
import subprocess
import sys
import threading
from contextlib import closing
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from collectors import config

app = FastAPI(title="LOL Database API")

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
ASSET_DIR = ROOT / "assets" / "images"


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{config.DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def rows(sql: str, params: tuple = ()) -> list[dict]:
    with closing(db()) as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def one(sql: str, params: tuple = ()) -> dict | None:
    with closing(db()) as conn:
        r = conn.execute(sql, params).fetchone()
        return dict(r) if r else None


def scalar(sql: str, params: tuple = ()):
    with closing(db()) as conn:
        r = conn.execute(sql, params).fetchone()
        return r[0] if r else None


# ---------- 工具 ----------

MEDIA_SQL = {
    "team": "SELECT local_path FROM media_assets WHERE entity_type='team' AND entity_id=? AND kind='logo' AND is_active=1",
    # 选手头像优先取最新年份的定妆照，无年代照时回退默认照
    "player": "SELECT local_path FROM media_assets WHERE entity_type='player' AND entity_id=? AND kind='photo' AND is_active=1 ORDER BY (year IS NOT NULL) DESC, year DESC LIMIT 1",
}


def _media(kind: str, entity_id) -> str | None:
    path = scalar(MEDIA_SQL[kind], (entity_id,))
    if not path:
        return None
    return "/images/" + path.replace("assets/images/", "", 1)


def _team_brief(tid) -> dict | None:
    if tid is None:
        return None
    r = one("SELECT id, name, short_name FROM teams WHERE id=?", (tid,))
    if not r:
        return None
    r["logo"] = _media("team", tid)
    return r


def _champion(cid) -> dict | None:
    if cid is None:
        return None
    r = one("SELECT id, name, name_cn, key_integer FROM champions WHERE id=?", (cid,))
    if not r:
        return None
    r["icon"] = f"/images/champions/icons/{cid}.png" if r["key_integer"] else None
    return r


# ---------- 元数据 ----------

@app.get("/api/overview")
def overview():
    return {
        "tournaments": scalar("SELECT COUNT(*) FROM tournaments"),
        "series": scalar("SELECT COUNT(*) FROM series"),
        "games": scalar("SELECT COUNT(*) FROM games"),
        "players": scalar("SELECT COUNT(*) FROM players"),
        "teams": scalar("SELECT COUNT(*) FROM teams"),
        "champions": scalar("SELECT COUNT(*) FROM champions"),
        "years": [r["y"] for r in rows(
            "SELECT DISTINCT substr(year,1,4) AS y FROM tournaments "
            "WHERE year IS NOT NULL ORDER BY y DESC"
        )],
        "latest_game_date": scalar(
            "SELECT MAX(datetime_utc) FROM games WHERE datetime_utc IS NOT NULL"
        ),
    }


@app.get("/api/tournaments")
def tournaments(year: str | None = None, scope: str | None = None):
    sql = (
        "SELECT t.id, t.name, t.overview_page, t.year, t.split, "
        "t.is_playoffs, t.date_start, t.date_end, "
        "l.short_name AS league_short, l.is_international, "
        "(SELECT COUNT(*) FROM series s WHERE s.tournament_id=t.id) AS series_count, "
        "(SELECT COUNT(*) FROM games g WHERE g.tournament_id=t.id) AS games_count "
        "FROM tournaments t JOIN leagues l ON l.id=t.league_id"
    )
    where, params = [], []
    if year:
        where.append("substr(t.year,1,4)=?")
        params.append(year)
    if scope == "intl":
        where.append("l.is_international=1")
    elif scope:
        # 具体联赛名（LPL/LCK/LEC/LCS）
        where.append("l.name=?")
        params.append(scope)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY t.date_start, t.id"
    result = rows(sql, tuple(params))
    for r in result:
        r["name_cn"] = _cn(r.get("name") or "") or None
    return result


@app.get("/api/teams")
def teams(tournament_id: int | None = None):
    base = (
        "SELECT t.id, t.name, t.short_name, t.region, "
        "(SELECT COUNT(*) FROM series s WHERE s.team1_id=t.id OR s.team2_id=t.id) AS series_count, "
        "(SELECT COUNT(*) FROM series s WHERE s.winner_id=t.id) AS win_count "
        "FROM teams t"
    )
    params: tuple = ()
    if tournament_id:
        base = (
            "SELECT t.id, t.name, t.short_name, t.region, "
            "(SELECT COUNT(*) FROM series s WHERE s.tournament_id=? AND (s.team1_id=t.id OR s.team2_id=t.id)) AS series_count, "
            "(SELECT COUNT(*) FROM series s WHERE s.tournament_id=? AND s.winner_id=t.id) AS win_count "
            "FROM teams t"
        )
        params = (tournament_id, tournament_id)
    result = rows(base + " ORDER BY t.id", params)
    for r in result:
        r["logo"] = _media("team", r["id"])
    return result


@app.get("/api/players")
def players(
    q: str | None = None,
    team_id: int | None = None,
    limit: int = Query(default=50, le=200),
):
    sql = (
        "SELECT p.id, p.player_id, p.name, p.native_name, p.country, p.role, "
        "p.team_last, p.is_retired, "
        "(SELECT COUNT(*) FROM game_player_stats g WHERE g.player_id=p.id) AS games_count "
        "FROM players p"
    )
    where, params = [], []
    if q:
        where.append(
            "(p.name LIKE ? OR p.native_name LIKE ? OR p.player_id LIKE ? "
            "OR p.id IN (SELECT player_id FROM player_aliases WHERE alias LIKE ?))"
        )
        like = f"%{q}%"
        params += [like, like, like, like]
    if team_id:
        where.append(
            "p.id IN (SELECT DISTINCT gps.player_id FROM game_player_stats gps "
            "JOIN games g ON g.id=gps.game_id "
            "JOIN series s ON s.id=g.series_id WHERE s.team1_id=? OR s.team2_id=?)"
        )
        params += [team_id, team_id]
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY p.native_name IS NULL, p.id LIMIT ?"
    params.append(limit)
    result = rows(sql, tuple(params))
    for r in result:
        r["photo"] = _media("player", r["id"])
    return result


# ---------- 系列赛 ----------

# 赛段/阶段英文 → 中文（长词优先，忽略大小写）
TOURNAMENT_NAME_CN = (
    ("China Regional Finals", "LPL 区域资格赛"),
    ("Regional Finals", "区域资格赛"),
    ("First Stand", "全球先锋赛"),
    ("Mid-Season Invitational", "季中冠军赛"),
    ("Mid-Season Cup", "季中杯"),
    ("Rift Rivals", "洲际对抗赛"),
    ("World Championship", "全球总决赛"),
    ("Grand Finals", "总决赛"),
    ("Main Event", "正赛"),
    ("Play-In", "入围赛"),
    ("Group Stage", "小组赛"),
    ("Knockout Stage", "淘汰赛"),
    ("Swiss Stage", "瑞士轮"),
    ("Regular Season", "常规赛"),
    ("Summer Playoffs", "夏季赛 季后赛"),
    ("Spring Playoffs", "春季赛 季后赛"),
    ("Winter Playoffs", "冬季赛 季后赛"),
    ("Summer Season", "夏季赛"),
    ("Spring Season", "春季赛"),
    ("Winter Season", "冬季赛"),
    ("Summer Split", "夏季赛"),
    ("Spring Split", "春季赛"),
    ("Summer", "夏季赛"),
    ("Spring", "春季赛"),
    ("Winter", "冬季赛"),
    ("Split 1", "第一赛段"),
    ("Split 2", "第二赛段"),
    ("Split 3", "第三赛段"),
    ("Promotion Tournament", "升降级赛"),
    ("Promotion", "升降级赛"),
    ("Playoffs", "季后赛"),
    ("Qualifying Series", "资格赛"),
    ("Qualifier", "资格赛"),
    ("Qualifiers", "资格赛"),
    ("Worlds", "全球总决赛"),
    ("MSI", "季中冠军赛"),
    ("Finals", "决赛"),
    ("Final", "决赛"),
    ("Split", "赛段"),
    ("Season", "赛季"),
)

# 阶段词（Round Robin / 八强 / 半决赛 / 季军赛等）
PHASE_CN = (
    ("Round Robin", "循环赛"),
    ("Third-Place Match", "季军赛"),
    ("Third Place", "季军赛"),
    ("Quarterfinals", "八强赛"),
    ("Quarterfinal", "八强赛"),
    ("Semifinals", "半决赛"),
    ("Semifinal", "半决赛"),
    ("Tiebreaker", "加赛"),
)


def _cn(text: str) -> str:
    """英文赛段名 → 中文（长词优先，忽略大小写）。"""
    if not text:
        return text or ""
    out = str(text)
    out = re.sub(r"\bRound\s+(\d+)\b", r"第 \1 轮", out, flags=re.IGNORECASE)
    out = re.sub(r"\bMatch\s+(\d+)\b", r"第 \1 场", out, flags=re.IGNORECASE)
    out = re.sub(r"\bGame\s+(\d+)\b", r"第 \1 局", out, flags=re.IGNORECASE)
    out = re.sub(r"\bDay\s+(\d+)\b", r"第 \1 天", out, flags=re.IGNORECASE)
    for en, zh in PHASE_CN + TOURNAMENT_NAME_CN:
        out = re.sub(re.escape(en), zh, out, flags=re.IGNORECASE)
    return out


def _phase_cn(text: str) -> str:
    """阶段/轮次名 → 中文；无法映射时返回空串（前端回退原文）。"""
    if not text:
        return ""
    cn = _cn(text)
    return cn if cn != str(text) else ""


SERIES_BRIEF = (
    "SELECT s.id, s.start_time_utc, s.best_of, s.phase, s.shown_round, s.patch, "
    "s.score1, s.score2, s.winner_id, s.overview_page, "
    "t.id AS tournament_id, t.name AS tournament_name, t.year AS tournament_year, "
    "l.short_name AS league_short, l.is_international AS league_intl, "
    "s.team1_id, s.team2_id, "
    "(SELECT COUNT(*) FROM games g WHERE g.series_id=s.id) AS game_count "
    "FROM series s JOIN tournaments t ON t.id=s.tournament_id "
    "JOIN leagues l ON l.id=t.league_id"
)


def _series_briefs(sql: str, params: tuple) -> list[dict]:
    result = rows(sql, params)
    for r in result:
        t1 = r.pop("team1_id")
        t2 = r.pop("team2_id")
        r["team1"] = _team_brief(t1)
        r["team2"] = _team_brief(t2)
        r["tournament_name_cn"] = _cn(r.get("tournament_name") or "") or None
        r["phase_cn"] = _phase_cn(
            r.get("shown_round") or r.get("phase") or ""
        ) or None
    return result


@app.get("/api/series")
def series(
    tournament_id: int | None = None,
    team_id: int | None = None,
    player_id: int | None = None,
    year: int | None = None,
    scope: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    where, params = [], []
    if tournament_id:
        where.append("s.tournament_id=?")
        params.append(tournament_id)
    if team_id:
        where.append("(s.team1_id=? OR s.team2_id=?)")
        params += [team_id, team_id]
    if player_id:
        where.append(
            "EXISTS (SELECT 1 FROM game_player_stats gps "
            "JOIN games g ON g.id=gps.game_id "
            "WHERE g.series_id=s.id AND gps.player_id=?)"
        )
        params.append(player_id)
    if year:
        where.append("substr(t.year,1,4)=?")
        params.append(str(year))
    if scope == "intl":
        where.append("l.is_international=1")
    elif scope:
        where.append("l.name=?")
        params.append(scope)
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    join_sql = (
        " FROM series s JOIN tournaments t ON t.id=s.tournament_id "
        "JOIN leagues l ON l.id=t.league_id"
    )
    total = scalar(f"SELECT COUNT(*) {join_sql}{where_sql}", tuple(params))
    sql = (
        SERIES_BRIEF + where_sql +
        " ORDER BY (s.winner_id IS NULL) ASC, "
        "s.start_time_utc IS NULL ASC, s.start_time_utc DESC, s.id DESC "
        "LIMIT ? OFFSET ?"
    )
    items = _series_briefs(sql, (*params, page_size, (page - 1) * page_size))
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@app.get("/api/series/{sid}")
def series_detail(sid: int):
    r = one(SERIES_BRIEF + " WHERE s.id=?", (sid,))
    if not r:
        raise HTTPException(404, "系列不存在")
    brief = _series_briefs(SERIES_BRIEF + " WHERE s.id=?", (sid,))[0]

    # 召唤师技能 / 装备 / 饰品图标（icon_assets 名称 → 本地路径，整请求查一次）
    icon_map = {
        (r["kind"], r["name"]): r["local_path"]
        for r in rows("SELECT kind, name, local_path FROM icon_assets")
    }

    # 选手头像：年代定妆照（≤对局年份的最近一张）+ 无年份默认照回退
    photo_by_year: dict[int, dict[int, str]] = {}
    photo_default: dict[int, str] = {}
    for r in rows(
        "SELECT entity_id, year, local_path FROM media_assets "
        "WHERE entity_type='player' AND kind='photo' AND is_active=1"
    ):
        if r["year"]:
            photo_by_year.setdefault(r["entity_id"], {})[r["year"]] = r["local_path"]
        else:
            photo_default.setdefault(r["entity_id"], r["local_path"])

    def _photo_path(pid, year):
        by_y = photo_by_year.get(pid)
        if by_y and year:
            cand = [y for y in by_y if y <= year]
            if cand:
                return by_y[max(cand)]
        return photo_default.get(pid)

    games = []
    for g in rows(
        "SELECT id, game_no, gamename, win_team_side, score1_after, score2_after, "
        "game_length_min, patch, completeness, datetime_utc FROM games WHERE series_id=? "
        "ORDER BY game_no, id",
        (sid,),
    ):
        gid = g["id"]
        m_year = re.search(r"(20\d{2})", str(g.get("datetime_utc") or ""))
        game_year = int(m_year.group(1)) if m_year else None
        sides = {}
        for side_no in (1, 2):
            team_id = scalar(
                f"SELECT team{side_no}_id FROM games WHERE id=?", (gid,)
            )
            bans = rows(
                "SELECT pb.slot, pb.champion_id FROM picks_bans pb "
                "WHERE pb.game_id=? AND pb.side=? AND pb.phase='ban' ORDER BY pb.slot",
                (gid, side_no),
            )
            picks = rows(
                "SELECT pb.slot, pb.champion_id FROM picks_bans pb "
                "WHERE pb.game_id=? AND pb.side=? AND pb.phase='pick' ORDER BY pb.slot",
                (gid, side_no),
            )
            team_stats = one(
                "SELECT kills, gold, towers, barons, dragons_total FROM game_team_stats "
                "WHERE game_id=? AND side=?",
                (gid, side_no),
            )
            sides[str(side_no)] = {
                "team": _team_brief(team_id),
                "bans": [
                    {**b, "champion": _champion(b["champion_id"])} for b in bans
                ],
                "picks": [
                    {**p, "champion": _champion(p["champion_id"])} for p in picks
                ],
                "stats": team_stats,
            }
        players = rows(
            "SELECT gps.id, gps.player_id, gps.link_used, gps.side, gps.role, "
            "gps.role_number, gps.champion_id, gps.kills, gps.deaths, gps.assists, "
            "gps.gold, gps.cs, gps.summoner_spells, gps.items, gps.trinket, "
            "p.native_name, p.name, p.player_id AS pkey "
            "FROM game_player_stats gps LEFT JOIN players p ON p.id=gps.player_id "
            "WHERE gps.game_id=? ORDER BY gps.side, gps.role_number",
            (gid,),
        )
        for p in players:
            p["champion"] = _champion(p.pop("champion_id"))
            ppath = _photo_path(p["player_id"], game_year)
            p["photo"] = (
                "/images/" + ppath.replace("assets/images/", "", 1) if ppath else None
            )

        def _ui(path):
            return "/images/" + path.replace("assets/images/", "", 1) if path else None

        for p in players:
            spells = []
            for x in (p.get("summoner_spells") or "").split(","):
                x = x.strip()
                if x:
                    spells.append({"name": x, "icon": _ui(icon_map.get(("spell", x)))})
            p["spells"] = spells
            pitems = []
            for x in (p.get("items") or "").split(";"):
                x = x.strip()
                if x:
                    pitems.append({"name": x, "icon": _ui(icon_map.get(("item", x)))})
            p["items_icons"] = pitems
            tri = (p.get("trinket") or "").strip()
            p["trinket_icon"] = (
                {"name": tri, "icon": _ui(icon_map.get(("item", tri)))} if tri else None
            )
        games.append({**g, "sides": sides, "players": players})

    brief["games"] = games
    return brief


# ---------- 选手 / 队伍详情 ----------

@app.get("/api/players/{pid}")
def player_detail(pid: str):
    """pid 可为数字主键或选手 ID 文本（如 'TheShy'，含别名解析）。"""
    if pid.isdigit():
        pid_int = int(pid)
    else:
        r = one(
            "SELECT id FROM players WHERE player_id=? "
            "UNION SELECT player_id FROM player_aliases WHERE alias=? LIMIT 1",
            (pid, pid),
        )
        pid_int = r["id"] if r else None
    p = one(
        "SELECT id, player_id, name, native_name, name_full, country, birthdate, "
        "age, role, team_last, is_retired, image FROM players WHERE id=?",
        (pid_int,),
    )
    if not p:
        raise HTTPException(404, "选手不存在")
    p["photo"] = _media("player", pid_int)
    p["aliases"] = [
        r["alias"]
        for r in rows(
            "SELECT alias FROM player_aliases WHERE player_id=? ORDER BY alias", (pid_int,)
        )
    ]
    agg = one(
        "SELECT COUNT(*) AS games, SUM(kills) AS kills, SUM(deaths) AS deaths, "
        "SUM(assists) AS assists, "
        "SUM(CASE WHEN player_win=1 THEN 1 ELSE 0 END) AS wins "
        "FROM game_player_stats WHERE player_id=?",
        (pid_int,),
    )
    champs = rows(
        "SELECT c.id, c.name, c.name_cn, COUNT(*) AS cnt, "
        "SUM(CASE WHEN gps.player_win=1 THEN 1 ELSE 0 END) AS wins "
        "FROM game_player_stats gps JOIN champions c ON c.id=gps.champion_id "
        "WHERE gps.player_id=? GROUP BY c.id ORDER BY cnt DESC LIMIT 12",
        (pid_int,),
    )
    for c in champs:
        c["icon"] = f"/images/champions/icons/{c['id']}.png"
    yearly = rows(
        "SELECT substr(t.year,1,4) AS year, COUNT(*) AS games, "
        "SUM(CASE WHEN gps.player_win=1 THEN 1 ELSE 0 END) AS wins "
        "FROM game_player_stats gps JOIN games g ON g.id=gps.game_id "
        "JOIN tournaments t ON t.id=g.tournament_id WHERE gps.player_id=? "
        "GROUP BY year ORDER BY year",
        (pid_int,),
    )
    p["agg"] = agg
    p["champions"] = champs
    p["yearly"] = yearly
    return p


@app.get("/api/teams/{tid}")
def team_detail(tid: int):
    t = one(
        "SELECT id, name, short_name, region, location, renamed_to, is_disbanded "
        "FROM teams WHERE id=?",
        (tid,),
    )
    if not t:
        raise HTTPException(404, "队伍不存在")
    t["logo"] = _media("team", tid)
    t["agg"] = one(
        "SELECT "
        "(SELECT COUNT(*) FROM series WHERE team1_id=? OR team2_id=?) AS series, "
        "(SELECT COUNT(*) FROM series WHERE winner_id=?) AS wins",
        (tid, tid, tid),
    )
    yearly = rows(
        "SELECT substr(tt.year,1,4) AS year, COUNT(*) AS series, "
        "SUM(CASE WHEN s.winner_id=? THEN 1 ELSE 0 END) AS wins "
        "FROM series s JOIN tournaments tt ON tt.id=s.tournament_id "
        "WHERE s.team1_id=? OR s.team2_id=? GROUP BY year ORDER BY year",
        (tid, tid, tid),
    )
    t["yearly"] = yearly
    return t


# ---------- 选手排行 ----------

# 排序维度 → 聚合别名（SQL 里同名输出列，ORDER BY 用别名，白名单防注入）
RANK_SORTS = {
    "games": "games",
    "wins": "wins",
    "winrate": "winrate",
    "kills": "kills",
    "deaths": "deaths",
    "assists": "assists",
    "kda": "kda",
    "pentakills": "pentakills",
    "mvp": "mvp",
    "avg_kills": "avg_kills",
    "avg_gold": "avg_gold",
    "avg_cs": "avg_cs",
    "avg_damage": "avg_damage",
}

RANK_AGG = (
    "COUNT(gps.id) AS games, "
    "SUM(CASE WHEN gps.player_win=1 THEN 1 ELSE 0 END) AS wins, "
    "ROUND(100.0 * SUM(CASE WHEN gps.player_win=1 THEN 1 ELSE 0 END) "
    "/ COUNT(gps.id), 1) AS winrate, "
    "SUM(gps.kills) AS kills, SUM(gps.deaths) AS deaths, "
    "SUM(gps.assists) AS assists, "
    "CASE WHEN SUM(gps.deaths)=0 THEN NULL "
    "ELSE ROUND((SUM(gps.kills)+SUM(gps.assists))*1.0/SUM(gps.deaths), 2) END AS kda, "
    "SUM(gps.pentakills) AS pentakills, "
    "(SELECT COUNT(*) FROM series s WHERE s.mvp_player_id=p.id) AS mvp, "
    "ROUND(AVG(gps.kills), 2) AS avg_kills, "
    "ROUND(AVG(gps.gold), 0) AS avg_gold, "
    "ROUND(AVG(gps.cs), 1) AS avg_cs, "
    "ROUND(AVG(gps.damage_to_champions), 0) AS avg_damage, "
    "COUNT(DISTINCT gps.champion_id) AS champs "
)


@app.get("/api/player-rank")
def player_rank(
    sort: str = "games",
    order: str = "desc",
    scope: str | None = None,
    role: str | None = None,
    min_games: int = Query(default=10, ge=0, le=500),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    sort_col = RANK_SORTS.get(sort)
    if not sort_col:
        raise HTTPException(400, f"未知排序维度: {sort}")
    order = "ASC" if order.lower() == "asc" else "DESC"

    joins = ""
    where = []
    params: list = []
    if role:
        # 分路过滤：按比赛当时位置（Top/Jungle/Mid/Bot/Support）
        if role in ("Top", "Jungle", "Mid", "Bot", "Support"):
            where.append("gps.role=?")
            params.append(role)
    if scope == "intl":
        joins = (
            " JOIN games g ON g.id=gps.game_id "
            "JOIN tournaments t ON t.id=g.tournament_id "
            "JOIN leagues l ON l.id=t.league_id"
        )
        where.append("l.is_international=1")
    elif scope:
        joins = (
            " JOIN games g ON g.id=gps.game_id "
            "JOIN tournaments t ON t.id=g.tournament_id "
            "JOIN leagues l ON l.id=t.league_id"
        )
        where.append("l.name=?")
        params.append(scope)
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    base = (
        "SELECT p.id, p.player_id, p.native_name, p.name, p.country, p.role, "
        f"p.is_retired, {RANK_AGG} "
        "FROM game_player_stats gps JOIN players p ON p.id=gps.player_id"
        + joins + where_sql + " GROUP BY p.id"
    )
    total = scalar(
        f"SELECT COUNT(*) FROM ({base} HAVING games >= ?)", (*params, min_games)
    )
    items = rows(
        base + f" HAVING games >= ? ORDER BY {sort_col} {order}, games DESC, p.id "
        "LIMIT ? OFFSET ?",
        (*params, min_games, page_size, (page - 1) * page_size),
    )
    for r in items:
        r["photo"] = _media("player", r["id"])
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "sort": sort,
        "order": order.lower(),
        "items": items,
    }


# ---------- 增量同步 ----------

SYNC_STATUS_FILE = ROOT / "data" / "sync_status.json"
_sync_lock = threading.Lock()


def _sync_status_read() -> dict:
    try:
        return json.loads(SYNC_STATUS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _sync_status_write(status: dict):
    SYNC_STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SYNC_STATUS_FILE.write_text(
        json.dumps(status, ensure_ascii=False), encoding="utf-8"
    )


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _tail(r: subprocess.CompletedProcess) -> str:
    return ((r.stdout or "") + (r.stderr or ""))[-800:]


def _run_sync_job():
    """后台执行：scripts/sync_latest.py（增量拉取）→ scripts/load_lpl.py（入库）。"""
    try:
        _sync_status_write({
            "status": "running", "started_at": _now(),
            "message": "拉取最新数据…", "last_error": None,
        })
        r1 = subprocess.run(
            [sys.executable, "scripts/sync_latest.py"], cwd=ROOT,
            capture_output=True, text=True, timeout=7200,
        )
        if r1.returncode != 0:
            raise RuntimeError("增量拉取失败:\n" + _tail(r1))
        _sync_status_write({
            "status": "running", "started_at": _now(),
            "message": "数据入库中…", "last_error": None,
        })
        r2 = subprocess.run(
            [sys.executable, "scripts/load_lpl.py"], cwd=ROOT,
            capture_output=True, text=True, timeout=3600,
        )
        if r2.returncode != 0:
            raise RuntimeError("数据入库失败:\n" + _tail(r2))
        _sync_status_write({
            "status": "done", "finished_at": _now(),
            "message": "更新完成", "last_error": None,
        })
    except Exception as exc:  # noqa: BLE001 —— 后台线程兜底，状态供前端轮询
        _sync_status_write({
            "status": "error", "finished_at": _now(),
            "message": "更新失败", "last_error": str(exc)[-1000:],
        })


@app.post("/api/sync")
def trigger_sync():
    st = _sync_status_read()
    if st.get("status") == "running":
        raise HTTPException(409, "同步正在进行中")
    with _sync_lock:
        if _sync_status_read().get("status") == "running":
            raise HTTPException(409, "同步正在进行中")
        threading.Thread(target=_run_sync_job, daemon=True).start()
    return {"status": "started"}


@app.get("/api/sync/status")
def sync_status():
    st = _sync_status_read()
    st.setdefault("status", "idle")
    st["latest_game_date"] = scalar(
        "SELECT MAX(datetime_utc) FROM games WHERE datetime_utc IS NOT NULL"
    )
    return st


# ---------- 静态资源 ----------

app.mount("/images", StaticFiles(directory=ASSET_DIR), name="images")

if FRONTEND_DIR.exists():
    # 静态前端（含 /favicon.ico，位于 frontend/）
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")