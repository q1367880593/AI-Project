"""增量同步：从数据库「最新比赛日期」起回补数据（Leaguepedia Cargo）。

范围：date_start >= (最新比赛日期 - 14 天缓冲) 的赛段页，缓存强制失效后重拉
matchschedule / scoreboardgames / scoreboardplayers；新出现的选手 Link 走
增量选手档案批次（incr_ 缓存目录，不触碰全量批次）；英雄摘要顺带刷新。
结束后由调用方（API 后台线程）执行 scripts/load_lpl.py 入库。

用法:
    .venv/bin/python scripts/sync_latest.py [--dry]     # --dry 仅列出目标页面
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import communitydragon, config, stages

INCR_WINDOW_DAYS = 14  # 缓冲窗口：收尾中/刚结束/即将开始的赛段都覆盖


def _scope_of(overview: str) -> str:
    """OverviewPage → 采集范围（lpl / intl / regions），与加载器分类一致。"""
    ov = overview or ""
    if ov.startswith("LPL/"):
        return "lpl"
    for feat in (
        "World Championship", "Worlds Qualifying Series",
        "Mid-Season Invitational", "Mid-Season Cup",
        "Rift Rivals", "First Stand", "All-Star",
    ):
        if feat in ov:
            return "intl"
    return "regions"


def _snapshot(rows: list) -> str:
    """缓存行 → 稳定字符串（行序无关的内容对比，用于赛程变化检测）。"""
    return json.dumps(
        sorted(
            json.dumps(
                {str(k): str(v or "") for k, v in r.items()},
                sort_keys=True, ensure_ascii=False,
            )
            for r in rows
        ),
        ensure_ascii=False,
    )


def _dry() -> int:
    """只读预览：按库内赛段打印窗口内目标页面（不发任何网络请求）。"""
    conn = sqlite3.connect(config.DB_PATH)
    latest = conn.execute(
        "SELECT MAX(datetime_utc) FROM games WHERE datetime_utc IS NOT NULL"
    ).fetchone()[0]
    if not latest:
        print("! 库内没有比赛日期。", flush=True)
        return 3
    cutoff = conn.execute(
        "SELECT date(?, ?)", (latest, f"-{INCR_WINDOW_DAYS} days")
    ).fetchone()[0]
    pages = [
        r[0]
        for r in conn.execute(
            "SELECT overview_page FROM tournaments "
            "WHERE date_start IS NOT NULL AND date_start >= ? ORDER BY date_start",
            (cutoff,),
        ).fetchall()
    ]
    conn.close()
    print(
        f"== 增量预览（最新比赛 {latest}，窗口 {cutoff} 起，"
        f"{len(pages)} 个已入库赛段页；实际运行还会刷新赛段列表）==",
        flush=True,
    )
    for p in pages:
        print(f"   [{_scope_of(p)}] {p}", flush=True)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="仅打印目标赛段页")
    args = ap.parse_args()

    if args.dry:
        return _dry()

    auth = config.load_auth()
    if not auth:
        print("缺少登录凭据（.auth.json 或环境变量），已中止。", flush=True)
        return 2

    stages.client.login(*auth)

    # 0) 英雄摘要（直连，轻量）
    communitydragon.fetch_champion_summary()

    # 0.5) 刷新赛段列表：wiki 可能新建库内没有的赛段页（如未来新赛事），
    #      必须重拉 Tournaments 列表才能发现。Showmatch 行回来也没关系，
    #      加载层会统一过滤。
    print("-- 阶段 0.5: 赛段列表刷新 --", flush=True)
    for key, fn in (
        ("lpl/tournaments/all", stages.stage_tournaments),
        ("intl/tournaments/all", stages.stage_intl_tournaments),
        ("regions/tournaments/all", stages.stage_regional_tournaments),
    ):
        stages.client.invalidate(key)
        fn()

    # 最新比赛日期 → 截断日；窗口内的赛段页强制深拉
    conn = sqlite3.connect(config.DB_PATH)
    latest = conn.execute(
        "SELECT MAX(datetime_utc) FROM games WHERE datetime_utc IS NOT NULL"
    ).fetchone()[0]
    if not latest:
        print("! 库内没有比赛日期，增量无法定位，请先跑全量同步。", flush=True)
        return 3
    conn.close()
    with sqlite3.connect(config.DB_PATH) as c2:
        cutoff = c2.execute(
            "SELECT date(?, ?)", (latest, f"-{INCR_WINDOW_DAYS} days")
        ).fetchone()[0]

    tour_rows = []
    for rel in ("lpl/tournaments", "intl/tournaments", "regions/tournaments"):
        root = config.RAW_DIR / rel / "all"
        if not root.exists():
            continue
        for pf in sorted(root.glob("page_*.json")):
            tour_rows.extend(json.loads(pf.read_text(encoding="utf-8")))
    # 表演赛（TournamentLevel='Showmatch'）不采集（加载层也会过滤），跳过以省请求
    tour_rows = [
        r for r in tour_rows
        if str(r.get("TournamentLevel") or "").strip() != "Showmatch"
    ]
    all_pages = sorted({r["OverviewPage"] for r in tour_rows if r.get("OverviewPage")})
    window_pages = {
        r.get("OverviewPage")
        for r in tour_rows
        if (r.get("OverviewPage") and r.get("DateStart")
            and str(r.get("DateStart")) >= cutoff)
    }

    print(
        f"== 增量同步（最新比赛 {latest}，窗口 {cutoff} 起，"
        f"{len(all_pages)} 个赛段页，其中窗口内 {len(window_pages)} 页）==",
        flush=True,
    )

    # 1) 全部赛段的赛程表轻量重拉 + 变化检测
    #    wiki 对任何赛段（含历史页面）的补录/修正都会体现在赛程上，
    #    检测到变化的赛段进入深拉（小局+选手），窗口内页面无条件深拉。
    snapshot_cache: dict[str, str] = {}
    for scope in ("lpl", "intl", "regions"):
        root = config.RAW_DIR / scope / "matchschedule"
        if not root.exists():
            continue
        for sub in root.iterdir():
            if not sub.is_dir():
                continue
            rows = []
            for pf in sorted(sub.glob("page_*.json")):
                rows.extend(json.loads(pf.read_text(encoding="utf-8")))
            # 0 行的页面也记录空快照：空对空不算变化，只有纯新页面 old 才是 None
            snapshot_cache[f"{scope}/matchschedule/{sub.name}"] = (
                _snapshot(rows) if rows else "[]"
            )

    changed_pages: list[str] = []
    for idx, page in enumerate(all_pages, 1):
        scope = _scope_of(page)
        key = f"{scope}/matchschedule/{stages.slug(page)}"
        old = snapshot_cache.get(key)
        stages.client.invalidate(key)
        new_rows = stages.stage_match_schedule(page, scope=scope)
        new = _snapshot(new_rows)
        if old is None or old != new:
            changed_pages.append(page)
            mark = "新增页面" if old is None else "赛程有变化"
            print(f"  ◆ [{idx}/{len(all_pages)}] {mark} → 深拉 [{scope}] {page}",
                  flush=True)

    deep = sorted(set(window_pages) | set(changed_pages))
    print(
        f"  赛程对比完成：{len(all_pages)} 页中 {len(changed_pages)} 页有变化；"
        f"深拉共 {len(deep)} 页（窗口 {len(window_pages)} + 变化 {len(changed_pages)}）",
        flush=True,
    )

    # 2) 深拉：小局 + 小局选手（赛程已在上面全部重拉完毕）
    for idx, page in enumerate(deep, 1):
        scope = _scope_of(page)
        print(f"-- 深拉 [{idx}/{len(deep)}] [{scope}] {page} --", flush=True)
        for kind, fn in (
            ("scoreboardgames", stages.stage_scoreboard_games),
            ("scoreboardplayers", stages.stage_scoreboard_players),
        ):
            stages.client.invalidate(f"{scope}/{kind}/{stages.slug(page)}")
            fn(page, scope=scope)

    # 3) 选手档案：只补库内没有的 Link（增量缓存批次）
    existing: set[str] = set()
    conn = sqlite3.connect(config.DB_PATH)
    existing |= {r[0] for r in conn.execute("SELECT player_id FROM players")}
    existing |= {r[0] for r in conn.execute("SELECT alias FROM player_aliases")}
    conn.close()
    links = stages.collect_links_from_raw()
    new_links = sorted(set(links) - existing)
    print(f"  选手 Link 总数 {len(links)}，新增 {len(new_links)}", flush=True)
    if new_links:
        stages.stage_players(new_links, incr=True)

    print("== 增量同步完成 ==", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())