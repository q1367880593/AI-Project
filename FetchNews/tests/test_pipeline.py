import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

from fetch_news.config import AppConfig
from fetch_news.domain import CrawlResult, SearchResult, Target
from fetch_news.pipeline import Pipeline


class FakeSearcher:
    def search(self, query, language="zh", limit=20):
        return [
            SearchResult(
                provider="fixture",
                query=query,
                title="Elon Musk launches a new product",
                url="https://example.com/news?a=1&utm_source=test",
                snippet="Elon Musk announced a new product today.",
                source_name="Example News",
                published_at=datetime(2026, 8, 4, 1, 0, tzinfo=timezone.utc),
            )
        ]


class FakeCrawler:
    def crawl(self, url, fallback_title="", fallback_snippet=""):
        return CrawlResult(
            canonical_url=url,
            title_original=fallback_title,
            content_markdown=("Elon Musk announced a new product today. " * 20),
            source_name="Example News",
            language="en",
            published_at=datetime(2026, 8, 4, 1, 0, tzinfo=timezone.utc),
            content_quality="full",
            extractor="fixture",
        )


class PipelineTests(unittest.TestCase):
    def test_offline_pipeline_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            target = Target("elon", "Elon Musk", "person", ("Elon Musk",))
            config = AppConfig(
                path=root / "config.toml",
                timezone="Asia/Shanghai",
                report_dir=root / "reports",
                database_path=root / "research.db",
                search={"per_query_limit": 10, "window_hours": 24},
                crawler={},
                analysis={"provider": "none"},
                report={},
                targets=(target,),
            )
            pipeline = Pipeline(config)
            pipeline.searcher = FakeSearcher()
            pipeline.crawler = FakeCrawler()

            first = pipeline.run(date(2026, 8, 4), "elon")[0]
            second = pipeline.run(date(2026, 8, 4), "elon")[0]

            self.assertEqual(first.discovered, 1)
            self.assertEqual(first.events, 1)
            self.assertEqual(second.discovered, 0)
            self.assertEqual(second.events, 1)
            self.assertEqual(pipeline.database.stats()["news"], 1)
            self.assertEqual(pipeline.database.stats()["events"], 1)
            report = Path(second.report_path).read_text(encoding="utf-8")
            self.assertIn("Elon Musk 新闻日报", report)
            self.assertIn("Example News", report)


if __name__ == "__main__":
    unittest.main()
