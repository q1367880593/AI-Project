#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 TMDB 抓取订阅美剧的完结状态与最新一季播出时间，并输出 data.js。

用法：在项目目录下执行 `python3 app/fetch_tv.py`
依赖：仅使用 Python 标准库，无需 pip 安装任何包。
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/w200"

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONFIG_PATH = os.path.join(ROOT, "data", "config.json")
SHOWS_PATH = os.path.join(ROOT, "data", "shows.json")
OUTPUT_PATH = os.path.join(ROOT, "web", "data.js")

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


def http_get_json(url, retries=2):
    """请求 JSON，失败时自动重试（网络抖动容错）。"""
    headers = {
        "User-Agent": "TVSubscribe/1.0 (local script)",
        "Accept": "application/json",
    }
    last_err = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with _opener.open(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise last_err


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


def find_by_imdb(api_key, imdb_id):
    params = urllib.parse.urlencode({
        "api_key": api_key,
        "external_source": "imdb_id",
    })
    url = f"{BASE_URL}/find/{urllib.parse.quote(imdb_id)}?{params}"
    data = http_get_json(url)
    results = data.get("tv_results", [])
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


def fetch_external_ids(api_key, tmdb_id):
    params = urllib.parse.urlencode({"api_key": api_key})
    url = f"{BASE_URL}/tv/{tmdb_id}/external_ids?{params}"
    data = http_get_json(url)
    return data.get("imdb_id")


def has_cjk(s):
    """是否包含中文字符。"""
    return any("\u4e00" <= ch <= "\u9fff" for ch in s)


def fetch_zh_alias(api_key, tmdb_id):
    """从 TMDB 别名（alternative_titles）中找中文译名，找不到返回 None。"""
    try:
        params = urllib.parse.urlencode({"api_key": api_key})
        url = f"{BASE_URL}/tv/{tmdb_id}/alternative_titles?{params}"
        data = http_get_json(url)
        for t in (data.get("titles") or data.get("results") or []):
            iso = (t.get("iso_3166_1") or "").upper()
            name = (t.get("title") or "").strip()
            if iso in ("CN", "TW", "HK", "SG") and name:
                return name
    except Exception:
        pass
    return None


def pick_zh_name(raw, api_key, tmdb_id):
    """优先 zh-CN 主名；无中文时回退到中文别名。"""
    zh = (raw.get("name") or "").strip()
    if zh and has_cjk(zh):
        return zh
    return fetch_zh_alias(api_key, tmdb_id) or zh


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
        "networks": [n.get("name") for n in (raw.get("networks") or []) if n.get("name")],
        "found": True,
    }


def save_shows(shows_cfg):
    with open(SHOWS_PATH, "w", encoding="utf-8") as f:
        json.dump(shows_cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_data_payload():
    """读取现有 data.js 中的 TV_DATA（用于局部更新时合并）。"""
    if not os.path.exists(OUTPUT_PATH):
        return {"shows": []}
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    marker = "window.TV_DATA = "
    idx = content.find(marker)
    if idx < 0:
        return {"shows": []}
    js = content[idx + len(marker):].strip()
    if js.endswith(";"):
        js = js[:-1].rstrip()
    return json.loads(js)


def process_item(api_key, item):
    """处理单个剧集条目，返回 (entry, changed)。entry.found=False 表示未找到。"""
    title = (item.get("title") or "").strip()
    imdb_id = (item.get("imdb_id") or "").strip()
    name_zh = (item.get("name_zh") or "").strip()
    tmdb_id = item.get("tmdb_id")
    display = title or imdb_id
    if not display and not tmdb_id:
        return {"title": "", "found": False}, False

    matched_by_text = False
    # 匹配优先级：imdb 号 -> tmdb_id -> 文本搜索
    if not tmdb_id:
        if imdb_id:
            tmdb_id = find_by_imdb(api_key, imdb_id)
        if not tmdb_id and title:
            tmdb_id = search_show(api_key, title)
            if tmdb_id:
                matched_by_text = True
        if not tmdb_id:
            print(f"[跳过] 未找到: {display}")
            return {"title": display, "found": False}, False

    changed = False
    # 文本匹配命中后，把确认的 imdb 号回填到 shows.json
    if matched_by_text:
        imdb = fetch_external_ids(api_key, tmdb_id)
        if imdb and imdb != imdb_id:
            item["imdb_id"] = imdb
            changed = True
            print(f"[回填] {display} -> imdb {imdb}")

    raw = fetch_show(api_key, tmdb_id)
    # 回填中文名到 shows.json（主名没有中文时，从中文别名补取）
    zh = pick_zh_name(raw, api_key, tmdb_id)
    if zh and zh != name_zh:
        item["name_zh"] = zh
        changed = True

    entry = build_entry(title or display, raw)
    if zh:
        entry["name"] = zh
    entry["tmdb_id"] = tmdb_id
    entry["imdb_id"] = (item.get("imdb_id") or "").strip() or None
    entry["mark"] = (item.get("mark") or "").strip() or None
    print(f"[完成] {entry.get('name') or display} -> {entry.get('status_zh')}")
    return entry, changed


def main():
    try:
        config = load_json(CONFIG_PATH)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"读取 config.json 失败: {e}")
        sys.exit(1)
    set_proxy((config.get("proxy") or "").strip())
    api_key = (config.get("api_key") or "").strip()
    if not api_key:
        print("请先在 config.json 中填入 TMDB API Key。")
        sys.exit(1)

    try:
        shows_cfg = load_json(SHOWS_PATH)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"读取 shows.json 失败: {e}")
        sys.exit(1)
    shows = shows_cfg.get("shows", [])
    if not isinstance(shows, list) or not shows:
        print("shows.json 中没有订阅剧目。")
        sys.exit(1)

    only = None
    if len(sys.argv) > 1:
        only = sys.argv[1].strip()
        if not only:
            print("用法: python3 fetch_tv.py [剧名 或 imdb 号]，参数不能为空。")
            sys.exit(1)

    # 局部更新：python3 fetch_tv.py <title 或 imdb_id>
    if only:
        target = None
        for item in shows:
            if (item.get("title") or "").strip() == only or (item.get("imdb_id") or "").strip() == only:
                if target is not None:
                    print(f"警告: shows.json 中存在多个 '{only}'，仅更新第一条。")
                    break
                target = item
        if target is None:
            print(f"未在 shows.json 中找到 '{only}'")
            sys.exit(1)
        try:
            entry, changed = process_item(api_key, target)
        except Exception as e:
            print(f"[失败] {only}: {e}")
            sys.exit(1)
        if changed:
            save_shows(shows_cfg)
            print("已回填到 shows.json")

        payload = load_data_payload()
        merged = payload.get("shows", [])
        if not merged:
            print("data.js 不存在或为空，请先执行一次全量抓取（python3 fetch_tv.py）。")
            sys.exit(1)
        title = (target.get("title") or "").strip()
        replaced = False
        for i, s in enumerate(merged):
            if (s.get("title") or "") == title:
                merged[i] = entry
                replaced = True
                break
        if not replaced:
            merged.append(entry)
        payload["generated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload["shows"] = merged
        write_output(payload)
        return

    results = []
    changed = False
    for item in shows:
        display = (item.get("title") or "").strip() or (item.get("imdb_id") or "").strip()
        if not display and not item.get("tmdb_id"):
            continue
        try:
            entry, ch = process_item(api_key, item)
            changed = changed or ch
            results.append(entry)
        except Exception as e:
            print(f"[失败] {display}: {e}")
            results.append({"title": display, "found": False, "error": str(e)})

    if changed:
        save_shows(shows_cfg)
        print("已回填到 shows.json")

    if sum(1 for s in results if s.get("found")) == 0:
        print("本次抓取全部失败（网络或代理异常），已保留现有 data.js，请检查 config.json 中的 proxy。")
        sys.exit(1)

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