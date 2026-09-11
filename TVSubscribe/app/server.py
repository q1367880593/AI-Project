#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TVSubscribe 本地小服务：页面直接读写 shows.json / data.js

用法：
    双击 start.command（或执行 python3 app/server.py）
    浏览器访问 http://127.0.0.1:8765
"""
import contextlib
import io
import json
import os
import re
import subprocess
import sys
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import fetch_tv as ft

HERE = os.path.dirname(os.path.abspath(__file__))   # app/
ROOT = os.path.dirname(HERE)                          # 项目根目录
WEB_DIR = os.path.join(ROOT, "web")
PORT = 8765
HOST = "127.0.0.1"

STATIC_OK = {
    "": "text/html; charset=utf-8",
    "index.html": "text/html; charset=utf-8",
    "style.css": "text/css; charset=utf-8",
    "app.js": "application/javascript; charset=utf-8",
    "data.js": "application/javascript; charset=utf-8",
    "movies_data.js": "application/javascript; charset=utf-8",
    "favicon.svg": "image/svg+xml",
    "favicon.png": "image/png",
    "apple-touch-icon.png": "image/png",
}

CONFIG_FIELDS = ("title", "imdb_id", "name_zh", "mark", "group")

TMDB_BASE = "https://api.themoviedb.org/3"

# 服务启动时读取配置、配置代理（复用 fetch_tv 的请求函数）
_config = None
API_KEY = ""


def init_env():
    global _config, API_KEY
    _config = ft.load_json(ft.CONFIG_PATH)
    ft.set_proxy((_config.get("proxy") or "").strip())
    API_KEY = (ft.load_json(ft.CONFIG_PATH).get("api_key") or "").strip()


def tmdb_url(path):
    sep = "&" if "?" in path else "?"
    return TMDB_BASE + path + sep + "api_key=" + urllib.parse.quote(API_KEY)


def key_of(e):
    if e.get("imdb_id"):
        return "imdb|" + str(e.get("imdb_id"))
    return "title|" + str(e.get("title") or "")


def clean_config_item(e):
    out = {}
    title = (e.get("title") or "").strip()
    if title:
        out["title"] = title
    imdb = (e.get("imdb_id") or "").strip()
    if imdb:
        out["imdb_id"] = imdb
    zh = (e.get("name_zh") or e.get("name") or "").strip()
    if zh and zh != title:
        out["name_zh"] = zh
    mark = (e.get("mark") or "").strip()
    if mark:
        out["mark"] = mark
    group = (e.get("group") or "").strip()
    if group:
        out["group"] = group
    return out


def save_entries(entries, kind="tv"):
    """写订阅配置文件，并把数据缓存同步为最新列表（保留旧条目富数据，新增条目用页面快照）。"""
    cfg_path = ft.MOVIES_PATH if kind == "movie" else ft.SHOWS_PATH
    data_path = ft.MOVIE_OUTPUT_PATH if kind == "movie" else ft.OUTPUT_PATH
    var_name = "MOVIE_DATA" if kind == "movie" else "TV_DATA"

    # 0) 写盘前去重：IMDb 号相同必去重；片名相同仅在任一方无 IMDb 时去重（双方 IMDb 不同视为重名不同片）
    seen_imdb = set()
    seen_title = {}   # 归一化片名 → 该条目的 imdb
    unique = []
    for e in entries:
        imdb = (e.get("imdb_id") or "").strip()
        title = " ".join((e.get("title") or "").strip().lower().split())
        if imdb and imdb in seen_imdb:
            continue
        if title and title in seen_title:
            prev_imdb = seen_title[title]
            if not (imdb and prev_imdb and imdb != prev_imdb):
                continue
        if imdb:
            seen_imdb.add(imdb)
        if title:
            seen_title[title] = imdb
        unique.append(e)
    entries = unique

    # 1) 订阅配置（仅配置字段）
    config_items = [clean_config_item(e) for e in entries]
    with open(cfg_path, "w", encoding="utf-8") as f:
        json.dump({"shows": config_items}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # 2) 数据缓存：按 key 保留旧富数据，更新 mark，新增条目填充快照
    old = ft.load_data_payload(data_path, var_name)
    old_map = {}
    for s in old.get("shows", []):
        old_map.setdefault(key_of(s), s)

    new_list = []
    for e in entries:
        k = key_of(e)
        old_item = old_map.get(k)
        if old_item and old_item.get("found"):
            item = dict(old_item)
        else:
            item = {
                "title": (e.get("title") or "").strip(),
                "name": (e.get("name_zh") or e.get("name") or e.get("title") or "").strip(),
                "original_name": (e.get("original_name") or e.get("title") or "").strip(),
                "status": e.get("status"),
                "status_zh": e.get("status_zh") or "",
                "in_production": None,
                "first_air_date": e.get("first_air_date") or "",
                "last_air_date": e.get("last_air_date") or "",
                "release_date": e.get("release_date") or "",
                "runtime": e.get("runtime"),
                "vote_average": e.get("vote_average"),
                "poster": e.get("poster"),
                "last_episode": e.get("last_episode"),
                "next_episode": e.get("next_episode"),
                "latest_season": e.get("latest_season"),
                "networks": e.get("networks") or [],
                "collection": e.get("collection"),
                "countries": e.get("countries"),
                "origin_country": e.get("origin_country"),
                "original_language": e.get("original_language"),
                "spoken_languages": e.get("spoken_languages"),
                "found": True,
            }
        candidate_imdb = (e.get("imdb_id") or "").strip()
        if candidate_imdb:
            item["imdb_id"] = candidate_imdb
        if e.get("tmdb_id") is not None:
            item["tmdb_id"] = e.get("tmdb_id")
        if e.get("collection"):
            item["collection"] = e.get("collection")
        if e.get("countries"):
            item["countries"] = e.get("countries")
        if e.get("origin_country"):
            item["origin_country"] = e.get("origin_country")
        if e.get("original_language"):
            item["original_language"] = e.get("original_language")
        if e.get("spoken_languages"):
            item["spoken_languages"] = e.get("spoken_languages")
        item["mark"] = (e.get("mark") or "").strip() or None
        item["group"] = (e.get("group") or "").strip() or None
        new_list.append(item)

    ft.write_output({
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "shows": new_list,
    }, data_path, var_name)


def serve_index():
    """返回 index.html，并给本地资源加时间戳版本号，避免浏览器缓存旧 JS/CSS。"""
    with open(os.path.join(WEB_DIR, "index.html"), "rb") as f:
        content = f.read().decode("utf-8")
    for asset in ("style.css", "data.js", "movies_data.js", "app.js"):
        mtime = int(os.path.getmtime(os.path.join(WEB_DIR, asset)))
        content = content.replace('"%s"' % asset, '"%s?v=%d"' % (asset, mtime))
    return content.encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[http] %s\n" % (fmt % args))

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # ---- API：搜索（服务端走代理中转 TMDB） ----
        if path == "/api/search":
            kind = (qs.get("kind") or ["tv"])[0]
            if kind not in ("tv", "movie"):
                self.send_json(400, {"error": "kind 只能是 tv 或 movie"})
                return
            q = (qs.get("q") or [""])[0].strip()
            if not q:
                self.send_json(400, {"error": "缺少搜索词 q"})
                return
            if not API_KEY:
                self.send_json(500, {"error": "config.json 缺少 api_key"})
                return
            endpoint = "search/movie" if kind == "movie" else "search/tv"
            clean_q = re.sub(ft._YEAR_RE, "", q).strip() or q
            extra = ""
            year = ft.parse_year(q)
            if year:
                key = "primary_release_year" if kind == "movie" else "first_air_date_year"
                extra = "&%s=%d" % (key, year)
            url = tmdb_url("/%s?language=zh-CN&query=%s%s" % (endpoint, urllib.parse.quote(clean_q), extra))
            try:
                self.send_json(200, ft.http_get_json(url))
            except Exception as e:
                self.send_json(502, {"error": "搜索失败: %s" % e})
            return

        # ---- API：详情 + imdb 号（预览用） ----
        if path == "/api/show":
            kind = (qs.get("kind") or ["tv"])[0]
            if kind not in ("tv", "movie"):
                self.send_json(400, {"error": "kind 只能是 tv 或 movie"})
                return
            tid = (qs.get("id") or [""])[0].strip()
            if not tid:
                self.send_json(400, {"error": "缺少 id"})
                return
            endpoint = "movie" if kind == "movie" else "tv"
            try:
                detail = ft.http_get_json(tmdb_url("/%s/%s?language=zh-CN" % (endpoint, urllib.parse.quote(tid))))
                ext = ft.http_get_json(tmdb_url("/%s/%s/external_ids" % (endpoint, urllib.parse.quote(tid))))
                # 主名无中文时，补取中文别名（如 女巫阿加莎）
                name = (detail.get("name") or detail.get("title") or "")
                if name and not ft.has_cjk(name):
                    alias = ft.fetch_zh_alias(API_KEY, tid, kind)
                    if alias:
                        detail["name"] = alias
                        detail["title"] = alias
                # 电影系列归属：系列名无中文时补抓 collection 详情
                if kind == "movie":
                    coll = detail.get("belongs_to_collection")
                    if coll and isinstance(coll, dict):
                        cname = (coll.get("name") or "").strip()
                        cid = coll.get("id")
                        if cid and cname and not ft.has_cjk(cname):
                            try:
                                zc = ft.http_get_json(tmdb_url("/collection/%s?language=zh-CN" % cid))
                                zh_name = (zc.get("name") or "").strip()
                                if zh_name:
                                    detail["belongs_to_collection"] = dict(coll)
                                    detail["belongs_to_collection"]["name_zh"] = zh_name
                            except Exception:
                                pass
                self.send_json(200, {"detail": detail, "imdb_id": ext.get("imdb_id")})
            except Exception as e:
                self.send_json(502, {"error": "获取详情失败: %s" % e})
            return

        name = path.lstrip("/")
        if name not in STATIC_OK:
            self.send_json(404, {"error": "not found"})
            return
        if name and name != "index.html":
            fp = os.path.join(WEB_DIR, name)
            try:
                with open(fp, "rb") as f:
                    body = f.read()
            except OSError:
                self.send_json(404, {"error": "not found"})
                return
        else:
            # index.html：注入资源版本号
            body = serve_index()
        self.send_response(200)
        self.send_header("Content-Type", STATIC_OK[name] or STATIC_OK[""])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        if length > 20 * 1024 * 1024:
            self.send_json(413, {"error": "请求体过大"})
            return
        raw = self.rfile.read(length) if length else b""

        if path == "/api/save-shows":
            try:
                body = json.loads(raw.decode("utf-8"))
                entries = body.get("entries")
                kind = body.get("kind") or "tv"
                if kind not in ("tv", "movie"):
                    raise ValueError("kind 只能是 tv 或 movie")
                if not isinstance(entries, list):
                    raise ValueError("entries 必须是数组")
            except Exception as e:
                self.send_json(400, {"error": "参数错误: %s" % e})
                return
            try:
                save_entries(entries, kind)
                self.send_json(200, {"ok": True, "count": len(entries)})
            except Exception as e:
                self.send_json(500, {"error": "写入失败: %s" % e})

        elif path == "/api/refresh":
            kind = "tv"
            only_unfetched = False
            item = ""
            try:
                if raw:
                    body = json.loads(raw.decode("utf-8"))
                    kind = body.get("kind") or "tv"
                    only_unfetched = bool(body.get("only_unfetched"))
                    item = (body.get("item") or "").strip()
            except Exception:
                pass
            if kind not in ("tv", "movie"):
                kind = "tv"
            buf = io.StringIO()
            saved_argv = sys.argv[:]
            try:
                sys.argv = ["fetch_tv.py"] \
                    + (["--movies"] if kind == "movie" else []) \
                    + (["--only-unfetched"] if only_unfetched else []) \
                    + ([item] if item else [])
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    ft.main()
                self.send_json(200, {"ok": True, "log": buf.getvalue()})
            except SystemExit as e:
                self.send_json(500, {"ok": False, "code": e.code, "log": buf.getvalue()})
            except Exception as e:
                self.send_json(500, {"ok": False, "error": str(e), "log": buf.getvalue()})
            finally:
                sys.argv = saved_argv

        else:
            self.send_json(404, {"error": "not found"})


def main():
    try:
        init_env()
    except Exception as e:
        print("读取配置失败：%s" % e)
        sys.exit(1)
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as e:
        print("启动失败：%s" % e)
        print("请勿重复启动，或修改 server.py 顶部 PORT 后重试。")
        sys.exit(1)
    url = "http://%s:%d/" % (HOST, PORT)
    print("TVSubscribe 本地服务已启动：%s" % url)
    print("按 Ctrl+C 停止服务。")
    if "--no-open" not in sys.argv and sys.platform == "darwin":
        subprocess.Popen(["open", url])
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()