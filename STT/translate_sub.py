#!/usr/bin/env python3
"""
纯翻译脚本：读取 ASS/SRT 字幕文件，日语→中文翻译，边翻译边写入
复用 transcribe.py 的翻译后端（Gemini / Google Translate / Ollama 等）
"""

import sys
import argparse
from pathlib import Path

# 复用 transcribe.py 的配置和翻译函数
sys.path.insert(0, str(Path(__file__).parent))
from transcribe import translate_segments, TRANSLATION_API


# ============================================================
# 解析
# ============================================================

def parse_ass(lines: list[str]) -> tuple[list[str], list[dict]]:
    """
    解析 ASS 文件
    返回: (header_lines, entries)
    entries: [{'line_idx': int, 'prefix': str, 'text': str}]
    """
    header = []
    entries = []
    in_events = False

    for i, line in enumerate(lines):
        if not in_events:
            header.append(line)
            if line.strip() == "[Events]":
                in_events = True
            continue

        # 事件区的 Format 行
        if line.strip().startswith("Format:"):
            header.append(line)
            continue

        # Dialogue 行
        if line.strip().startswith("Dialogue:"):
            stripped = line.rstrip("\n\r")
            # 按前 9 个逗号分割，第 9 个之后是文本
            parts = stripped.split(",", 9)
            if len(parts) >= 10:
                prefix = ",".join(parts[:9]) + ","
                text = parts[9]
                entries.append({"line_idx": i, "prefix": prefix, "text": text})
            else:
                header.append(line)
        else:
            header.append(line)

    return header, entries


def parse_srt(lines: list[str]) -> tuple[list[str], list[dict]]:
    """
    解析 SRT 文件
    返回: (header_lines, entries)
    entries: [{'line_idx': int, 'prefix': str, 'text': str}]
    header_lines 在 SRT 中始终为空（SRT 没有头部）
    """
    entries = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # 跳过空行
        if not line:
            i += 1
            continue
        # 序号行
        if line.isdigit():
            seq = line
            i += 1
            if i >= len(lines):
                break
            timestamp = lines[i].strip()
            i += 1
            # 收集文本行（可能多行）
            text_lines = []
            while i < len(lines) and lines[i].strip():
                text_lines.append(lines[i].strip())
                i += 1
            text = "\n".join(text_lines)
            entries.append({
                "line_idx": i - len(text_lines),
                "is_srt": True,
                "seq": seq,
                "timestamp": timestamp,
                "text": text,
                "text_lines": text_lines,
            })
        else:
            i += 1

    return [], entries


# ============================================================
# 增量写入
# ============================================================

BATCH_SIZE = 20  # 每批翻译条数，写完一批再翻下一批


def translate_ass_file(input_path: Path, output_path: Path, start_line: int = 0):
    """翻译 ASS 字幕，边翻译边写入"""
    print(f"📖 读取: {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    header, entries = parse_ass(raw_lines)
    total = len(entries)

    if start_line >= total:
        print(f"❌ 起始行 {start_line} 超出范围 (共 {total} 条对话)")
        return

    to_translate = entries[start_line:]
    print(f"📝 共 {total} 条对话，从第 {start_line + 1} 条开始翻译 (共 {len(to_translate)} 条)")
    print(f"🔧 翻译后端: {TRANSLATION_API}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        # 写入头部（非对话行）
        f.writelines(header)
        f.flush()

        # 写入 start_line 之前的条目（原样保留）
        for entry in entries[:start_line]:
            f.write(raw_lines[entry["line_idx"]])
        f.flush()

        # 分批次翻译并实时写入
        for batch_start in range(0, len(to_translate), BATCH_SIZE):
            batch = to_translate[batch_start:batch_start + BATCH_SIZE]
            texts = [e["text"] for e in batch]
            translations = translate_segments(texts)

            for entry, translated in zip(batch, translations):
                f.write(entry["prefix"] + translated + "\n")
            f.flush()

            done = min(batch_start + BATCH_SIZE, len(to_translate))
            print(f"  💾 已写入 {done}/{len(to_translate)} 条")

    print(f"✅ 已保存: {output_path}\n")


def translate_srt_file(input_path: Path, output_path: Path, start_line: int = 0):
    """翻译 SRT 字幕，边翻译边写入"""
    print(f"📖 读取: {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    _, entries = parse_srt(raw_lines)
    total = len(entries)

    if start_line >= total:
        print(f"❌ 起始行 {start_line} 超出范围 (共 {total} 条对话)")
        return

    to_translate = entries[start_line:]
    print(f"📝 共 {total} 条字幕，从第 {start_line + 1} 条开始翻译 (共 {len(to_translate)} 条)")
    print(f"🔧 翻译后端: {TRANSLATION_API}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        # 写入 start_line 之前的条目（原样）
        for entry in entries[:start_line]:
            f.write(f"{entry['seq']}\n")
            f.write(f"{entry['timestamp']}\n")
            for tl in entry["text_lines"]:
                f.write(f"{tl}\n")
            f.write("\n")
        f.flush()

        # 分批次翻译并实时写入
        for batch_start in range(0, len(to_translate), BATCH_SIZE):
            batch = to_translate[batch_start:batch_start + BATCH_SIZE]
            texts = [e["text"] for e in batch]
            translations = translate_segments(texts)

            for entry, translated in zip(batch, translations):
                f.write(f"{entry['seq']}\n")
                f.write(f"{entry['timestamp']}\n")
                translated_lines = translated.split("\n")
                text_lines = entry["text_lines"]
                for j in range(len(text_lines)):
                    if j < len(translated_lines):
                        f.write(f"{translated_lines[j]}\n")
                    else:
                        f.write("\n")
                f.write("\n")
            f.flush()

            done = min(batch_start + BATCH_SIZE, len(to_translate))
            print(f"  💾 已写入 {done}/{len(to_translate)} 条")

    print(f"✅ 已保存: {output_path}\n")


# ============================================================
# 主流程
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="纯翻译：ASS/SRT 字幕日语→中文")
    parser.add_argument("input", type=str, help="输入字幕文件 (.ass 或 .srt)")
    parser.add_argument("-o", "--output", type=str, default=None,
                        help="输出文件路径（默认: 输入文件名_translated.扩展名）")
    parser.add_argument("-s", "--start", type=int, default=0,
                        help="从第几条对话开始翻译（从 0 开始计数，用于断点续传）")
    parser.add_argument("--format", type=str, choices=["ass", "srt", "auto"], default="auto",
                        help="输入格式（默认自动检测）")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ 文件不存在: {input_path}")
        sys.exit(1)

    # 自动检测格式
    fmt = args.format
    if fmt == "auto":
        suffix = input_path.suffix.lower()
        if suffix == ".ass":
            fmt = "ass"
        elif suffix == ".srt":
            fmt = "srt"
        else:
            print(f"❌ 无法自动检测格式，请用 --format 指定")
            sys.exit(1)

    # 默认输出路径
    output_path = Path(args.output) if args.output else \
        input_path.parent / f"{input_path.stem}_translated{input_path.suffix}"

    if fmt == "ass":
        translate_ass_file(input_path, output_path, args.start)
    elif fmt == "srt":
        translate_srt_file(input_path, output_path, args.start)


if __name__ == "__main__":
    main()