"""Crawl4AI 本地爬虫"""

import httpx
from datetime import datetime
from typing import Optional

from storage.models import CrawlResult


class Crawl4AICrawler:
    """Crawl4AI 本地爬虫"""

    def __init__(self, base_url: str = "http://localhost:11235"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=60.0)

    async def close(self):
        await self.client.aclose()

    async def crawl(self, url: str) -> Optional[CrawlResult]:
        """抓取网页并返回 Markdown"""
        try:
            resp = await self.client.post(
                f"{self.base_url}/crawl",
                json={"urls": [url], "extraction_config": {"type": "markdown"}},
            )
            resp.raise_for_status()
            data = resp.json()

            result = data.get("results", [{}])[0] if data.get("results") else {}
            return CrawlResult(
                url=url,
                markdown=result.get("markdown", result.get("cleaned_html", "")),
                title=result.get("metadata", {}).get("title", ""),
                source="crawl4ai",
                publish_time=None,
            )
        except Exception as e:
            print(f"[Crawl4AI] 抓取失败 ({url}): {e}")
            return None