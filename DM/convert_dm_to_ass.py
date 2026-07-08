#!/usr/bin/env python3
"""Convert protobuf-like danmaku dumps to ASS subtitles.

This script is tailored for the binary files in this folder (`dm1`, `dm2`, ...):

- Top-level records are length-delimited protobuf messages.
- `field 2` is the comment timestamp in milliseconds.
- `field 7` is the comment text.
- `field 3` is the comment mode, but this script renders everything as scrolling
  subtitles because that is what the request asked for.
- `field 5` is the RGB color.

Usage:

    python3 convert_dm_to_ass.py
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
import unicodedata
import shutil


@dataclass(frozen=True)
class Comment:
    time_ms: int
    text: str
    color: int
    font_size: int
    mode: int
    source: str


def read_varint(data: bytes, idx: int) -> Tuple[int, int]:
    value = 0
    shift = 0
    while True:
        if idx >= len(data):
            raise ValueError("unexpected end of data while reading varint")
        b = data[idx]
        idx += 1
        value |= (b & 0x7F) << shift
        if not (b & 0x80):
            return value, idx
        shift += 7


def parse_top_level_messages(data: bytes) -> Iterable[bytes]:
    """Yield each length-delimited protobuf message from the file."""
    idx = 0
    while idx < len(data):
        key, idx = read_varint(data, idx)
        wire_type = key & 0x7
        if wire_type != 2:
            raise ValueError(f"unexpected top-level wire type {wire_type}, expected length-delimited")
        length, idx = read_varint(data, idx)
        msg = data[idx : idx + length]
        if len(msg) != length:
            raise ValueError("truncated top-level message")
        idx += length
        yield msg


def parse_message_fields(msg: bytes) -> Dict[int, List[object]]:
    idx = 0
    fields: Dict[int, List[object]] = {}
    while idx < len(msg):
        key, idx = read_varint(msg, idx)
        field_no = key >> 3
        wire_type = key & 0x7

        if wire_type == 0:
            value, idx = read_varint(msg, idx)
        elif wire_type == 1:
            value = int.from_bytes(msg[idx : idx + 8], "little")
            idx += 8
        elif wire_type == 2:
            length, idx = read_varint(msg, idx)
            value = msg[idx : idx + length]
            idx += length
        elif wire_type == 5:
            value = int.from_bytes(msg[idx : idx + 4], "little")
            idx += 4
        else:
            raise ValueError(f"unsupported wire type {wire_type} in message")
        fields.setdefault(field_no, []).append(value)
    return fields


def decode_comment_text(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").strip()
    return str(value).strip()


def extract_comments(path: Path) -> List[Comment]:
    data = path.read_bytes()
    comments: List[Comment] = []

    for msg in parse_top_level_messages(data):
        fields = parse_message_fields(msg)

        time_ms: Optional[int] = None
        text: Optional[str] = None
        color = 0xFFFFFF
        font_size = 25
        mode = 1

        if 2 in fields and fields[2]:
            raw = fields[2][0]
            if isinstance(raw, int):
                time_ms = raw
        if 7 in fields and fields[7]:
            text = decode_comment_text(fields[7][0])
        if 3 in fields and fields[3]:
            raw = fields[3][0]
            if isinstance(raw, int):
                mode = raw
        if 5 in fields and fields[5]:
            raw = fields[5][0]
            if isinstance(raw, int):
                color = raw & 0xFFFFFF
        if 4 in fields and fields[4]:
            raw = fields[4][0]
            if isinstance(raw, int) and raw > 0:
                font_size = raw

        if time_ms is None or not text:
            continue

        comments.append(
            Comment(
                time_ms=time_ms,
                text=text,
                color=color,
                font_size=font_size,
                mode=mode,
                source=path.name,
            )
        )

    return comments


def ass_time(seconds: float) -> str:
    total_cs = int(round(seconds * 100))
    cs = total_cs % 100
    total_s = total_cs // 100
    s = total_s % 60
    total_m = total_s // 60
    m = total_m % 60
    h = total_m // 60
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ass_color(rgb: int) -> str:
    r = (rgb >> 16) & 0xFF
    g = (rgb >> 8) & 0xFF
    b = rgb & 0xFF
    return f"&H{b:02X}{g:02X}{r:02X}&"


def escape_ass_text(text: str) -> str:
    return (
        text.replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\r\n", r"\N")
        .replace("\n", r"\N")
        .replace("\r", r"\N")
    )


def safe_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\\\|?*]+', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = name.strip(". ")
    return name or "video"


def layout_scale(width: int, height: int) -> float:
    """Scale layout parameters from a 1920x1080 baseline."""
    return min(width / 1920.0, height / 1080.0)


def char_width(ch: str, font_size: float) -> float:
    if ch == "\t":
        return font_size * 2
    if ch.isspace():
        return font_size * 0.35

    east = unicodedata.east_asian_width(ch)
    if east in {"W", "F"}:
        return font_size
    if east == "A":
        return font_size * 0.85
    if ch.isascii():
        return font_size * 0.55
    return font_size * 0.9


def estimate_text_width(text: str, font_size: int) -> int:
    width = 0.0
    for ch in text:
        width += char_width(ch, font_size)
    return max(font_size, int(math.ceil(width)))


def format_ass(
    comments: Sequence[Comment],
    width: int,
    height: int,
    font_name: str,
    font_size: int,
    min_duration: float,
    max_duration: float,
    speed_px_per_sec: float,
    margin_x: int,
    margin_y: int,
    scale: float,
) -> str:
    scaled_font_size = max(12, int(round(font_size * scale)))
    scaled_margin_x = max(0, int(round(margin_x * scale)))
    scaled_margin_y = max(0, int(round(margin_y * scale)))

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Scroll,{font_name},{scaled_font_size},&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,0,0,0,0,100,100,0,0,1,1.2,0,7,{scaled_margin_x},{scaled_margin_x},{scaled_margin_y},1
Style: Top,{font_name},{scaled_font_size},&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,0,0,0,0,100,100,0,0,1,1.2,0,8,{scaled_margin_x},{scaled_margin_x},{scaled_margin_y},1
Style: Bottom,{font_name},{scaled_font_size},&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,0,0,0,0,100,100,0,0,1,1.2,0,2,{scaled_margin_x},{scaled_margin_x},{scaled_margin_y},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    sorted_comments = sorted(comments, key=lambda c: (c.time_ms, c.source, c.text))
    lane_height = max(1, int(round(scaled_font_size * 1.35)))
    lane_count = max(1, (height - scaled_margin_y * 2) // lane_height)
    scroll_lane_free_at = [float("-inf")] * lane_count
    top_lane_free_at = [float("-inf")] * lane_count
    bottom_lane_free_at = [float("-inf")] * lane_count

    events: List[str] = []
    for comment in sorted_comments:
        text = comment.text
        if not text:
            continue

        effective_font_size = max(12, int(round(comment.font_size * scale)))
        effective_speed = max(speed_px_per_sec * scale, 1.0)
        text_width = estimate_text_width(text, effective_font_size)

        scroll_duration = (width + text_width) / effective_speed
        scroll_duration = max(min_duration, min(max_duration, scroll_duration))
        static_duration = 4.0

        start = comment.time_ms / 1000.0

        if comment.mode == 4:
            end = start + static_duration
            free_lanes = [i for i in range(lane_count) if bottom_lane_free_at[i] <= start]
            if free_lanes:
                lane = min(free_lanes, key=lambda i: bottom_lane_free_at[i])
            else:
                lane = min(range(lane_count), key=lambda i: bottom_lane_free_at[i])
            bottom_lane_free_at[lane] = end
            y = height - scaled_margin_y - lane * lane_height
            line = (
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Bottom,,0,0,0,,"
                f"{{\\an2\\pos({width // 2},{y})\\fs{effective_font_size}\\c{ass_color(comment.color)}}}{escape_ass_text(text)}"
            )
        elif comment.mode == 5:
            end = start + static_duration
            free_lanes = [i for i in range(lane_count) if top_lane_free_at[i] <= start]
            if free_lanes:
                lane = min(free_lanes, key=lambda i: top_lane_free_at[i])
            else:
                lane = min(range(lane_count), key=lambda i: top_lane_free_at[i])
            top_lane_free_at[lane] = end
            y = scaled_margin_y + lane * lane_height
            line = (
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Top,,0,0,0,,"
                f"{{\\an8\\pos({width // 2},{y})\\fs{effective_font_size}\\c{ass_color(comment.color)}}}{escape_ass_text(text)}"
            )
        else:
            end = start + scroll_duration
            free_lanes = [i for i in range(lane_count) if scroll_lane_free_at[i] <= start]
            if free_lanes:
                lane = min(free_lanes, key=lambda i: scroll_lane_free_at[i])
            else:
                # If all lanes are busy, fall back to the lane that becomes free soonest.
                lane = min(range(lane_count), key=lambda i: scroll_lane_free_at[i])
            scroll_lane_free_at[lane] = end
            y = scaled_margin_y + lane * lane_height
            x1 = width + text_width
            x2 = -text_width
            line = (
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Scroll,,0,0,0,,"
                f"{{\\move({x1},{y},{x2},{y})\\fs{effective_font_size}\\c{ass_color(comment.color)}}}{escape_ass_text(text)}"
            )
        events.append(line)

    return header + "\n".join(events) + "\n"


def collect_input_files() -> List[Path]:
    cwd = Path(".")
    candidates = [p for p in cwd.iterdir() if p.is_file() and re.fullmatch(r"dm\d+", p.name)]

    def sort_key(path: Path) -> Tuple[int, str]:
        m = re.fullmatch(r"dm(\d+)", path.name)
        if m:
            return (int(m.group(1)), path.name)
        return (10**9, path.name)

    return sorted(candidates, key=sort_key)


def load_video_title(metadata_path: Path = Path("videoInfo.json")) -> str:
    if not metadata_path.exists():
        return "video"
    try:
        info = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return "video"
    if not isinstance(info, dict):
        return "video"
    title = str(info.get("title") or info.get("groupTitle") or "video")
    return safe_filename(title)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Convert binary danmaku files to ASS subtitles.")
    parser.add_argument("--width", type=int, default=1920, help="ASS canvas width.")
    parser.add_argument("--height", type=int, default=1080, help="ASS canvas height.")
    parser.add_argument("--font-name", default="PingFang SC", help="Font name used in the ASS style.")
    parser.add_argument("--font-size", type=int, default=25, help="Base font size at 1920x1080 used for the ASS style.")
    parser.add_argument("--min-duration", type=float, default=5.0, help="Minimum scroll duration in seconds.")
    parser.add_argument("--max-duration", type=float, default=12.0, help="Maximum scroll duration in seconds.")
    parser.add_argument("--speed", type=float, default=220.0, help="Horizontal scroll speed in pixels per second at 1920x1080.")
    parser.add_argument("--margin-x", type=int, default=20, help="Left/right margin at 1920x1080.")
    parser.add_argument("--margin-y", type=int, default=20, help="Top/bottom margin at 1920x1080.")
    args = parser.parse_args(argv)

    input_files = collect_input_files()
    if not input_files:
        print("No input files found. Expected dm1, dm2, ... in the current directory.", file=sys.stderr)
        return 1

    all_comments: List[Comment] = []
    for path in input_files:
        if not path.exists():
            print(f"Skipping missing file: {path}", file=sys.stderr)
            continue
        all_comments.extend(extract_comments(path))

    if not all_comments:
        print("No comments parsed from the input files.", file=sys.stderr)
        return 1

    scale = layout_scale(args.width, args.height)
    title = load_video_title()
    output_path = Path("out") / f"{title}.ass"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ass = format_ass(
        comments=all_comments,
        width=args.width,
        height=args.height,
        font_name=args.font_name,
        font_size=args.font_size,
        min_duration=args.min_duration,
        max_duration=args.max_duration,
        speed_px_per_sec=args.speed,
        margin_x=args.margin_x,
        margin_y=args.margin_y,
        scale=scale,
    )

    output_path.write_text(ass, encoding="utf-8-sig")
    print(f"Wrote {output_path} with {len(all_comments)} comments from {len(input_files)} file(s).")


    # 将 A 文件移动到 B 目录，并重命名为 C
    shutil.move("c.mp4", f"out/{title}.mp4")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
