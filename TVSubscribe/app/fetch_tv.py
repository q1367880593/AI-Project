#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 TMDB 抓取订阅美剧的完结状态与最新一季播出时间，并输出 data.js。

用法：在项目目录下执行 `python3 app/fetch_tv.py`
依赖：仅使用 Python 标准库，无需 pip 安装任何包。
"""

import json
import os
import re
import sys
import threading
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
MOVIES_PATH = os.path.join(ROOT, "data", "movies.json")
MOVIE_OUTPUT_PATH = os.path.join(ROOT, "web", "movies_data.js")

# 多用户目录：data/users/<用户名>/shows.json、movies.json、data.js、movies_data.js
USERS_DIR = os.path.join(ROOT, "data", "users")
DEFAULT_USER = "xiaolongbao"   # 直接命令行抓取时默认归属的用户

# 线程级当前用户：server.py 在处理请求时会 set_active_user / clear_active_user，
# 保证并发请求互不串数据；命令行单独运行则回退 DEFAULT_USER / 旧版全局路径。
_tls = threading.local()


def set_active_user(username):
    _tls.active_user = username


def clear_active_user():
    _tls.active_user = None


def active_user():
    return getattr(_tls, "active_user", None) or None


def user_dir(username):
    return os.path.join(USERS_DIR, username)


def user_cfg_path(username, kind):
    return os.path.join(user_dir(username), "movies.json" if kind == "movie" else "shows.json")


def user_data_path(username, kind):
    return os.path.join(user_dir(username), "movies_data.js" if kind == "movie" else "data.js")


def resolve_paths(kind):
    """返回 (cfg_path, data_path)：优先线程级用户，其次默认用户（目录存在时），否则旧版全局路径。"""
    u = active_user() or DEFAULT_USER
    if u and os.path.isdir(user_dir(u)):
        return user_cfg_path(u, kind), user_data_path(u, kind)
    if kind == "movie":
        return MOVIES_PATH, MOVIE_OUTPUT_PATH
    return SHOWS_PATH, OUTPUT_PATH

STATUS_ZH = {
    "Returning Series": "在播",
    "Ended": "已完结",
    "Canceled": "已取消",
    "In Production": "制作中",
    "Planned": "计划中",
    "Pilot": "试播集",
}

MOVIE_STATUS_ZH = {
    "Released": "已上映",
    "In Production": "制作中",
    "Post Production": "后期制作",
    "Planned": "计划中",
    "Canceled": "已取消",
    "Rumored": "传闻",
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


_last_req_ts = 0.0
REQ_INTERVAL = 0.25  # 请求最小间隔（秒）：批量抓取时防止触发 TMDB 限流


def _throttle():
    global _last_req_ts
    now = time.time()
    wait = _last_req_ts + REQ_INTERVAL - now
    if wait > 0:
        time.sleep(wait)
    _last_req_ts = time.time()


def http_get_json(url, retries=2):
    """请求 JSON，失败时自动重试（网络抖动容错）；内置限速。"""
    headers = {
        "User-Agent": "TVSubscribe/1.0 (local script)",
        "Accept": "application/json",
    }
    last_err = None
    for attempt in range(retries + 1):
        try:
            _throttle()
            req = urllib.request.Request(url, headers=headers)
            with _opener.open(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise last_err


_YEAR_RE = re.compile(r"[\(（]?(\d{4})[\)）]?\s*$")


def parse_year(title):
    """从片名末尾提取 4 位年份（如 The Lion King (2019) → 2019），无则返回 None。"""
    m = _YEAR_RE.search((title or "").strip())
    if not m:
        return None
    y = int(m.group(1))
    return y if 1900 <= y <= 2100 else None


def search_item(api_key, title, kind="tv"):
    clean = _YEAR_RE.sub("", (title or "").strip()).strip() or title
    params = {
        "query": clean,
        "api_key": api_key,
        "language": "en-US",
    }
    year = parse_year(title)
    if year:
        key = "primary_release_year" if kind == "movie" else "first_air_date_year"
        params[key] = year
    endpoint = "search/movie" if kind == "movie" else "search/tv"
    url = f"{BASE_URL}/{endpoint}?" + urllib.parse.urlencode(params)
    data = http_get_json(url)
    results = data.get("results", [])
    if not results:
        return None
    return results[0]["id"]


def find_by_imdb(api_key, imdb_id, kind="tv"):
    params = urllib.parse.urlencode({
        "api_key": api_key,
        "external_source": "imdb_id",
    })
    url = f"{BASE_URL}/find/{urllib.parse.quote(imdb_id)}?{params}"
    data = http_get_json(url)
    key = "movie_results" if kind == "movie" else "tv_results"
    results = data.get(key, [])
    if not results:
        return None
    return results[0]["id"]


def fetch_item(api_key, tmdb_id, kind="tv"):
    params = urllib.parse.urlencode({
        "api_key": api_key,
        "language": "zh-CN",
    })
    endpoint = "movie" if kind == "movie" else "tv"
    url = f"{BASE_URL}/{endpoint}/{tmdb_id}?{params}"
    return http_get_json(url)


def fetch_external_ids(api_key, tmdb_id, kind="tv"):
    params = urllib.parse.urlencode({"api_key": api_key})
    endpoint = "movie" if kind == "movie" else "tv"
    url = f"{BASE_URL}/{endpoint}/{tmdb_id}/external_ids?{params}"
    data = http_get_json(url)
    return data.get("imdb_id")


def has_cjk(s):
    """是否包含中文字符。"""
    return any("\u4e00" <= ch <= "\u9fff" for ch in s)


def fetch_zh_alias(api_key, tmdb_id, kind="tv"):
    """从 TMDB 别名（alternative_titles）中找中文译名，找不到返回 None。"""
    try:
        params = urllib.parse.urlencode({"api_key": api_key})
        endpoint = "movie" if kind == "movie" else "tv"
        url = f"{BASE_URL}/{endpoint}/{tmdb_id}/alternative_titles?{params}"
        data = http_get_json(url)
        for t in (data.get("titles") or data.get("results") or []):
            iso = (t.get("iso_3166_1") or "").upper()
            name = (t.get("title") or "").strip()
            if iso in ("CN", "TW", "HK", "SG") and name:
                return name
    except Exception:
        pass
    return None


def fetch_collection_zh(api_key, collection_id):
    """抓取电影系列中文名（collection 详情），失败返回 None。"""
    try:
        params = urllib.parse.urlencode({
            "api_key": api_key,
            "language": "zh-CN",
        })
        url = f"{BASE_URL}/collection/{collection_id}?{params}"
        data = http_get_json(url)
        name = (data.get("name") or "").strip()
        if name and has_cjk(name):
            return name
    except Exception:
        pass
    return None


def build_collection(raw, api_key, cache):
    """构建电影系列归属（含中文名兜底），无系列返回 None。"""
    coll = raw.get("belongs_to_collection")
    if not coll or not isinstance(coll, dict):
        return None
    cid = coll.get("id")
    name = (coll.get("name") or "").strip()
    name_zh = name if has_cjk(name) else None
    if not name_zh and cid and api_key:
        if cid not in cache:
            cache[cid] = fetch_collection_zh(api_key, cid)
        name_zh = cache[cid]
    return {
        "id": cid,
        "name": name,
        "name_zh": name_zh or name or None,
    }


def pick_zh_name(raw, api_key, tmdb_id, kind="tv"):
    """优先 zh-CN 主名；无中文时回退到中文别名。"""
    zh = (raw.get("name") or raw.get("title") or "").strip()
    if zh and has_cjk(zh):
        return zh
    return fetch_zh_alias(api_key, tmdb_id, kind) or zh


def zh_status(status, kind="tv"):
    if kind == "movie":
        return MOVIE_STATUS_ZH.get(status, status or "未知")
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


def build_entry(title, raw, kind="tv", api_key=None, collection_cache=None):
    poster = raw.get("poster_path")

    if kind == "movie":
        return {
            "title": title,
            "name": raw.get("title") or title,
            "original_name": raw.get("original_title") or title,
            "status": raw.get("status"),
            "status_zh": zh_status(raw.get("status"), "movie"),
            "release_date": raw.get("release_date"),
            "runtime": raw.get("runtime"),
            "vote_average": raw.get("vote_average"),
            "poster": f"{IMAGE_BASE}{poster}" if poster else None,
            "networks": [g.get("name") for g in (raw.get("genres") or []) if g.get("name")],
            "collection": build_collection(raw, api_key, collection_cache or {}),
            "countries": [
                {"iso": c.get("iso_3166_1"), "name": c.get("name")}
                for c in (raw.get("production_countries") or [])
            ],
            "origin_country": [c for c in (raw.get("origin_country") or [])] if isinstance(raw.get("origin_country"), list) else [],
            "original_language": raw.get("original_language"),
            "spoken_languages": [
                {"iso": l.get("iso_639_1"), "name": l.get("name")}
                for l in (raw.get("spoken_languages") or [])
            ],
            "found": True,
        }

    last_ep = raw.get("last_episode_to_air") or {}
    next_ep = raw.get("next_episode_to_air")

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
        "number_of_seasons": raw.get("number_of_seasons"),
        "networks": [n.get("name") for n in (raw.get("networks") or []) if n.get("name")],
        "genres": [g.get("name") for g in (raw.get("genres") or []) if g.get("name")],
        "found": True,
    }


def save_shows(shows_cfg, path=None):
    with open(path or SHOWS_PATH, "w", encoding="utf-8") as f:
        json.dump(shows_cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_data_payload(path=None, var_name="TV_DATA"):
    """读取现有 data.js 中的缓存（用于局部更新时合并）。"""
    path = path or OUTPUT_PATH
    if not os.path.exists(path):
        return {"shows": []}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    marker = "window.%s = " % var_name
    idx = content.find(marker)
    if idx < 0:
        return {"shows": []}
    js = content[idx + len(marker):].strip()
    if js.endswith(";"):
        js = js[:-1].rstrip()
    return json.loads(js)


def process_item(api_key, item, kind="tv", collection_cache=None):
    """处理单个条目，返回 (entry, changed)。entry.found=False 表示未找到。"""
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
            tmdb_id = find_by_imdb(api_key, imdb_id, kind)
        if not tmdb_id and title:
            tmdb_id = search_item(api_key, title, kind)
            if tmdb_id:
                matched_by_text = True
        if not tmdb_id:
            print(f"[跳过] 未找到: {display}")
            return {"title": display, "found": False}, False

    changed = False
    # 文本匹配命中后，把确认的 imdb 号回填到配置文件
    if matched_by_text:
        imdb = fetch_external_ids(api_key, tmdb_id, kind)
        if imdb and imdb != imdb_id:
            item["imdb_id"] = imdb
            changed = True
            print(f"[回填] {display} -> imdb {imdb}")

    raw = fetch_item(api_key, tmdb_id, kind)
    # 回填中文名到配置文件（主名没有中文时，从中文别名补取）
    zh = pick_zh_name(raw, api_key, tmdb_id, kind)
    if zh and zh != name_zh:
        item["name_zh"] = zh
        changed = True

    entry = build_entry(title or display, raw, kind, api_key, collection_cache)
    if zh:
        entry["name"] = zh
    entry["tmdb_id"] = tmdb_id
    entry["imdb_id"] = (item.get("imdb_id") or "").strip() or None
    entry["mark"] = (item.get("mark") or "").strip() or None
    entry["group"] = (item.get("group") or "").strip() or None
    try:
        entry["watched_seasons"] = int(item.get("watched_seasons")) if item.get("watched_seasons") is not None else None
    except (TypeError, ValueError):
        entry["watched_seasons"] = None
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

    args = list(sys.argv[1:])
    kind = "movie" if "--movies" in args else "tv"
    args = [a for a in args if a != "--movies"]
    only_unfetched = "--only-unfetched" in args
    args = [a for a in args if a != "--only-unfetched"]

    cfg_path, data_path = resolve_paths(kind)
    var_name = "MOVIE_DATA" if kind == "movie" else "TV_DATA"
    label = "电影" if kind == "movie" else "剧集"

    try:
        shows_cfg = load_json(cfg_path)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"读取 {os.path.basename(cfg_path)} 失败: {e}")
        sys.exit(1)
    shows = shows_cfg.get("shows", [])
    if not isinstance(shows, list) or not shows:
        print(f"{os.path.basename(cfg_path)} 中没有订阅条目。")
        sys.exit(1)

    only = args[0].strip() if args else None
    if args and not only:
        print("用法: python3 app/fetch_tv.py [--movies] [片名 或 imdb 号]，参数不能为空。")
        sys.exit(1)

    # 局部更新：python3 app/fetch_tv.py [--movies] <title 或 imdb_id>
    if only:
        target = None
        for item in shows:
            if (item.get("title") or "").strip() == only or (item.get("imdb_id") or "").strip() == only:
                if target is not None:
                    print(f"警告: 配置中存在多个 '{only}'，仅更新第一条。")
                    break
                target = item
        if target is None:
            print(f"未在 {os.path.basename(cfg_path)} 中找到 '{only}'")
            sys.exit(1)
        try:
            entry, changed = process_item(api_key, target, kind)
        except Exception as e:
            print(f"[失败] {only}: {e}")
            sys.exit(1)
        if changed:
            save_shows(shows_cfg, cfg_path)
            print("已回填到 %s" % os.path.basename(cfg_path))

        payload = load_data_payload(data_path, var_name)
        merged = payload.get("shows", [])
        if not merged:
            print("数据文件不存在或为空，请先执行一次全量抓取（python3 app/fetch_tv.py%s）。" % (" --movies" if kind == "movie" else ""))
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
        write_output(payload, data_path, var_name)
        return

    results = []
    changed = False
    collection_cache = {}  # 系列中文名缓存（同系列去重请求）

    def config_key(item):
        imdb = (item.get("imdb_id") or "").strip()
        if imdb:
            return "imdb|" + imdb
        return "title|" + (item.get("title") or "").strip()

    old_map = {}
    if only_unfetched:
        old_payload = load_data_payload(data_path, var_name)
        for s in old_payload.get("shows", []):
            old_map.setdefault(config_key(s), s)

    for item in shows:
        display = (item.get("title") or "").strip() or (item.get("imdb_id") or "").strip()
        if not display and not item.get("tmdb_id"):
            continue
        if only_unfetched:
            cached = old_map.get(config_key(item))
            if cached and cached.get("found") and cached.get("status"):
                # 已抓取：直接复用旧缓存，只同步标记与分组
                cached["mark"] = (item.get("mark") or "").strip() or None
                cached["group"] = (item.get("group") or "").strip() or None
                results.append(cached)
                print(f"[跳过] 已抓取: {cached.get('name') or display}")
                continue
        try:
            entry, ch = process_item(api_key, item, kind, collection_cache)
            changed = changed or ch
            results.append(entry)
        except Exception as e:
            print(f"[失败] {display}: {e}")
            results.append({"title": display, "found": False, "error": str(e)})

    if changed:
        save_shows(shows_cfg, cfg_path)
        print("已回填到 %s" % os.path.basename(cfg_path))

    if sum(1 for s in results if s.get("found")) == 0:
        print("本次抓取全部失败（网络或代理异常），已保留现有数据文件，请检查 config.json 中的 proxy。")
        sys.exit(1)

    # 抓取结果按 IMDb 去重：文本匹配歧义可能把不同片名配成同一部（如系列名与新作）
    seen = set()
    deduped = []
    for r in results:
        imdb = (r.get("imdb_id") or "").strip().lower()
        if imdb and imdb in seen:
            print(f"[去重] 与前面条目 IMDb 相同的重复结果已移除: {r.get('name') or r.get('title')} ({imdb})")
            continue
        if imdb:
            seen.add(imdb)
        deduped.append(r)
    results = deduped

    payload = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "shows": results,
    }
    write_output(payload, data_path, var_name)


def write_output(payload, path=None, var_name="TV_DATA"):
    js = "// 本文件由 fetch_tv.py 自动生成，请勿手动编辑\n"
    js += "window.%s = " % var_name + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    with open(path or OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(js)
    found = sum(1 for s in payload["shows"] if s.get("found"))
    print(f"\n已输出 {found}/{len(payload['shows'])} 部剧集到 {os.path.basename(path or OUTPUT_PATH)}")


if __name__ == "__main__":
    main()