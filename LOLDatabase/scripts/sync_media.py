"""媒体资源本地缓存（英雄图标/原画、战队 logo、选手头像）。

用法:
    .venv/bin/python scripts/sync_media.py
幂等：已下载的文件自动跳过，media_assets 表登记可溯源。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import media
from collectors import config
from collectors import load


def main() -> int:
    print("== 媒体缓存开始 ==", flush=True)
    counts = media.run()
    print("\n== 计数 ==")
    for k, v in counts.items():
        print(f"  {k}: {v}")

    # 召唤师技能 / 装备 / 饰品图标（ddragon 直连，入库 icon_assets）
    print("\n== 技能/装备图标 ==", flush=True)
    conn = load.init_db()
    n_spell, n_item = media.fetch_icon_assets(conn)
    conn.commit()
    conn.close()
    print(f"  spell: {n_spell} / item: {n_item}")

    # 选手年代定妆照（PlayerImages Cargo，按对局年份选图）
    print("\n== 选手年代定妆照 ==", flush=True)
    from collectors.cargo import CargoClient

    client = CargoClient()
    auth = config.load_auth()
    assert auth, "缺少 .auth.json 登录凭据"
    client.login(*auth)
    conn = load.init_db()
    n_year = media.fetch_player_year_photos(conn, client)
    conn.commit()
    print(f"  year-photos: {n_year}")

    # 无头像选手兜底（pageimages + 页面图片列表）
    n_fb = media.fetch_player_avatar_fallback(conn, client)
    conn.commit()
    conn.close()
    print(f"  avatar-fallback: {n_fb}")

    print(f"\n资源目录: {media.ASSET_ROOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())