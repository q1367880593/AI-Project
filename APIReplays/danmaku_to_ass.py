#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""将 B 站弹幕 JSON 转换为 ASS 字幕。

参考 convert_dm_to_ass.py 的车道分配 / 颜色 / 文本宽度估计 / 动态滚动时长
等算法，输入由 protobuf 二进制改为 JSON（弹幕_纵横宇宙.json 等）。

用法：
    python3 danmaku_to_ass.py [输入.json] [输出.ass]
    python3 danmaku_to_ass.py --width 1920 --height 1080 --font-size 25 --speed 220
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence


@dataclass(frozen=True)
class Comment:
    time_ms: int
    text: str
    color: int
    font_size: int
    mode: int


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
    """十进制 RGB（RRGGBB）-> ASS 的 &HBBGGRR&"""
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


def layout_scale(width: int, height: int) -> float:
    """按 1920x1080 基准缩放布局参数。"""
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

    sorted_comments = sorted(comments, key=lambda c: (c.time_ms, c.text))
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
            free = [i for i in range(lane_count) if bottom_lane_free_at[i] <= start]
            lane = min(free, key=lambda i: bottom_lane_free_at[i]) if free else min(
                range(lane_count), key=lambda i: bottom_lane_free_at[i]
            )
            bottom_lane_free_at[lane] = end
            y = height - scaled_margin_y - lane * lane_height
            line = (
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Bottom,,0,0,0,,"
                f"{{\\an2\\pos({width // 2},{y})\\fs{effective_font_size}\\c{ass_color(comment.color)}}}"
                f"{escape_ass_text(text)}"
            )
        elif comment.mode == 5:
            end = start + static_duration
            free = [i for i in range(lane_count) if top_lane_free_at[i] <= start]
            lane = min(free, key=lambda i: top_lane_free_at[i]) if free else min(
                range(lane_count), key=lambda i: top_lane_free_at[i]
            )
            top_lane_free_at[lane] = end
            y = scaled_margin_y + lane * lane_height
            line = (
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Top,,0,0,0,,"
                f"{{\\an8\\pos({width // 2},{y})\\fs{effective_font_size}\\c{ass_color(comment.color)}}}"
                f"{escape_ass_text(text)}"
            )
        else:  # 滚动（含逆向等，统一从右到左）
            end = start + scroll_duration
            free = [i for i in range(lane_count) if scroll_lane_free_at[i] <= start]
            lane = min(free, key=lambda i: scroll_lane_free_at[i]) if free else min(
                range(lane_count), key=lambda i: scroll_lane_free_at[i]
            )
            scroll_lane_free_at[lane] = end
            y = scaled_margin_y + lane * lane_height
            x1 = width + text_width
            x2 = -text_width
            line = (
                f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Scroll,,0,0,0,,"
                f"{{\\move({x1},{y},{x2},{y})\\fs{effective_font_size}\\c{ass_color(comment.color)}}}"
                f"{escape_ass_text(text)}"
            )
        events.append(line)

    return header + "\n".join(events) + "\n"


def load_comments(src: Path) -> List[Comment]:
    data = json.loads(src.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("data") or []
    comments: List[Comment] = []
    for d in data:
        text = (d.get("content") or "").strip()
        if not text:
            continue
        progress = d.get("progress")
        if isinstance(progress, (int, float)) and progress:
            time_ms = max(0, int(round(progress)))
        else:
            time_ms = max(0, int(round(float(d.get("time_sec", 0)) * 1000)))
        comments.append(
            Comment(
                time_ms=time_ms,
                text=text,
                color=int(d.get("color", 0xFFFFFF)) & 0xFFFFFF,
                font_size=max(1, int(d.get("fontsize", 25) or 25)),
                mode=int(d.get("mode", 1) or 1),
            )
        )
    return comments


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="将 B 站弹幕 JSON 转换为 ASS 字幕。")
    parser.add_argument("input", nargs="?", default="弹幕_纵横宇宙.json", help="输入 JSON 路径。")
    parser.add_argument("output", nargs="?", default=None, help="输出 ASS 路径（默认同目录同名 .ass）。")
    parser.add_argument("--width", type=int, default=1920, help="ASS 画布宽度。")
    parser.add_argument("--height", type=int, default=1080, help="ASS 画布高度。")
    parser.add_argument("--font-name", default="PingFang SC", help="ASS 样式使用的字体。")
    parser.add_argument("--font-size", type=int, default=25, help="基准字号（1920x1080 下）。")
    parser.add_argument("--min-duration", type=float, default=5.0, help="滚动最短秒数。")
    parser.add_argument("--max-duration", type=float, default=12.0, help="滚动最长秒数。")
    parser.add_argument("--speed", type=float, default=220.0, help="滚动速度（像素/秒，1920x1080 下）。")
    parser.add_argument("--margin-x", type=int, default=20, help="左右边距。")
    parser.add_argument("--margin-y", type=int, default=20, help="上下边距。")
    args = parser.parse_args(argv)

    src = Path(args.input)
    if not src.exists():
        print(f"输入文件不存在：{src}", file=sys.stderr)
        return 1

    comments = load_comments(src)
    if not comments:
        print("未解析到任何弹幕。", file=sys.stderr)
        return 1

    scale = layout_scale(args.width, args.height)
    output = Path(args.output or src.with_suffix(".ass"))
    ass = format_ass(
        comments=comments,
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
    output.write_text(ass, encoding="utf-8-sig")
    print(f"已导出 {output}，共 {len(comments)} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())