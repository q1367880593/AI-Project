"""Search Agent - 搜索新闻"""

import asyncio
import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote, urlencode

import httpx
import feedparser
import yaml

from storage.models import SearchResult


class SearchAgent:
    """搜索 Agent，负责从多个来源收集新闻"""

    def __init__(self, config_path: str = "config/source.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        self.sources = self.config.get("sources", {})
        self.client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)

    async def close(self):
        await self.client.aclose()

    async def search(
        self,
        keyword: str,
        person_name: str,
        language: str = "en",
        max_results: int = 20,
    ) -> list[SearchResult]:
        """搜索指定关键词的新闻"""
        results = []
        tasks = []

        if self.sources.get("google_news_rss", {}).get("enabled", True):
            tasks.append(self._search_google_rss(keyword, language, max_results))

        if self.sources.get("newsapi", {}).get("enabled", False):
            tasks.append(self._search_newsapi(keyword, language, max_results))

        if self.sources.get("tavily", {}).get("enabled", False):
            tasks.append(self._search_tavily(keyword, max_results))

        all_results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in all_results:
            if isinstance(res, list):
                results.extend(res)
            elif isinstance(res, Exception):
                print(f"[SearchAgent] 搜索源出错: {res}")

        # URL 去重
        seen = set()
        unique = []
        for r in results:
            url_hash = self._normalize_url(r.url)
            if url_hash not in seen:
                seen.add(url_hash)
                unique.append(r)

        return unique[:max_results]

    async def _search_google_rss(
        self, keyword: str, language: str, max_results: int
    ) -> list[SearchResult]:
        """通过 Google News RSS 搜索"""
        cfg = self.sources.get("google_news_rss", {})
        base_url = cfg.get("base_url", "https://news.google.com/rss/search")
        params = dict(cfg.get("params", {}))

        if language == "zh":
            params["hl"] = "zh-CN"
            params["gl"] = "CN"
            params["ceid"] = "CN:zh-Hans"

        params["q"] = keyword
        url = f"{base_url}?{urlencode(params)}"

        try:
            resp = await self.client.get(url)
            resp.raise_for_status()
            feed = feedparser.parse(resp.text)
        except Exception as e:
            print(f"[Google RSS] 搜索失败 ({keyword}): {e}")
            return []

        results = []
        for entry in feed.entries[:max_results]:
            # 从 Google News URL 中提取真正的来源
            source = entry.get("source", {}).get("title", "Google News")
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    published = datetime(*entry.published_parsed[:6])
                except Exception:
                    pass

            results.append(SearchResult(
                title=entry.get("title", ""),
                url=entry.get("link", ""),
                summary=entry.get("summary", entry.get("description", "")),
                published_at=published,
                source=source,
            ))

        return results

    async def _search_newsapi(
        self, keyword: str, language: str, max_results: int
    ) -> list[SearchResult]:
        """通过 NewsAPI 搜索"""
        cfg = self.sources.get("newsapi", {})
        api_key = cfg.get("api_key") or os.getenv("NEWSAPI_KEY", "")
        if not api_key:
            return []

        base_url = cfg.get("base_url", "https://newsapi.org/v2/everything")
        from_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        params = {
            "q": keyword,
            "from": from_date,
            "sortBy": "publishedAt",
            "language": language,
            "pageSize": max_results,
            "apiKey": api_key,
        }

        try:
            resp = await self.client.get(f"{base_url}?{urlencode(params)}")
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[NewsAPI] 搜索失败 ({keyword}): {e}")
            return []

        results = []
        for article in data.get("articles", []):
            published = None
            if article.get("publishedAt"):
                try:
                    published = datetime.fromisoformat(article["publishedAt"].replace("Z", "+00:00"))
                except Exception:
                    pass

            results.append(SearchResult(
                title=article.get("title", ""),
                url=article.get("url", ""),
                summary=article.get("description", ""),
                published_at=published,
                source=article.get("source", {}).get("name", "NewsAPI"),
            ))

        return results

    async def _search_tavily(
        self, keyword: str, max_results: int
    ) -> list[SearchResult]:
        """通过 Tavily 搜索"""
        cfg = self.sources.get("tavily", {})
        api_key = cfg.get("api_key") or os.getenv("TAVILY_API_KEY", "")
        if not api_key:
            return []

        base_url = cfg.get("base_url", "https://api.tavily.com/search")

        try:
            resp = await self.client.post(
                base_url,
                json={
                    "query": keyword,
                    "search_depth": "basic",
                    "max_results": max_results,
                    "include_answer": False,
                },
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[Tavily] 搜索失败 ({keyword}): {e}")
            return []

        results = []
        for result in data.get("results", []):
            results.append(SearchResult(
                title=result.get("title", ""),
                url=result.get("url", ""),
                summary=result.get("content", ""),
                published_at=None,
                source="Tavily",
            ))

        return results

    def _normalize_url(self, url: str) -> str:
        """URL 标准化用于去重"""
        # 去掉协议和尾部斜杠
        url = url.strip().lower()
        if url.startswith("https://"):
            url = url[8:]
        elif url.startswith("http://"):
            url = url[7:]
        url = url.rstrip("/")
        # 去掉常见的追踪参数
        if "?" in url:
            base, params = url.split("?", 1)
            # 保留必要的参数，去掉 utm_ 等追踪参数
            essential = []
            for p in params.split("&"):
                if "=" in p:
                    k, v = p.split("=", 1)
                    if not k.startswith("utm_") and k not in ("ref", "ref_src"):
                        essential.append(f"{k}={v}")
            if essential:
                url = f"{base}?{'&'.join(essential)}"
            else:
                url = base
        return url

    def get_url_hash(self, url: str) -> str:
        return hashlib.md5(self._normalize_url(url).encode()).hexdigest()