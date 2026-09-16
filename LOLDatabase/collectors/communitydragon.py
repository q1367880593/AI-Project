"""CommunityDragon（客户端同源 CDN）数据：英雄列表（含中文名）。

该 CDN 可直连，不走代理。
"""

import json

import requests

from collectors import config


def fetch_champion_summary() -> list:
    """拉取全英雄摘要（id/alias/name中文/title），落盘 raw/champions/communitydragon.json。"""
    out_file = config.RAW_DIR / "champions" / "communitydragon.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)

    resp = requests.get(config.CDN_CHAMPIONS_URL, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    out_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"  ✔ champions: communitydragon 摘要 {len(data)} 个英雄", flush=True)
    return data