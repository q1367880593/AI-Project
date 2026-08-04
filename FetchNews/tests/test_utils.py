import unittest

from fetch_news.utils import canonicalize_url


class CanonicalizeURLTests(unittest.TestCase):
    def test_removes_tracking_and_fragment(self):
        result = canonicalize_url(
            "HTTPS://Example.COM:443/news/?utm_source=x&b=2&a=1#section"
        )
        self.assertEqual(result, "https://example.com/news?a=1&b=2")

    def test_keeps_non_default_port(self):
        self.assertEqual(
            canonicalize_url("http://example.com:8080/a"),
            "http://example.com:8080/a",
        )


if __name__ == "__main__":
    unittest.main()

