#!/usr/bin/env python3
"""
日语歌曲 → 双语 ASS 字幕生成器
流程: MP3 → faster-whisper 日语识别 → 翻译 API 翻中文 → 生成 ASS
"""

import os
import sys
import json
import argparse
import re
import time
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env
load_dotenv(Path(__file__).parent / ".env")


# ============================================================
# 配置
# ============================================================

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")

# 本地模型路径（优先使用，避免从 HuggingFace 下载）
_LOCAL_MODEL_DIR = Path(__file__).parent / "models"
_LOCAL_MODEL_CANDIDATES = sorted(_LOCAL_MODEL_DIR.glob("**/snapshots/*/model.bin")) if _LOCAL_MODEL_DIR.exists() else []
WHISPER_MODEL_PATH = os.getenv("WHISPER_MODEL_PATH",
    str(_LOCAL_MODEL_CANDIDATES[0].parent) if _LOCAL_MODEL_CANDIDATES else "")

TRANSLATION_API = os.getenv("TRANSLATION_API", "gemini")

# Google Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Google Translate
GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")

# Ollama 本地翻译
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# DeepL
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY", "")

# 输出目录
OUTPUT_DIR = Path(__file__).parent / "output"


# ============================================================
# ASS 字幕模板
# ============================================================

ASS_HEADER = """[Script Info]
Title: Japanese Song Lyrics
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: JP,Microsoft YaHei,36,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,60,1
Style: CN,Microsoft YaHei,28,&H0000FFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,25,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ASS_HEADER_CN = """[Script Info]
Title: Chinese Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CN,Microsoft YaHei,36,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


# ============================================================
# 工具函数
# ============================================================

def seconds_to_ass_time(seconds: float) -> str:
    """将秒数转换为 ASS 时间格式 H:MM:SS.cc"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centiseconds = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def format_segment_text(text: str, max_chars_per_line: int = 30) -> str:
    """拆分长文本为多行（ASS 用 \\N 换行）"""
    text = text.strip()
    if len(text) <= max_chars_per_line:
        return text
    # 在中间位置找合适的断点
    mid = len(text) // 2
    # 尝试在标点或空格处断开
    for i in range(mid, max(0, mid - 10), -1):
        if text[i] in "、。，！？\u3000  ":
            return text[:i+1] + "\\N" + text[i+1:].lstrip()
    return text[:mid] + "\\N" + text[mid:]


# ============================================================
# 翻译模块
# ============================================================

def _ollama_translate_batch(batch: list[str]) -> list[str]:
    """用 Ollama 翻译单个批次（Gemini 失败时的降级方案）"""
    import requests

    if not any(t.strip() for t in batch):
        return [""] * len(batch)

    numbered = "\n".join(
        f"{i+1}. {t}" for i, t in enumerate(batch) if t.strip()
    )

    prompt = f"""将以下日语对话逐行翻译成中文，保持语气和语境。

规则：
- 一行原文对应一行翻译，顺序不变
- 只输出中文译文，不要编号、不要解释
- 空行保留为空

{numbered}"""

    try:
        resp = requests.post(
            f"{OLLAMA_HOST}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": "你是日语翻译专家，逐行翻译日语为流畅中文，只输出译文，不输出任何额外内容。"},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "options": {"temperature": 0.1},
            },
            timeout=120,
        )
        resp.raise_for_status()
        result = resp.json()["message"]["content"].strip()
        lines = [line.strip() for line in result.split("\n") if line.strip()]
        lines = [re.sub(r"^\d+[\.\、\)）]\s*", "", line) for line in lines]

        final_batch = []
        line_idx = 0
        for t in batch:
            if t.strip():
                final_batch.append(lines[line_idx] if line_idx < len(lines) else t)
                line_idx += 1
            else:
                final_batch.append("")

        if len(final_batch) == len(batch):
            return final_batch
        print(f"  ⚠ Ollama 降级行数不匹配，保留原文")
    except Exception as e:
        print(f"  ⚠ Ollama 降级错误: {e}")

    return batch  # 失败返回原文


def translate_with_gemini(segments: list[str]) -> list[str]:
    """使用 Google Gemini API 批量翻译（免费额度，带限速，失败降级到 Ollama）"""
    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)

    BATCH_SIZE = 10
    DELAY_BETWEEN_BATCHES = 5

    all_results = []
    total_batches = (len(segments) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_start in range(0, len(segments), BATCH_SIZE):
        batch = segments[batch_start:batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        if not any(t.strip() for t in batch):
            all_results.extend([""] * len(batch))
            continue

        numbered = "\n".join(
            f"{i+1}. {t}" for i, t in enumerate(batch) if t.strip()
        )

        prompt = f"""将以下日语对话逐行翻译成中文，保持语气和语境。

规则：
- 一行原文对应一行翻译，顺序不变
- 只输出中文译文，不要编号、不要解释
- 空行保留为空

{numbered}"""

        success = False
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=[
                        {"role": "user", "parts": [{"text": prompt}]}
                    ],
                    config={
                        "system_instruction": "你是日语翻译专家，逐行翻译日语为流畅中文，只输出译文，不输出任何额外内容。",
                        "temperature": 0.1,
                    },
                )
                result = response.text.strip()
                lines = [line.strip() for line in result.split("\n") if line.strip()]
                lines = [re.sub(r"^\d+[\.\、\)）]\s*", "", line) for line in lines]

                final_batch = []
                line_idx = 0
                for t in batch:
                    if t.strip():
                        final_batch.append(lines[line_idx] if line_idx < len(lines) else t)
                        line_idx += 1
                    else:
                        final_batch.append("")

                if len(final_batch) == len(batch):
                    all_results.extend(final_batch)
                    print(f"  ✅ 批次 {batch_num}/{total_batches} Gemini 完成")
                    success = True
                    break
                print(f"  ⚠ 翻译行数不匹配 (期望 {len(batch)}，得到 {len(final_batch)})，重试...")
            except Exception as e:
                err_msg = str(e)
                if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                    wait = 30
                    m = re.search(r"retryDelay['\"]:\s*['\"](\d+)s", err_msg)
                    if m:
                        wait = int(m.group(1)) + 2
                    print(f"  ⏳ Gemini 限速，等待 {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"  ⚠ Gemini 错误: {e}，重试...")
                    time.sleep(3)

        if not success:
            print(f"  🔄 批次 {batch_num}/{total_batches} Gemini 失败，降级到 Ollama...")
            fallback = _ollama_translate_batch(batch)
            all_results.extend(fallback)
            print(f"  ✅ 批次 {batch_num}/{total_batches} Ollama 降级完成")

        # 批次间延迟，避免触发限速
        if batch_start + BATCH_SIZE < len(segments):
            time.sleep(DELAY_BETWEEN_BATCHES)

    return all_results


def translate_with_ollama(segments: list[str]) -> list[str]:
    """使用 Ollama 本地模型逐批翻译"""
    import requests

    BATCH_SIZE = 20  # 每批最多 20 行，避免小模型上下文不够

    all_results = []

    for batch_start in range(0, len(segments), BATCH_SIZE):
        batch = segments[batch_start:batch_start + BATCH_SIZE]
        if not any(t.strip() for t in batch):
            all_results.extend([""] * len(batch))
            continue

        numbered = "\n".join(
            f"{i+1}. {t}" for i, t in enumerate(batch) if t.strip()
        )

        prompt = f"""将以下日语对话逐行翻译成中文，保持语气和语境。

规则：
- 一行原文对应一行翻译，顺序不变
- 只输出中文译文，不要编号、不要解释
- 空行保留为空

{numbered}"""

        for attempt in range(3):
            try:
                resp = requests.post(
                    f"{OLLAMA_HOST}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": [
                            {"role": "system", "content": "你是日语歌词翻译专家，逐行翻译日语歌词为流畅中文，只输出译文，不输出任何额外内容。"},
                            {"role": "user", "content": prompt},
                        ],
                        "stream": False,
                        "options": {"temperature": 0.1},
                    },
                    timeout=120,
                )
                resp.raise_for_status()
                result = resp.json()["message"]["content"].strip()
                lines = [line.strip() for line in result.split("\n") if line.strip()]
                # 去除可能的编号前缀
                lines = [re.sub(r"^\d+[\.\、\)）]\s*", "", line) for line in lines]

                # 补充空行
                final_batch = []
                line_idx = 0
                for t in batch:
                    if t.strip():
                        final_batch.append(lines[line_idx] if line_idx < len(lines) else t)
                        line_idx += 1
                    else:
                        final_batch.append("")

                if len(final_batch) == len(batch):
                    all_results.extend(final_batch)
                    break
                print(f"  ⚠ 翻译行数不匹配 (期望 {len(batch)}，得到 {len(final_batch)})，重试...")
            except Exception as e:
                print(f"  ⚠ Ollama 翻译错误: {e}，重试...")
                time.sleep(2)
        else:
            # 3 次重试都失败，保留原文
            print(f"  ⚠ 批次 {batch_start} 翻译失败，保留原文")
            all_results.extend(batch)

    return all_results


def translate_with_openai(segments: list[str]) -> list[str]:
    """使用 OpenAI 兼容 API 批量翻译"""
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)

    # 构建带编号的文本
    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(segments))

    prompt = f"""将以下日语歌词逐行翻译成中文。保持歌词的韵律和意境，翻译要自然流畅。

要求：
- 严格按顺序返回，每行一个翻译
- 不要添加编号、解释或任何额外内容
- 只返回中文翻译，每行对应一行原文

{numbered}"""

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "你是一个专业的日语歌词翻译助手，擅长将日语歌词翻译成优美流畅的中文。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=4096,
            )
            result = response.choices[0].message.content.strip()
            lines = [line.strip() for line in result.split("\n") if line.strip()]
            # 去除可能的编号前缀
            lines = [re.sub(r"^\d+[\.\、\)）]\s*", "", line) for line in lines]
            if len(lines) == len(segments):
                return lines
            print(f"  ⚠ 翻译行数不匹配 (期望 {len(segments)}，得到 {len(lines)})，重试...")
        except Exception as e:
            print(f"  ⚠ 翻译 API 错误: {e}，重试...")
            time.sleep(2)

    raise RuntimeError("翻译失败，已重试 3 次")


def translate_with_deepl(segments: list[str]) -> list[str]:
    """使用 DeepL API 批量翻译"""
    import requests

    url = "https://api-free.deepl.com/v2/translate"
    results = []

    for text in segments:
        if not text.strip():
            results.append("")
            continue
        for attempt in range(3):
            try:
                resp = requests.post(
                    url,
                    data={
                        "auth_key": DEEPL_API_KEY,
                        "text": text,
                        "source_lang": "JA",
                        "target_lang": "ZH",
                    },
                    timeout=30,
                )
                resp.raise_for_status()
                results.append(resp.json()["translations"][0]["text"])
                break
            except Exception as e:
                print(f"  ⚠ DeepL 翻译错误: {e}，重试...")
                time.sleep(2)
        else:
            raise RuntimeError(f"DeepL 翻译失败: {text[:30]}...")

    return results


def translate_with_google_translate(segments: list[str]) -> list[str]:
    """使用 Google Cloud Translation API v2 翻译（每月 50 万字符免费）"""
    import requests

    url = "https://translation.googleapis.com/language/translate/v2"
    results = []

    for i, text in enumerate(segments):
        if not text.strip():
            results.append("")
            continue
        for attempt in range(3):
            try:
                resp = requests.post(
                    url,
                    params={"key": GOOGLE_TRANSLATE_API_KEY},
                    data={
                        "q": text,
                        "source": "ja",
                        "target": "zh-CN",
                        "format": "text",
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()
                translated = data["data"]["translations"][0]["translatedText"]
                results.append(translated)
                break
            except Exception as e:
                print(f"  ⚠ Google Translate 错误: {e}，重试...")
                time.sleep(2)
        else:
            raise RuntimeError(f"Google Translate 翻译失败: {text[:30]}...")

        if (i + 1) % 50 == 0:
            print(f"  ✅ 已翻译 {i + 1}/{len(segments)}")

    return results


def translate_segments(segments: list[str]) -> list[str]:
    """根据配置选择翻译方式"""
    if not segments:
        return []

    print(f"\n📝 翻译 {len(segments)} 个片段...")
    if TRANSLATION_API == "gemini":
        if not GEMINI_API_KEY:
            raise RuntimeError("请设置 GEMINI_API_KEY 环境变量")
        return translate_with_gemini(segments)
    elif TRANSLATION_API == "google_translate":
        if not GOOGLE_TRANSLATE_API_KEY:
            raise RuntimeError("请设置 GOOGLE_TRANSLATE_API_KEY 环境变量")
        return translate_with_google_translate(segments)
    elif TRANSLATION_API == "ollama":
        return translate_with_ollama(segments)
    elif TRANSLATION_API == "deepl":
        if not DEEPL_API_KEY:
            raise RuntimeError("请设置 DEEPL_API_KEY 环境变量")
        return translate_with_deepl(segments)
    elif TRANSLATION_API == "openai":
        if not OPENAI_API_KEY:
            raise RuntimeError("请设置 OPENAI_API_KEY 环境变量")
        return translate_with_openai(segments)
    else:
        raise RuntimeError(f"不支持的翻译 API: {TRANSLATION_API}")


# ============================================================
# Whisper 识别模块
# ============================================================

def transcribe_audio(audio_path: Path) -> list[dict]:
    """使用 faster-whisper 识别日语音频"""
    from faster_whisper import WhisperModel

    # 优先使用本地模型路径
    model_id = WHISPER_MODEL_PATH if WHISPER_MODEL_PATH else WHISPER_MODEL
    print(f"\n🎤 加载 Whisper 模型 ({model_id})...")
    model = WhisperModel(model_id, device=WHISPER_DEVICE, compute_type="int8")

    print(f"🔊 识别中: {audio_path.name}")
    segments, info = model.transcribe(
        str(audio_path),
        language="ja",
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
        ),
    )

    print(f"  检测到语言: {info.language} (概率: {info.language_probability:.2%})")

    results = []
    for seg in segments:
        results.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
        })

    print(f"  识别完成: {len(results)} 个片段")
    return results


# ============================================================
# ASS 生成模块
# ============================================================

def generate_ass(
    segments: list[dict],
    translations: list[str],
    output_path: Path,
):
    """生成双语 ASS 和纯中文 ASS 字幕文件"""
    cn_path = output_path.with_suffix(".cn.ass")

    with open(output_path, "w", encoding="utf-8") as f, \
         open(cn_path, "w", encoding="utf-8") as f_cn:

        f.write(ASS_HEADER)
        f_cn.write(ASS_HEADER_CN)

        for seg, cn_text in zip(segments, translations):
            start = seconds_to_ass_time(seg["start"])
            end = seconds_to_ass_time(seg["end"])
            jp_text = format_segment_text(seg["text"])

            # 双语：日文 + 中文
            f.write(f"Dialogue: 0,{start},{end},JP,,0,0,0,,{jp_text}\n")
            if cn_text:
                cn_formatted = format_segment_text(cn_text, max_chars_per_line=25)
                f.write(f"Dialogue: 0,{start},{end},CN,,0,0,0,,{cn_formatted}\n")

            # 纯中文
            if cn_text:
                cn_formatted = format_segment_text(cn_text, max_chars_per_line=30)
                f_cn.write(f"Dialogue: 0,{start},{end},CN,,0,0,0,,{cn_formatted}\n")

    print(f"\n✅ 双语字幕: {output_path}")
    print(f"✅ 纯中文字幕: {cn_path}")


# ============================================================
# 主流程
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="日语歌曲 → 双语 ASS 字幕生成器")
    parser.add_argument("input", type=str, nargs="?", default=None,
                        help="输入 MP3 文件路径（默认: source/ 下所有 mp3）")
    parser.add_argument("-o", "--output", type=str, default=None,
                        help="输出目录（默认: output/）")
    parser.add_argument("--skip-transcribe", action="store_true",
                        help="跳过识别，使用已有的识别结果 JSON")
    parser.add_argument("--skip-translate", action="store_true",
                        help="跳过翻译，使用已有的翻译结果")
    args = parser.parse_args()

    # 创建输出目录
    output_dir = Path(args.output) if args.output else OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    # 收集输入文件
    if args.input:
        input_files = [Path(args.input)]
    else:
        source_dir = Path(__file__).parent / "source"
        input_files = sorted(source_dir.glob("*.mp3")) + sorted(source_dir.glob("*.wav"))

    if not input_files:
        print("❌ 未找到音频文件，请将 MP3 放入 source/ 目录或指定文件路径")
        sys.exit(1)

    for audio_path in input_files:
        if not audio_path.exists():
            print(f"❌ 文件不存在: {audio_path}")
            continue

        base_name = audio_path.stem
        json_path = output_dir / f"{base_name}_segments.json"
        trans_json_path = output_dir / f"{base_name}_translated.json"
        ass_path = output_dir / f"{base_name}.ass"

        print(f"\n{'='*60}")
        print(f"🎵 处理: {audio_path.name}")
        print(f"{'='*60}")

        # Step 1: Whisper 识别
        if args.skip_transcribe and json_path.exists():
            print("  ⏭ 跳过识别，加载已有结果...")
            with open(json_path, "r", encoding="utf-8") as f:
                segments = json.load(f)
        else:
            segments = transcribe_audio(audio_path)
            # 保存识别结果
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(segments, f, ensure_ascii=False, indent=2)
            print(f"  💾 识别结果已保存: {json_path}")

        # 提取文本列表
        texts = [s["text"] for s in segments]

        # Step 2: 翻译
        if args.skip_translate and trans_json_path.exists():
            print("  ⏭ 跳过翻译，加载已有结果...")
            with open(trans_json_path, "r", encoding="utf-8") as f:
                translations = json.load(f)
        else:
            translations = translate_segments(texts)
            with open(trans_json_path, "w", encoding="utf-8") as f:
                json.dump(translations, f, ensure_ascii=False, indent=2)
            print(f"  💾 翻译结果已保存: {trans_json_path}")

        # Step 3: 生成 ASS
        generate_ass(segments, translations, ass_path)

        # 打印预览
        print(f"\n📋 预览 (前 5 行):")
        for i, (seg, cn) in enumerate(zip(segments[:5], translations[:5])):
            ts = f"[{seconds_to_ass_time(seg['start'])}]"
            print(f"  {ts} {seg['text']}")
            print(f"  {' ' * len(ts)} {cn}")

    print(f"\n🎉 全部完成! 输出目录: {output_dir}")


if __name__ == "__main__":
    main()