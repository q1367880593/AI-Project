from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


PHONE_RE = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")

LEAD_ATTEMPT_KEYWORDS = (
    "电话",
    "手机号",
    "联系方式",
    "联系到您",
    "方便联系",
    "留个电话",
    "留一下电话",
    "留个联系方式",
    "发给我",
    "加微信",
    "微信",
    "授权手机号",
)

VISIT_KEYWORDS = (
    "看房",
    "能看",
    "约看",
    "什么时候看",
    "几点看",
    "周末",
    "今天",
    "明天",
    "有时间",
    "方便看",
)

CONCERN_KEYWORDS = (
    "中介费",
    "押金",
    "押一付",
    "付款",
    "贷款",
    "税费",
    "首付",
    "真假",
    "真实",
    "假房源",
    "业主",
    "能便宜",
    "太贵",
)

CHURN_KEYWORDS = (
    "算了",
    "不用了",
    "不需要",
    "再看看",
    "太贵了",
    "不考虑",
    "不要租",
    "不租",
)

PROPERTY_CARD_PREFIX = "[房源]"
REPORT_KEYWORDS = ("房屋价值报告", "户型报告", "点击查看户型报告", "授权手机号即可免费查看")
LEAD_CARD_KEYWORDS = ("授权手机号", "联系方式发给我", "联系到您")


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    return None


def load_conversations(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    stripped = text.strip()
    if not stripped:
        return []

    try:
        data = json.loads(stripped)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            return [data]
    except json.JSONDecodeError:
        pass

    # Supports JSONL and files containing multiple JSON objects separated by whitespace.
    decoder = json.JSONDecoder()
    idx = 0
    items: list[dict[str, Any]] = []
    while idx < len(text):
        while idx < len(text) and text[idx].isspace():
            idx += 1
        if idx >= len(text):
            break
        obj, end = decoder.raw_decode(text, idx)
        if isinstance(obj, dict):
            items.append(obj)
        idx = end
    return items


def contains_any(text: str, keywords: Iterable[str]) -> bool:
    return any(k in text for k in keywords)


def mask_phone(text: str) -> tuple[str, bool]:
    found = bool(PHONE_RE.search(text or ""))
    return PHONE_RE.sub("[PHONE]", text or ""), found


def bucket_rounds(count: int | None) -> str:
    if count is None:
        return "none"
    if count <= 2:
        return "1-2"
    if count <= 5:
        return "3-5"
    if count <= 10:
        return "6-10"
    if count <= 20:
        return "11-20"
    if count <= 30:
        return "21-30"
    return "30+"


def normalize_messages(raw_messages: list[dict[str, Any]], user_id: str, broker_id: str) -> list[dict[str, Any]]:
    messages = []
    user_turn = 0
    for idx, raw in enumerate(sorted(raw_messages, key=lambda m: m.get("createtime") or ""), start=1):
        sender_id = str(raw.get("from") or "")
        if sender_id == str(user_id):
            sender = "user"
            user_turn += 1
            turn_index = user_turn
        elif sender_id == str(broker_id):
            sender = "agent"
            turn_index = user_turn if user_turn > 0 else 1
        else:
            sender = "system"
            turn_index = user_turn if user_turn > 0 else 1

        raw_content = str(raw.get("payload") or "")
        content, has_phone = mask_phone(raw_content)
        message_type = infer_message_type(raw_content)
        messages.append(
            {
                "message_id": raw.get("message_id") or f"m_{idx:04d}",
                "message_index": idx,
                "turn_index": turn_index,
                "sender": sender,
                "sender_id": sender_id,
                "message_type": message_type,
                "content": content,
                "send_time": raw.get("createtime"),
                "contains_phone": has_phone,
                "is_system_message": sender == "system",
                "is_auto_reply": bool(raw.get("is_auto_reply", False)),
            }
        )
    return messages


def infer_message_type(content: str) -> str:
    if content.startswith(PROPERTY_CARD_PREFIX):
        return "property_card"
    if contains_any(content, REPORT_KEYWORDS):
        return "report_card"
    if content in ("[-]", "[图片]", "[表情]"):
        return "other"
    return "text"


def first_time(messages: list[dict[str, Any]], sender: str | None = None) -> datetime | None:
    for msg in messages:
        if sender is None or msg["sender"] == sender:
            t = parse_time(msg.get("send_time"))
            if t:
                return t
    return None


def last_time(messages: list[dict[str, Any]]) -> datetime | None:
    for msg in reversed(messages):
        t = parse_time(msg.get("send_time"))
        if t:
            return t
    return None


def seconds_between(a: datetime | None, b: datetime | None) -> int | None:
    if not a or not b:
        return None
    return max(0, int((b - a).total_seconds()))


def find_first_lead_attempt(messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    for msg in messages:
        if msg["sender"] != "agent":
            continue
        content = msg.get("content") or ""
        if contains_any(content, LEAD_ATTEMPT_KEYWORDS):
            return msg
    return None


def find_first_user_phone(messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    for msg in messages:
        if msg["sender"] == "user" and msg.get("contains_phone"):
            return msg
    return None


def keyword_hits(messages: list[dict[str, Any]], sender: str, keywords: Iterable[str]) -> list[dict[str, Any]]:
    hits = []
    for msg in messages:
        if msg["sender"] == sender and contains_any(msg.get("content") or "", keywords):
            hits.append(
                {
                    "message_index": msg["message_index"],
                    "turn_index": msg["turn_index"],
                    "content": msg["content"],
                }
            )
    return hits


def extract_key_messages(messages: list[dict[str, Any]], lead_attempt: dict[str, Any] | None, lead_msg: dict[str, Any] | None) -> list[dict[str, Any]]:
    selected_indexes: set[int] = set()

    # Opening context.
    selected_indexes.update(m["message_index"] for m in messages[:6])

    # Around first lead attempt.
    for anchor in (lead_attempt, lead_msg):
        if not anchor:
            continue
        idx = anchor["message_index"]
        selected_indexes.update(range(max(1, idx - 3), idx + 4))

    # Keyword messages.
    all_keywords = LEAD_ATTEMPT_KEYWORDS + VISIT_KEYWORDS + CONCERN_KEYWORDS + CHURN_KEYWORDS
    for msg in messages:
        if contains_any(msg.get("content") or "", all_keywords):
            idx = msg["message_index"]
            selected_indexes.update(range(max(1, idx - 1), idx + 2))

    # Closing context.
    selected_indexes.update(m["message_index"] for m in messages[-4:])

    result = []
    for msg in messages:
        if msg["message_index"] in selected_indexes:
            result.append(
                {
                    "message_index": msg["message_index"],
                    "turn_index": msg["turn_index"],
                    "sender": msg["sender"],
                    "message_type": msg["message_type"],
                    "content": msg["content"],
                    "send_time": msg["send_time"],
                }
            )
    return result[:30]


def infer_lead_reason_type(text: str) -> str:
    if contains_any(text, ("看房", "约", "时间")):
        return "visit_arrangement"
    if contains_any(text, ("房子还在", "确认", "跟您说")):
        return "confirm_property"
    if contains_any(text, ("找房", "推荐", "帮您找")):
        return "help_find_house"
    if contains_any(text, ("报告", "授权手机号")):
        return "send_report"
    if contains_any(text, ("联系", "电话", "联系方式")):
        return "follow_up_contact"
    if "微信" in text:
        return "wechat_contact"
    return "no_clear_reason"


def preprocess_one(raw: dict[str, Any], fallback_id: int) -> dict[str, Any]:
    user_id = str(raw.get("user_id") or "")
    broker_id = str(raw.get("broker_id") or raw.get("agent_id") or "")
    raw_messages = raw.get("messages") or []
    messages = normalize_messages(raw_messages, user_id, broker_id)

    conversation_id = raw.get("conversation_id")
    if not conversation_id:
        start = messages[0]["send_time"].replace(" ", "_").replace(":", "") if messages else f"idx_{fallback_id}"
        conversation_id = f"{user_id}_{broker_id}_{start}"

    lead_result = raw.get("lead_result") or {}
    lead_msg = find_first_user_phone(messages)
    first_lead_attempt = find_first_lead_attempt(messages)

    user_messages = [m for m in messages if m["sender"] == "user"]
    agent_messages = [m for m in messages if m["sender"] == "agent"]
    start_time = first_time(messages)
    end_time = last_time(messages)
    first_agent_time = first_time(messages, "agent")
    first_user_time = first_time(messages, "user")
    duration_seconds = seconds_between(start_time, end_time)

    conversation_round_count = len(user_messages)
    lead_turn_index = lead_msg["turn_index"] if lead_msg else lead_result.get("lead_turn_index")
    lead_message_index = lead_msg["message_index"] if lead_msg else lead_result.get("lead_message_index")
    first_lead_attempt_turn = first_lead_attempt["turn_index"] if first_lead_attempt else None
    first_lead_attempt_index = first_lead_attempt["message_index"] if first_lead_attempt else None

    has_phone_left = bool(lead_result.get("is_phone_left")) or bool(lead_msg)
    has_visit_signal = bool(keyword_hits(messages, "user", VISIT_KEYWORDS))
    has_concern_signal = bool(keyword_hits(messages, "user", CONCERN_KEYWORDS))
    has_churn_signal = bool(keyword_hits(messages, "user", CHURN_KEYWORDS))

    all_text = "\n".join(m["content"] for m in messages)
    has_property_card = any(m["message_type"] == "property_card" for m in messages)
    has_report_card = any(m["message_type"] == "report_card" for m in messages)
    has_lead_card = contains_any(all_text, LEAD_CARD_KEYWORDS)
    has_visit_card = contains_any(all_text, ("约看卡", "预约看房", "看房卡"))

    lead_attempt_text = first_lead_attempt["content"] if first_lead_attempt else ""
    turns_from_attempt_to_lead = None
    if first_lead_attempt_turn is not None and lead_turn_index is not None:
        turns_from_attempt_to_lead = lead_turn_index - first_lead_attempt_turn

    feature = {
        "conversation_id": conversation_id,
        "user_id": user_id,
        "broker_id": broker_id,
        "conversation_start_time": messages[0]["send_time"] if messages else None,
        "conversation_end_time": messages[-1]["send_time"] if messages else None,
        "conversation_duration_minutes": round(duration_seconds / 60, 2) if duration_seconds is not None else None,
        "lead_result": {
            "is_phone_left": has_phone_left,
            "lead_time": lead_result.get("lead_time") or (lead_msg.get("send_time") if lead_msg else None),
            "lead_turn_index": lead_turn_index,
            "lead_message_index": lead_message_index,
            "minutes_to_lead": round(seconds_between(start_time, parse_time(lead_result.get("lead_time") or (lead_msg.get("send_time") if lead_msg else None))) / 60, 2)
            if (start_time and (lead_result.get("lead_time") or lead_msg))
            else None,
        },
        "basic_features": {
            "message_count_total": len(messages),
            "message_count_user": len(user_messages),
            "message_count_agent": len(agent_messages),
            "conversation_round_count": conversation_round_count,
            "conversation_round_bucket": bucket_rounds(conversation_round_count),
            "first_agent_response_seconds": seconds_between(first_user_time, first_agent_time),
        },
        "lead_attempt_features": {
            "has_lead_attempt": first_lead_attempt is not None,
            "first_lead_attempt_turn_index": first_lead_attempt_turn,
            "first_lead_attempt_message_index": first_lead_attempt_index,
            "first_lead_attempt_bucket": bucket_rounds(first_lead_attempt_turn),
            "first_lead_attempt_text": lead_attempt_text,
            "lead_reason_type": infer_lead_reason_type(lead_attempt_text) if first_lead_attempt else "none",
            "turns_from_attempt_to_lead": turns_from_attempt_to_lead,
            "is_repeated_lead_attempt": sum(1 for m in agent_messages if contains_any(m["content"], LEAD_ATTEMPT_KEYWORDS)) > 1,
        },
        "rule_signals": {
            "has_visit_signal": has_visit_signal,
            "visit_signal_messages": keyword_hits(messages, "user", VISIT_KEYWORDS)[:5],
            "has_concern_signal": has_concern_signal,
            "concern_signal_messages": keyword_hits(messages, "user", CONCERN_KEYWORDS)[:5],
            "has_churn_signal": has_churn_signal,
            "churn_signal_messages": keyword_hits(messages, "user", CHURN_KEYWORDS)[:5],
        },
        "tool_usage": {
            "has_property_card": has_property_card,
            "has_lead_card": has_lead_card,
            "has_report_card": has_report_card,
            "has_visit_card": has_visit_card,
        },
        "key_messages_for_llm": extract_key_messages(messages, first_lead_attempt, lead_msg),
        "messages_masked": messages,
    }
    return feature


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def rate(numerator: int, denominator: int) -> str:
    if denominator == 0:
        return "0.00%"
    return f"{numerator / denominator * 100:.2f}%"


def aggregate(features: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(features)
    lead_total = sum(1 for f in features if f["lead_result"]["is_phone_left"])

    def group_by(path: tuple[str, ...]) -> list[dict[str, Any]]:
        counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for f in features:
            value: Any = f
            for key in path:
                value = value.get(key, {}) if isinstance(value, dict) else None
            value = "none" if value is None else str(value)
            counts[value][0] += 1
            if f["lead_result"]["is_phone_left"]:
                counts[value][1] += 1
        return [
            {"bucket": k, "conversation_count": v[0], "lead_count": v[1], "lead_rate": rate(v[1], v[0])}
            for k, v in sorted(counts.items())
        ]

    return {
        "total_conversations": total,
        "lead_conversations": lead_total,
        "overall_lead_rate": rate(lead_total, total),
        "by_conversation_round_bucket": group_by(("basic_features", "conversation_round_bucket")),
        "by_first_lead_attempt_bucket": group_by(("lead_attempt_features", "first_lead_attempt_bucket")),
        "by_lead_reason_type": group_by(("lead_attempt_features", "lead_reason_type")),
        "by_has_visit_signal": group_by(("rule_signals", "has_visit_signal")),
        "by_has_concern_signal": group_by(("rule_signals", "has_concern_signal")),
        "by_has_report_card": group_by(("tool_usage", "has_report_card")),
        "by_has_property_card": group_by(("tool_usage", "has_property_card")),
    }


def write_stats_markdown(path: Path, stats: dict[str, Any]) -> None:
    lines = [
        "# 历史爱聊预处理统计摘要",
        "",
        f"- 会话总数：{stats['total_conversations']}",
        f"- 留资会话数：{stats['lead_conversations']}",
        f"- 整体留资率：{stats['overall_lead_rate']}",
        "",
    ]

    table_map = [
        ("会话总轮次分桶留资率", "by_conversation_round_bucket"),
        ("首次索要手机号轮次分桶留资率", "by_first_lead_attempt_bucket"),
        ("留资理由类型留资率", "by_lead_reason_type"),
        ("是否有看房信号留资率", "by_has_visit_signal"),
        ("是否有顾虑信号留资率", "by_has_concern_signal"),
        ("是否发送报告物料留资率", "by_has_report_card"),
        ("是否发送房源卡留资率", "by_has_property_card"),
    ]
    for title, key in table_map:
        lines.extend([f"## {title}", "", "| 分组 | 会话数 | 留资数 | 留资率 |", "| --- | ---: | ---: | ---: |"])
        for row in stats[key]:
            lines.append(f"| {row['bucket']} | {row['conversation_count']} | {row['lead_count']} | {row['lead_rate']} |")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def write_csv(path: Path, features: list[dict[str, Any]]) -> None:
    fields = [
        "conversation_id",
        "is_phone_left",
        "message_count_total",
        "message_count_user",
        "message_count_agent",
        "conversation_round_count",
        "conversation_round_bucket",
        "first_agent_response_seconds",
        "has_lead_attempt",
        "first_lead_attempt_turn_index",
        "first_lead_attempt_bucket",
        "lead_reason_type",
        "lead_turn_index",
        "minutes_to_lead",
        "has_visit_signal",
        "has_concern_signal",
        "has_churn_signal",
        "has_property_card",
        "has_lead_card",
        "has_report_card",
        "has_visit_card",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for item in features:
            writer.writerow(
                {
                    "conversation_id": item["conversation_id"],
                    "is_phone_left": item["lead_result"]["is_phone_left"],
                    "message_count_total": item["basic_features"]["message_count_total"],
                    "message_count_user": item["basic_features"]["message_count_user"],
                    "message_count_agent": item["basic_features"]["message_count_agent"],
                    "conversation_round_count": item["basic_features"]["conversation_round_count"],
                    "conversation_round_bucket": item["basic_features"]["conversation_round_bucket"],
                    "first_agent_response_seconds": item["basic_features"]["first_agent_response_seconds"],
                    "has_lead_attempt": item["lead_attempt_features"]["has_lead_attempt"],
                    "first_lead_attempt_turn_index": item["lead_attempt_features"]["first_lead_attempt_turn_index"],
                    "first_lead_attempt_bucket": item["lead_attempt_features"]["first_lead_attempt_bucket"],
                    "lead_reason_type": item["lead_attempt_features"]["lead_reason_type"],
                    "lead_turn_index": item["lead_result"]["lead_turn_index"],
                    "minutes_to_lead": item["lead_result"]["minutes_to_lead"],
                    "has_visit_signal": item["rule_signals"]["has_visit_signal"],
                    "has_concern_signal": item["rule_signals"]["has_concern_signal"],
                    "has_churn_signal": item["rule_signals"]["has_churn_signal"],
                    "has_property_card": item["tool_usage"]["has_property_card"],
                    "has_lead_card": item["tool_usage"]["has_lead_card"],
                    "has_report_card": item["tool_usage"]["has_report_card"],
                    "has_visit_card": item["tool_usage"]["has_visit_card"],
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Preprocess Ailiao conversation data for lead-window analysis.")
    parser.add_argument("--input", default="conversations/preview.json", help="Input JSON/JSONL file.")
    parser.add_argument("--output-dir", default="conversations/out", help="Output directory.")
    parser.add_argument("--include-messages", action="store_true", help="Keep full masked messages in features JSONL.")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_items = load_conversations(input_path)
    features = [preprocess_one(item, idx) for idx, item in enumerate(raw_items, start=1)]

    if not args.include_messages:
        for item in features:
            item.pop("messages_masked", None)

    write_jsonl(output_dir / "conversation_features.jsonl", features)
    write_csv(output_dir / "conversation_features.csv", features)
    stats = aggregate(features)
    (output_dir / "aggregate_stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    write_stats_markdown(output_dir / "aggregate_stats.md", stats)

    print(f"Loaded conversations: {len(raw_items)}")
    print(f"Wrote: {output_dir / 'conversation_features.jsonl'}")
    print(f"Wrote: {output_dir / 'conversation_features.csv'}")
    print(f"Wrote: {output_dir / 'aggregate_stats.md'}")


if __name__ == "__main__":
    main()
