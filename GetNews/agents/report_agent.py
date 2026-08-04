"""Report Agent - 生成中文日报/周报"""

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from storage import Database, Event, NewsArticle
from .llm_client import LLMClient


class ReportAgent:
    """报告 Agent，生成日报、周报"""

    STAR_MAP = {
        range(90, 101): "⭐⭐⭐⭐⭐",
        range(70, 90): "⭐⭐⭐⭐",
        range(50, 70): "⭐⭐⭐",
        range(30, 50): "⭐⭐",
        range(0, 30): "⭐",
    }

    def __init__(
        self,
        db: Database,
        llm: Optional[LLMClient] = None,
        output_dir: str = "reports",
    ):
        self.db = db
        self.llm = llm
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_daily_report(
        self,
        person_name: str,
        target_date: Optional[date] = None,
        format: str = "markdown",
    ) -> str:
        """生成日报"""
        target_date = target_date or date.today()
        date_str = target_date.isoformat()

        events = self.db.get_events_by_person(person_name, date_str)
        if not events:
            return self._empty_report(person_name, target_date)

        events.sort(key=lambda e: e.importance, reverse=True)
        report = self._template_report(person_name, target_date, events)
        self._save_report(person_name, target_date, report, format)
        return report

    def _template_report(self, person_name: str, target_date: date, events: list[Event]) -> str:
        """使用模板生成中文报告"""
        lines = [
            f"# {person_name} 日报",
            f"**日期：{target_date}**",
            "",
            "---",
            "",
            f"> 今日共监测到 {len(events)} 个相关事件，按重要程度排列如下：",
            "",
        ]

        for i, e in enumerate(events, 1):
            stars = self._get_stars(e.importance)
            news = self.db.get_news_for_event(e.id)
            sources = list(set(n.source for n in news if n.source))

            lines.append(f"## {i}. {stars} {e.summary[:80]}")
            lines.append("")
            lines.append(f"| 指标 | 评分 |")
            lines.append(f"|------|------|")
            lines.append(f"| 重要程度 | {e.importance}/100 |")
            lines.append(f"| 可信度 | {e.credibility}% |")
            lines.append("")

            # 解析摘要
            if "\n\n影响：" in e.summary:
                parts = e.summary.split("\n\n影响：")
                lines.append(f"**摘要**：{parts[0]}")
                if len(parts) > 1:
                    impact_parts = parts[1].split("\n\n背景：")
                    lines.append(f"**影响**：{impact_parts[0]}")
                    if len(impact_parts) > 1:
                        lines.append(f"**背景**：{impact_parts[1]}")
            else:
                lines.append(f"**摘要**：{e.summary}")

            lines.append("")

            # 相关新闻链接
            if news:
                lines.append("**相关新闻**：")
                for n in news[:5]:
                    lines.append(f"- [{n.title[:60]}]({n.url})")
                lines.append("")

            if sources:
                lines.append(f"**来源**：{', '.join(sources)}")

            lines.append("")
            lines.append("---")
            lines.append("")

        return "\n".join(lines)

    def _empty_report(self, person_name: str, target_date: date) -> str:
        report = f"# {person_name} 日报\n**日期：{target_date}**\n\n---\n\n今日暂无相关新闻。"
        self._save_report(person_name, target_date, report, "markdown")
        return report

    def _get_stars(self, importance: int) -> str:
        for rng, stars in self.STAR_MAP.items():
            if importance in rng:
                return stars
        return "⭐"

    def _save_report(
        self, person_name: str, target_date: date, content: str, format: str
    ) -> Path:
        safe_name = person_name.lower().replace(" ", "_")
        filename = f"{safe_name}_{target_date.isoformat()}.md"
        filepath = self.output_dir / filename

        if format == "html":
            filepath = filepath.with_suffix(".html")
            content = self._markdown_to_html(content)

        filepath.write_text(content, encoding="utf-8")
        print(f"[Report] 已保存: {filepath}")
        return filepath

    def _markdown_to_html(self, md: str) -> str:
        try:
            import markdown
            return markdown.markdown(md, extensions=["extra", "nl2br"])
        except ImportError:
            return f"<html><head><meta charset='utf-8'></head><body><pre>{md}</pre></body></html>"

    def generate_weekly_report(
        self, person_name: str, end_date: Optional[date] = None
    ) -> str:
        """生成周报"""
        end_date = end_date or date.today()
        start_date = end_date - timedelta(days=7)

        lines = [
            f"# {person_name} 周报",
            f"**{start_date} ~ {end_date}**",
            "",
            "---",
            "",
        ]

        with self.db._get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM event
                   WHERE person_name = ? AND date(first_seen) BETWEEN ? AND ?
                   ORDER BY importance DESC""",
                (person_name, start_date.isoformat(), end_date.isoformat()),
            ).fetchall()

        events = []
        for row in rows:
            event = Event(
                id=row["id"],
                summary=row["summary"] or "",
                importance=row["importance"] or 0,
                credibility=row["credibility"] or 0,
                person_name=row["person_name"] or "",
                first_seen=datetime.fromisoformat(row["first_seen"]) if row["first_seen"] else None,
                last_seen=datetime.fromisoformat(row["last_seen"]) if row["last_seen"] else None,
            )
            events.append(event)

        if not events:
            lines.append("本周暂无相关新闻。")
            content = "\n".join(lines)
            safe_name = person_name.lower().replace(" ", "_")
            filepath = self.output_dir / f"{safe_name}_weekly_{end_date.isoformat()}.md"
            filepath.write_text(content, encoding="utf-8")
            return content

        from collections import defaultdict
        by_date = defaultdict(list)
        for e in events:
            if e.first_seen:
                by_date[e.first_seen.date()].append(e)

        for d in sorted(by_date.keys(), reverse=True):
            lines.append(f"## {d}")
            lines.append("")
            for e in by_date[d]:
                stars = self._get_stars(e.importance)
                lines.append(f"- {stars} {e.summary[:100]}（重要性：{e.importance}）")
            lines.append("")

        safe_name = person_name.lower().replace(" ", "_")
        filepath = self.output_dir / f"{safe_name}_weekly_{end_date.isoformat()}.md"
        content = "\n".join(lines)
        filepath.write_text(content, encoding="utf-8")
        print(f"[Report] 周报已保存: {filepath}")

        return content