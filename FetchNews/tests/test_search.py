import unittest

from fetch_news.search import GoogleNewsRSS


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


if __name__ == "__main__":
    unittest.main()

