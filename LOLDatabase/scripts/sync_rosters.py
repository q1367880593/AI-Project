"""赛段阵容（roster）采集：解析各赛段页 wikitext 的 Rosters 模板块。

数据源：赛段页面内 {{RostersStart}}..{{TeamRoster|team=..}}..{{TeamRoster/Line|
player=ID (姓名) |flag=cn |role=t}}..{{RostersEnd}} 模板（role: t/j/m/a/s 选手，
c 教练）。落盘 data/raw/rosters/pages/{slug}.json（每页一个文件，存在即跳过；
--force 强制重拉）。

用法:
    .venv/bin/python scripts/sync_rosters.py [--force] [--pages P1,P2,...]
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import config
from collectors.cargo import CargoClient
from collectors.stages import slug

ROSTER_BLOCK = re.compile(
    r"\{\{RostersStart[\s\S]*?\{\{RostersEnd\}\}", re.IGNORECASE
)
TEAM_RE = re.compile(
    r"\{\{TeamRoster\|team\s*=\s*([^|}\n]+)", re.IGNORECASE
)
LINE_RE = re.compile(
    r"\{\{TeamRoster/Line\s*\|\s*player\s*=\s*([^|}\n]+)"
    r"\s*\|\s*flag\s*=\s*([\w-]+)(?:\s*\|\s*role\s*=\s*(\w))?",
    re.IGNORECASE,
)


def strip_wikilink(v: str) -> str:
    v = (v or "").strip()
    if v.startswith("[[") and "]]" in v:
        return v[2:].split("]]")[0].split("|")[0].strip()
    return v


def parse_rosters(wikitext: str) -> list:
    """wikitext → [{team, members:[{player, flag, role}]}]（每页只取第一个 Rosters 块）。"""
    out = []
    for block in ROSTER_BLOCK.findall(wikitext or ""):
        ms = list(TEAM_RE.finditer(block))
        for i, m in enumerate(ms):
            seg = block[m.end(): ms[i + 1].start()] if i + 1 < len(ms) else block[m.end():]
            lines = []
            for lm in LINE_RE.finditer(seg):
                lines.append({
                    "player": strip_wikilink(lm.group(1)),
                    "flag": (lm.group(2) or "").lower(),
                    "role": (lm.group(3) or "").lower(),
                })
            out.append({"team": strip_wikilink(m.group(1)), "members": lines})
        break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="已缓存页面也重新拉取")
    ap.add_argument("--pages", default="", help="只拉指定页面（逗号分隔）")
    args = ap.parse_args()

    auth = config.load_auth()
    if not auth:
        print("缺少登录凭据，已中止。", flush=True)
        return 2

    client = CargoClient()
    client.login(*auth)

    # 目标页面：库内全部赛段
    import sqlite3
    conn = sqlite3.connect(config.DB_PATH)
    pages = [r[0] for r in conn.execute(
        "SELECT overview_page FROM tournaments WHERE overview_page IS NOT NULL"
    ).fetchall()]
    conn.close()
    if args.pages:
        pages = [p for p in args.pages.split(",") if p]

    out_root = config.RAW_DIR / "rosters" / "pages"
    out_root.mkdir(parents=True, exist_ok=True)
    done = failed = 0
    for idx, page in enumerate(pages, 1):
        dest = out_root / f"{slug(page)}.json"
        if dest.exists() and not args.force:
            done += 1
            continue
        try:
            data = client._plain_get({
                "action": "parse", "page": page, "prop": "wikitext",
                "format": "json",
            })
        except Exception as exc:
            print(f"  ✗ [{idx}/{len(pages)}] {page}: {exc}", flush=True)
            failed += 1
            continue
        wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
        rosters = parse_rosters(wikitext)
        dest.write_text(
            json.dumps({"page": page, "rosters": rosters}, ensure_ascii=False),
            encoding="utf-8",
        )
        n_teams = len(rosters)
        n_lines = sum(len(t["members"]) for t in rosters)
        print(
            f"  ✔ [{idx}/{len(pages)}] {page}: {n_teams} 队 / {n_lines} 行",
            flush=True,
        )
        time.sleep(1.2)

    print(
        f"== roster 采集完成：跳过已缓存 {done}，失败 {failed}，"
        f"处理 {len(pages) - done - failed} ==",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())