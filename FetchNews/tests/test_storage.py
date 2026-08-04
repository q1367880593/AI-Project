import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

from fetch_news.domain import CrawlResult, EventDraft, SearchResult, Target
from fetch_news.storage import Database


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Database(Path(self.temp_dir.name) / "test.db")
        self.target = Target("elon", "Elon Musk", "person", ("Elon Musk", "马斯克"))
        self.target_id = self.database.upsert_target(self.target)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_news_and_event_are_idempotent(self):
        item = SearchResult(
            provider="test",
            query="Elon Musk",
            title="Elon Musk launches a product",
            url="https://example.com/a?utm_source=test",
            snippet="Elon Musk announced a new product.",
            source_name="Example",
            published_at=datetime(2026, 8, 4, tzinfo=timezone.utc),
        )
        news_id, created = self.database.upsert_search_result(self.target_id, item)
        repeated_id, repeated_created = self.database.upsert_search_result(self.target_id, item)
        self.assertTrue(created)
        self.assertFalse(repeated_created)
        self.assertEqual(news_id, repeated_id)

        self.database.save_crawl(
            news_id,
            CrawlResult(
                canonical_url=item.url,
                title_original=item.title,
                content_markdown="Elon Musk announced a new product. " * 20,
                content_quality="full",
            ),
        )
        draft = EventDraft(
            title_zh="马斯克发布新产品",
            summary_zh="马斯克发布了一款新产品。",
            impact_zh="影响尚待观察。",
            background_zh="暂无背景。",
            importance=60,
            credibility=70,
            confidence_note_zh="单一来源。",
            news_ids=[news_id],
        )
        first_event = self.database.insert_event(self.target_id, date(2026, 8, 4), draft)
        second_event = self.database.insert_event(self.target_id, date(2026, 8, 4), draft)
        self.assertEqual(first_event, second_event)
        self.assertEqual(self.database.stats()["events"], 1)

    def test_analyzed_news_remains_available_to_another_target(self):
        second_target = Target("tesla", "Tesla", "company", ("Tesla",))
        second_target_id = self.database.upsert_target(second_target)
        item = SearchResult(
            provider="test",
            query="Elon Musk",
            title="Elon Musk discusses Tesla",
            url="https://example.com/shared",
            snippet="Elon Musk discussed Tesla strategy.",
            published_at=datetime(2026, 8, 4, tzinfo=timezone.utc),
        )
        news_id, _ = self.database.upsert_search_result(self.target_id, item)
        self.database.upsert_search_result(second_target_id, item)
        self.database.save_crawl(
            news_id,
            CrawlResult(
                canonical_url=item.url,
                title_original=item.title,
                content_markdown="Elon Musk discussed Tesla strategy. " * 20,
            ),
        )
        draft = EventDraft(
            title_zh="马斯克讨论特斯拉战略",
            summary_zh="马斯克讨论了特斯拉战略。",
            impact_zh="影响待观察。",
            background_zh="暂无。",
            importance=50,
            credibility=60,
            confidence_note_zh="单一来源。",
            news_ids=[news_id],
        )
        self.database.insert_event(self.target_id, date(2026, 8, 4), draft)
        pending_for_second = self.database.news_for_analysis(second_target_id, date(2026, 8, 4))
        self.assertEqual([record["id"] for record in pending_for_second], [news_id])


if __name__ == "__main__":
    unittest.main()
