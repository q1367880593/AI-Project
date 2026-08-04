"""SQLite 数据库操作层"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

from .models import NewsArticle, Event, EventNews, Entity

DB_DIR = Path(__file__).parent.parent / "database"
DB_PATH = DB_DIR / "research.db"


def get_db_path() -> Path:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return DB_PATH


class Database:
    """SQLite 数据库管理"""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or get_db_path()
        self._init_db()

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        """初始化数据库表"""
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS news (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    content TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    source TEXT DEFAULT '',
                    published_at TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    person_name TEXT DEFAULT '',
                    keyword TEXT DEFAULT '',
                    raw_data TEXT DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_news_url ON news(url);
                CREATE INDEX IF NOT EXISTS idx_news_person ON news(person_name);
                CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);

                CREATE TABLE IF NOT EXISTS event (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    summary TEXT DEFAULT '',
                    importance INTEGER DEFAULT 0,
                    credibility INTEGER DEFAULT 0,
                    person_name TEXT DEFAULT '',
                    first_seen TEXT DEFAULT (datetime('now')),
                    last_seen TEXT DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_event_person ON event(person_name);

                CREATE TABLE IF NOT EXISTS event_news (
                    event_id INTEGER NOT NULL,
                    news_id INTEGER NOT NULL,
                    PRIMARY KEY (event_id, news_id),
                    FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
                    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS entity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    type TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS historical_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    current_event_id INTEGER NOT NULL,
                    past_event_id INTEGER NOT NULL,
                    relation_desc TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (current_event_id) REFERENCES event(id) ON DELETE CASCADE,
                    FOREIGN KEY (past_event_id) REFERENCES event(id) ON DELETE CASCADE
                );
            """)

    # ==================== News CRUD ====================

    def insert_news(self, article: NewsArticle) -> int:
        """插入新闻，返回 id。若 URL 已存在则返回已有 id"""
        with self._get_conn() as conn:
            existing = conn.execute(
                "SELECT id FROM news WHERE url = ?", (article.url,)
            ).fetchone()
            if existing:
                return existing["id"]

            cursor = conn.execute(
                """INSERT INTO news (url, title, content, summary, source, published_at,
                   person_name, keyword, raw_data)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    article.url, article.title, article.content, article.summary,
                    article.source,
                    article.published_at.isoformat() if article.published_at else None,
                    article.person_name, article.keyword,
                    article.raw_data,
                ),
            )
            return cursor.lastrowid

    def news_exists(self, url: str) -> bool:
        with self._get_conn() as conn:
            row = conn.execute("SELECT 1 FROM news WHERE url = ?", (url,)).fetchone()
            return row is not None

    def get_news_by_url(self, url: str) -> Optional[NewsArticle]:
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM news WHERE url = ?", (url,)).fetchone()
            if row:
                return self._row_to_news(row)
        return None

    def get_news_by_id(self, news_id: int) -> Optional[NewsArticle]:
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM news WHERE id = ?", (news_id,)).fetchone()
            if row:
                return self._row_to_news(row)
        return None

    def get_news_by_person(self, person_name: str, limit: int = 100) -> list[NewsArticle]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM news WHERE person_name = ? ORDER BY published_at DESC LIMIT ?",
                (person_name, limit),
            ).fetchall()
            return [self._row_to_news(r) for r in rows]

    def get_news_by_date(self, date_str: str, person_name: Optional[str] = None) -> list[NewsArticle]:
        """获取指定日期的新闻"""
        with self._get_conn() as conn:
            if person_name:
                rows = conn.execute(
                    """SELECT * FROM news
                       WHERE date(created_at) = ? AND person_name = ?
                       ORDER BY published_at DESC""",
                    (date_str, person_name),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM news WHERE date(created_at) = ? ORDER BY published_at DESC",
                    (date_str,),
                ).fetchall()
            return [self._row_to_news(r) for r in rows]

    def get_recent_news_ids(self, person_name: str, days: int = 30) -> list[int]:
        """获取最近 N 天的新闻 ID 列表"""
        with self._get_conn() as conn:
            rows = conn.execute(
                """SELECT id FROM news
                   WHERE person_name = ?
                     AND created_at >= datetime('now', ?)
                   ORDER BY created_at DESC""",
                (person_name, f'-{days} days'),
            ).fetchall()
            return [r["id"] for r in rows]

    def get_news_for_analysis(self, person_name: str, limit: int = 50) -> list[NewsArticle]:
        """获取待分析的新闻（最近未关联事件的新闻）"""
        with self._get_conn() as conn:
            rows = conn.execute(
                """SELECT n.* FROM news n
                   WHERE n.person_name = ?
                     AND n.id NOT IN (SELECT news_id FROM event_news)
                   ORDER BY n.created_at DESC
                   LIMIT ?""",
                (person_name, limit),
            ).fetchall()
            return [self._row_to_news(r) for r in rows]

    def update_news_content(self, news_id: int, content: str, summary: str = ""):
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE news SET content = ?, summary = ? WHERE id = ?",
                (content, summary, news_id),
            )

    def _row_to_news(self, row: sqlite3.Row) -> NewsArticle:
        return NewsArticle(
            id=row["id"],
            url=row["url"],
            title=row["title"],
            content=row["content"] or "",
            summary=row["summary"] or "",
            source=row["source"] or "",
            published_at=datetime.fromisoformat(row["published_at"]) if row["published_at"] else None,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            person_name=row["person_name"] or "",
            keyword=row["keyword"] or "",
            raw_data=row["raw_data"] or "",
        )

    # ==================== Event CRUD ====================

    def insert_event(self, event: Event) -> int:
        with self._get_conn() as conn:
            cursor = conn.execute(
                """INSERT INTO event (summary, importance, credibility, person_name, first_seen, last_seen)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    event.summary, event.importance, event.credibility,
                    event.person_name,
                    event.first_seen.isoformat() if event.first_seen else datetime.now().isoformat(),
                    event.last_seen.isoformat() if event.last_seen else datetime.now().isoformat(),
                ),
            )
            return cursor.lastrowid

    def update_event(self, event: Event):
        with self._get_conn() as conn:
            conn.execute(
                """UPDATE event SET summary = ?, importance = ?, credibility = ?,
                   last_seen = ? WHERE id = ?""",
                (event.summary, event.importance, event.credibility,
                 event.last_seen.isoformat() if event.last_seen else datetime.now().isoformat(),
                 event.id),
            )

    def get_event_by_id(self, event_id: int) -> Optional[Event]:
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM event WHERE id = ?", (event_id,)).fetchone()
            if row:
                return self._row_to_event(row)
        return None

    def get_events_by_person(self, person_name: str, date_str: Optional[str] = None) -> list[Event]:
        with self._get_conn() as conn:
            if date_str:
                rows = conn.execute(
                    """SELECT * FROM event
                       WHERE person_name = ? AND date(first_seen) = ?
                       ORDER BY importance DESC""",
                    (person_name, date_str),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM event WHERE person_name = ? ORDER BY importance DESC",
                    (person_name,),
                ).fetchall()
            return [self._row_to_event(r) for r in rows]

    def get_past_events(self, person_name: str, exclude_date: str, limit: int = 10) -> list[Event]:
        """获取历史事件（排除当天）"""
        with self._get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM event
                   WHERE person_name = ? AND date(first_seen) < ?
                   ORDER BY first_seen DESC LIMIT ?""",
                (person_name, exclude_date, limit),
            ).fetchall()
            return [self._row_to_event(r) for r in rows]

    def _row_to_event(self, row: sqlite3.Row) -> Event:
        return Event(
            id=row["id"],
            summary=row["summary"] or "",
            importance=row["importance"] or 0,
            credibility=row["credibility"] or 0,
            person_name=row["person_name"] or "",
            first_seen=datetime.fromisoformat(row["first_seen"]) if row["first_seen"] else None,
            last_seen=datetime.fromisoformat(row["last_seen"]) if row["last_seen"] else None,
        )

    # ==================== Event-News 关联 ====================

    def link_event_news(self, event_id: int, news_ids: list[int]):
        with self._get_conn() as conn:
            conn.executemany(
                "INSERT OR IGNORE INTO event_news (event_id, news_id) VALUES (?, ?)",
                [(event_id, nid) for nid in news_ids],
            )

    def get_news_ids_for_event(self, event_id: int) -> list[int]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT news_id FROM event_news WHERE event_id = ?", (event_id,)
            ).fetchall()
            return [r["news_id"] for r in rows]

    def get_news_for_event(self, event_id: int) -> list[NewsArticle]:
        news_ids = self.get_news_ids_for_event(event_id)
        return [self.get_news_by_id(nid) for nid in news_ids if self.get_news_by_id(nid)]

    # ==================== Historical Links ====================

    def insert_historical_link(self, current_event_id: int, past_event_id: int, relation_desc: str = ""):
        with self._get_conn() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO historical_links (current_event_id, past_event_id, relation_desc)
                   VALUES (?, ?, ?)""",
                (current_event_id, past_event_id, relation_desc),
            )

    def get_historical_links(self, event_id: int) -> list[dict]:
        with self._get_conn() as conn:
            rows = conn.execute(
                """SELECT hl.*, e.summary as past_event_summary
                   FROM historical_links hl
                   JOIN event e ON hl.past_event_id = e.id
                   WHERE hl.current_event_id = ?""",
                (event_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    # ==================== Entity ====================

    def upsert_entity(self, name: str, entity_type: str = ""):
        with self._get_conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO entity (name, type) VALUES (?, ?)",
                (name, entity_type),
            )

    # ==================== Stats ====================

    def get_stats(self, person_name: Optional[str] = None) -> dict:
        with self._get_conn() as conn:
            if person_name:
                total_news = conn.execute(
                    "SELECT COUNT(*) FROM news WHERE person_name = ?", (person_name,)
                ).fetchone()[0]
                total_events = conn.execute(
                    "SELECT COUNT(*) FROM event WHERE person_name = ?", (person_name,)
                ).fetchone()[0]
            else:
                total_news = conn.execute("SELECT COUNT(*) FROM news").fetchone()[0]
                total_events = conn.execute("SELECT COUNT(*) FROM event").fetchone()[0]

            return {"total_news": total_news, "total_events": total_events}