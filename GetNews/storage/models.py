"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class NewsArticle:
    """新闻条目"""
    id: Optional[int] = None
    url: str = ""
    title: str = ""
    content: str = ""  # Markdown 正文
    summary: str = ""
    source: str = ""
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    person_name: str = ""  # 关联的监控对象
    keyword: str = ""  # 搜索使用的关键词
    raw_data: str = ""  # 原始 JSON 数据备份

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "content": self.content,
            "summary": self.summary,
            "source": self.source,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "person_name": self.person_name,
            "keyword": self.keyword,
        }


@dataclass
class Event:
    """新闻事件（聚类后的结果）"""
    id: Optional[int] = None
    summary: str = ""  # 事件摘要
    importance: int = 0  # 重要程度 0-100
    credibility: int = 0  # 可信度 0-100
    person_name: str = ""
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "summary": self.summary,
            "importance": self.importance,
            "credibility": self.credibility,
            "person_name": self.person_name,
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
        }


@dataclass
class EventNews:
    """事件-新闻关联"""
    event_id: int = 0
    news_id: int = 0


@dataclass
class Entity:
    """实体（人物/公司/产品）"""
    id: Optional[int] = None
    name: str = ""
    type: str = ""  # person / company / product

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
        }


@dataclass
class SearchResult:
    """搜索结果"""
    title: str = ""
    url: str = ""
    summary: str = ""
    published_at: Optional[datetime] = None
    source: str = ""


@dataclass
class CrawlResult:
    """抓取结果"""
    url: str = ""
    markdown: str = ""
    title: str = ""
    source: str = ""
    publish_time: Optional[datetime] = None