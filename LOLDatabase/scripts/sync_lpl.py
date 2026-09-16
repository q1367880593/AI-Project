"""LPL 全历史（2013 至今）基础数据采集（Leaguepedia Cargo，慢速限流 + 断点续传）。

用法:
    .venv/bin/python scripts/sync_lpl.py

按阶段顺序执行：英雄 → 赛段 → 赛程 → 小局 → 小局选手 → 选手档案。
任意时刻中断后重跑会自动跳过已完成部分。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import communitydragon, stages
from collectors import config


def main() -> int:
    print(f"== LPL 全历史采集开始（代理 {config.PROXY}）==", flush=True)

    # 0) 登录（Fandom 机器人密码：解除匿名查询限制）
    auth = config.load_auth()
    if not auth:
        print(
            "缺少登录凭据。请:\n"
            "  1) 在 lol.fandom.com 登录你的 Fandom 账号，打开\n"
            "     https://lol.fandom.com/wiki/Special:BotPasswords\n"
            "     创建机器人密码（权限至少勾选 highvolume，名称如 loldb）；\n"
            "  2) 将凭据写入项目根目录 .auth.json:\n"
            '     {"username": "你的用户名@loldb", "password": "生成的密码"}\n'
            "     （或用环境变量 LOLDB_BOT_USER / LOLDB_BOT_PASS）",
            flush=True,
        )
        return 2
    stages.client.login(*auth)

    # 1) 英雄（communitydragon 直连）
    print("-- 阶段 0: 英雄 --", flush=True)
    communitydragon.fetch_champion_summary()

    # 2) 赛段（全部 LPL）
    print("-- 阶段 1: 赛段 --", flush=True)
    tournaments = stages.stage_tournaments()
    pages = sorted({t.get("OverviewPage") for t in tournaments if t.get("OverviewPage")})
    print(f"发现 {len(pages)} 个赛段页", flush=True)

    # 3) 赛程 / 4) 小局 / 5) 小局选手（按赛段页）
    for idx, page in enumerate(pages, 1):
        print(f"-- [{idx}/{len(pages)}] 赛程 [{page}] --", flush=True)
        stages.stage_match_schedule(page)
        print(f"-- [{idx}/{len(pages)}] 小局 [{page}] --", flush=True)
        stages.stage_scoreboard_games(page)
        print(f"-- [{idx}/{len(pages)}] 小局选手 [{page}] --", flush=True)
        stages.stage_scoreboard_players(page)

    # 6) 选手档案（依赖小局选手阶段的 Link 集合）
    print("-- 阶段 6: 选手档案 --", flush=True)
    links = stages.collect_links_from_raw()
    print(f"共 {len(links)} 个选手 Link", flush=True)
    stages.stage_players(links)

    print("== 采集全部完成 ==", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())