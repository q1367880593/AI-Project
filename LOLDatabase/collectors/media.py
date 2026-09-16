"""媒体资源本地缓存。

- 英雄图标: communitydragon champion-icons（直连）
- 英雄原画: ddragon splash（直连）
- 战队 logo / 选手头像: Leaguepedia 文件（imageinfo 解析 URL 后直连 nocookie 下载）
- 召唤师技能 / 装备 / 饰品图标: ddragon 多版本 item.json/summoner.json（直连，icon_assets 表）

所有下载登记进 media_assets 表；文件已存在则跳过（断点续传），哈希与来源可追溯。
"""

import hashlib
import re
import time
from pathlib import Path

import requests

from collectors import config
from collectors.cargo import CargoClient
from collectors.load import b, s

ASSET_ROOT = config.ROOT / "assets" / "images"

DIRECT_SESSION = requests.Session()  # 直连会话（CDN/ddragon/nocookie 都可直连）
DIRECT_SESSION.headers["User-Agent"] = config.USER_AGENT

ICON_URL = (
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/"
    "global/default/v1/champion-icons/{key}.png"
)
SPLASH_URL = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{name}_0.jpg"

# 召唤师技能图标：ddragon 已停更（停在 16.x），2026 赛季改用 communitydragon
SPELL_ICON_BASE = (
    "https://raw.communitydragon.org/latest/game/data/spells/icons2d/{file}"
)

# ddragon summoner id → communitydragon icons2d 文件名（注意个别命名不规则）
CD_SPELL_FILES = {
    "SummonerBarrier": "summonerbarrier.png",
    "SummonerBoost": "summoner_boost.png",
    "SummonerDot": "summonerignite.png",
    "SummonerExhaust": "summoner_exhaust.png",
    "SummonerFlash": "summoner_flash.png",
    "SummonerHaste": "summoner_haste.png",
    "SummonerHeal": "summoner_heal.png",
    "SummonerSmite": "summoner_smite.png",
    "SummonerTeleport": "summoner_teleport.png",
}


def _snake(camel: str) -> str:
    """SummonerFlash → summoner_flash。"""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", camel).lower()

# wiki 旧名 → ddragon 名称（饰品升级链 / 单复数差异）
ITEM_ALIASES = {
    "Greater Totem": "Greater Stealth Totem (Trinket)",
    "Greater Lens": "Oracle Alteration",
    "Oracle's Lens": "Oracle Alteration",
    "Farsight Orb": "Farsight Alteration",
    "Scrying Orb": "Farsight Alteration",
    "Greater Orb": "Farsight Alteration",
    "Lord Dominik's Regard": "Lord Dominik's Regards",
}


def _grab(session, url, dest: Path, entity_type, entity_id, kind, source, conn) -> int:
    """下载单个资源并登记 media_assets；成功返回 1。"""
    if dest.exists() and dest.stat().st_size > 0:
        data = dest.read_bytes()
    else:
        try:
            resp = session.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.content
            if not data or not resp.headers.get("content-type", "").startswith("image"):
                return 0
        except requests.RequestException as exc:
            print(f"  ✗ {dest.name}: {exc}", flush=True)
            return 0
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        time.sleep(0.2)
    sha = hashlib.sha256(data).hexdigest()
    rel = dest.relative_to(config.ROOT).as_posix()
    row = conn.execute(
        "SELECT id FROM media_assets "
        "WHERE entity_type=? AND entity_id=? AND kind=?",
        (entity_type, entity_id, kind),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE media_assets SET source=?, source_url=?, local_path=?, "
            "sha256=?, fetched_at=datetime('now'), is_active=1 WHERE id=?",
            (source, url, rel, sha, row[0]),
        )
    else:
        conn.execute(
            "INSERT INTO media_assets"
            "(entity_type, entity_id, kind, source, source_url, local_path, "
            "sha256, fetched_at, is_active) "
            "VALUES(?,?,?,?,?,?,?,datetime('now'),1)",
            (entity_type, entity_id, kind, source, url, rel, sha),
        )
    return 1


def fetch_champion_media(conn) -> tuple[int, int]:
    """英雄图标 + 原画。"""
    n_icon = n_splash = 0
    rows = conn.execute(
        "SELECT id, name, key_integer FROM champions WHERE key_integer IS NOT NULL"
    ).fetchall()
    for cid, name, key in rows:
        if key:
            n_icon += _grab(
                DIRECT_SESSION, ICON_URL.format(key=key),
                ASSET_ROOT / "champions" / "icons" / f"{cid}.png",
                "champion", cid, "icon", "communitydragon", conn,
            )
        if name:
            n_splash += _grab(
                DIRECT_SESSION, SPLASH_URL.format(name=name),
                ASSET_ROOT / "champions" / "splashes" / f"{cid}.jpg",
                "champion", cid, "splash", "ddragon", conn,
            )
    print(f"  champions: 图标 {n_icon} / 原画 {n_splash}", flush=True)
    return n_icon, n_splash


TEAM_FIELDS = (
    "OverviewPage,Name,Short,Region,TeamLocation,Image,RosterPhoto,"
    "RenamedTo,IsDisbanded"
)


def _file_titles(values) -> list[str]:
    return [f"File:{v.strip()}" for v in values if v and v.strip()]


def _imageinfo_map(client: CargoClient, titles: list[str], width: int | None = None) -> dict:
    """File 标题 → 图片 URL（分 40 个一批查 imageinfo；width 给定时返回缩略图）。"""
    url_map = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i : i + 40]
        params = {
            "action": "query",
            "titles": "|".join(chunk),
            "prop": "imageinfo",
            "iiprop": "url",
            "format": "json",
            "formatversion": "2",
        }
        if width:
            params["iiurlwidth"] = str(width)
        data = client.mediawiki(params)
        for page in data.get("query", {}).get("pages", []):
            if page.get("missing"):
                continue
            info = (page.get("imageinfo") or [{}])[0]
            u = (info.get("thumburl") or info.get("url")) if width else info.get("url")
            if u:
                url_map[page["title"]] = u
        time.sleep(0.5)
    return url_map


def fetch_team_media(conn) -> int:
    """拉取 Teams Cargo 档案（顺带补全 teams 表字段）并下载 logo。"""
    client = CargoClient()
    auth = config.load_auth()
    assert auth, "缺少 .auth.json 登录凭据"
    client.login(*auth)

    # 1) 按 OverviewPage 批量拉 Teams 行
    pages = [
        r[0]
        for r in conn.execute(
            "SELECT overview_page FROM teams WHERE overview_page IS NOT NULL"
        ).fetchall()
    ]
    rows = []
    for i in range(0, len(pages), 40):
        chunk = pages[i : i + 40]
        where = "OverviewPage IN (" + ",".join(
            f"'{p.replace(chr(39), chr(92) + chr(39))}'" for p in chunk
        ) + ")"
        rows.extend(
            client.cargoquery(
                {
                    "action": "cargoquery",
                    "tables": "Teams",
                    "fields": TEAM_FIELDS,
                    "where": where,
                }
            )
        )
        time.sleep(0.5)

    image_by_page = {}
    for row in rows:
        page = s(row.get("OverviewPage"))
        if not page:
            continue
        image_by_page[page] = s(row.get("Image"))
        ups = {
            "name": s(row.get("Name")) or page,
            "short_name": s(row.get("Short")),
            "region": s(row.get("Region")),
            "location": s(row.get("TeamLocation")),
            "image": s(row.get("Image")),
            "roster_photo": s(row.get("RosterPhoto")),
            "renamed_to": s(row.get("RenamedTo")),
            "is_disbanded": b(row.get("IsDisbanded")),
        }
        cur = conn.execute(
            "UPDATE teams SET " + ",".join(f"{k}=?" for k in ups) +
            " WHERE overview_page=?",
            [*ups.values(), page],
        )
        if cur.rowcount == 0:
            conn.execute(
                "INSERT INTO teams(overview_page, name, short_name, region, "
                "location, image, roster_photo, renamed_to, is_disbanded) "
                "VALUES(?,?,?,?,?,?,?,?,?)",
                (page, ups["name"], ups["short_name"], ups["region"],
                 ups["location"], ups["image"], ups["roster_photo"],
                 ups["renamed_to"], ups["is_disbanded"]),
            )
    print(f"  teams: 档案行 {len(rows)}", flush=True)

    # 2) imageinfo → 下载
    team_rows = conn.execute(
        "SELECT id, overview_page FROM teams WHERE overview_page IS NOT NULL"
    ).fetchall()
    targets = [(tid, p) for tid, p in team_rows if image_by_page.get(p)]
    titles = _file_titles([image_by_page[p] for _, p in targets])
    url_map = _imageinfo_map(client, titles)

    n_logo = 0
    for tid, page in targets:
        title = f"File:{image_by_page[page]}"
        url = url_map.get(title)
        if not url:
            continue
        ext = Path(url.split("?")[0]).suffix or ".png"
        n_logo += _grab(
            DIRECT_SESSION, url,
            ASSET_ROOT / "teams" / "logos" / f"{tid}{ext}",
            "team", tid, "logo", "leaguepedia", conn,
        )
    print(f"  teams: logo 下载 {n_logo}", flush=True)
    return n_logo


def fetch_player_media(conn, client: CargoClient) -> int:
    """选手头像（players.image 字段 → imageinfo → 下载）。"""
    rows = conn.execute(
        "SELECT id, image FROM players WHERE image IS NOT NULL AND image != ''"
    ).fetchall()
    targets = [(pid, img) for pid, img in rows if img and img.lower() != "default.png"]
    titles = _file_titles([img for _, img in targets])
    url_map = _imageinfo_map(client, titles)

    n_photo = 0
    for pid, img in targets:
        url = url_map.get(f"File:{img.strip()}")
        if not url:
            continue
        ext = Path(url.split("?")[0]).suffix or ".png"
        n_photo += _grab(
            DIRECT_SESSION, url,
            ASSET_ROOT / "players" / "photos" / f"{pid}{ext}",
            "player", pid, "photo", "leaguepedia", conn,
        )
    print(f"  players: 头像下载 {n_photo}", flush=True)
    return n_photo


def _json_get(url):
    """直连 GET JSON。"""
    resp = DIRECT_SESSION.get(url, timeout=60)
    resp.raise_for_status()
    return resp.json()


def _grab_icon(conn, kind: str, name: str, url: str, version: str, force: bool = False) -> int:
    """下载单个图标并登记 icon_assets；成功返回 1（force=True 时强制覆盖重下）。"""
    dest = (
        ASSET_ROOT / ("summoners" if kind == "spell" else "items")
        / f"{hashlib.sha256(name.encode()).hexdigest()[:12]}.png"
    )
    if not force and dest.exists() and dest.stat().st_size > 0:
        data = dest.read_bytes()
    else:
        try:
            resp = DIRECT_SESSION.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.content
            if not data:
                return 0
        except requests.RequestException as exc:
            print(f"  ✗ {name}: {exc}", flush=True)
            return 0
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        time.sleep(0.15)
    sha = hashlib.sha256(data).hexdigest()
    rel = dest.relative_to(config.ROOT).as_posix()
    conn.execute(
        "INSERT INTO icon_assets(kind, name, local_path, source_url, version, "
        "sha256, fetched_at) VALUES(?,?,?,?,?,?,datetime('now')) "
        "ON CONFLICT(kind, name) DO UPDATE SET local_path=excluded.local_path, "
        "source_url=excluded.source_url, version=excluded.version, "
        "sha256=excluded.sha256, fetched_at=datetime('now')",
        (kind, name, rel, url, version, sha),
    )
    return 1


def _version_key(v: str) -> tuple:
    return tuple(int(p) for p in v.split("."))


def fetch_icon_assets(conn) -> tuple[int, int]:
    """召唤师技能 + 装备/饰品图标（ddragon 直连，多版本 name→icon 映射）。

    ddragon 只保留各版本当季物品：早期装备（Ninja Tabi 等）需用历史版本
    item.json 匹配；全局最新版优先，按主版本逐年回退补齐。
    """
    # 1) 收集库中出现过的名称
    need = {"spell": set(), "item": set()}
    for ss_col, it_col, tri_col in conn.execute(
        "SELECT summoner_spells, items, trinket FROM game_player_stats"
    ).fetchall():
        for x in (ss_col or "").split(","):
            x = x.strip()
            if x:
                need["spell"].add(x)
        for x in (it_col or "").split(";"):
            x = x.strip()
            if x:
                need["item"].add(x)
        t = (tri_col or "").strip()
        if t:
            need["item"].add(t)
    print(
        f"  icons: 待匹配 技能 {len(need['spell'])} 种 / "
        f"装备+饰品 {len(need['item'])} 种", flush=True,
    )

    # 2) 版本选择：每主版本取首/中/末三个补丁（覆盖改名前后的物品命名）
    versions = _json_get("https://ddragon.leagueoflegends.com/api/versions.json")
    try:
        versions = [v for v in versions if all(p.isdigit() for p in v.split("."))]
    except AttributeError:
        pass
    latest = max(versions, key=_version_key)
    by_major = {}
    for v in versions:
        by_major.setdefault(v.split(".")[0], []).append(v)
    picks = {latest}
    for group in by_major.values():
        group.sort(key=_version_key)
        picks.add(group[0])
        picks.add(group[len(group) // 2])
        picks.add(group[-1])
    picks = sorted(picks, key=_version_key, reverse=True)
    print(f"  icons: 使用 {len(picks)} 个历史版本（{picks[0]} → {picks[-1]}）", flush=True)

    # 3) 召唤师技能（ddragon summoner.json 仅用于 name→id 映射，图标取自 communitydragon）
    spell_icon = {}
    sj = _json_get(
        f"https://ddragon.leagueoflegends.com/cdn/{latest}/data/en_US/summoner.json"
    )
    for sid, info in sj.get("data", {}).items():
        nm = info.get("name")
        if nm:
            # 16.18.1 的键名带 "_Jade" 后缀（翡翠主题变体），此处剥除
            spell_icon[nm] = sid.replace("_Jade", "")

    # 4) 装备/饰品（多版本 item.json，新版本优先）
    item_icon = {}  # name -> (version, imgfile)
    for ver in picks:
        try:
            ij = _json_get(
                f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/item.json"
            )
        except requests.RequestException as exc:
            print(f"  ✗ item.json {ver}: {exc}", flush=True)
            continue
        for key, info in ij.get("data", {}).items():
            if not isinstance(info, dict):
                continue
            nm = info.get("name")
            if not nm or nm in item_icon:
                continue
            img = (info.get("image") or {}).get("full") or f"{key}.png"
            item_icon[nm] = (ver, img)
        time.sleep(0.2)

    # 5) 下载
    n_spell = 0
    for nm in sorted(need["spell"]):
        sid = spell_icon.get(nm)
        if not sid:
            continue
        file = CD_SPELL_FILES.get(sid) or _snake(sid) + ".png"
        n_spell += _grab_icon(
            conn, "spell", nm, SPELL_ICON_BASE.format(file=file),
            "cd-latest", force=True,
        )

    def _resolve(nm: str):
        """wiki 命名 → ddragon 名称（(Trinket) 后缀 / 显式别名 / 版本范围后缀 / 附魔变体）。"""
        if nm in item_icon:
            return item_icon[nm]
        if nm + " (Trinket)" in item_icon:
            return item_icon[nm + " (Trinket)"]
        alias = ITEM_ALIASES.get(nm)
        if alias and alias in item_icon:
            return item_icon[alias]
        m1 = re.match(r"^(.*?)\s*\([0-9][^)]*\)$", nm)  # "X (6.3 - 10.22)" / "(Item)"
        if m1:
            base = m1.group(1).rstrip()
            if base in item_icon:
                return item_icon[base]
        m2 = re.match(r"^(.*?)\s+-\s+(.+)$", nm)  # "Berserker's Greaves - Alacrity"
        if m2:
            base = m2.group(1)
            if base in item_icon:
                return item_icon[base]
        if nm.startswith("Bonetooth Necklace") and "Bonetooth Necklace" in item_icon:
            return item_icon["Bonetooth Necklace"]
        return None

    n_item = 0
    for nm in sorted(need["item"]):
        hit = _resolve(nm)
        if not hit:
            continue
        ver, img = hit
        n_item += _grab_icon(
            conn, "item", nm,
            f"https://ddragon.leagueoflegends.com/cdn/{ver}/img/item/{img}",
            ver,
        )
    miss_spell = sorted(set(need["spell"]) - set(spell_icon))
    miss_item = sorted(nm for nm in need["item"] if not _resolve(nm))
    if miss_spell:
        print(f"  ✗ 技能无图标 {len(miss_spell)} 种: {miss_spell}", flush=True)
    if miss_item:
        print(
            f"  ✗ 装备无图标 {len(miss_item)} 种（示例）: {miss_item[:30]}", flush=True
        )
    print(f"  icons: 技能 {n_spell} / 装备+饰品 {n_item} 下载完成", flush=True)
    return n_spell, n_item


def _fallback_page_image(client: CargoClient, titles: list[str]) -> dict:
    """pageimages 无果时：取页面 images 列表第一张"像头像"的图。

    过滤英雄方形图/原画等命名模式，返回 {title: thumb_url}。
    """
    url_map = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i : i + 40]
        data = client.mediawiki(
            {
                "action": "query",
                "titles": "|".join(chunk),
                "prop": "images",
                "imlimit": "12",
                "format": "json",
                "formatversion": "2",
            }
        )
        for page in data.get("query", {}).get("pages", []):
            if page.get("missing"):
                continue
            cands = [
                im["title"]
                for im in page.get("images", [])
                if re.search(r"\.(png|jpe?g)$", im["title"], re.I)
                and not re.search(
                    r"(Square|Splash|Circle|Original|_0\.|Loading|Logo)", im["title"]
                )
            ]
            if cands:
                url_map[page["title"]] = cands[0]
        time.sleep(0.4)
    return url_map


def _norm_title(t: str) -> str:
    """MediaWiki 标题归一：下划线转空格 + 首字母小写折叠。"""
    return t.replace("_", " ").strip().casefold()


def fetch_player_avatar_fallback(conn, client: CargoClient) -> int:
    """无头像选手补采：pageimages 缩略图 → 页面 images 列表兜底。

    Cargo Players.Image 字段大部分为空，但选手页面本身普遍有头像图，
    通过 MediaWiki pageimages（redirects=1，自动解析重定向链）批量拿缩略图。
    短 ID 直达页（可能撞名他人）用 Cargo Players.OverviewPage 反验证归属。
    """
    rows = conn.execute(
        "SELECT p.id, p.player_id, COALESCE(NULLIF(p.overview_page,''), "
        "  (SELECT alias FROM player_aliases a WHERE a.player_id=p.id "
        "   AND lower(a.alias) GLOB lower(p.player_id) || ' (*' LIMIT 1), p.player_id) "
        "FROM players p "
        "WHERE NOT EXISTS (SELECT 1 FROM media_assets m "
        "  WHERE m.entity_type='player' AND m.entity_id=p.id "
        "  AND m.kind='photo' AND m.is_active=1)"
    ).fetchall()
    if not rows:
        print("  players: 头像已全覆盖", flush=True)
        return 0
    by_norm = {_norm_title(r[2]): (r[2], r[0], r[1]) for r in rows}
    titles = sorted({t for t, _, _ in by_norm.values()})
    print(f"  players: 待补头像 {len(titles)} 人", flush=True)

    # 1) pageimages 批量查询（redirects=1：API 直接返回重定向最终页的图）
    thumb = {}       # norm输入 → 缩略图 URL
    final_of = {}    # norm输入 → 最终页面（区分大小写）
    for i in range(0, len(titles), 40):
        chunk = titles[i : i + 40]
        data = client.mediawiki(
            {
                "action": "query",
                "titles": "|".join(chunk),
                "prop": "pageimages",
                "piprop": "thumbnail|name",
                "pithumbsize": "150",
                "redirects": "1",
                "format": "json",
                "formatversion": "2",
            }
        )
        hops = {
            r["from"]: r["to"]
            for r in data.get("query", {}).get("redirects", [])
        }
        final_key = {}   # 最终页（norm）→ 输入（norm）
        for t in chunk:
            cur = t
            seen = set()
            while cur in hops and cur not in seen:
                seen.add(cur)
                cur = hops[cur]
            final_key[_norm_title(cur)] = _norm_title(t)
        for page in data.get("query", {}).get("pages", []):
            if page.get("missing"):
                continue
            pt = page["title"]
            key = final_key.get(_norm_title(pt), _norm_title(pt))
            if key not in by_norm:
                continue
            final_of[key] = pt
            th = (page.get("thumbnail") or {}).get("source")
            if th:
                thumb[key] = th
        time.sleep(0.4)

    # 2) 短 ID 直达页归属验证（可能与他人撞名，如 'Cool'）
    susp = {}
    for key, pt in final_of.items():
        title, _dbid, pid = by_norm[key]
        if pt != title and "(" not in title:
            pass  # 重定向解析（含大小写变体），可信
        elif "(" in title:
            pass  # 全名页，可信
        else:
            susp[key] = pt  # 短 ID == 页面名，需验证
    if susp:
        susps = list(susp.items())
        for i in range(0, len(susps), 40):
            batch = susps[i : i + 40]
            pages = sorted({pt for _, pt in batch})
            where = "OverviewPage IN (" + ",".join(
                f"'{p.replace(chr(39), chr(92) + chr(39))}'" for p in pages
            ) + ")"
            try:
                rows2 = client.cargoquery(
                    {
                        "action": "cargoquery",
                        "tables": "Players",
                        "fields": "OverviewPage,ID",
                        "where": where,
                    }
                )
            except Exception as exc:
                print(f"  ✗ 归属验证查询失败: {exc}", flush=True)
                rows2 = []
            owner = {}
            for r in rows2:
                owner.setdefault(r.get("OverviewPage"), s(r.get("ID")))
            for key, pt in batch:
                oid = owner.get(pt)
                want = by_norm[key][2]
                if not oid or oid.casefold() != want.casefold():
                    thumb.pop(key, None)  # 归属不符，弃用
            time.sleep(0.5)

    # 3) 页面 images 列表兜底（仅重定向解析或全名页；短 ID 撞名页不猜）
    noimg = [t for t in titles if _norm_title(t) not in thumb]
    guessable = [
        t for t in noimg
        if (final_of.get(_norm_title(t), t) != t) or "(" in t
    ]
    if guessable:
        print(f"  players: pageimages 无图 {len(noimg)} 人，可兜底 {len(guessable)} 人", flush=True)
        file_of = _fallback_page_image(client, [final_of.get(_norm_title(t), t) for t in guessable])
        url_map = _imageinfo_map(client, list(file_of.values()))
        for t in guessable:
            ft = final_of.get(_norm_title(t), t)
            u = url_map.get(file_of.get(ft, ""))
            if u:
                thumb[_norm_title(t)] = u

    # 4) 下载
    n = 0
    for ntitle, url in thumb.items():
        _orig, pid, _pid_str = by_norm[ntitle]
        ext = Path(url.split("?")[0]).suffix or ".png"
        n += _grab(
            DIRECT_SESSION, url,
            ASSET_ROOT / "players" / "photos" / f"{pid}{ext}",
            "player", pid, "photo", "leaguepedia-page", conn,
        )

    # 4.5) 同人大小写变体复用（icon/Icon、Clearlove/ClearLove 等重复档案）
    rem = conn.execute(
        "SELECT p.id, p.player_id FROM players p "
        "WHERE NOT EXISTS (SELECT 1 FROM media_assets m "
        "  WHERE m.entity_type='player' AND m.entity_id=p.id "
        "  AND m.kind='photo' AND m.is_active=1)"
    ).fetchall()
    for pid, pid_str in rem:
        sib = conn.execute(
            "SELECT m.local_path, m.sha256, m.source, m.source_url FROM media_assets m "
            "JOIN players p2 ON p2.id=m.entity_id "
            "WHERE m.entity_type='player' AND m.kind='photo' AND m.is_active=1 "
            "AND lower(p2.player_id)=lower(?) AND p2.id<>? LIMIT 1",
            (pid_str, pid),
        ).fetchone()
        if sib:
            conn.execute(
                "INSERT INTO media_assets(entity_type, entity_id, kind, source, "
                "source_url, local_path, sha256, fetched_at, is_active) "
                "VALUES('player',?, 'photo',?,?,?,?,datetime('now'),1)",
                (pid, sib[2] or "leaguepedia-page", sib[3], sib[0], sib[1]),
            )
            n += 1
    missing = len(titles) - len(thumb)
    print(
        f"  players: 头像补采 {n} 张"
        + (f"，仍缺 {missing} 人" if missing else ""),
        flush=True,
    )
    return n


def _norm_link(link: str) -> str:
    """选手链接归一：大小写折叠 + 去全名后缀（'Lele (Dang Bo-Lin)' → 'lele'）。"""
    link = (s(link)).strip()
    link = re.sub(r"\s*\(.*\)\s*$", "", link)
    return link.casefold()


def _year_of(image_row: dict) -> int | None:
    """图像年份：文件名 → Tournament → SortDate。"""
    target = " ".join(
        str(image_row.get(k) or "") for k in ("FN", "TO", "SD")
    )
    m = re.search(r"(20\d{2})", target)
    return int(m.group(1)) if m else None


def fetch_player_year_photos(conn, client: CargoClient) -> int:
    """按年份缓存选手定妆照（PlayerImages Cargo：LPL 相关 Headshot）。

    每场比赛渲染时按对局日期选 ≤ 年份的最新一张。
    """
    # 1) DB 选手链接集合（现役用名 + 比赛中 link_used）
    db_links = {}
    for pid, pkey in conn.execute(
        "SELECT id, player_id FROM players"
    ).fetchall():
        db_links.setdefault(_norm_link(pkey), set()).add(pid)
    for pid, link in conn.execute(
        "SELECT DISTINCT player_id, link_used FROM game_player_stats "
        "WHERE link_used IS NOT NULL AND link_used != ''"
    ).fetchall():
        db_links.setdefault(_norm_link(link), set()).add(pid)

    # 2) 分页拉 LPL 相关 PlayerImages 行
    rows_img = []
    offset = 0
    while True:
        data = client.mediawiki(
            {
                "action": "cargoquery",
                "tables": "PlayerImages",
                "fields": "_pageName=Page,Link=PL,Team=TM,Tournament=TO,"
                "ImageType=IT,IsProfileImage=PI,FileName=FN,SortDate=SD",
                "where": "Tournament LIKE 'LPL%' AND Tournament NOT LIKE 'LPLOL%' "
                "AND ImageType='Headshot'",
                "offset": str(offset),
                "limit": "500",
                "format": "json",
            }
        )
        rows_img.extend(
            {k.replace(" ", "_"): v for k, v in r["title"].items()}
            for r in data.get("cargoquery", [])
        )
        if len(data.get("cargoquery", [])) < 500:
            break
        offset += 500
        time.sleep(0.5)
    print(f"  year-photos: PlayerImages LPL 行 {len(rows_img)}", flush=True)

    # 3) (选手, 年份) → 定妆照文件（同组取文件名逆序即较新命名）
    best = {}
    for row in rows_img:
        if (row.get("PI") or "").strip() not in ("1", "Yes"):
            continue
        year = _year_of(row)
        if not year:
            continue
        norm = _norm_link(row.get("PL"))
        if norm not in db_links:
            continue
        key = (norm, year)
        prev = best.get(key)
        if prev is None or str(row.get("FN")) > str(prev.get("FN")):
            best[key] = row

    # 4) 下载（imageinfo → 160px 缩略图）
    print(f"  year-photos: 待下载 {len(best)} 组", flush=True)
    url_map = _imageinfo_map(
        client, sorted({f"File:{r['FN']}" for r in best.values()}), 160
    )
    n = 0
    for (norm, year), row in sorted(best.items()):
        fn = str(row.get("FN") or "")
        url = url_map.get(f"File:{fn}")
        if not url:
            continue
        ext = Path(url.split("?")[0]).suffix or ".png"
        tgt = ASSET_ROOT / "players" / "years" / f"{norm}_{year}{ext}"
        for pid in db_links[norm]:
            n += _grab_year(
                DIRECT_SESSION, url, tgt, pid, year, "leaguepedia-year", conn
            )
    return n


def _grab_year(session, url, dest: Path, entity_id, year, source, conn) -> int:
    """下载年代定妆照并登记 media_assets（带 year）。"""
    if dest.exists() and dest.stat().st_size > 0:
        data = dest.read_bytes()
    else:
        try:
            resp = session.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.content
            if not data:
                return 0
        except requests.RequestException as exc:
            return 0
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        time.sleep(0.15)
    sha = hashlib.sha256(data).hexdigest()
    rel = dest.relative_to(config.ROOT).as_posix()
    conn.execute(
        "INSERT INTO media_assets(entity_type, entity_id, kind, source, "
        "source_url, local_path, sha256, fetched_at, is_active, year) "
        "VALUES('player',?, 'photo',?,?,?,?,datetime('now'),1,?) "
        "ON CONFLICT(entity_type, entity_id, kind, year) DO UPDATE SET "
        "source=excluded.source, source_url=excluded.source_url, "
        "local_path=excluded.local_path, sha256=excluded.sha256, "
        "fetched_at=datetime('now'), is_active=1",
        (entity_id, source, url, rel, sha, year),
    )
    return 1


def run() -> dict:
    """全量媒体缓存（幂等）。"""
    import sqlite3

    from collectors.load import init_db

    conn = init_db()
    counts = {}
    counts["champions"] = fetch_champion_media(conn)
    counts["teams"] = fetch_team_media(conn)
    client = CargoClient()
    auth = config.load_auth()
    assert auth, "缺少 .auth.json 登录凭据"
    client.login(*auth)
    counts["players"] = fetch_player_media(conn, client)
    conn.commit()
    conn.close()
    return counts