#!/usr/bin/env python3
from __future__ import annotations

import html
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path("闹鬼酒店")
OUT_DIR = Path("闹鬼酒店_ASS双语字幕")


@dataclass
class Cue:
    start: int
    end: int
    text: str


TIME_RE = re.compile(
    r"(?P<sh>\d{2}):(?P<sm>\d{2}):(?P<ss>\d{2}),(?P<sms>\d{3})\s+-->\s+"
    r"(?P<eh>\d{2}):(?P<em>\d{2}):(?P<es>\d{2}),(?P<ems>\d{3})"
)


def parse_time(h: str, m: str, s: str, ms: str) -> int:
    return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(ms)


def parse_srt(path: Path) -> list[Cue]:
    raw = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    cues: list[Cue] = []
    for block in re.split(r"\n\s*\n", raw.strip()):
        lines = [line.strip() for line in block.splitlines()]
        time_index = next((i for i, line in enumerate(lines) if "-->" in line), None)
        if time_index is None:
            continue
        match = TIME_RE.search(lines[time_index])
        if not match:
            continue
        start = parse_time(match["sh"], match["sm"], match["ss"], match["sms"])
        end = parse_time(match["eh"], match["em"], match["es"], match["ems"])
        text = normalize_text(lines[time_index + 1 :])
        cues.append(Cue(start, end, text))
    return cues


def normalize_text(lines: list[str]) -> str:
    parts = []
    for line in lines:
        line = html.unescape(line.strip())
        line = re.sub(r"</?i>", "", line, flags=re.I)
        line = re.sub(r"</?font[^>]*>", "", line, flags=re.I)
        line = re.sub(r"<br\s*/?>", " ", line, flags=re.I)
        line = re.sub(r"<[^>]+>", "", line)
        if line:
            parts.append(line)
    if not parts:
        return ""

    speaker_lines = [p for p in parts if p.startswith("-")]
    if len(speaker_lines) >= 2:
        text = " - ".join(p.lstrip("-").strip() for p in parts if p.strip("- ").strip())
    else:
        text = " ".join(parts)

    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("{", "(").replace("}", ")")
    return text


def overlap(a: Cue, b: Cue) -> int:
    return max(0, min(a.end, b.end) - max(a.start, b.start))


def has_meaningful_overlap(a: Cue, b: Cue) -> bool:
    ov = overlap(a, b)
    if ov <= 0:
        return False
    min_len = max(1, min(a.end - a.start, b.end - b.start))
    return ov >= 120 or ov / min_len >= 0.18


def connected_groups(en: list[Cue], zh: list[Cue]) -> list[tuple[list[int], list[int]]]:
    events: list[tuple[int, int, str, int]] = []
    for i, cue in enumerate(en):
        events.append((cue.start, 0, "en", i))
        events.append((cue.end, 1, "en", i))
    for i, cue in enumerate(zh):
        events.append((cue.start, 0, "zh", i))
        events.append((cue.end, 1, "zh", i))
    events.sort()

    parent = {}

    def key(kind: str, idx: int) -> tuple[str, int]:
        k = (kind, idx)
        parent.setdefault(k, k)
        return k

    def find(x):
        parent.setdefault(x, x)
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(a, b) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    active_en: set[int] = set()
    active_zh: set[int] = set()
    for _, typ, kind, idx in events:
        key(kind, idx)
        if typ == 0:
            if kind == "en":
                for j in active_zh:
                    if has_meaningful_overlap(en[idx], zh[j]):
                        union(key("en", idx), key("zh", j))
                active_en.add(idx)
            else:
                for j in active_en:
                    if has_meaningful_overlap(en[j], zh[idx]):
                        union(key("zh", idx), key("en", j))
                active_zh.add(idx)
        elif kind == "en":
            active_en.discard(idx)
        else:
            active_zh.discard(idx)

    by_root: dict[tuple[str, int], tuple[list[int], list[int]]] = {}
    for i in range(len(en)):
        group = by_root.setdefault(find(key("en", i)), ([], []))
        group[0].append(i)
    for i in range(len(zh)):
        group = by_root.setdefault(find(key("zh", i)), ([], []))
        group[1].append(i)

    groups = list(by_root.values())
    groups.sort(key=lambda g: min([en[i].start for i in g[0]] + [zh[i].start for i in g[1]]))
    return groups


def ass_time(ms: int) -> str:
    cs = round(ms / 10)
    h = cs // 360000
    cs %= 360000
    m = cs // 6000
    cs %= 6000
    s = cs // 100
    cs %= 100
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ass_header(title: str) -> str:
    return f"""[Script Info]
Title: {title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,90,90,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def build_ass(en_path: Path, zh_path: Path, out_path: Path) -> tuple[int, int, int]:
    en = parse_srt(en_path)
    zh = parse_srt(zh_path)
    lines = [ass_header(en_path.stem.replace(".en-STRIPPED_SDH", ""))]
    used_en: set[int] = set()
    used_zh: set[int] = set()
    dialogue_count = 0

    for en_idxs, zh_idxs in connected_groups(en, zh):
        egroup = sorted(en_idxs)
        zgroup = sorted(zh_idxs)
        used_en.update(egroup)
        used_zh.update(zgroup)
        if egroup:
            start = min(en[i].start for i in egroup)
            end = max(en[i].end for i in egroup)
        else:
            start = min(zh[i].start for i in zgroup)
            end = max(zh[i].end for i in zgroup)

        zh_text = " ".join(zh[i].text for i in zgroup if zh[i].text).strip()
        en_text = " ".join(en[i].text for i in egroup if en[i].text).strip()
        if not zh_text and not en_text:
            continue
        if zh_text and en_text:
            text = f"{zh_text} \\N {en_text}"
        elif zh_text:
            text = zh_text
        else:
            text = en_text
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{text}\n")
        dialogue_count += 1

    out_path.write_text("".join(lines), encoding="utf-8-sig")
    return dialogue_count, len(used_en), len(used_zh)


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    zh_files = sorted(ROOT.glob("*.zh-Hans.srt"))
    for zh_path in zh_files:
        en_path = Path(str(zh_path).replace(".zh-Hans.srt", ".en-STRIPPED_SDH.srt"))
        if not en_path.exists():
            raise FileNotFoundError(en_path)
        out_name = zh_path.name.replace(".zh-Hans.srt", ".bilingual.zh-Hans-en.ass")
        count, used_en, used_zh = build_ass(en_path, zh_path, OUT_DIR / out_name)
        print(f"{out_name}: {count} dialogues, en used {used_en}, zh used {used_zh}")


if __name__ == "__main__":
    main()
