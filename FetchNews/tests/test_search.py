import json
import os
import unittest
from unittest.mock import patch

from fetch_news.search import GoogleNewsRSS, TavilySearch


RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item><title>Elon Musk launches product - Reuters</title>
<link>https://example.com/a</link>
<guid>a</guid><pubDate>Tue, 04 Aug 2026 01:20:00 GMT</pubDate>
<description><![CDATA[<p>A short summary.</p>]]></description>
<source url="https://reuters.com">Reuters</source></item>
</channel></rss>"""


class GoogleNewsRSSTests(unittest.TestCase):
    def test_parse(self):
        results = GoogleNewsRSS.parse(RSS, "Elon Musk")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].source_name, "Reuters")
        self.assertEqual(results[0].snippet, "A short summary.")
        self.assertIsNotNone(results[0].published_at)

    def test_tavily_parsing(self):
        payload = {
            "results": [
                {
                    "title": "Elon Musk announces a product",
                    "url": "https://example.com/a",
                    "content": "Elon Musk announced a product.",
                    "published_date": "2026-08-04T01:20:00Z",
                    "score": 0.9,
                }
            ]
        }

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps(payload).encode("utf-8")

        searcher = TavilySearch(api_key_env="TEST_TAVILY_KEY")
        with patch.dict(os.environ, {"TEST_TAVILY_KEY": "secret"}):
            with patch("urllib.request.urlopen", return_value=FakeResponse()):
                results = searcher.search("Elon Musk")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].provider, "tavily")
        self.assertEqual(results[0].source_name, "example.com")


if __name__ == "__main__":
    unittest.main()
