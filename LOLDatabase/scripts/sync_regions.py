"""其它赛区（LCK / LEC / LCS）数据采集（Leaguepedia Cargo，慢速限流 + 断点续传）。

范围：LCK（2015 至今）、LEC（2013-2018 名 EU LCS）、LCS（2013-2020 名 NA LCS）。
表演赛在加载层按 TournamentLevel='Showmatch' 过滤，此处原样采集。
原始数据落盘 data/raw/regions/**；选手档案阶段复用 lpl/players 缓存目录。

用法:
    .venv/bin/python scripts/sync_regions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import communitydragon, stages
from collectors import config


def main() -> int:
    print(f"== 其它赛区采集开始（代理 {config.PROXY}）==", flush=True)

    # 0) 登录（Fandom 机器人密码：解除匿名查询限制）
    auth = config.load_auth()
    if not auth:
        print("缺少登录凭据（.auth.json 或环境变量），已中止。", flush=True)
        return 2
    stages.client.login(*auth)

    # 1) 英雄（幂等；数据已存在时秒回）
    print("-- 阶段 0: 英雄 --", flush=True)
    communitydragon.fetch_champion_summary()

    # 2) 赛段
    print("-- 阶段 1: 赛区赛段 --", flush=True)
    tournaments = stages.stage_regional_tournaments()
    pages = sorted({t.get("OverviewPage") for t in tournaments if t.get("OverviewPage")})
    print(f"发现 {len(pages)} 个赛段页", flush=True)

    # 3) 赛程 / 4) 小局 / 5) 小局选手（按赛段页）
    for idx, page in enumerate(pages, 1):
        print(f"-- [{idx}/{len(pages)}] 赛程 [{page}] --", flush=True)
        stages.stage_match_schedule(page, scope="regions")
        print(f"-- [{idx}/{len(pages)}] 小局 [{page}] --", flush=True)
        stages.stage_scoreboard_games(page, scope="regions")
        print(f"-- [{idx}/{len(pages)}] 小局选手 [{page}] --", flush=True)
        stages.stage_scoreboard_players(page, scope="regions")

    # 6) 选手档案（全部 Link；已完成批次自动跳过）
    print("-- 阶段 6: 选手档案 --", flush=True)
    links = stages.collect_links_from_raw()
    print(f"共 {len(links)} 个选手 Link", flush=True)
    stages.stage_players(links)

    print("== 其它赛区采集全部完成 ==", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())