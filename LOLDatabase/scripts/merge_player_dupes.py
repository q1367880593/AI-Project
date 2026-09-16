"""合并同一选手的重复档案（大小写变体 / "ID (全名)" 变体）。

Leaguepedia 的 Link 存在大小写不一致与带全名后缀的形式，加载时被拆成
多条 players 行，导致选手统计被切分（如 Knight 拆成 2 条，击杀数少一半）。

判定：player_id 大小写折叠并去掉 "(...)" 后缀后同组；
组内 native_name 冲突（非空且不同）视为不同人，跳过。
合并目标为出场局数最多的档案；其余档案的比赛记录、别名、头像并入，
并登记 data_fixes 保证幂等。

用法:
    .venv/bin/python scripts/merge_player_dupes.py [--dry-run]
"""

import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import config
from collectors.load import init_db


def norm_key(pid: str) -> str:
    return re.sub(r"\s*\(.*\)\s*$", "", pid).casefold()


def merge_one(conn, key: str, rows: list) -> tuple[int, int]:
    """合并一个组；返回 (并入的比赛行数, 并入档案数)。"""
    stats = []
    for pid, pkey, native in rows:
        g = conn.execute(
            "SELECT COUNT(*) FROM game_player_stats WHERE player_id=?", (pid,)
        ).fetchone()[0]
        stats.append((pid, pkey, native, g))
    active = [s for s in stats if s[3] > 0]
    if len(active) < 2:
        active = stats  # 只有一个有比赛：仍需把 0 局档案并入
    # 主档案：局数最多 → 有本名 → 无括号 ID
    main = max(
        active,
        key=lambda s: (s[3], bool(s[2]), "(" not in (s[1] or "")),
    )
    merged_games = 0
    merged_rows = 0
    for pid, pkey, native, games in stats:
        if pid == main[0]:
            continue
        merged_rows += 1
        merged_games += games
        # 1) 比赛记录并入主档案
        conn.execute(
            "UPDATE game_player_stats SET player_id=? WHERE player_id=?",
            (main[0], pid),
        )
        conn.execute(
            "UPDATE series SET mvp_player_id=? WHERE mvp_player_id=?",
            (main[0], pid),
        )
        conn.execute(
            "UPDATE tenures SET player_id=? WHERE player_id=?", (main[0], pid)
        )
        # 2) 别名迁移（去重）+ 子档案 ID 本身登记为别名
        conn.execute(
            "DELETE FROM player_aliases WHERE player_id=? "
            "AND alias IN (SELECT alias FROM player_aliases WHERE player_id=?)",
            (pid, main[0]),
        )
        conn.execute(
            "UPDATE player_aliases SET player_id=? WHERE player_id=?", (main[0], pid)
        )
        exists = conn.execute(
            "SELECT 1 FROM player_aliases WHERE player_id=? AND alias=?",
            (main[0], pkey),
        ).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO player_aliases(player_id, alias, source) "
                "VALUES(?,?, 'merge')",
                (main[0], pkey),
            )
        # 3) 头像/媒体并入（主档案同年已有照片时弃子保主）
        child_media = conn.execute(
            "SELECT id, kind, year FROM media_assets "
            "WHERE entity_type='player' AND entity_id=?", (pid,)
        ).fetchall()
        for mid, kind, year in child_media:
            clash = conn.execute(
                "SELECT 1 FROM media_assets WHERE entity_type='player' "
                "AND entity_id=? AND kind=? AND year IS ?",
                (main[0], kind, year),
            ).fetchone()
            if clash:
                conn.execute("DELETE FROM media_assets WHERE id=?", (mid,))
            else:
                conn.execute(
                    "UPDATE media_assets SET entity_id=? WHERE id=?", (main[0], mid)
                )
        # 4) 档案字段补全 + 删除子档案
        for col in ("name", "native_name", "country", "birthdate", "role", "team_last"):
            val = conn.execute(f"SELECT {col} FROM players WHERE id=?", (pid,)).fetchone()[0]
            if val:
                conn.execute(
                    f"UPDATE players SET {col}=COALESCE(NULLIF({col},''), ?) WHERE id=?",
                    (val, main[0]),
                )
        conn.execute("DELETE FROM players WHERE id=?", (pid,))
        # 5) data_fixes 登记（幂等）
        conn.execute(
            "INSERT OR IGNORE INTO data_fixes(target_type, target_key, action, field, fixed_value) "
            "VALUES('player_merge', ?, 'player_merge', ?, ?)",
            (key, pkey, str(main[0])),
        )
    return merged_games, merged_rows


def main() -> int:
    dry = "--dry-run" in sys.argv
    conn = init_db()
    groups = defaultdict(list)
    for pid, pkey, native in conn.execute(
        "SELECT id, player_id, native_name FROM players"
    ):
        groups[norm_key(pkey)].append((pid, pkey, native))

    conflicts = []
    total_games = total_rows = total_groups = 0
    for key, rows in groups.items():
        if len(rows) < 2:
            continue
        names = {n for _, _, n in rows if n}
        if len(names) > 1:
            conflicts.append((key, rows))
            continue
        total_groups += 1
        if not dry:
            g, r = merge_one(conn, key, rows)
            total_games += g
            total_rows += r
    if conflicts:
        print(f"⚠ 名字冲突未合并（疑似不同人）：")
        for key, rows in conflicts:
            print("   ", key, [(p, n) for _, p, n in rows])
    print(f"== {'模拟' if dry else '实际'}合并：{total_groups} 组，"
          f"并入比赛 {total_games} 行，删除档案 {total_rows} 条 ==")
    if not dry:
        conn.commit()
        print("校验 Knight：")
        for r in conn.execute(
            "SELECT p.player_id, COUNT(*), SUM(gps.kills), SUM(gps.deaths), "
            "SUM(gps.assists) "
            "FROM game_player_stats gps JOIN players p ON p.id=gps.player_id "
            "WHERE lower(p.player_id) LIKE 'knight%' GROUP BY p.id"
        ):
            print("   ", r)
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())