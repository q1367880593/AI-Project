from __future__ import annotations

import os
import re
import tempfile
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .domain import Target


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'


def safe_link(url: str) -> str:
    return url.replace("(", "%28").replace(")", "%29").replace(" ", "%20")


def safe_text(value: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value or "").strip()


def score_label(score: int) -> str:
    if score >= 90:
        return "很高"
    if score >= 75:
        return "较高"
    if score >= 60:
        return "一般"
    return "待核实"


class MarkdownReporter:
    def __init__(self, report_dir: Path, timezone_name: str, pipeline_version: str):
        self.report_dir = report_dir
        self.timezone = ZoneInfo(timezone_name)
        self.timezone_name = timezone_name
        self.pipeline_version = pipeline_version

    def render(
        self,
        target: Target,
        day: date,
        events: list[dict],
        warnings: list[str],
        window_hours: int = 24,
    ) -> str:
        generated_at = datetime.now(self.timezone)
        source_count = sum(len(event["sources"]) for event in events)
        partial = bool(warnings)
        title = f"{target.name} 新闻日报｜{day.isoformat()}"
        lines = [
            "---",
            f"title: {yaml_quote(title)}",
            f'date: "{day.isoformat()}"',
            f'timezone: "{self.timezone_name}"',
            'language: "zh-CN"',
            f"target: {yaml_quote(target.name)}",
            f'generated_at: "{generated_at.isoformat(timespec="seconds")}"',
            f'pipeline_version: "{self.pipeline_version}"',
            f"event_count: {len(events)}",
            f"source_count: {source_count}",
            f"partial: {'true' if partial else 'false'}",
            "---",
            "",
            f"# {title}",
            "",
            f"> 统计日期：{day.isoformat()}（{self.timezone_name}，最近 {window_hours} 小时）",
            ">",
            f"> 共收录 {len(events)} 个事件、{source_count} 个来源。",
            "",
        ]
        if events:
            lines.extend(["## 今日要点", ""])
            for event in events[:5]:
                lines.append(f"- {safe_text(event['title_zh'])}")
            lines.extend(["", "## 重点事件", ""])
            for index, event in enumerate(events, start=1):
                lines.extend(self._render_event(index, event))
        else:
            lines.extend(
                [
                    "## 今日概览",
                    "",
                    "今日未发现符合条件的重要新闻。",
                    "",
                ]
            )
        lines.extend(
            [
                "## 采集说明",
                "",
                "- 本报告由自动化流程生成，重要信息请以原始来源为准。",
            ]
        )
        if warnings:
            for warning in dict.fromkeys(warnings):
                lines.append(f"- 部分完成：{safe_text(warning)}")
        else:
            lines.append("- 本次任务未记录采集或分析异常。")
        lines.append("")
        return "\n".join(lines)

    def _render_event(self, index: int, event: dict) -> list[str]:
        lines = [
            f"### {index}. {safe_text(event['title_zh'])}",
            "",
            f"**重要性：** {event['importance']}/100（{score_label(event['importance'])}）",
            "",
            f"**可信度：** {event['credibility']}/100（{score_label(event['credibility'])}）",
            "",
            "**事件摘要**",
            "",
            safe_text(event["summary_zh"]),
            "",
            "**影响分析**",
            "",
            safe_text(event["impact_zh"]),
            "",
            "**背景关联**",
            "",
            safe_text(event["background_zh"]),
            "",
            f"**证据说明：** {safe_text(event['confidence_note_zh'])}",
            "",
            "**来源**",
            "",
        ]
        for source in event["sources"]:
            source_name = safe_text(source["source_name"]) or "原始来源"
            source_title = safe_text(source["title_original"]) or "查看原文"
            timestamp = self._format_time(source["published_at"])
            suffix = f" — {timestamp}" if timestamp else ""
            if source["content_quality"] == "snippet_only":
                suffix += "（仅检索摘要）"
            lines.append(f"- [{source_name}：{source_title}]({safe_link(source['canonical_url'])}){suffix}")
        lines.extend(["", "---", ""])
        return lines

    def _format_time(self, value: str | None) -> str:
        if not value:
            return ""
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=self.timezone)
            return parsed.astimezone(self.timezone).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            return value

    def write(self, target: Target, day: date, content: str) -> Path:
        target_dir = self.report_dir / target.slug
        target_dir.mkdir(parents=True, exist_ok=True)
        destination = target_dir / f"{day.isoformat()}.md"
        file_descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{destination.name}.", dir=target_dir, text=True
        )
        try:
            with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as temp_file:
                temp_file.write(content)
                temp_file.flush()
                os.fsync(temp_file.fileno())
            os.replace(temporary_name, destination)
        except Exception:
            try:
                os.unlink(temporary_name)
            except FileNotFoundError:
                pass
            raise
        return destination

