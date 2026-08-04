# Search Agent - uses 360 news search (so.com)
import hashlib
import json
import re
from datetime import datetime

import requests

from storage.models import SearchResult


class SearchAgent:

    BASE_URL = "https://news.so.com/ns"
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        ),
    }

    def __init__(self, config_path: str = "config/source.yaml"):
        self.config = {}
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

    def close(self):
        self.session.close()

    def search(self, keyword, person_name="", language="en", max_results=10):
        results = []
        try:
            resp = self.session.get(self.BASE_URL, params={"q": keyword, "src": "news"}, timeout=15)
            resp.raise_for_status()
            results = self._parse_results(resp.text, max_results)
        except Exception as e:
            print(f"  [360] search failed ({keyword}): {type(e).__name__}: {e}")
        return results

    def _parse_results(self, html, max_results):
        match = re.search(r'id="?initData"?[^>]*>(.*?)</script>', html, re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            return []

        items = data.get("items", [])
        results = []
        for item in items[:max_results]:
            title = self._clean_html(item.get("title", ""))
            content = self._clean_html(item.get("content", ""))
            url = item.get("url", "").replace("\\/", "/")
            source = item.get("attr", {}).get("site", "")

            ts = item.get("timestamp", "")
            published_at = None
            if ts and ts.isdigit():
                try:
                    published_at = datetime.fromtimestamp(int(ts))
                except (ValueError, OSError):
                    pass

            if title and url:
                results.append(SearchResult(
                    title=title, url=url, summary=content,
                    published_at=published_at, source=source or "360",
                ))
        return results

    @staticmethod
    def _clean_html(text):
        text = re.sub(r"<[^>]+>", "", text)
        text = text.replace("\\/", "/")
        text = text.replace("&nbsp;", " ")
        text = text.replace("&amp;", "&")
        text = text.replace("&lt;", "<")
        text = text.replace("&gt;", ">")
        text = text.replace("&quot;", '"')
        text = text.replace("&#39;", "'")
        # Remove common noise patterns
        text = re.sub(r'方便,快捷\s+手机查看财经快讯.*', '', text)
        text = re.sub(r'打开微信,.*?东方财富官网微信', '', text)
        text = re.sub(r'提示:.*?扫一扫', '', text)
        text = re.sub(r'\[br\]', '\n', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _normalize_url(self, url):
        url = url.strip().lower()
        if url.startswith("https://"):
            url = url[8:]
        elif url.startswith("http://"):
            url = url[7:]
        return url.rstrip("/")

    def get_url_hash(self, url):
        return hashlib.md5(self._normalize_url(url).encode()).hexdigest()