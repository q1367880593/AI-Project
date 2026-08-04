from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class NewsStatus(StrEnum):
    DISCOVERED = "discovered"
    CRAWLED = "crawled"
    CRAWL_FAILED = "crawl_failed"
    ANALYZED = "analyzed"
    IGNORED = "ignored"


@dataclass(frozen=True)
class Target:
    slug: str
    name: str
    type: str
    keywords: tuple[str, ...]
    enabled: bool = True


@dataclass
class SearchResult:
    provider: str
    query: str
    title: str
    url: str
    snippet: str = ""
    source_name: str = ""
    published_at: datetime | None = None
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class CrawlResult:
    canonical_url: str
    title_original: str
    content_markdown: str
    source_name: str = ""
    author: str = ""
    language: str = "unknown"
    published_at: datetime | None = None
    content_quality: str = "full"
    extractor: str = "direct"


@dataclass
class EventDraft:
    title_zh: str
    summary_zh: str
    impact_zh: str
    background_zh: str
    importance: int
    credibility: int
    confidence_note_zh: str
    news_ids: list[int]
    topics: list[str] = field(default_factory=list)

