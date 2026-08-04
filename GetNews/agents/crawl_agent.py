"""Crawl Agent - 抓取新闻正文"""

import asyncio
import yaml
from typing import Optional

from crawler import JinaCrawler, Crawl4AICrawler, FirecrawlCrawler
from storage import CrawlResult, Database


class CrawlAgent:
    """抓取 Agent，负责获取新闻正文"""

    def __init__(self, config_path: str = "config/source.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        cfg = self.config.get("crawler", {})
        self.default_crawler = cfg.get("default", "jina")

        self.jina = JinaCrawler(cfg.get("jina", {}).get("base_url", "https://r.jina.ai"))
        self.crawl4ai = Crawl4AICrawler(cfg.get("crawl4ai", {}).get("base_url", "http://localhost:11235"))
        self.firecrawl = FirecrawlCrawler(cfg.get("firecrawl", {}).get("api_key", ""))

    async def close(self):
        await self.jina.close()
        await self.crawl4ai.close()
        await self.firecrawl.close()

    async def crawl(self, url: str, crawler_type: Optional[str] = None) -> Optional[CrawlResult]:
        """抓取单个 URL"""
        ct = crawler_type or self.default_crawler

        if ct == "crawl4ai":
            return await self.crawl4ai.crawl(url)
        elif ct == "firecrawl":
            return await self.firecrawl.crawl(url)
        else:
            return await self.jina.crawl(url)

    async def crawl_batch(self, urls: list[str], concurrency: int = 5) -> list[CrawlResult]:
        """批量抓取"""
        sem = asyncio.Semaphore(concurrency)

        async def crawl_one(url: str) -> Optional[CrawlResult]:
            async with sem:
                return await self.crawl(url)

        tasks = [crawl_one(url) for url in urls]
        results = await asyncio.gather(*tasks)
        return [r for r in results if r is not None]

    async def crawl_and_save(
        self, urls: list[str], db: Database, concurrency: int = 5
    ) -> list[int]:
        """抓取并存入数据库，返回 news_id 列表"""
        results = await self.crawl_batch(urls, concurrency)
        news_ids = []

        for result in results:
            if not result or not result.markdown.strip():
                continue

            # 查找已有记录（通过 URL）
            from storage.models import NewsArticle
            article = NewsArticle(
                url=result.url,
                title=result.title or "Untitled",
                content=result.markdown,
                source=result.source,
                published_at=result.publish_time,
            )
            news_id = db.insert_news(article)
            db.update_news_content(news_id, result.markdown, "")
            news_ids.append(news_id)

        return news_ids