#!/usr/bin/env python3
"""探查 Leaguepedia Cargo API：拉取目标表的字段定义与样例数据。

用法:
    .venv/bin/python scripts/explore_cargo.py [--samples N] [--only Teams,Players]

输出:
    data/cargo_schema/<表>.schema.json   Cargo 表字段定义
    data/cargo_schema/<表>.sample.json   样例行（用于验证字段语义）
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests

API_URL = "https://lol.fandom.com/api.php"
USER_AGENT = "LOLDB-explorer/0.1 (personal research; python-requests)"
DEFAULT_PROXY = "http://127.0.0.1:1087"  # 本机代理，直连 fandom.com 会超时
REQUEST_INTERVAL = 1.0  # 请求间隔（秒）
MAX_ATTEMPTS = 3

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "cargo_schema"
PROXIES: dict | None = {}

# 目标表及其样例查询的 where 条件（None = 不限制，取任意行）
TABLES = {
    "Leagues": None,
    "Tournaments": None,
    "Teams": None,
    "TeamRedirects": None,
    "Players": None,
    "PlayerRedirects": None,
    "Tenures": None,
    "ScoreboardGames": "OverviewPage LIKE 'LPL/2026%'",
    "ScoreboardPlayers": "OverviewPage LIKE 'LPL/2026%'",
    "TournamentResults": None,
    "MatchSchedule": "OverviewPage LIKE 'LPL/2026%'",
    "Champions": None,
    "Entities": None,
}


def api_call(params: dict) -> dict:
    """调用 Leaguepedia API，附重试与频率控制。"""
    last_err = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = requests.get(
                API_URL,
                params={**params, "format": "json"},
                headers={"User-Agent": USER_AGENT},
                timeout=30,
                proxies=PROXIES or None,
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                err = data["error"]
                if err.get("code") == "ratelimited" and attempt < MAX_ATTEMPTS:
                    wait = 60 + 15 * attempt  # 代理出口 IP 共享，限流窗口约 1-2 分钟
                    print(f"  限流中，等待 {wait}s 后重试(第{attempt}次)...", flush=True)
                    time.sleep(wait)
                    continue
                raise RuntimeError(json.dumps(err, ensure_ascii=False))
            return data
        except Exception as exc:  # noqa: BLE001 - 网络/限流均可重试
            last_err = exc
            if attempt < MAX_ATTEMPTS:
                time.sleep(REQUEST_INTERVAL * attempt * 2)
    raise RuntimeError(f"API 调用失败: {last_err}")


def get_fields(table: str) -> dict:
    """取 Cargo 表字段定义（action=cargofields）。"""
    data = api_call({"action": "cargofields", "table": table})
    return data.get("cargofields", {})


def get_samples(table: str, where: str | None, limit: int) -> list:
    """取样例行。"""
    params = {
        "action": "cargoquery",
        "tables": table,
        "fields": "_pageName",
        "limit": str(limit),
    }
    if where:
        params["where"] = where
    data = api_call(params)
    rows = data.get("cargoquery", [])
    # formatversion=1 时 cargoquery 是 [{"title": {...}}, ...]
    return [row.get("title", {}) for row in rows]


def main() -> int:
    global PROXIES
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=3, help="每个表的样例行数")
    parser.add_argument("--only", type=str, default="", help="逗号分隔，只探查指定表")
    parser.add_argument("--proxy", type=str, default=DEFAULT_PROXY, help="HTTP 代理地址")
    parser.add_argument("--no-proxy", action="store_true", help="不走代理（直连）")
    args = parser.parse_args()

    if args.no_proxy:
        PROXIES = None
    elif args.proxy:
        PROXIES = {"http": args.proxy, "https": args.proxy}

    tables = TABLES
    if args.only:
        wanted = {t.strip() for t in args.only.split(",") if t.strip()}
        tables = {k: v for k, v in TABLES.items() if k in wanted}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"代理: {args.proxy if not args.no_proxy else '直连'}", flush=True)
    print(f"{'表':<22}{'字段数':>6}{'样例':>6}  状态", flush=True)

    for table, where in tables.items():
        try:
            fields = get_fields(table)
            field_list = fields.get("fields", [])
            samples = get_samples(table, where, args.samples)

            (OUT_DIR / f"{table}.schema.json").write_text(
                json.dumps(fields, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            (OUT_DIR / f"{table}.sample.json").write_text(
                json.dumps(samples, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"{table:<22}{len(field_list):>6}{len(samples):>6}  OK", flush=True)
            time.sleep(REQUEST_INTERVAL)
        except Exception as exc:  # noqa: BLE001 - 单表失败不中断整体探查
            print(f"{table:<22}{'-':>6}{'-':>6}  FAIL: {exc}", flush=True)

    print(f"\n结果已写入: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())