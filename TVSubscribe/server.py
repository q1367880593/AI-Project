#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TVSubscribe 本地小服务（可选，用于让页面直接读写 shows.json / data.js）

用法：
    双击 start.command（或执行 python3 server.py）
    浏览器访问 http://127.0.0.1:8765

不启动本服务时，项目仍可按原方式以 file:// 直接打开 index.html。
"""
import contextlib
import io
import json
import os
import subprocess
import sys
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import fetch_tv as ft

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
HOST = "127.0.0.1"

STATIC_OK = {
    "": "text/html; charset=utf-8",
    "index.html": "text/html; charset=utf-8",
    "style.css": "text/css; charset=utf-8",
    "app.js": "application/javascript; charset=utf-8",
    "data.js": "application/javascript; charset=utf-8",
    "shows.json": "application/json; charset=utf-8",
    "favicon.svg": "image/svg+xml",
    "favicon.png": "image/png",
    "apple-touch-icon.png": "image/png",
}

CONFIG_FIELDS = ("title", "imdb_id", "name_zh", "mark")

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
    return out


def save_shows(entries):
    """写 shows.json，并把 data.js 同步为最新列表（保留旧条目富数据，新增条目用页面快照）。"""
    # 1) shows.json（仅配置字段）
    config_items = [clean_config_item(e) for e in entries]
    with open(ft.SHOWS_PATH, "w", encoding="utf-8") as f:
        json.dump({"shows": config_items}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # 2) data.js：按 key 保留旧富数据，更新 mark，新增条目填充快照
    old = ft.load_data_payload()
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
                "poster": e.get("poster"),
                "last_episode": e.get("last_episode"),
                "next_episode": e.get("next_episode"),
                "latest_season": e.get("latest_season"),
                "networks": e.get("networks") or [],
                "found": True,
            }
        candidate_imdb = (e.get("imdb_id") or "").strip()
        if candidate_imdb:
            item["imdb_id"] = candidate_imdb
        item["mark"] = (e.get("mark") or "").strip() or None
        new_list.append(item)

    ft.write_output({
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "shows": new_list,
    })


def serve_index():
    """返回 index.html，并给本地资源加时间戳版本号，避免浏览器缓存旧 JS/CSS。"""
    with open(os.path.join(HERE, "index.html"), "rb") as f:
        content = f.read().decode("utf-8")
    for asset in ("style.css", "data.js", "app.js"):
        mtime = int(os.path.getmtime(os.path.join(HERE, asset)))
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
            q = (qs.get("q") or [""])[0].strip()
            if not q:
                self.send_json(400, {"error": "缺少搜索词 q"})
                return
            if not API_KEY:
                self.send_json(500, {"error": "config.json 缺少 api_key"})
                return
            url = tmdb_url("/search/tv?language=zh-CN&query=" + urllib.parse.quote(q))
            try:
                self.send_json(200, ft.http_get_json(url))
            except Exception as e:
                self.send_json(502, {"error": "搜索失败: %s" % e})
            return

        # ---- API：剧集详情 + imdb 号（预览用） ----
        if path == "/api/show":
            tid = (qs.get("id") or [""])[0].strip()
            if not tid:
                self.send_json(400, {"error": "缺少剧集 id"})
                return
            try:
                detail = ft.http_get_json(tmdb_url("/tv/%s?language=zh-CN" % urllib.parse.quote(tid)))
                ext = ft.http_get_json(tmdb_url("/tv/%s/external_ids" % urllib.parse.quote(tid)))
                # 主名无中文时，补取中文别名（如 女巫阿加莎）
                name = (detail.get("name") or "")
                if name and not ft.has_cjk(name):
                    alias = ft.fetch_zh_alias(API_KEY, tid)
                    if alias:
                        detail["name"] = alias
                self.send_json(200, {"detail": detail, "imdb_id": ext.get("imdb_id")})
            except Exception as e:
                self.send_json(502, {"error": "获取详情失败: %s" % e})
            return

        name = path.lstrip("/")
        if name not in STATIC_OK:
            self.send_json(404, {"error": "not found"})
            return
        if name and name != "index.html":
            fp = os.path.join(HERE, name)
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
                entries = json.loads(raw.decode("utf-8")).get("entries")
                if not isinstance(entries, list):
                    raise ValueError("entries 必须是数组")
            except Exception as e:
                self.send_json(400, {"error": "参数错误: %s" % e})
                return
            try:
                save_shows(entries)
                self.send_json(200, {"ok": True, "count": len(entries)})
            except Exception as e:
                self.send_json(500, {"error": "写入失败: %s" % e})

        elif path == "/api/refresh":
            buf = io.StringIO()
            try:
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    ft.main()
                self.send_json(200, {"ok": True, "log": buf.getvalue()})
            except SystemExit as e:
                self.send_json(500, {"ok": False, "code": e.code, "log": buf.getvalue()})
            except Exception as e:
                self.send_json(500, {"ok": False, "error": str(e), "log": buf.getvalue()})

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