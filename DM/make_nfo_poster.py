#!/usr/bin/env python3
"""Generate a media-library NFO file and poster image from Bilibili metadata.

Defaults:
- read `videoInfo.json`
- write `out/<videoInfo.title>.nfo`
- copy `image.jpg` to `out/<videoInfo.title>-poster.jpg`

The generated NFO follows a simple Kodi/Emby-friendly `<movie>` layout.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from xml.sax.saxutils import escape as xml_escape


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def format_date_from_epoch(value: Any) -> Optional[str]:
    """Format epoch seconds or milliseconds as YYYY-MM-DD."""
    if value is None:
        return None
    ts = as_int(value, 0)
    if ts <= 0:
        return None
    if ts > 10_000_000_000:
        ts /= 1000.0
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def format_datetime_from_epoch(value: Any) -> Optional[str]:
    """Format epoch seconds or milliseconds as an ISO-like UTC datetime."""
    if value is None:
        return None
    ts = as_int(value, 0)
    if ts <= 0:
        return None
    if ts > 10_000_000_000:
        ts /= 1000.0
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def safe_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\\\|?*]+', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = name.strip(". ")
    return name or "video"


def build_plot(info: Dict[str, Any]) -> str:
    lines = []
    title = info.get("title") or info.get("groupTitle")
    if title:
        lines.append(str(title))

    uname = info.get("uname")
    if uname:
        lines.append(f"UP主: {uname}")

    bvid = info.get("bvid")
    if bvid:
        lines.append(f"BV号: {bvid}")

    aid = info.get("aid")
    if aid is not None:
        lines.append(f"AID: {aid}")

    view = info.get("view")
    if view is not None:
        lines.append(f"播放: {view}")

    danmaku = info.get("danmaku")
    if danmaku is not None:
        lines.append(f"弹幕: {danmaku}")

    duration = info.get("duration")
    if duration is not None:
        lines.append(f"时长: {as_int(duration) // 60} 分钟")

    pubdate = format_date_from_epoch(info.get("pubdate"))
    if pubdate:
        lines.append(f"发布时间: {pubdate}")

    return "\n".join(lines)


def build_nfo(info: Dict[str, Any], thumb: str) -> str:
    title = str(info.get("title") or info.get("groupTitle") or "")
    originaltitle = str(info.get("groupTitle") or title)
    sorttitle = title
    plot = build_plot(info)
    premiered = format_date_from_epoch(info.get("pubdate"))
    aired = premiered
    year = None
    if premiered:
        year = premiered[:4]

    runtime_seconds = as_int(info.get("duration"), 0)
    runtime_minutes = max(1, runtime_seconds // 60) if runtime_seconds else None
    unique_bvid = str(info.get("bvid") or "")
    aid = info.get("aid")
    cid = info.get("cid")
    uname = str(info.get("uname") or "")
    studio = "Bilibili"

    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        "<movie>",
    ]

    def add(tag: str, value: Optional[Any]) -> None:
        if value is None or value == "":
            return
        parts.append(f"  <{tag}>{xml_escape(str(value))}</{tag}>")

    add("title", title)
    add("originaltitle", originaltitle)
    add("sorttitle", sorttitle)
    add("year", year)
    add("premiered", premiered)
    add("aired", aired)
    add("runtime", runtime_minutes)
    add("studio", studio)
    add("thumb", thumb)
    add("plot", plot)
    add("tagline", title)
    add("director", uname)
    add("writer", uname)
    add("id", aid)

    if unique_bvid:
        parts.append(f'  <uniqueid type="bilibili" default="true">{xml_escape(unique_bvid)}</uniqueid>')
    if cid is not None:
        parts.append(f'  <uniqueid type="cid">{xml_escape(str(cid))}</uniqueid>')

    parts.extend(
        [
            "</movie>",
            "",
        ]
    )
    return "\n".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert videoInfo.json to NFO and image.jpg to a title-based poster.")
    parser.add_argument("-i", "--input-json", default="videoInfo.json", help="Input metadata JSON file.")
    parser.add_argument("-o", "--output-nfo", default=None, help="Output NFO file. Defaults to out/<title>.nfo.")
    parser.add_argument("--cover", default="image.jpg", help="Input cover image.")
    parser.add_argument("--poster", default=None, help="Output poster image. Defaults to out/<title>-poster.jpg.")
    args = parser.parse_args()

    input_json = Path(args.input_json)
    cover = Path(args.cover)

    info = json.loads(input_json.read_text(encoding="utf-8"))
    if not isinstance(info, dict):
        raise SystemExit("videoInfo.json must contain a JSON object")

    title = str(info.get("title") or info.get("groupTitle") or "video")
    base_name = safe_filename(title)
    output_dir = input_json.parent / "out"
    output_nfo = Path(args.output_nfo) if args.output_nfo else output_dir / f"{base_name}.nfo"
    poster = Path(args.poster) if args.poster else output_dir / f"{base_name}-poster.jpg"

    output_nfo.parent.mkdir(parents=True, exist_ok=True)
    output_nfo.write_text(build_nfo(info, poster.name), encoding="utf-8")

    if cover.exists():
        poster.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cover, poster)
    else:
        raise SystemExit(f"Cover image not found: {cover}")

    print(f"Wrote {output_nfo} and {poster}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
