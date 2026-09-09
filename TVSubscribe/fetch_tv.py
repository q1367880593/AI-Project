#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 TMDB 抓取订阅美剧的完结状态与最新一季播出时间，并输出 data.js。

用法：在项目目录下执行 `python3 fetch_tv.py`
依赖：仅使用 Python 标准库，无需 pip 安装任何包。
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/w200"

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
SHOWS_PATH = os.path.join(HERE, "shows.json")
OUTPUT_PATH = os.path.join(HERE, "data.js")

STATUS_ZH = {
    "Returning Series": "在播",
    "Ended": "已完结",
    "Canceled": "已取消",
    "In Production": "制作中",
    "Planned": "计划中",
    "Pilot": "试播集",
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_opener = None


def set_proxy(proxy):
    """配置全局 HTTP 代理（可选），例如 http://127.0.0.1:1087。留空则直连。"""
    global _opener
    handlers = []
    if proxy:
        handlers.append(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
    _opener = urllib.request.build_opener(*handlers)


def http_get_json(url):
    headers = {
        "User-Agent": "TVSubscribe/1.0 (local script)",
        "Accept": "application/json",
    }
    req = urllib.request.Request(url, headers=headers)
    with _opener.open(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def search_show(api_key, title):
    params = urllib.parse.urlencode({
        "query": title,
        "api_key": api_key,
        "language": "en-US",
    })
    url = f"{BASE_URL}/search/tv?{params}"
    data = http_get_json(url)
    results = data.get("results", [])
    if not results:
        return None
    return results[0]["id"]


def fetch_show(api_key, tmdb_id):
    params = urllib.parse.urlencode({
        "api_key": api_key,
        "language": "zh-CN",
    })
    url = f"{BASE_URL}/tv/{tmdb_id}?{params}"
    return http_get_json(url)


def zh_status(status):
    return STATUS_ZH.get(status, status or "未知")


def pick_latest_season(seasons):
    """从 seasons 中挑出最新一季（排除特辑 season 0，且必须有首播日期）。"""
    best = None
    for s in seasons or []:
        n = s.get("season_number")
        air_date = s.get("air_date")
        if n is None or n <= 0 or not air_date:
            continue
        if best is None or n > best["season_number"]:
            best = {
                "season_number": n,
                "air_date": air_date,
                "episode_count": s.get("episode_count"),
            }
    return best


def build_entry(title, raw):
    last_ep = raw.get("last_episode_to_air") or {}
    next_ep = raw.get("next_episode_to_air")
    poster = raw.get("poster_path")

    def episode(e):
        if not e:
            return None
        return {
            "season": e.get("season_number"),
            "episode": e.get("episode_number"),
            "name": e.get("name"),
            "air_date": e.get("air_date"),
        }

    return {
        "title": title,
        "name": raw.get("name") or title,
        "original_name": raw.get("original_name") or title,
        "status": raw.get("status"),
        "status_zh": zh_status(raw.get("status")),
        "in_production": raw.get("in_production"),
        "first_air_date": raw.get("first_air_date"),
        "last_air_date": raw.get("last_air_date"),
        "poster": f"{IMAGE_BASE}{poster}" if poster else None,
        "last_episode": episode(last_ep),
        "next_episode": episode(next_ep),
        "latest_season": pick_latest_season(raw.get("seasons")),
        "found": True,
    }


def main():
    config = load_json(CONFIG_PATH)
    set_proxy((config.get("proxy") or "").strip())
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        print("请先在 config.json 中填入 TMDB API Key。")
        sys.exit(1)

    shows_cfg = load_json(SHOWS_PATH)
    shows = shows_cfg.get("shows", [])

    results = []
    for item in shows:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        tmdb_id = item.get("tmdb_id")
        try:
            if not tmdb_id:
                tmdb_id = search_show(api_key, title)
                if not tmdb_id:
                    print(f"[跳过] 未找到: {title}")
                    results.append({"title": title, "found": False})
                    continue
            raw = fetch_show(api_key, tmdb_id)
            entry = build_entry(title, raw)
            entry["tmdb_id"] = tmdb_id
            results.append(entry)
            print(f"[完成] {entry.get('name') or title} -> {entry.get('status_zh')}")
        except Exception as e:
            print(f"[失败] {title}: {e}")
            results.append({"title": title, "found": False, "error": str(e)})

    payload = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "shows": results,
    }
    write_output(payload)


def write_output(payload):
    js = "// 本文件由 fetch_tv.py 自动生成，请勿手动编辑\n"
    js += "window.TV_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(js)
    found = sum(1 for s in payload["shows"] if s.get("found"))
    print(f"\n已输出 {found}/{len(payload['shows'])} 部剧集到 data.js")


if __name__ == "__main__":
    main()