import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path

from fetch_news.analysis import Analyzer, cluster_rows
from fetch_news.domain import Target
from fetch_news.report import MarkdownReporter


def row(**values):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    columns = ", ".join(f"? AS {key}" for key in values)
    result = connection.execute(f"SELECT {columns}", tuple(values.values())).fetchone()
    connection.close()
    return result


class AnalysisReportTests(unittest.TestCase):
    def test_fallback_analysis_and_report(self):
        target = Target("elon", "Elon Musk", "person", ("Elon Musk", "马斯克"))
        article = row(
            id=1,
            title_original="Elon Musk launches a new product",
            snippet="Elon Musk announced a new product today",
            content_markdown="",
            source_name="Example",
            canonical_url="https://example.com/a",
            content_quality="snippet_only",
        )
        events, updates, warnings = Analyzer().analyze(target, [article])
        self.assertEqual(len(events), 1)
        self.assertTrue(updates[0][2])
        self.assertIn("规则降级模式", events[0].summary_zh)
        self.assertEqual(warnings, [])

        with tempfile.TemporaryDirectory() as temp_dir:
            reporter = MarkdownReporter(Path(temp_dir), "Asia/Shanghai", "0.1.0")
            report_event = {
                "title_zh": events[0].title_zh,
                "summary_zh": events[0].summary_zh,
                "impact_zh": events[0].impact_zh,
                "background_zh": events[0].background_zh,
                "importance": events[0].importance,
                "credibility": events[0].credibility,
                "confidence_note_zh": events[0].confidence_note_zh,
                "sources": [
                    {
                        "source_name": "Example",
                        "title_original": article["title_original"],
                        "canonical_url": article["canonical_url"],
                        "published_at": None,
                        "content_quality": "snippet_only",
                    }
                ],
            }
            content = reporter.render(target, date(2026, 8, 4), [report_event], [])
            path = reporter.write(target, date(2026, 8, 4), content)
            self.assertTrue(path.exists())
            self.assertIn('language: "zh-CN"', content)
            self.assertIn("仅检索摘要", content)

    def test_similar_titles_cluster(self):
        first = row(title_original="Tesla launches new Robotaxi service")
        second = row(title_original="Tesla launches Robotaxi service in Austin")
        self.assertEqual(len(cluster_rows([first, second])), 1)


if __name__ == "__main__":
    unittest.main()

