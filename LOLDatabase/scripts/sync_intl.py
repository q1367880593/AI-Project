"""国际赛（Riot 官方国际赛事）数据采集（Leaguepedia Cargo，慢速限流 + 断点续传）。

范围：Worlds（S1 至今，含 Play-In/Main Event）、MSI、MSC 2020、
Rift Rivals 洲际赛、First Stand、All-Star 全明星。
原始数据落盘 data/raw/intl/**；选手档案阶段复用 lpl/players 缓存目录
（fetch_all 按批次键跳过已完成的批次，LPL 已拉过的档案不会重复请求）。

用法:
    .venv/bin/python scripts/sync_intl.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import communitydragon, stages
from collectors import config


def main() -> int:
    print(f"== 国际赛采集开始（代理 {config.PROXY}）==", flush=True)

    # 0) 登录（Fandom 机器人密码：解除匿名查询限制）
    auth = config.load_auth()
    if not auth:
        print("缺少登录凭据（.auth.json 或环境变量），已中止。", flush=True)
        return 2
    stages.client.login(*auth)

    # 1) 英雄（幂等；数据已存在时秒回）
    print("-- 阶段 0: 英雄 --", flush=True)
    communitydragon.fetch_champion_summary()

    # 2) 国际赛赛段
    print("-- 阶段 1: 国际赛赛段 --", flush=True)
    tournaments = stages.stage_intl_tournaments()
    pages = sorted({t.get("OverviewPage") for t in tournaments if t.get("OverviewPage")})
    print(f"发现 {len(pages)} 个国际赛赛段页", flush=True)

    # 3) 赛程 / 4) 小局 / 5) 小局选手（按赛段页）
    for idx, page in enumerate(pages, 1):
        print(f"-- [{idx}/{len(pages)}] 赛程 [{page}] --", flush=True)
        stages.stage_match_schedule(page, scope="intl")
        print(f"-- [{idx}/{len(pages)}] 小局 [{page}] --", flush=True)
        stages.stage_scoreboard_games(page, scope="intl")
        print(f"-- [{idx}/{len(pages)}] 小局选手 [{page}] --", flush=True)
        stages.stage_scoreboard_players(page, scope="intl")

    # 6) 选手档案（LPL + 国际赛全部 Link；已完成批次自动跳过）
    print("-- 阶段 6: 选手档案 --", flush=True)
    links = stages.collect_links_from_raw()
    print(f"共 {len(links)} 个选手 Link", flush=True)
    stages.stage_players(links)

    print("== 国际赛采集全部完成 ==", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())