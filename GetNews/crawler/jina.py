"""Jina Reader 爬虫（免费，无需 API Key）"""

import httpx
from datetime import datetime
from typing import Optional

from storage.models import CrawlResult


class JinaCrawler:
    """Jina Reader - 免费网页内容提取服务"""

    def __init__(self, base_url: str = "https://r.jina.ai"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=60.0)

    async def close(self):
        await self.client.aclose()

    async def crawl(self, url: str) -> Optional[CrawlResult]:
        """通过 Jina Reader 抓取网页"""
        try:
            resp = await self.client.get(
                f"{self.base_url}/{url}",
                headers={
                    "Accept": "text/markdown",
                    "X-Return-Format": "markdown",
                },
            )
            resp.raise_for_status()
            markdown = resp.text

            # 从 Markdown 内容中提取标题（第一行 # 开头）
            title = ""
            lines = markdown.strip().split("\n")
            if lines and lines[0].startswith("# "):
                title = lines[0][2:].strip()

            return CrawlResult(
                url=url,
                markdown=markdown,
                title=title,
                source="jina",
                publish_time=None,
            )
        except Exception as e:
            print(f"[Jina] 抓取失败 ({url}): {e}")
            return None