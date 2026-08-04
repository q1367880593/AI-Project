"""Search Agent - 搜索新闻"""

import asyncio
import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
import feedparser
import yaml

from storage.models import SearchResult

# ============================================================
# 内置 Mock 数据（当所有外部搜索源不可用时使用）
# 按关键词索引，每个关键词匹配相关新闻
# ============================================================
MOCK_NEWS = {
    "Elon Musk": [
        SearchResult(
            title="Elon Musk Meets with World Leaders at G20 Summit",
            url="https://example.com/musk-g20",
            summary="Elon Musk attended the G20 summit in Rio de Janeiro, meeting with multiple world leaders to discuss AI regulation and sustainable energy initiatives.",
            published_at=datetime.now() - timedelta(hours=2),
            source="Reuters",
        ),
        SearchResult(
            title="Elon Musk Named Time Person of the Year Again",
            url="https://example.com/musk-time",
            summary="Time magazine has named Elon Musk as Person of the Year for the second time, citing his transformative impact across multiple industries.",
            published_at=datetime.now() - timedelta(hours=14),
            source="Time",
        ),
    ],
    "Tesla CEO": [
        SearchResult(
            title="Tesla Q2 Earnings Beat Expectations as Robotaxi Launch Nears",
            url="https://example.com/tesla-q2-earnings",
            summary="Tesla reported better-than-expected Q2 earnings, driven by record energy storage deployments and improving automotive margins. Elon Musk confirmed Robotaxi unveil is on track for October.",
            published_at=datetime.now() - timedelta(hours=4),
            source="Reuters",
        ),
        SearchResult(
            title="Tesla's Robotaxi Service Set for Limited Launch in Texas",
            url="https://example.com/tesla-robotaxi-texas",
            summary="Tesla plans to launch a limited Robotaxi service in Austin, Texas starting next month, according to internal documents. The service will initially use Model Y vehicles with safety drivers.",
            published_at=datetime.now() - timedelta(hours=6),
            source="The Verge",
        ),
        SearchResult(
            title="Tesla Semi Truck Begins Mass Production at Nevada Gigafactory",
            url="https://example.com/tesla-semi-production",
            summary="Tesla announced the official start of mass production for the Tesla Semi at its Nevada Gigafactory, with PepsiCo and Walmart among the first customers.",
            published_at=datetime.now() - timedelta(hours=10),
            source="Bloomberg",
        ),
    ],
    "SpaceX CEO": [
        SearchResult(
            title="SpaceX Starship Completes Fifth Test Flight Successfully",
            url="https://example.com/spacex-starship-test",
            summary="SpaceX's Starship rocket completed its fifth integrated test flight, successfully demonstrating the booster catch mechanism. The upper stage reached orbit before splashing down in the Indian Ocean.",
            published_at=datetime.now() - timedelta(hours=8),
            source="CNN",
        ),
        SearchResult(
            title="SpaceX Wins $3 Billion NASA Contract for Lunar Mission",
            url="https://example.com/spacex-nasa-contract",
            summary="NASA awarded SpaceX a $3 billion contract for a crewed lunar landing mission as part of the Artemis program, beating out competitors.",
            published_at=datetime.now() - timedelta(hours=12),
            source="SpaceNews",
        ),
        SearchResult(
            title="SpaceX Starlink Reaches 5 Million Subscribers Worldwide",
            url="https://example.com/starlink-5m",
            summary="SpaceX's Starlink satellite internet service has surpassed 5 million subscribers globally, with strong growth in Asia and Africa markets.",
            published_at=datetime.now() - timedelta(hours=18),
            source="CNBC",
        ),
    ],
    "xAI": [
        SearchResult(
            title="xAI Raises $6 Billion in Series C Funding Round",
            url="https://example.com/xai-funding",
            summary="Elon Musk's AI startup xAI has raised $6 billion in a Series C funding round, valuing the company at $40 billion. The funds will be used to expand the Grok AI model and build new data centers.",
            published_at=datetime.now() - timedelta(hours=12),
            source="Bloomberg",
        ),
        SearchResult(
            title="xAI's Grok-3 Tops AI Benchmarks, Surpassing GPT-5",
            url="https://example.com/grok3-benchmarks",
            summary="xAI's latest Grok-3 model has topped several AI benchmarks, outperforming OpenAI's GPT-5 in reasoning and coding tasks, according to independent evaluations.",
            published_at=datetime.now() - timedelta(hours=3),
            source="The Verge",
        ),
        SearchResult(
            title="xAI to Build World's Largest AI Supercomputer in Memphis",
            url="https://example.com/xai-supercomputer",
            summary="xAI announced plans to build the world's largest AI supercomputer in Memphis, Tennessee, with 200,000 NVIDIA GPUs to power next-generation AI research.",
            published_at=datetime.now() - timedelta(hours=16),
            source="Wired",
        ),
    ],
    "Jensen Huang": [
        SearchResult(
            title="NVIDIA Unveils Next-Gen Blackwell Ultra GPU Architecture",
            url="https://example.com/nvidia-blackwell-ultra",
            summary="NVIDIA CEO Jensen Huang announced the Blackwell Ultra GPU architecture at GTC, promising 4x performance improvement over the previous generation for AI training workloads.",
            published_at=datetime.now() - timedelta(hours=3),
            source="Reuters",
        ),
        SearchResult(
            title="Jensen Huang: AI Will Transform Every Industry Within 5 Years",
            url="https://example.com/huang-ai-prediction",
            summary="In a keynote speech, Jensen Huang predicted that AI will fundamentally transform every industry within the next five years, with NVIDIA positioned as the key infrastructure provider.",
            published_at=datetime.now() - timedelta(hours=14),
            source="Bloomberg",
        ),
    ],
    "NVIDIA CEO": [
        SearchResult(
            title="NVIDIA Reports Record Data Center Revenue of $35 Billion",
            url="https://example.com/nvidia-revenue",
            summary="NVIDIA reported record quarterly revenue of $35 billion from its data center segment, driven by surging demand for AI chips. Jensen Huang said demand for Blackwell is 'insane'.",
            published_at=datetime.now() - timedelta(hours=10),
            source="CNBC",
        ),
        SearchResult(
            title="NVIDIA Stock Surges 15% on Record Earnings and Strong Guidance",
            url="https://example.com/nvidia-stock-surge",
            summary="NVIDIA shares surged 15% after the company reported record earnings and raised guidance, with analysts calling the AI chip boom 'unprecedented'.",
            published_at=datetime.now() - timedelta(hours=5),
            source="Reuters",
        ),
    ],
    "Sam Altman": [
        SearchResult(
            title="Sam Altman: OpenAI Revenue Reaches $10 Billion Annual Run Rate",
            url="https://example.com/openai-revenue",
            summary="Sam Altman revealed that OpenAI has reached a $10 billion annual revenue run rate, up from $1.6 billion a year ago. The company is profitable for the first time.",
            published_at=datetime.now() - timedelta(hours=7),
            source="Financial Times",
        ),
        SearchResult(
            title="Sam Altman Outlines Vision for AGI at World Economic Forum",
            url="https://example.com/altman-wef",
            summary="At the World Economic Forum in Davos, Sam Altman outlined his vision for artificial general intelligence, predicting AGI could arrive within 3-5 years.",
            published_at=datetime.now() - timedelta(hours=15),
            source="Bloomberg",
        ),
    ],
    "OpenAI CEO": [
        SearchResult(
            title="OpenAI Launches GPT-5 with Advanced Reasoning Capabilities",
            url="https://example.com/openai-gpt5",
            summary="OpenAI has officially launched GPT-5, featuring significant improvements in reasoning, coding, and multimodal capabilities. Sam Altman called it 'the most capable model ever created'.",
            published_at=datetime.now() - timedelta(hours=2),
            source="The Verge",
        ),
        SearchResult(
            title="OpenAI Partners with Apple for On-Device AI Integration",
            url="https://example.com/openai-apple",
            summary="OpenAI and Apple announced a partnership to integrate ChatGPT into iOS, macOS, and visionOS. Sam Altman said the partnership will bring AI to billions of devices.",
            published_at=datetime.now() - timedelta(hours=11),
            source="Bloomberg",
        ),
        SearchResult(
            title="OpenAI Announces $500 Billion Stargate AI Infrastructure Project",
            url="https://example.com/stargate-project",
            summary="OpenAI, SoftBank, and Oracle announced Stargate, a $500 billion AI infrastructure project to build massive data centers across the US over the next four years.",
            published_at=datetime.now() - timedelta(hours=18),
            source="Reuters",
        ),
    ],
}


class SearchAgent:
    """搜索 Agent，负责从多个来源收集新闻"""

    def __init__(self, config_path: str = "config/source.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        self.sources = self.config.get("sources", {})
        self.client = httpx.AsyncClient(timeout=15.0, follow_redirects=True)

    async def close(self):
        await self.client.aclose()

    async def search(
        self,
        keyword: str,
        person_name: str,
        language: str = "en",
        max_results: int = 20,
    ) -> list[SearchResult]:
        """搜索指定关键词的新闻。所有外部源失败时自动回退到 mock 数据。"""
        results = []
        tasks = []

        if self.sources.get("google_news_rss", {}).get("enabled", True):
            tasks.append(("google_rss", self._search_google_rss(keyword, language, max_results)))

        if self.sources.get("newsapi", {}).get("enabled", False):
            tasks.append(("newsapi", self._search_newsapi(keyword, language, max_results)))

        if self.sources.get("tavily", {}).get("enabled", False):
            tasks.append(("tavily", self._search_tavily(keyword, max_results)))

        all_real_failed = True
        for name, task in tasks:
            try:
                res = await task
                if isinstance(res, list) and res:
                    results.extend(res)
                    all_real_failed = False
            except Exception as e:
                print(f"  [{name}] 搜索失败 ({keyword}): {type(e).__name__}: {e}")

        if not results:
            results = self._mock_search(person_name, keyword, max_results)
            if results:
                print(f"  [mock] 使用内置测试数据，找到 {len(results)} 条结果")

        return results

    def _mock_search(self, person_name: str, keyword: str, max_results: int) -> list[SearchResult]:
        """使用内置 mock 数据，按关键词精确匹配"""
        # 精确匹配关键词
        if keyword in MOCK_NEWS:
            return MOCK_NEWS[keyword][:max_results]

        # 不区分大小写匹配
        for k, news_list in MOCK_NEWS.items():
            if k.lower() == keyword.lower():
                return news_list[:max_results]

        return []

    async def _search_google_rss(
        self, keyword: str, language: str, max_results: int
    ) -> list[SearchResult]:
        """通过 Google News RSS 搜索"""
        cfg = self.sources.get("google_news_rss", {})
        base_url = cfg.get("base_url", "https://news.google.com/rss/search")
        params = dict(cfg.get("params", {}))
        params["q"] = keyword
        url = f"{base_url}?{urlencode(params)}"

        resp = await self.client.get(url)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)

        results = []
        for entry in feed.entries[:max_results]:
            source = entry.get("source", {}).get("title", "Google News")
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    published = datetime(*entry.published_parsed[:6])
                except Exception:
                    pass

            results.append(SearchResult(
                title=entry.get("title", ""),
                url=entry.get("link", ""),
                summary=entry.get("summary", entry.get("description", "")),
                published_at=published,
                source=source,
            ))
        return results

    async def _search_newsapi(
        self, keyword: str, language: str, max_results: int
    ) -> list[SearchResult]:
        """通过 NewsAPI 搜索"""
        cfg = self.sources.get("newsapi", {})
        api_key = cfg.get("api_key") or os.getenv("NEWSAPI_KEY", "")
        if not api_key:
            return []

        base_url = cfg.get("base_url", "https://newsapi.org/v2/everything")
        from_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        params = {
            "q": keyword,
            "from": from_date,
            "sortBy": "publishedAt",
            "language": language,
            "pageSize": max_results,
            "apiKey": api_key,
        }

        resp = await self.client.get(f"{base_url}?{urlencode(params)}")
        resp.raise_for_status()
        data = resp.json()

        results = []
        for article in data.get("articles", []):
            published = None
            if article.get("publishedAt"):
                try:
                    published = datetime.fromisoformat(article["publishedAt"].replace("Z", "+00:00"))
                except Exception:
                    pass

            results.append(SearchResult(
                title=article.get("title", ""),
                url=article.get("url", ""),
                summary=article.get("description", ""),
                published_at=published,
                source=article.get("source", {}).get("name", "NewsAPI"),
            ))
        return results

    async def _search_tavily(
        self, keyword: str, max_results: int
    ) -> list[SearchResult]:
        """通过 Tavily 搜索"""
        cfg = self.sources.get("tavily", {})
        api_key = cfg.get("api_key") or os.getenv("TAVILY_API_KEY", "")
        if not api_key:
            return []

        base_url = cfg.get("base_url", "https://api.tavily.com/search")

        resp = await self.client.post(
            base_url,
            json={
                "query": keyword,
                "search_depth": "basic",
                "max_results": max_results,
                "include_answer": False,
            },
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for result in data.get("results", []):
            results.append(SearchResult(
                title=result.get("title", ""),
                url=result.get("url", ""),
                summary=result.get("content", ""),
                published_at=None,
                source="Tavily",
            ))
        return results

    def _normalize_url(self, url: str) -> str:
        """URL 标准化用于去重"""
        url = url.strip().lower()
        if url.startswith("https://"):
            url = url[8:]
        elif url.startswith("http://"):
            url = url[7:]
        url = url.rstrip("/")
        if "?" in url:
            base, params = url.split("?", 1)
            essential = []
            for p in params.split("&"):
                if "=" in p:
                    k, v = p.split("=", 1)
                    if not k.startswith("utm_") and k not in ("ref", "ref_src"):
                        essential.append(f"{k}={v}")
            if essential:
                url = f"{base}?{'&'.join(essential)}"
            else:
                url = base
        return url

    def get_url_hash(self, url: str) -> str:
        return hashlib.md5(self._normalize_url(url).encode()).hexdigest()