from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Iterator

from .domain import CrawlResult, EventDraft, NewsStatus, SearchResult, Target
from .utils import canonicalize_url, isoformat, sha256_text, utc_now


SCHEMA_VERSION = 1


class Database:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.migrate()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=15000")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def migrate(self) -> None:
        with self.connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_meta (
                    version INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS target (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'topic',
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS news (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    canonical_url TEXT NOT NULL,
                    canonical_url_hash TEXT NOT NULL UNIQUE,
                    title_original TEXT NOT NULL DEFAULT '',
                    snippet TEXT NOT NULL DEFAULT '',
                    content_markdown TEXT NOT NULL DEFAULT '',
                    content_hash TEXT,
                    source_name TEXT NOT NULL DEFAULT '',
                    author TEXT NOT NULL DEFAULT '',
                    language TEXT NOT NULL DEFAULT 'unknown',
                    published_at TEXT,
                    discovered_at TEXT NOT NULL,
                    fetched_at TEXT,
                    content_quality TEXT NOT NULL DEFAULT 'unknown',
                    status TEXT NOT NULL DEFAULT 'discovered',
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT NOT NULL DEFAULT '',
                    raw_payload TEXT NOT NULL DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
                CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);
                CREATE INDEX IF NOT EXISTS idx_news_content_hash ON news(content_hash);

                CREATE TABLE IF NOT EXISTS target_news (
                    target_id INTEGER NOT NULL,
                    news_id INTEGER NOT NULL,
                    query TEXT NOT NULL DEFAULT '',
                    relevance_score REAL,
                    is_relevant INTEGER,
                    PRIMARY KEY (target_id, news_id),
                    FOREIGN KEY (target_id) REFERENCES target(id) ON DELETE CASCADE,
                    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS event (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_fingerprint TEXT NOT NULL,
                    title_zh TEXT NOT NULL,
                    summary_zh TEXT NOT NULL,
                    impact_zh TEXT NOT NULL DEFAULT '',
                    background_zh TEXT NOT NULL DEFAULT '',
                    importance INTEGER NOT NULL,
                    credibility INTEGER NOT NULL,
                    confidence_note_zh TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'active',
                    event_date TEXT NOT NULL,
                    first_seen_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_event_fingerprint ON event(event_fingerprint);
                CREATE INDEX IF NOT EXISTS idx_event_date ON event(event_date);

                CREATE TABLE IF NOT EXISTS event_news (
                    event_id INTEGER NOT NULL,
                    news_id INTEGER NOT NULL,
                    evidence_role TEXT NOT NULL DEFAULT 'supporting',
                    PRIMARY KEY (event_id, news_id),
                    FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
                    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS target_event (
                    target_id INTEGER NOT NULL,
                    event_id INTEGER NOT NULL,
                    PRIMARY KEY (target_id, event_id),
                    FOREIGN KEY (target_id) REFERENCES target(id) ON DELETE CASCADE,
                    FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS run (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_date TEXT NOT NULL,
                    target_id INTEGER NOT NULL,
                    pipeline_version TEXT NOT NULL,
                    status TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    finished_at TEXT,
                    discovered_count INTEGER NOT NULL DEFAULT 0,
                    crawled_count INTEGER NOT NULL DEFAULT 0,
                    event_count INTEGER NOT NULL DEFAULT 0,
                    error_count INTEGER NOT NULL DEFAULT 0,
                    report_path TEXT NOT NULL DEFAULT '',
                    UNIQUE (run_date, target_id, pipeline_version),
                    FOREIGN KEY (target_id) REFERENCES target(id) ON DELETE CASCADE
                );
                """
            )
            row = connection.execute("SELECT version FROM schema_meta LIMIT 1").fetchone()
            if row is None:
                connection.execute("INSERT INTO schema_meta(version) VALUES (?)", (SCHEMA_VERSION,))
            elif row["version"] != SCHEMA_VERSION:
                raise RuntimeError(
                    f"数据库版本 {row['version']} 与程序版本 {SCHEMA_VERSION} 不兼容"
                )

    def upsert_target(self, target: Target) -> int:
        now = utc_now().isoformat()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO target(slug, name, type, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(slug) DO UPDATE SET
                    name=excluded.name, type=excluded.type,
                    enabled=excluded.enabled, updated_at=excluded.updated_at
                """,
                (target.slug, target.name, target.type, int(target.enabled), now, now),
            )
            row = connection.execute("SELECT id FROM target WHERE slug=?", (target.slug,)).fetchone()
            return int(row["id"])

    def get_target_id(self, slug: str) -> int:
        with self.connect() as connection:
            row = connection.execute("SELECT id FROM target WHERE slug=?", (slug,)).fetchone()
            if row is None:
                raise KeyError(f"监控对象不存在：{slug}")
            return int(row["id"])

    def upsert_search_result(self, target_id: int, result: SearchResult) -> tuple[int, bool]:
        canonical_url = canonicalize_url(result.url)
        url_hash = sha256_text(canonical_url)
        now = utc_now().isoformat()
        payload = json.dumps(result.raw_payload, ensure_ascii=False)
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT id FROM news WHERE canonical_url_hash=?", (url_hash,)
            ).fetchone()
            created = existing is None
            if created:
                cursor = connection.execute(
                    """
                    INSERT INTO news(
                        canonical_url, canonical_url_hash, title_original, snippet,
                        source_name, published_at, discovered_at, raw_payload
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        canonical_url,
                        url_hash,
                        result.title,
                        result.snippet,
                        result.source_name,
                        isoformat(result.published_at),
                        now,
                        payload,
                    ),
                )
                news_id = int(cursor.lastrowid)
            else:
                news_id = int(existing["id"])
                connection.execute(
                    """
                    UPDATE news SET
                        title_original=CASE WHEN title_original='' THEN ? ELSE title_original END,
                        snippet=CASE WHEN snippet='' THEN ? ELSE snippet END,
                        source_name=CASE WHEN source_name='' THEN ? ELSE source_name END,
                        published_at=COALESCE(published_at, ?)
                    WHERE id=?
                    """,
                    (
                        result.title,
                        result.snippet,
                        result.source_name,
                        isoformat(result.published_at),
                        news_id,
                    ),
                )
            connection.execute(
                """
                INSERT INTO target_news(target_id, news_id, query)
                VALUES (?, ?, ?)
                ON CONFLICT(target_id, news_id) DO UPDATE SET query=excluded.query
                """,
                (target_id, news_id, result.query),
            )
            return news_id, created

    def pending_news(self, target_id: int, retry_failed: bool = True) -> list[sqlite3.Row]:
        statuses = [NewsStatus.DISCOVERED.value]
        if retry_failed:
            statuses.append(NewsStatus.CRAWL_FAILED.value)
        placeholders = ",".join("?" for _ in statuses)
        with self.connect() as connection:
            return connection.execute(
                f"""
                SELECT n.* FROM news n
                JOIN target_news tn ON tn.news_id=n.id
                WHERE tn.target_id=? AND n.status IN ({placeholders})
                ORDER BY n.discovered_at
                """,
                (target_id, *statuses),
            ).fetchall()

    def save_crawl(self, news_id: int, result: CrawlResult) -> None:
        content_hash = sha256_text(result.content_markdown) if result.content_markdown else None
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE news SET title_original=COALESCE(NULLIF(?, ''), title_original),
                    content_markdown=?, content_hash=?, source_name=COALESCE(NULLIF(?, ''), source_name),
                    author=?, language=?, published_at=COALESCE(?, published_at), fetched_at=?,
                    content_quality=?, status=?, attempt_count=attempt_count+1, last_error=''
                WHERE id=?
                """,
                (
                    result.title_original,
                    result.content_markdown,
                    content_hash,
                    result.source_name,
                    result.author,
                    result.language,
                    isoformat(result.published_at),
                    utc_now().isoformat(),
                    result.content_quality,
                    NewsStatus.CRAWLED.value,
                    news_id,
                ),
            )

    def mark_crawl_failed(self, news_id: int, error: str) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE news SET status=?, attempt_count=attempt_count+1, last_error=? WHERE id=?
                """,
                (NewsStatus.CRAWL_FAILED.value, error[:1000], news_id),
            )

    def news_for_analysis(self, target_id: int, day: date) -> list[sqlite3.Row]:
        with self.connect() as connection:
            return connection.execute(
                """
                SELECT n.*, tn.relevance_score, tn.is_relevant
                FROM news n JOIN target_news tn ON tn.news_id=n.id
                LEFT JOIN event_news en ON en.news_id=n.id
                LEFT JOIN target_event te ON te.event_id=en.event_id AND te.target_id=tn.target_id
                WHERE tn.target_id=? AND n.status IN (?, ?, ?)
                  AND (n.published_at IS NULL OR date(n.published_at) BETWEEN date(?, '-1 day') AND date(?))
                  AND te.event_id IS NULL
                ORDER BY COALESCE(n.published_at, n.discovered_at) DESC
                """,
                (
                    target_id,
                    NewsStatus.CRAWLED.value,
                    NewsStatus.CRAWL_FAILED.value,
                    NewsStatus.ANALYZED.value,
                    day.isoformat(),
                    day.isoformat(),
                ),
            ).fetchall()

    def set_relevance(self, target_id: int, news_id: int, score: float, relevant: bool) -> None:
        with self.connect() as connection:
            connection.execute(
                "UPDATE target_news SET relevance_score=?, is_relevant=? WHERE target_id=? AND news_id=?",
                (score, int(relevant), target_id, news_id),
            )

    def insert_event(self, target_id: int, day: date, draft: EventDraft) -> int:
        fingerprint = sha256_text(" ".join(sorted(str(item) for item in draft.news_ids)))
        now = utc_now().isoformat()
        with self.connect() as connection:
            existing = connection.execute(
                """
                SELECT e.id FROM event e JOIN target_event te ON te.event_id=e.id
                WHERE te.target_id=? AND e.event_fingerprint=? AND e.event_date=?
                """,
                (target_id, fingerprint, day.isoformat()),
            ).fetchone()
            if existing:
                event_id = int(existing["id"])
                connection.execute(
                    """
                    UPDATE event SET title_zh=?, summary_zh=?, impact_zh=?, background_zh=?,
                        importance=?, credibility=?, confidence_note_zh=?, last_seen_at=?, updated_at=?
                    WHERE id=?
                    """,
                    (
                        draft.title_zh,
                        draft.summary_zh,
                        draft.impact_zh,
                        draft.background_zh,
                        draft.importance,
                        draft.credibility,
                        draft.confidence_note_zh,
                        now,
                        now,
                        event_id,
                    ),
                )
            else:
                cursor = connection.execute(
                    """
                    INSERT INTO event(
                        event_fingerprint, title_zh, summary_zh, impact_zh, background_zh,
                        importance, credibility, confidence_note_zh, event_date,
                        first_seen_at, last_seen_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        fingerprint,
                        draft.title_zh,
                        draft.summary_zh,
                        draft.impact_zh,
                        draft.background_zh,
                        draft.importance,
                        draft.credibility,
                        draft.confidence_note_zh,
                        day.isoformat(),
                        now,
                        now,
                        now,
                    ),
                )
                event_id = int(cursor.lastrowid)
                connection.execute(
                    "INSERT INTO target_event(target_id, event_id) VALUES (?, ?)",
                    (target_id, event_id),
                )
            connection.executemany(
                "INSERT OR IGNORE INTO event_news(event_id, news_id) VALUES (?, ?)",
                [(event_id, news_id) for news_id in draft.news_ids],
            )
            connection.executemany(
                "UPDATE news SET status=? WHERE id=?",
                [(NewsStatus.ANALYZED.value, news_id) for news_id in draft.news_ids],
            )
            return event_id

    def events_for_report(self, target_id: int, day: date) -> list[dict]:
        with self.connect() as connection:
            events = connection.execute(
                """
                SELECT e.* FROM event e JOIN target_event te ON te.event_id=e.id
                WHERE te.target_id=? AND e.event_date=?
                ORDER BY e.importance DESC, e.credibility DESC, e.last_seen_at DESC
                """,
                (target_id, day.isoformat()),
            ).fetchall()
            output: list[dict] = []
            for event in events:
                sources = connection.execute(
                    """
                    SELECT n.title_original, n.canonical_url, n.source_name,
                           n.published_at, n.content_quality
                    FROM news n JOIN event_news en ON en.news_id=n.id
                    WHERE en.event_id=? ORDER BY n.published_at DESC
                    """,
                    (event["id"],),
                ).fetchall()
                item = dict(event)
                item["sources"] = [dict(source) for source in sources]
                output.append(item)
            return output

    def begin_run(self, target_id: int, day: date, version: str) -> int:
        now = utc_now().isoformat()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO run(run_date, target_id, pipeline_version, status, started_at)
                VALUES (?, ?, ?, 'running', ?)
                ON CONFLICT(run_date, target_id, pipeline_version) DO UPDATE SET
                    status='running', started_at=excluded.started_at, finished_at=NULL,
                    discovered_count=0, crawled_count=0, event_count=0,
                    error_count=0, report_path=''
                """,
                (day.isoformat(), target_id, version, now),
            )
            row = connection.execute(
                "SELECT id FROM run WHERE run_date=? AND target_id=? AND pipeline_version=?",
                (day.isoformat(), target_id, version),
            ).fetchone()
            return int(row["id"])

    def finish_run(
        self,
        run_id: int,
        status: str,
        discovered: int,
        crawled: int,
        events: int,
        errors: int,
        report_path: str = "",
    ) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE run SET status=?, finished_at=?, discovered_count=?, crawled_count=?,
                    event_count=?, error_count=?, report_path=? WHERE id=?
                """,
                (
                    status,
                    utc_now().isoformat(),
                    discovered,
                    crawled,
                    events,
                    errors,
                    report_path,
                    run_id,
                ),
            )

    def stats(self) -> dict:
        with self.connect() as connection:
            return {
                "targets": connection.execute("SELECT COUNT(*) FROM target").fetchone()[0],
                "news": connection.execute("SELECT COUNT(*) FROM news").fetchone()[0],
                "events": connection.execute("SELECT COUNT(*) FROM event").fetchone()[0],
                "runs": connection.execute("SELECT COUNT(*) FROM run").fetchone()[0],
            }
