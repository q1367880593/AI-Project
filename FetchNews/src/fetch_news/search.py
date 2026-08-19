from __future__ import annotations

import email.utils
import json
import os
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from .domain import SearchResult
from .utils import strip_html


class SearchError(RuntimeError):
    pass


class GoogleNewsRSS:
    name = "google_news_rss"

    def __init__(self, timeout: int = 15, user_agent: str = "FetchNews/0.1"):
        self.timeout = timeout
        self.user_agent = user_agent

    def search(self, query: str, language: str = "zh", limit: int = 20) -> list[SearchResult]:
        locale = ("zh-CN", "CN", "CN:zh-Hans") if language == "zh" else ("en-US", "US", "US:en")
        params = urllib.parse.urlencode(
            {"q": query, "hl": locale[0], "gl": locale[1], "ceid": locale[2]}
        )
        url = f"https://news.google.com/rss/search?{params}"
        request = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = response.read()
        except Exception as error:
            raise SearchError(f"Google News RSS 请求失败：{error}") from error
        return self.parse(payload, query=query, limit=limit)

    @classmethod
    def parse(cls, payload: bytes, query: str, limit: int = 20) -> list[SearchResult]:
        try:
            root = ET.fromstring(payload)
        except ET.ParseError as error:
            raise SearchError(f"RSS XML 无法解析：{error}") from error
        output: list[SearchResult] = []
        for item in root.findall("./channel/item")[:limit]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if not title or not link:
                continue
            source_node = item.find("source")
            source_name = (source_node.text or "").strip() if source_node is not None else ""
            description = strip_html(item.findtext("description") or "")
            published_at = cls._parse_date(item.findtext("pubDate"))
            output.append(
                SearchResult(
                    provider=cls.name,
                    query=query,
                    title=title,
                    url=link,
                    snippet=description,
                    source_name=source_name,
                    published_at=published_at,
                    raw_payload={"guid": item.findtext("guid") or ""},
                )
            )
        return output

    @staticmethod
    def _parse_date(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = email.utils.parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except (TypeError, ValueError):
            return None


class TavilySearch:
    name = "tavily"

    def __init__(
        self,
        timeout: int = 15,
        api_key_env: str = "TAVILY_API_KEY",
        base_url: str = "https://api.tavily.com/search",
        user_agent: str = "FetchNews/0.1",
    ):
        self.timeout = timeout
        self.api_key_env = api_key_env
        self.base_url = base_url
        self.user_agent = user_agent

    def search(self, query: str, language: str = "zh", limit: int = 20) -> list[SearchResult]:
        api_key = os.environ.get(self.api_key_env, "").strip()
        if not api_key:
            raise SearchError(f"环境变量 {self.api_key_env} 未设置")
        payload = json.dumps(
            {
                "api_key": api_key,
                "query": query,
                "topic": "news",
                "search_depth": "basic",
                "max_results": limit,
                "include_answer": False,
                "include_raw_content": False,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            self.base_url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": self.user_agent},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
        except Exception as error:
            raise SearchError(f"Tavily 请求失败：{error}") from error

        output: list[SearchResult] = []
        for item in data.get("results", []):
            url = str(item.get("url", "")).strip()
            title = str(item.get("title", "")).strip()
            if not url or not title:
                continue
            output.append(
                SearchResult(
                    provider=self.name,
                    query=query,
                    title=title,
                    url=url,
                    snippet=str(item.get("content", "")).strip(),
                    source_name=urllib.parse.urlsplit(url).hostname or "",
                    published_at=self._parse_date(item.get("published_date")),
                    raw_payload={"score": item.get("score")},
                )
            )
        return output

    @staticmethod
    def _parse_date(value: object) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            return None
