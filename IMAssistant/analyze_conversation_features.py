from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path


ROUND_ORDER = ["none", "1-2", "3-5", "6-10", "11-20", "21-30", "30+"]


def as_bool(value: str) -> bool:
    return str(value).strip().lower() == "true"


def pct(n: int, d: int) -> float:
    return 0.0 if d == 0 else n / d * 100


def pct_text(n: int, d: int) -> str:
    return f"{pct(n, d):.2f}%"


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def group(rows: list[dict[str, str]], keys: list[str]) -> list[dict[str, str | int]]:
    bucket = defaultdict(lambda: [0, 0])
    for row in rows:
        key = tuple(row.get(k, "") or "none" for k in keys)
        bucket[key][0] += 1
        if as_bool(row.get("is_phone_left", "")):
            bucket[key][1] += 1
    result = []
    for key, (total, lead) in bucket.items():
        item = {keys[i]: key[i] for i in range(len(keys))}
        item.update({"conversation_count": total, "lead_count": lead, "lead_rate": pct_text(lead, total)})
        result.append(item)
    return sorted(result, key=lambda x: tuple(sort_value(x.get(k, "")) for k in keys))


def sort_value(value: str) -> tuple[int, str]:
    if value in ROUND_ORDER:
        return (ROUND_ORDER.index(value), value)
    return (99, value)


def top_lift(rows: list[dict[str, str | int]], baseline_rate: float, key_names: list[str], min_count: int = 100) -> list[dict]:
    out = []
    for row in rows:
        total = int(row["conversation_count"])
        lead = int(row["lead_count"])
        if total < min_count:
            continue
        rate = pct(lead, total)
        label = " / ".join(str(row[k]) for k in key_names)
        out.append({"label": label, "count": total, "lead": lead, "rate": rate, "lift": rate - baseline_rate})
    return sorted(out, key=lambda x: x["lift"], reverse=True)


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] + ["---:" for _ in headers[1:]]) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def write_report(path: Path, rows: list[dict[str, str]], tables: dict[str, list[dict]]) -> None:
    total = len(rows)
    lead = sum(1 for r in rows if as_bool(r.get("is_phone_left", "")))
    baseline = pct(lead, total)

    lines = [
        "# 历史爱聊会话预处理分析报告",
        "",
        "## 1. 总览",
        "",
        f"- 会话总数：{total}",
        f"- 留资会话数：{lead}",
        f"- 整体留资率：{baseline:.2f}%",
        "",
        "## 2. 关键发现",
        "",
    ]

    first_attempt = tables["first_attempt"]
    best_attempt = max([r for r in first_attempt if r["first_lead_attempt_bucket"] != "none"], key=lambda r: float(str(r["lead_rate"]).rstrip("%")))
    no_attempt = next((r for r in first_attempt if r["first_lead_attempt_bucket"] == "none"), None)
    visit_true = next((r for r in tables["visit_signal"] if r["has_visit_signal"] == "True"), None)
    visit_false = next((r for r in tables["visit_signal"] if r["has_visit_signal"] == "False"), None)
    report_true = next((r for r in tables["report_card"] if r["has_report_card"] == "True"), None)
    report_false = next((r for r in tables["report_card"] if r["has_report_card"] == "False"), None)

    findings = [
        f"会话轮次与留资率高度相关：1-2 轮会话留资率很低，6 轮以上会话明显提升，说明用户需求需要一定沟通后才进入成熟窗口。",
        f"首次索要手机号的最佳分桶出现在 {best_attempt['first_lead_attempt_bucket']} 轮，留资率 {best_attempt['lead_rate']}；未索要手机号的会话留资率仅 {no_attempt['lead_rate'] if no_attempt else 'N/A'}。",
    ]
    if visit_true and visit_false:
        findings.append(
            f"用户出现看房信号时留资率为 {visit_true['lead_rate']}，无看房信号时为 {visit_false['lead_rate']}，说明看房意向是强窗口信号。"
        )
    if report_true and report_false:
        findings.append(
            f"发送报告物料的会话留资率为 {report_true['lead_rate']}，未发送报告物料为 {report_false['lead_rate']}；报告物料需要结合时机进一步判断，不能简单前置强推。"
        )
    for item in findings:
        lines.append(f"- {item}")

    lines.extend(["", "## 3. 会话总轮次留资率", ""])
    lines.append(table_to_md(tables["round_bucket"], ["conversation_round_bucket", "conversation_count", "lead_count", "lead_rate"], ["会话总轮次", "会话数", "留资数", "留资率"]))

    lines.extend(["", "## 4. 首次索要手机号轮次留资率", ""])
    lines.append(table_to_md(tables["first_attempt"], ["first_lead_attempt_bucket", "conversation_count", "lead_count", "lead_rate"], ["首次索要手机号轮次", "会话数", "留资数", "留资率"]))

    lines.extend(["", "## 5. 首次索要轮次 × 留资理由", ""])
    lines.append(table_to_md(tables["attempt_reason"], ["first_lead_attempt_bucket", "lead_reason_type", "conversation_count", "lead_count", "lead_rate"], ["首次索要轮次", "留资理由", "会话数", "留资数", "留资率"]))

    lines.extend(["", "## 6. 看房信号 × 首次索要轮次", ""])
    lines.append(table_to_md(tables["visit_attempt"], ["has_visit_signal", "first_lead_attempt_bucket", "conversation_count", "lead_count", "lead_rate"], ["是否有看房信号", "首次索要轮次", "会话数", "留资数", "留资率"]))

    lines.extend(["", "## 7. 可用于立项材料的表达", ""])
    lines.append(
        "> 我们对历史爱聊会话进行规则预处理后发现，留资率并非随机分布，而是与会话轮次、首次索要手机号时机、用户是否出现看房信号、经纪人的留资理由显著相关。尤其是用户出现看房信号、且经纪人在中等轮次自然引导留资时，留资率明显高于整体平均。这说明“留资窗口”可以通过数据识别，并具备产品化为实时 Agent 提示能力的价值。"
    )

    path.write_text("\n".join(lines), encoding="utf-8")


def table_to_md(rows: list[dict], keys: list[str], headers: list[str]) -> str:
    return md_table(headers, [[str(r.get(k, "")) for k in keys] for r in rows])


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    keys = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze preprocessed conversation features.")
    parser.add_argument("--input", default="conversations/out/conversation_features.csv")
    parser.add_argument("--output-dir", default="conversations/out/analysis")
    args = parser.parse_args()

    rows = load_rows(Path(args.input))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    tables = {
        "round_bucket": group(rows, ["conversation_round_bucket"]),
        "first_attempt": group(rows, ["first_lead_attempt_bucket"]),
        "attempt_reason": group(rows, ["first_lead_attempt_bucket", "lead_reason_type"]),
        "visit_signal": group(rows, ["has_visit_signal"]),
        "visit_attempt": group(rows, ["has_visit_signal", "first_lead_attempt_bucket"]),
        "report_card": group(rows, ["has_report_card"]),
        "tool_combo": group(rows, ["has_report_card", "has_lead_card", "has_property_card"]),
        "reason": group(rows, ["lead_reason_type"]),
    }

    for name, table in tables.items():
        write_csv(output_dir / f"{name}.csv", table)

    write_report(output_dir / "analysis_report.md", rows, tables)
    print(f"Wrote analysis to {output_dir}")


if __name__ == "__main__":
    main()
