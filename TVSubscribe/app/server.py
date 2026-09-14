#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TVSubscribe 本地小服务：多用户登录 + 每用户数据隔离。

用法：
    双击 start.command（或执行 python3 app/server.py）
    浏览器访问 http://127.0.0.1:38765
数据：
    账号存于 data/users.json（PBKDF2 加盐哈希）
    每个用户的数据存于 data/users/<用户名>/（shows.json、movies.json、data.js、movies_data.js）
"""
import contextlib
import hashlib
import http.cookies
import io
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import fetch_tv as ft

HERE = os.path.dirname(os.path.abspath(__file__))   # app/
ROOT = os.path.dirname(HERE)                          # 项目根目录
WEB_DIR = os.path.join(ROOT, "web")
PORT = 38765
HOST = "0.0.0.0"   # 需在 NAS / 局域网提供服务，监听所有网卡

STATIC_OK = {
    "": "text/html; charset=utf-8",
    "index.html": "text/html; charset=utf-8",
    "login.html": "text/html; charset=utf-8",
    "style.css": "text/css; charset=utf-8",
    "app.js": "application/javascript; charset=utf-8",
    "data.js": "application/javascript; charset=utf-8",
    "movies_data.js": "application/javascript; charset=utf-8",
    "favicon.svg": "image/svg+xml",
}

CONFIG_FIELDS = ("title", "imdb_id", "name_zh", "mark", "group", "watched_seasons")

TMDB_BASE = "https://api.themoviedb.org/3"

USERS_PATH = os.path.join(ROOT, "data", "users.json")
SESSIONS_PATH = os.path.join(ROOT, "data", "sessions.json")
COOKIE_NAME = "tvsub_session"
SESSION_TTL = 30 * 24 * 3600   # 会话有效期 30 天

# 服务启动时读取配置、配置代理（复用 fetch_tv 的请求函数）
_config = None
API_KEY = ""

# 会话与用户并发保护
SESSIONS = {}            # token -> {"username": ..., "expires": ts}
SESSIONS_LOCK = threading.Lock()
USERS_LOCK = threading.Lock()


def init_env():
    global _config, API_KEY
    _config = ft.load_json(ft.CONFIG_PATH)
    ft.set_proxy((_config.get("proxy") or "").strip())
    API_KEY = (ft.load_json(ft.CONFIG_PATH).get("api_key") or "").strip()


def tmdb_url(path):
    sep = "&" if "?" in path else "?"
    return TMDB_BASE + path + sep + "api_key=" + urllib.parse.quote(API_KEY)


# ---------------- 用户与密码 ----------------

def load_users():
    try:
        with open(USERS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) and isinstance(data.get("users"), list) else {"users": []}
    except (FileNotFoundError, json.JSONDecodeError):
        return {"users": []}


def save_users(users):
    with USERS_LOCK:
        tmp = USERS_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, USERS_PATH)


def hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000).hex()
    return salt, digest


def verify_pw(user, password):
    if not user:
        return False
    _, digest = hash_pw(password, user.get("salt") or "")
    return secrets.compare_digest(digest, user.get("hash") or "")


def user_record(username):
    for u in load_users()["users"]:
        if u.get("username") == username:
            return u
    return None


def migrate_legacy_to(username):
    """首次启用多用户时，把旧版全局数据移入 <username> 的用户目录。"""
    ud = ft.user_dir(username)
    os.makedirs(ud, exist_ok=True)
    moves = [
        (os.path.join(ROOT, "data", "shows.json"), os.path.join(ud, "shows.json")),
        (os.path.join(ROOT, "data", "movies.json"), os.path.join(ud, "movies.json")),
        (os.path.join(WEB_DIR, "data.js"), os.path.join(ud, "data.js")),
        (os.path.join(WEB_DIR, "movies_data.js"), os.path.join(ud, "movies_data.js")),
    ]
    for src, dst in moves:
        if os.path.exists(src) and not os.path.exists(dst):
            shutil.move(src, dst)
            print("[迁移] %s -> %s" % (src, dst))


def user_ensure_files(username):
    """保证用户目录下四个数据文件存在（缺失时创建空文件）。"""
    ud = ft.user_dir(username)
    os.makedirs(ud, exist_ok=True)
    for kind in ("tv", "movie"):
        cfg = ft.user_cfg_path(username, kind)
        if not os.path.exists(cfg):
            with open(cfg, "w", encoding="utf-8") as f:
                json.dump({"shows": []}, f, ensure_ascii=False, indent=2)
                f.write("\n")
    for kind, var in (("tv", "TV_DATA"), ("movie", "MOVIE_DATA")):
        data = ft.user_data_path(username, kind)
        if not os.path.exists(data):
            ft.write_output({
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "shows": [],
            }, data, var)


def ensure_users():
    """启动时：首次运行创建账号 xiaolongbao/123456（管理员）并迁移旧数据。"""
    first_run = not os.path.exists(USERS_PATH)
    users = load_users()
    if not users["users"]:
        salt, digest = hash_pw("123456")
        users["users"].append({
            "username": "xiaolongbao",
            "role": "admin",
            "salt": salt,
            "hash": digest,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
        save_users(users)
        print("[账号] 已创建管理员 xiaolongbao（初始密码 123456，请尽快在设置页修改）")
    if first_run:
        migrate_legacy_to("xiaolongbao")
    for u in users["users"]:
        user_ensure_files(u["username"])


# ---------------- 会话 ----------------

def save_sessions():
    with SESSIONS_LOCK:
        payload = dict(SESSIONS)
    tmp = SESSIONS_PATH + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp, SESSIONS_PATH)
    except OSError as e:
        print("[会话] 持久化失败: %s" % e)


def load_sessions():
    """服务启动时恢复历史会话（过滤已过期）。"""
    try:
        with open(SESSIONS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return
    if not isinstance(data, dict):
        return
    now = time.time()
    restored = 0
    with SESSIONS_LOCK:
        for token, s in data.items():
            if isinstance(s, dict) and s.get("username") and s.get("expires", 0) > now:
                SESSIONS[token] = {"username": s["username"], "expires": s["expires"]}
                restored += 1
    if restored:
        print("[会话] 已恢复 %d 个登录会话" % restored)


def create_session(username):
    token = secrets.token_urlsafe(32)
    with SESSIONS_LOCK:
        SESSIONS[token] = {"username": username, "expires": time.time() + SESSION_TTL}
    save_sessions()
    return token


def get_session_user(token):
    if not token:
        return None
    cleaned = False
    with SESSIONS_LOCK:
        s = SESSIONS.get(token)
        if not s:
            return None
        if s["expires"] < time.time():
            SESSIONS.pop(token, None)
            cleaned = True
        else:
            return s["username"]
    if cleaned:
        save_sessions()
    return None


def drop_sessions(username):
    with SESSIONS_LOCK:
        for t in [t for t, s in SESSIONS.items() if s["username"] == username]:
            SESSIONS.pop(t, None)
    save_sessions()


def drop_session_token(token):
    if token:
        with SESSIONS_LOCK:
            SESSIONS.pop(token, None)
        save_sessions()


# ---------------- 数据写盘 ----------------

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
    ws = e.get("watched_seasons")
    if ws is not None:
        try:
            out["watched_seasons"] = int(ws)
        except (TypeError, ValueError):
            pass
    return out


def backup_file(path):
    if os.path.exists(path):
        try:
            shutil.copy2(path, path + ".bak")
        except OSError:
            pass


def save_entries(entries, kind="tv", username=None):
    """写订阅配置文件，并把数据缓存同步为最新列表（保留旧条目富数据，新增条目用页面快照）。"""
    if username:
        cfg_path = ft.user_cfg_path(username, kind)
        data_path = ft.user_data_path(username, kind)
    else:
        cfg_path = ft.MOVIES_PATH if kind == "movie" else ft.SHOWS_PATH
        data_path = ft.MOVIE_OUTPUT_PATH if kind == "movie" else ft.OUTPUT_PATH
    backup_file(cfg_path)
    backup_file(data_path)

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
    old = ft.load_data_payload(data_path, "MOVIE_DATA" if kind == "movie" else "TV_DATA")
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
                "genres": e.get("genres") or [],
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
        if e.get("genres"):
            item["genres"] = e.get("genres")
        item["mark"] = (e.get("mark") or "").strip() or None
        item["group"] = (e.get("group") or "").strip() or None
        try:
            ws = int(e.get("watched_seasons")) if e.get("watched_seasons") is not None else None
        except (TypeError, ValueError):
            ws = None
        if ws is not None:
            item["watched_seasons"] = ws
        else:
            item.pop("watched_seasons", None)
        new_list.append(item)

    ft.write_output({
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "shows": new_list,
    }, data_path, "MOVIE_DATA" if kind == "movie" else "TV_DATA")


def serve_index(username):
    """返回 index.html，并给本地资源加时间戳版本号，避免浏览器缓存旧 JS/CSS。"""
    with open(os.path.join(WEB_DIR, "index.html"), "rb") as f:
        content = f.read().decode("utf-8")
    for asset in ("style.css", "data.js", "movies_data.js", "app.js"):
        fp = os.path.join(WEB_DIR, asset)
        if username and asset in ("data.js", "movies_data.js"):
            fp = ft.user_data_path(username, "movie" if asset == "movies_data.js" else "tv")
        if os.path.exists(fp):
            mtime = int(os.path.getmtime(fp))
            content = content.replace('"%s"' % asset, '"%s?v=%d"' % (asset, mtime))
    return content.encode("utf-8")


def read_file(name):
    with open(os.path.join(WEB_DIR, name), "rb") as f:
        return f.read()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[http] %s\n" % (fmt % args))

    # ---- 工具 ----

    def send_json(self, code, obj, set_cookie=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def send_js(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def session_token(self):
        try:
            c = http.cookies.SimpleCookie(self.headers.get("Cookie") or "")
            m = c.get(COOKIE_NAME)
            return m.value if m else None
        except Exception:
            return None

    def current_user(self):
        u = get_session_user(self.session_token())
        if u and user_record(u):
            return u
        return None

    def require_user(self):
        u = self.current_user()
        if not u:
            self.send_json(401, {"error": "未登录"})
        return u

    def require_admin(self):
        u = self.require_user()
        if not u:
            return None
        if (user_record(u) or {}).get("role") != "admin":
            self.send_json(403, {"error": "需要管理员权限"})
            return None
        return u

    # ---- GET ----

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # 登录态查询（前端启动时校验，未登录返回 401）
        if path == "/api/me":
            u = self.current_user()
            if not u:
                self.send_json(401, {"error": "未登录"})
            else:
                rec = user_record(u)
                self.send_json(200, {"username": u, "is_admin": rec.get("role") == "admin"})
            return

        # 管理员：用户列表
        if path == "/api/users":
            admin = self.require_admin()
            if not admin:
                return
            self.send_json(200, {
                "users": [{"username": x["username"], "role": x["role"]} for x in load_users()["users"]]
            })
            return

        # ---- 需登录的 API：搜索（服务端走代理中转 TMDB） ----
        if path == "/api/search":
            if not self.require_user():
                return
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

        # ---- 需登录的 API：详情 + imdb 号（预览用） ----
        if path == "/api/show":
            if not self.require_user():
                return
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

        # ---- 页面与静态资源 ----
        name = path.lstrip("/")
        if name not in STATIC_OK:
            self.send_json(404, {"error": "not found"})
            return

        u = self.current_user()

        if name in ("", "index.html"):
            # 已登录返回主页面，未登录返回登录页
            if u:
                self.send_html(200, serve_index(u))
            else:
                self.send_html(200, read_file("login.html"))
            return

        if name == "login.html":
            self.send_html(200, read_file("login.html"))
            return

        if name in ("data.js", "movies_data.js"):
            if not u:
                self.send_json(401, {"error": "未登录"})
                return
            fp = ft.user_data_path(u, "movie" if name == "movies_data.js" else "tv")
            try:
                body = open(fp, "rb").read()
            except OSError:
                self.send_json(404, {"error": "数据文件不存在"})
                return
            self.send_js(200, body)
            return

        # 其余静态资源（app.js / style.css / 图标）公开
        try:
            body = read_file(name)
        except OSError:
            self.send_json(404, {"error": "not found"})
            return
        self.send_response(200)
        self.send_header("Content-Type", STATIC_OK[name])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # ---- POST ----

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        if length > 20 * 1024 * 1024:
            self.send_json(413, {"error": "请求体过大"})
            return
        raw = self.rfile.read(length) if length else b""

        def parse_body():
            if not raw:
                return {}
            return json.loads(raw.decode("utf-8"))

        # ---- 登录 / 登出 ----
        if path == "/api/login":
            try:
                body = parse_body()
            except Exception:
                self.send_json(400, {"error": "请求体不是合法 JSON"})
                return
            username = (body.get("username") or "").strip()
            password = body.get("password") or ""
            rec = user_record(username)
            if not rec or not verify_pw(rec, password):
                time.sleep(0.5)   # 拖慢暴力破解
                self.send_json(401, {"error": "用户名或密码错误"})
                return
            token = create_session(username)
            cookie = "%s=%s; HttpOnly; SameSite=Lax; Path=/; Max-Age=%d" % (COOKIE_NAME, token, SESSION_TTL)
            self.send_json(200, {"ok": True, "username": username, "is_admin": rec.get("role") == "admin"}, cookie)
            return

        if path == "/api/logout":
            drop_session_token(self.session_token())
            cookie = "%s=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" % COOKIE_NAME
            self.send_json(200, {"ok": True}, cookie)
            return

        # ---- 管理员：用户管理 ----
        if path == "/api/users":
            admin = self.require_admin()
            if not admin:
                return
            try:
                body = parse_body()
            except Exception:
                self.send_json(400, {"error": "请求体不是合法 JSON"})
                return
            action = body.get("action") or ""
            username = (body.get("username") or "").strip()
            password = body.get("password") or ""
            users = load_users()
            target = next((x for x in users["users"] if x["username"] == username), None)

            if action == "add":
                if not re.match(r"^[A-Za-z0-9_-]{1,32}$", username):
                    self.send_json(400, {"error": "用户名仅限字母、数字、下划线或中划线，最长 32 位"})
                    return
                if len(password) < 6:
                    self.send_json(400, {"error": "密码至少 6 位"})
                    return
                if target:
                    self.send_json(400, {"error": "用户已存在"})
                    return
                salt, digest = hash_pw(password)
                users["users"].append({
                    "username": username,
                    "role": "user",
                    "salt": salt,
                    "hash": digest,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                })
                save_users(users)
                user_ensure_files(username)
                self.send_json(200, {"ok": True})
                return

            if action == "delete":
                if not target:
                    self.send_json(400, {"error": "用户不存在"})
                    return
                if target.get("role") == "admin":
                    self.send_json(400, {"error": "不能删除管理员账号"})
                    return
                users["users"] = [x for x in users["users"] if x["username"] != username]
                save_users(users)
                drop_sessions(username)
                self.send_json(200, {"ok": True})
                return

            if action == "reset_password":
                if not target:
                    self.send_json(400, {"error": "用户不存在"})
                    return
                if len(password) < 6:
                    self.send_json(400, {"error": "密码至少 6 位"})
                    return
                target["salt"], target["hash"] = hash_pw(password)
                save_users(users)
                drop_sessions(username)
                self.send_json(200, {"ok": True})
                return

            self.send_json(400, {"error": "action 只能是 add / delete / reset_password"})
            return

        # ---- 需登录：保存订阅 ----
        if path == "/api/save-shows":
            u = self.require_user()
            if not u:
                return
            try:
                body = parse_body()
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
                save_entries(entries, kind, u)
                self.send_json(200, {"ok": True, "count": len(entries)})
            except Exception as e:
                self.send_json(500, {"error": "写入失败: %s" % e})

        # ---- 需登录：全量 / 部分刷新 ----
        elif path == "/api/refresh":
            u = self.require_user()
            if not u:
                return
            kind = "tv"
            only_unfetched = False
            item = ""
            try:
                if raw:
                    body = parse_body()
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
                ft.set_active_user(u)   # 刷新读写到该用户目录
                try:
                    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                        ft.main()
                finally:
                    ft.clear_active_user()
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
        ensure_users()
    except Exception as e:
        print("初始化用户失败：%s" % e)
        sys.exit(1)
    load_sessions()
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
        subprocess.Popen(["open", "http://127.0.0.1:%d/" % PORT])
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()