"""Firecrawl 云端爬虫"""

import os
import httpx
from datetime import datetime
from typing import Optional

from storage.models import CrawlResult


class FirecrawlCrawler:
    """Firecrawl 云端爬虫"""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.getenv("FIRECRAWL_API_KEY", "")
        self.base_url = "https://api.firecrawl.dev/v1"
        self.client = httpx.AsyncClient(timeout=60.0)

    async def close(self):
        await self.client.aclose()

    async def crawl(self, url: str) -> Optional[CrawlResult]:
        if not self.api_key:
            return None

        try:
            resp = await self.client.post(
                f"{self.base_url}/scrape",
                json={"url": url, "formats": ["markdown"]},
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()

            return CrawlResult(
                url=url,
                markdown=data.get("data", {}).get("markdown", ""),
                title=data.get("data", {}).get("metadata", {}).get("title", ""),
                source="firecrawl",
                publish_time=None,
            )
        except Exception as e:
            print(f"[Firecrawl] 抓取失败 ({url}): {e}")
            return None