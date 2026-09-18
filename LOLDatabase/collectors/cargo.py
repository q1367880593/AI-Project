"""Leaguepedia Cargo API 客户端：慢速限流 + 分页 + 断点续传。

- 每个查询任务对应 raw 目录下的一个子目录，每页结果落盘为 page_<offset>.json；
- 任务完整拉完会写 done.ok 标记；重跑时已有页直接跳过（断点续传）；
- 触发限流时指数退避等待后自动重试。
"""

import json
import random
import time
from pathlib import Path

import requests

from collectors import config


class CargoError(RuntimeError):
    """Cargo 查询失败（非限流）。"""


def _pause():
    """正常请求间隔 + 抖动。"""
    time.sleep(config.BASE_INTERVAL + random.uniform(0, config.JITTER))


class CargoClient:
    def __init__(self, proxy: str | None = config.PROXY, out_root: Path | None = None):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = config.USER_AGENT
        self.proxies = {"http": proxy, "https": proxy} if proxy else None
        self.out_root = out_root or config.RAW_DIR
        self.authenticated = False
        self.username: str | None = None

    def invalidate(self, key: str) -> None:
        """使某个任务缓存失效（删除 done.ok 与所有分页文件），下次 fetch_all 全量重拉。"""
        out_dir = self.out_root / key
        if not out_dir.exists():
            return
        for p in out_dir.glob("page_*.json"):
            p.unlink()
        (out_dir / "done.ok").unlink(missing_ok=True)
        print(f"  ↻ {key}: 缓存已失效，将重新拉取", flush=True)

    def login(self, username: str, password: str) -> str:
        """以机器人密码（BotPasswords）登录；登录后自动解除匿名配额限制。"""
        data = self._plain_get(
            {"action": "query", "meta": "tokens", "type": "login", "format": "json"}
        )
        token = data["query"]["tokens"]["logintoken"]
        resp = self.session.post(
            config.CARGO_API,
            data={
                "action": "login",
                "lgname": username,
                "lgpassword": password,
                "lgtoken": token,
                "format": "json",
            },
            timeout=60,
            proxies=self.proxies,
        )
        resp.raise_for_status()
        result = resp.json().get("login", {})
        if result.get("result") != "Success":
            raise CargoError(
                f"登录失败: {result.get('result')} ({result.get('reason', '')})"
            )
        self.authenticated = True
        self.username = result.get("lgusername", username)
        print(f"  ✔ 已登录 Fandom: {self.username}", flush=True)
        return self.username

    def _plain_get(self, params: dict) -> dict:
        resp = self.session.get(
            config.CARGO_API, params=params, timeout=60, proxies=self.proxies
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise CargoError(json.dumps(data["error"], ensure_ascii=False))
        return data

    def mediawiki(self, params: dict) -> dict:
        """通用 MediaWiki API 查询（登录态会话，如 imageinfo）。"""
        return self._plain_get(params)

    def cargoquery(self, params: dict) -> list:
        """单次 cargoquery（不带分页），返回行列表 [{字段: 值}, ...]。"""
        payload = {**params, "format": "json", "limit": str(config.PAGE_SIZE)}
        if self.authenticated:
            payload["assert"] = "user"  # 确保查询以登录态执行
        wait = config.RATELIMIT_BACKOFF
        for attempt in range(1, config.MAX_ATTEMPTS + 1):
            try:
                resp = self.session.get(
                    config.CARGO_API, params=payload, timeout=60, proxies=self.proxies
                )
                if resp.status_code == 429:
                    raise CargoError("HTTP 429")
                resp.raise_for_status()
                data = resp.json()
                if "error" in data:
                    raise CargoError(json.dumps(data["error"], ensure_ascii=False))
                rows = data.get("cargoquery", [])
                # 字段名归一化：API 会把下划线返回成空格（'DateTime UTC'）
                return [
                    {k.replace(" ", "_"): v for k, v in r.get("title", {}).items()}
                    for r in rows
                ]
            except requests.RequestException as exc:
                print(f"    ⚠ 网络异常: {exc}（第 {attempt} 次重试）", flush=True)
                if attempt == config.MAX_ATTEMPTS:
                    raise CargoError(f"重试次数用尽: {exc}")
                time.sleep(15 * attempt)
            except CargoError as exc:
                msg = str(exc)
                limited = "ratelimited" in msg or "429" in msg
                if not limited:
                    raise  # 查询本身出错（如 where 语法），不重试
                print(f"    ⏳ 限流：等待 {wait:.0f}s（第 {attempt} 次）", flush=True)
                if attempt == config.MAX_ATTEMPTS:
                    raise CargoError(f"限流重试次数用尽: {msg}")
                time.sleep(wait)
                wait = min(wait * 2, config.RATELIMIT_MAX_WAIT)
            _pause()
        raise CargoError("unreachable")

    def fetch_all(self, key: str, params: dict) -> list:
        """分页拉取某个查询的全量数据并可断点续传。

        key: raw 目录下的相对任务目录（如 lpl2025/matchschedule/Split_1）。
        返回该任务全部行（由已缓存页 + 新拉取页拼接）。
        """
        out_dir = self.out_root / key
        out_dir.mkdir(parents=True, exist_ok=True)
        done_flag = out_dir / "done.ok"

        def load_cached() -> list:
            rows = []
            for p in sorted(out_dir.glob("page_*.json")):
                rows.extend(json.loads(p.read_text(encoding="utf-8")))
            return rows

        rows = load_cached()
        if done_flag.exists():
            print(f"  ✔ {key}: 已完整缓存（{len(rows)} 行），跳过", flush=True)
            return rows
        if rows:
            print(f"  ⏳ {key}: 断点续传（已有 {len(rows)} 行）", flush=True)

        offset = len(list(out_dir.glob("page_*.json"))) * config.PAGE_SIZE
        while True:
            chunk = self.cargoquery({**params, "offset": str(offset)})
            if not chunk:
                done_flag.touch()
                print(f"  ✔ {key}: 拉取完成（共 {len(rows)} 行）", flush=True)
                break
            page_file = out_dir / f"page_{offset:06d}.json"
            page_file.write_text(
                json.dumps(chunk, ensure_ascii=False), encoding="utf-8"
            )
            rows.extend(chunk)
            print(
                f"    {key}: offset {offset} → +{len(chunk)} 行（累计 {len(rows)}）",
                flush=True,
            )
            offset += len(chunk)
            if len(chunk) < config.PAGE_SIZE:
                done_flag.touch()
                print(f"  ✔ {key}: 拉取完成（共 {len(rows)} 行）", flush=True)
                break
            _pause()
        return rows