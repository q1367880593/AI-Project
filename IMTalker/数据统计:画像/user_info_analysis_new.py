# -*- coding: utf-8 -*-
"""
客户画像分布统计脚本（按业务线/轮次/留资分类）

读取 profile_extractor.py 输出的标签结果 CSV，按三个类别维度：
  - business_type：业务线
  - epoch_num：会话轮次数量
  - lead_tag：留资结果
对客户画像各维度（性格、目的、决策模式等）进行分组统计，
目的是判断不同轮次内客户画像分布是否存在差异，
为不同难度等级的客户 Agent 构造提供依据。

输出两部分：
  1. 统计报告：各维度标签按三类分组的交叉分布 + 请求总量统计
  2. 分类统计：business_type / epoch_num / lead_tag 各自的分布
"""

import json
import os
import pandas as pd
import numpy as np
from collections import Counter
from typing import Dict, List, Tuple

# ============================================================
# 配置区
# ============================================================

INPUT_FILE = "./result/profile_results_rental_test.xlsx"
OUTPUT_FILE = "./result/profile_analysis_new.xlsx"
HTML_REPORT_DIR = "./profile-analysis-report"
HTML_REPORT_FILE = "./profile-analysis-report/profile-analysis-report.html"

# ============================================================
# 标签映射表
# ============================================================

TAG_NAME_MAP = {
    "DECISIVE": "果断型", "CAUTIOUS": "谨慎型", "PICKY": "挑剔型",
    "EASYGOING": "随和型", "IMPULSIVE": "冲动型", "ANALYTICAL": "分析型",
    "IMPATIENT": "急躁型", "PATIENT": "耐心型",
    "SHORT_TERM": "短期过渡", "LONG_TERM": "长期居住", "SHARED": "合租需求", "UNCERTAIN": "不确定",
    "SELF_OCCUPY": "自住", "INVESTMENT": "投资", "IMPROVEMENT": "改善",
    "FAST": "快速决策", "CAUTIOUS_DELAY": "谨慎延迟",
    "COMPARATIVE": "比较型", "PRICE_DRIVEN": "价格驱动", "PASSIVE": "被动型",
    "HIGH": "高敏感度", "MEDIUM": "中敏感度", "LOW": "低敏感度",
    "BROWSING": "浏览阶段", "INQUIRING": "咨询阶段",
    "NEGOTIATING": "洽谈阶段", "READY_TO_ACT": "准备行动",
    "VIEWING": "约看阶段", "READY_TO_SIGN": "准备签约",
    "PROACTIVE": "积极主动", "REACTIVE": "被动回应", "MINIMAL": "极简沟通",
    "OPEN": "信息开放", "SELECTIVE": "选择性开放", "GUARDED": "信息保守",
    "BUDGET": "预算", "FLOOR": "楼层", "AREA": "面积", "LAYOUT": "户型",
    "LOCATION": "地段", "DECORATION": "装修", "TRANSPORT": "交通",
    "SCHOOL": "学区", "PARKING": "停车", "PET_FRIENDLY": "养宠",
    "PROPERTY_AGE": "房龄", "PROPERTY_RIGHTS": "产权", "MOVE_IN_TIME": "入住时间",
    "ORIENTATION": "朝向偏好",
    "LEASE_TERM": "租期", "PAYMENT_METHOD": "付款方式", "RENTAL_TYPE": "租赁类型",
    "FURNITURE": "家具家电", "ROOMMATE_TYPE": "室友类型",
}

DIM_CN_TO_EN = {
    "性格特征": "personality",
    "交易目的": "purchase_purpose",
    "租赁目的": "rental_purpose",
    "决策模式": "decision_mode",
    "价格敏感度": "price_sensitivity",
    "意向阶段": "intent_stage",
    "沟通风格": "communication_style",
    "核心需求": "core_needs",
}

DIM_ID_FIELD = {
    "personality": "trait_id",
    "purchase_purpose": "purpose_id",
    "rental_purpose": "purpose_id",
    "decision_mode": "mode_id",
    "price_sensitivity": "sensitivity_id",
    "intent_stage": "stage_id",
    "communication_style": "style_id",
    "core_needs": "need_id",
}

# 三个类别字段及其显示名
CATEGORY_FIELDS = {
    "business_type": "业务线",
    "epoch_num": "轮次",
    "lead_tag": "留资结果",
}


# ============================================================
# 数据加载与预处理
# ============================================================

def load_data(file_path: str) -> pd.DataFrame:
    """加载数据（支持 CSV 和 Excel）"""
    if file_path.endswith(".xlsx") or file_path.endswith(".xls"):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)
    print(f"加载数据: {len(df)} 条记录")
    return df


def prepare_categories(df: pd.DataFrame) -> pd.DataFrame:
    """确保三个类别字段存在（数据文件中已有则直接使用，无则从其他字段转换）"""
    # business_type
    if "business_type" not in df.columns:
        df["business_type"] = "unknown"

    # epoch_num：优先使用已有字段，否则从 conversation_turns 转换
    if "epoch_num" not in df.columns:
        if "conversation_turns" in df.columns:
            df["epoch_num"] = pd.to_numeric(df["conversation_turns"], errors="coerce").fillna(0).astype(int)
        else:
            df["epoch_num"] = 0

    # lead_tag：优先使用已有字段，否则从 is_phone_left 转换
    if "lead_tag" not in df.columns:
        if "is_phone_left" in df.columns:
            df["lead_tag"] = df["is_phone_left"].apply(lambda x: "已留资" if bool(x) else "未留资")
        else:
            df["lead_tag"] = "unknown"

    return df


def filter_valid(df: pd.DataFrame) -> pd.DataFrame:
    """过滤出有效记录（成功 + 业务相关）"""
    mask = pd.Series([True] * len(df), index=df.index)
    if "status" in df.columns:
        mask &= df["status"].isin(["成功", "部分校验失败"])
    if "is_business_related" in df.columns:
        mask &= df["is_business_related"] != False
    result = df[mask].copy()
    print(f"有效记录过滤后: {len(result)} 条")
    return result


def parse_json_column(series: pd.Series) -> pd.Series:
    return series.apply(lambda x: json.loads(x) if pd.notna(x) and isinstance(x, str) and x else [])


def extract_tags(parsed_col: pd.Series, id_field: str) -> pd.Series:
    def _extract(arr):
        if not isinstance(arr, list):
            return []
        return [item.get(id_field, "") for item in arr if isinstance(item, dict) and id_field in item]
    return parsed_col.apply(_extract)


def prepare_dimensions(df: pd.DataFrame) -> Dict[str, pd.Series]:
    """解析维度列，返回 {维度中文名: tag_series}"""
    tag_series = {}
    for cn_name, en_name in DIM_CN_TO_EN.items():
        if cn_name not in df.columns:
            continue
        parsed = parse_json_column(df[cn_name])
        id_field = DIM_ID_FIELD.get(en_name, "")
        if id_field:
            tag_series[cn_name] = extract_tags(parsed, id_field)
    return tag_series


# ============================================================
# 统计函数
# ============================================================

def request_overview_stats(df_all: pd.DataFrame) -> pd.DataFrame:
    """请求总量统计（不分类别）"""
    total = len(df_all)
    if "status" in df_all.columns:
        success = int((df_all["status"] == "成功").sum())
        partial = int((df_all["status"] == "部分校验失败").sum())
        fail = int((df_all["status"].isin(["校验失败", "失败"])).sum())
        success_rate = round((success + partial) / total * 100, 2) if total > 0 else 0
    else:
        success = partial = fail = 0
        success_rate = 0

    rows = [
        {"指标": "总请求数", "值": total},
        {"指标": "成功数", "值": success},
        {"指标": "部分校验失败数", "值": partial},
        {"指标": "失败数", "值": fail},
        {"指标": "成功率(含部分校验失败)", "值": f"{success_rate}%"},
    ]

    # token 统计
    if "usage" in df_all.columns:
        total_input = total_output = total_cached = 0
        for u in df_all["usage"].dropna():
            try:
                usage = json.loads(u)
                total_input += usage.get("input_tokens", 0)
                total_output += usage.get("output_tokens", 0)
                total_cached += usage.get("input_tokens_details", {}).get("cached_tokens", 0)
            except (json.JSONDecodeError, TypeError):
                pass
        rows.append({"指标": "总输入token", "值": total_input})
        rows.append({"指标": "总输出token", "值": total_output})
        rows.append({"指标": "总缓存token", "值": total_cached})

    # 模型列表
    if "model_name" in df_all.columns:
        models = df_all["model_name"].dropna().unique().tolist()
        rows.append({"指标": "涉及模型", "值": ", ".join(models)})

    return pd.DataFrame(rows)


def category_distribution(df: pd.DataFrame, cat_field: str, cat_label: str) -> pd.DataFrame:
    """单个类别字段的分布统计"""
    if cat_field not in df.columns:
        return pd.DataFrame()

    counts = df[cat_field].value_counts().reset_index()
    counts.columns = [cat_label, "记录数"]
    counts["占比"] = (counts["记录数"] / len(df) * 100).round(2)
    return counts


def tag_freq_by_category(tag_series: pd.Series, cat_series: pd.Series,
                         dim_name: str, cat_label: str) -> pd.DataFrame:
    """按单个类别字段分组的标签频率"""
    rows = []
    for cat_val in sorted(cat_series.dropna().unique()):
        mask = cat_series == cat_val
        subset = tag_series[mask]
        total = len(subset)
        counter = Counter()
        for tags in subset:
            counter.update(tags)
        for tag_id, count in counter.most_common():
            rows.append({
                "维度": dim_name,
                cat_label: cat_val,
                "标签ID": tag_id,
                "标签名称": TAG_NAME_MAP.get(tag_id, tag_id),
                "出现次数": count,
                "组内占比": round(count / total * 100, 2) if total > 0 else 0,
                "组样本数": total,
            })
        # 空标签
        empty_count = sum(1 for tags in subset if len(tags) == 0)
        rows.append({
            "维度": dim_name,
            cat_label: cat_val,
            "标签ID": "[空]",
            "标签名称": "无标签",
            "出现次数": empty_count,
            "组内占比": round(empty_count / total * 100, 2) if total > 0 else 0,
            "组样本数": total,
        })
    return pd.DataFrame(rows)


def tag_freq_by_multi_categories(tag_series: pd.Series, cat_df: pd.DataFrame,
                                  dim_name: str, cat_fields: list) -> pd.DataFrame:
    """按多个类别字段组合分组的标签频率"""
    rows = []
    # 构建组合 key
    cat_labels = [CATEGORY_FIELDS.get(f, f) for f in cat_fields]
    combined = cat_df[cat_fields].astype(str).agg(" | ".join, axis=1)

    for combo_val in sorted(combined.unique()):
        mask = combined == combo_val
        subset = tag_series[mask]
        total = len(subset)
        if total == 0:
            continue
        counter = Counter()
        for tags in subset:
            counter.update(tags)
        for tag_id, count in counter.most_common():
            rows.append({
                "维度": dim_name,
                " | ".join(cat_labels): combo_val,
                "标签ID": tag_id,
                "标签名称": TAG_NAME_MAP.get(tag_id, tag_id),
                "出现次数": count,
                "组内占比": round(count / total * 100, 2),
                "组样本数": total,
            })
    return pd.DataFrame(rows)


def tag_distribution_pivot(tag_series: pd.Series, cat_series: pd.Series,
                           dim_name: str, cat_label: str) -> pd.DataFrame:
    """标签 × 类别 交叉表（占比），用于直观对比分布差异"""
    rows = []
    all_tags = set()
    for tags in tag_series:
        all_tags.update(tags)
    all_tags = sorted(all_tags)

    cat_values = sorted(cat_series.dropna().unique())

    for tag_id in all_tags:
        row = {
            "维度": dim_name,
            "标签ID": tag_id,
            "标签名称": TAG_NAME_MAP.get(tag_id, tag_id),
        }
        for cv in cat_values:
            mask = cat_series == cv
            subset = tag_series[mask]
            total = len(subset)
            count = sum(1 for tags in subset if tag_id in tags)
            row[f"{cv}(n={total})"] = round(count / total * 100, 2) if total > 0 else 0
        rows.append(row)

    return pd.DataFrame(rows)


def cross_dim_by_category(tag_series_dict: Dict, cat_series: pd.Series,
                          cat_label: str) -> pd.DataFrame:
    """所有维度按类别分组的标签频率汇总"""
    all_rows = []
    for dim_name, ts in tag_series_dict.items():
        all_rows.append(tag_freq_by_category(ts, cat_series, dim_name, cat_label))
    return pd.concat(all_rows, ignore_index=True) if all_rows else pd.DataFrame()


def category_summary_stats(df: pd.DataFrame, cat_field: str, cat_label: str) -> pd.DataFrame:
    """按类别字段分组的综合统计（样本数、留资率、轮次分布等）"""
    if cat_field not in df.columns:
        return pd.DataFrame()

    rows = []
    for val in sorted(df[cat_field].dropna().unique()):
        subset = df[df[cat_field] == val]
        row = {cat_label: val, "样本数": len(subset)}

        if "is_phone_left" in subset.columns:
            lead = subset["is_phone_left"].dropna()
            if len(lead) > 0:
                row["留资数"] = int(lead.sum())
                row["留资率"] = round(lead.sum() / len(lead) * 100, 2)

        if "epoch_num" in subset.columns:
            turns = pd.to_numeric(subset["epoch_num"], errors="coerce").dropna()
            if len(turns) > 0:
                row["轮次均值"] = round(turns.mean(), 2)
                row["轮次中位数"] = round(turns.median(), 2)

        if "status" in subset.columns:
            success = int((subset["status"] == "成功").sum())
            row["成功数"] = success
            row["成功率"] = round(success / len(subset) * 100, 2)

        rows.append(row)

    return pd.DataFrame(rows)


def extra_tags_stats(df: pd.DataFrame) -> pd.DataFrame:
    """额外标签统计"""
    if "额外标签" not in df.columns:
        return pd.DataFrame()

    all_extra = []
    for val in df["额外标签"].dropna():
        if not val or not isinstance(val, str):
            continue
        try:
            data = json.loads(val)
            if isinstance(data, dict):
                for dim, items in data.items():
                    if dim == "_unknown_fields":
                        for k, v in items.items():
                            all_extra.append({"维度": "未知字段", "标签": k, "值": str(v)[:100]})
                    elif isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict):
                                tag_id = item.get("trait_id") or item.get("purpose_id") or \
                                         item.get("mode_id") or item.get("sensitivity_id") or \
                                         item.get("stage_id") or item.get("style_id") or \
                                         item.get("need_id") or item.get("id", "")
                                all_extra.append({"维度": dim, "标签": tag_id, "值": str(item)[:100]})
        except (json.JSONDecodeError, TypeError):
            pass

    if not all_extra:
        return pd.DataFrame()

    extra_df = pd.DataFrame(all_extra)
    freq = extra_df.groupby(["维度", "标签"]).size().reset_index(name="出现次数")
    return freq.sort_values("出现次数", ascending=False).reset_index(drop=True)


# ============================================================
# HTML 报告生成
# ============================================================

def compute_all_tag_data(df_valid: pd.DataFrame, tag_series: dict) -> dict:
    """预计算全量 + 16个类别的各维度标签分布数据"""
    # 类别值
    bt_values = sorted(df_valid["business_type"].dropna().unique().tolist()) if "business_type" in df_valid.columns else []
    ep_values = sorted(df_valid["epoch_num"].dropna().unique().tolist()) if "epoch_num" in df_valid.columns else []
    ld_values = sorted(df_valid["lead_tag"].dropna().unique().tolist()) if "lead_tag" in df_valid.columns else []

    # 排序：轮次按自然顺序
    ep_order = {"2轮以下": 0, "3-10轮": 1, "10-20轮": 2, "20轮以上": 3}
    ep_values = sorted(ep_values, key=lambda x: ep_order.get(x, 99))
    ld_values = sorted(ld_values, key=lambda x: str(x))

    result = {
        "bt_values": bt_values,
        "ep_values": ep_values,
        "ld_values": ld_values,
        "categories": [],
        "dimensions": {}
    }

    # 16个类别组合
    for bt in bt_values:
        for ep in ep_values:
            for ld in ld_values:
                mask = (df_valid["business_type"] == bt) & (df_valid["epoch_num"] == ep) & (df_valid["lead_tag"] == ld)
                count = int(mask.sum())
                cat_key = f"{bt}|{ep}|{ld}"
                result["categories"].append({
                    "key": cat_key,
                    "business_type": bt,
                    "epoch_num": ep,
                    "lead_tag": str(ld),
                    "count": count
                })

    # 各维度的标签分布
    for dim_name, ts in tag_series.items():
        dim_data = {"all": [], "by_category": {}}

        # 全量
        counter = Counter()
        for tags in ts:
            counter.update(tags)
        dim_data["all"] = [{"name": TAG_NAME_MAP.get(t, t), "id": t, "value": c}
                           for t, c in counter.most_common()]

        # 按类别
        for cat in result["categories"]:
            bt, ep, ld = cat["business_type"], cat["epoch_num"], cat["lead_tag"]
            mask = (df_valid["business_type"] == bt) & (df_valid["epoch_num"] == ep) & (df_valid["lead_tag"].astype(str) == ld)
            subset = ts[mask]
            counter = Counter()
            for tags in subset:
                counter.update(tags)
            dim_data["by_category"][cat["key"]] = [
                {"name": TAG_NAME_MAP.get(t, t), "id": t, "value": c}
                for t, c in counter.most_common()
            ]

        result["dimensions"][dim_name] = dim_data

    return result


def compute_category_diff(df_valid: pd.DataFrame, tag_series: dict, top_n: int = 3) -> list:
    """计算16个类别的差异指标，按业务线→轮次→留资排序，每个维度展示 TopN 标签"""
    bt_values = sorted(df_valid["business_type"].dropna().unique().tolist()) if "business_type" in df_valid.columns else []
    ep_values = sorted(df_valid["epoch_num"].dropna().unique().tolist()) if "epoch_num" in df_valid.columns else []
    ld_values = sorted(df_valid["lead_tag"].dropna().unique().tolist()) if "lead_tag" in df_valid.columns else []

    ep_order = {"2轮以下": 0, "3-10轮": 1, "10-20轮": 2, "20轮以上": 3}
    ep_values = sorted(ep_values, key=lambda x: ep_order.get(x, 99))
    ld_values = sorted(ld_values, key=lambda x: str(x))

    rows = []
    for bt in bt_values:
        for ep in ep_values:
            for ld in ld_values:
                mask = (df_valid["business_type"] == bt) & (df_valid["epoch_num"] == ep) & (df_valid["lead_tag"].astype(str) == str(ld))
                subset_df = df_valid[mask]
                count = len(subset_df)

                row = {
                    "business_type": bt,
                    "epoch_num": ep,
                    "lead_tag": str(ld),
                    "count": count,
                }

                # 各维度 TopN 标签
                for dim_name, ts in tag_series.items():
                    subset_ts = ts[mask]
                    counter = Counter()
                    for tags in subset_ts:
                        counter.update(tags)
                    if counter:
                        top_tags = counter.most_common(top_n)
                        parts = [f"{TAG_NAME_MAP.get(t, t)}({c})" for t, c in top_tags]
                        row[dim_name] = " | ".join(parts)
                    else:
                        row[dim_name] = "-"

                rows.append(row)

    return rows


def generate_html_report(sheets: dict, df_all: pd.DataFrame, df_valid: pd.DataFrame,
                         tag_series: dict, output_file: str):
    """生成 HTML 统计报告（饼图 + 条状图 + 筛选器 + 类别差异对比）"""
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # 根据业务线过滤维度：租赁用"租赁目的"，二手房用"交易目的"
    bt_values_all = df_valid["business_type"].dropna().unique().tolist() if "business_type" in df_valid.columns else []
    is_rental = any("租" in str(bt) for bt in bt_values_all)
    is_secondhand = any("二手" in str(bt) or "买卖" in str(bt) for bt in bt_values_all)

    # 过滤 tag_series
    filtered_tag_series = {}
    for dim_name, ts in tag_series.items():
        if dim_name == "交易目的" and not is_secondhand:
            continue
        if dim_name == "租赁目的" and not is_rental:
            continue
        filtered_tag_series[dim_name] = ts

    # 预计算数据
    all_data = compute_all_tag_data(df_valid, filtered_tag_series)
    cat_diff = compute_category_diff(df_valid, filtered_tag_series, top_n=3)

    data_json = json.dumps(all_data, ensure_ascii=False)
    diff_json = json.dumps(cat_diff, ensure_ascii=False)

    # 维度列表
    dim_list = list(filtered_tag_series.keys())

    # 类别差异表的列
    diff_columns = ["business_type", "epoch_num", "lead_tag", "count"] + dim_list
    diff_col_labels = {
        "business_type": "业务线", "epoch_num": "轮次", "lead_tag": "留资",
        "count": "样本数",
        "性格特征": "性格Top3", "租赁目的": "目的Top3", "交易目的": "目的Top3",
        "决策模式": "决策Top3", "价格敏感度": "价格Top3", "意向阶段": "意向Top3",
        "沟通风格": "沟通Top3", "核心需求": "需求Top3",
    }

    # 构建条状图数据（各维度 × 业务线/轮次/留资的交叉占比）
    bar_charts = []
    for cat_field, cat_label in [("business_type", "业务线"), ("epoch_num", "轮次"), ("lead_tag", "留资")]:
        if cat_field not in df_valid.columns:
            continue
        for dim_name, ts in filtered_tag_series.items():
            pivot = tag_distribution_pivot(ts, df_valid[cat_field], dim_name, cat_label)
            if pivot.empty:
                continue
            cat_values = [c for c in pivot.columns if c not in ["维度", "标签ID", "标签名称"]]
            bar_charts.append({
                "id": f"bar_{dim_name}_{cat_field}",
                "title": f"{dim_name} × {cat_label} 分布对比",
                "categories": pivot["标签名称"].tolist(),
                "series": [{"name": cv, "data": pivot[cv].tolist()} for cv in cat_values]
            })

    bar_charts_json = json.dumps(bar_charts, ensure_ascii=False)

    html = f"""<!-- Generated by Trae Work -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>客户画像分布统计报告</title>
<style>
:root {{
  --bg: #f8f9fa;
  --bg2: #ffffff;
  --ink: #1a1a2e;
  --muted: #6c757d;
  --rule: #dee2e6;
  --accent: #4361ee;
  --accent2: #f72585;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  font-family: -apple-system, "Microsoft YaHei", "Segoe UI", sans-serif;
  background: var(--bg); color: var(--ink); line-height: 1.7; font-size: 15px;
}}
.container {{ max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }}
h1 {{ font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }}
h2 {{
  font-size: 1.3rem; font-weight: 600; margin: 2.5rem 0 1rem;
  padding-bottom: 0.5rem; border-bottom: 2px solid var(--accent);
}}
h3 {{ font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }}
.subtitle {{ color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; }}

/* 筛选器 */
.filter-panel {{
  background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px;
  padding: 1.25rem; margin-bottom: 1.5rem;
}}
.filter-group {{ margin-bottom: 0.75rem; }}
.filter-group:last-child {{ margin-bottom: 0; }}
.filter-group-label {{
  font-size: 0.85rem; font-weight: 600; color: var(--ink);
  margin-bottom: 0.5rem; display: inline-block;
}}
.filter-checkbox {{
  display: inline-flex; align-items: center; gap: 0.3rem;
  margin-right: 1rem; cursor: pointer; font-size: 0.85rem;
}}
.filter-checkbox input {{ cursor: pointer; }}
.filter-actions {{ display: inline-block; margin-left: 1rem; }}
.filter-btn {{
  background: var(--accent); color: #fff; border: none; border-radius: 4px;
  padding: 0.3rem 0.8rem; font-size: 0.8rem; cursor: pointer; margin-right: 0.5rem;
}}
.filter-btn:hover {{ opacity: 0.85; }}
.filter-btn.secondary {{ background: var(--muted); }}
.filter-status {{
  display: inline-block; margin-left: 0.5rem; font-size: 0.8rem; color: var(--muted);
}}

/* 图表网格 */
.chart-grid {{
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin: 1rem 0;
}}
.chart-card {{
  background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px;
  padding: 1rem;
}}
.chart-card .chart-title {{
  font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--ink);
}}
.chart-container {{ width: 100%; min-height: 320px; }}

/* 表格 */
.table-wrap {{
  overflow-x: auto; overflow-y: auto; max-height: 600px;
  border: 1px solid var(--rule); border-radius: 8px; margin: 1rem 0;
}}
.data-table {{ width: 100%; border-collapse: collapse; font-size: 0.82rem; }}
.data-table thead {{ position: sticky; top: 0; background: var(--bg2); z-index: 1; }}
.data-table th {{
  padding: 0.6rem 0.75rem; text-align: left; border-bottom: 2px solid var(--rule);
  font-weight: 600; white-space: nowrap;
}}
.data-table td {{
  padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--rule); white-space: nowrap;
}}
.data-table td.allow-wrap {{ white-space: normal; word-break: break-word; max-width: 280px; }}
.data-table tbody tr:hover {{ background: var(--bg); }}

@media (max-width: 768px) {{
  .container {{ padding: 1rem; }}
  .chart-grid {{ grid-template-columns: 1fr; }}
}}
</style>
</head>
<body>
<div class="container">
<h1>客户画像分布统计报告</h1>
<p class="subtitle">按业务线、轮次、留资结果三个维度对客户画像进行分组统计，通过筛选器查看不同类别组合下的标签分布差异</p>

<!-- 筛选器 -->
<div class="filter-panel">
  <div class="filter-group">
    <span class="filter-group-label">业务线：</span>
    <div id="filter_bt" style="display:inline"></div>
  </div>
  <div class="filter-group">
    <span class="filter-group-label">轮次：</span>
    <div id="filter_ep" style="display:inline"></div>
  </div>
  <div class="filter-group">
    <span class="filter-group-label">留资：</span>
    <div id="filter_ld" style="display:inline"></div>
  </div>
  <div class="filter-actions">
    <button class="filter-btn" onclick="selectAll(true)">全选</button>
    <button class="filter-btn secondary" onclick="selectAll(false)">全不选</button>
    <span class="filter-status" id="filter_status"></span>
  </div>
</div>

<!-- 饼图区域 -->
<h2>各维度标签分布（饼图）</h2>
<p class="subtitle">通过上方筛选器选择类别，饼图将实时更新为所选类别的标签分布。全选时展示全部数据的统计结果。</p>
<div class="chart-grid" id="chart_grid">
</div>

<!-- 类别差异对比 -->
<h2>16个类别差异对比</h2>
<p class="subtitle">下表展示每个类别组合下各维度的 Top3 标签，按业务线→轮次→留资排序，用于快速发现类别间差异</p>
<div class="table-wrap">
  <table class="data-table">
    <thead><tr>
      {''.join(f'<th>{diff_col_labels.get(c, c)}</th>' for c in diff_columns)}
    </tr></thead>
    <tbody id="diff_tbody">
    </tbody>
  </table>
</div>

<!-- 条状图区域 -->
<h2>各维度分布对比（条状图）</h2>
<p class="subtitle">以下条状图展示各画像维度在业务线、轮次、留资三个类别下的标签占比对比，用于直观发现分布差异</p>
<div class="chart-grid" id="bar_chart_grid">
</div>

</div>

<script src="./_shared/js/echarts.min.js"></script>
<script>
(function() {{
  var data = {data_json};
  var diffData = {diff_json};
  var dimList = {json.dumps(dim_list, ensure_ascii=False)};
  var barCharts = {bar_charts_json};
  var charts = {{}};

  var palette = ['#4361ee', '#f72585', '#06d6a0', '#ffd166', '#118ab2',
                 '#ef476f', '#073b4c', '#7209b7', '#560bad', '#3a0ca3',
                 '#4cc9f0', '#f9c74f', '#f9844a', '#f8961e', '#90be6d', '#43aa8b'];

  // 构建筛选器
  function buildFilter(containerId, values, group) {{
    var container = document.getElementById(containerId);
    values.forEach(function(v, i) {{
      var label = document.createElement('label');
      label.className = 'filter-checkbox';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.group = group;
      cb.dataset.value = v;
      cb.addEventListener('change', onFilterChange);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(v));
      container.appendChild(label);
    }});
  }}

  buildFilter('filter_bt', data.bt_values, 'bt');
  buildFilter('filter_ep', data.ep_values, 'ep');
  buildFilter('filter_ld', data.ld_values.map(String), 'ld');

  // 构建饼图容器
  var grid = document.getElementById('chart_grid');
  dimList.forEach(function(dim) {{
    var card = document.createElement('div');
    card.className = 'chart-card';
    var title = document.createElement('div');
    title.className = 'chart-title';
    title.textContent = dim;
    var container = document.createElement('div');
    container.className = 'chart-container';
    container.id = 'chart_' + dim;
    card.appendChild(title);
    card.appendChild(container);
    grid.appendChild(card);
  }});

  // 全选/全不选
  window.selectAll = function(checked) {{
    document.querySelectorAll('.filter-checkbox input').forEach(function(cb) {{
      cb.checked = checked;
    }});
    onFilterChange();
  }};

  // 筛选变化时更新图表
  function onFilterChange() {{
    var btChecked = getChecked('bt');
    var epChecked = getChecked('ep');
    var ldChecked = getChecked('ld');

    // 计算选中的类别组合
    var selectedCats = [];
    var selectedCount = 0;
    data.categories.forEach(function(cat) {{
      if (btChecked.indexOf(cat.business_type) >= 0 &&
          epChecked.indexOf(cat.epoch_num) >= 0 &&
          ldChecked.indexOf(cat.lead_tag) >= 0) {{
        selectedCats.push(cat.key);
        selectedCount += cat.count;
      }}
    }});

    document.getElementById('filter_status').textContent =
      '已选 ' + selectedCats.length + '/16 个类别，共 ' + selectedCount + ' 条记录';

    // 更新每个维度的饼图
    dimList.forEach(function(dim) {{
      var dimData = data.dimensions[dim];
      if (!dimData) return;

      // 聚合选中类别的标签
      var tagCounter = {{}};
      if (selectedCats.length === data.categories.length) {{
        // 全选时用预计算的 all
        dimData.all.forEach(function(item) {{
          tagCounter[item.name] = item.value;
        }});
      }} else {{
        selectedCats.forEach(function(catKey) {{
          var catData = dimData.by_category[catKey] || [];
          catData.forEach(function(item) {{
            tagCounter[item.name] = (tagCounter[item.name] || 0) + item.value;
          }});
        }});
      }}

      var pieData = Object.keys(tagCounter).map(function(name) {{
        return {{ name: name, value: tagCounter[name] }};
      }}).sort(function(a, b) {{ return b.value - a.value; }});

      renderPie('chart_' + dim, dim, pieData);
    }});
  }}

  function getChecked(group) {{
    var result = [];
    document.querySelectorAll('.filter-checkbox input[data-group="' + group + '"]').forEach(function(cb) {{
      if (cb.checked) result.push(cb.dataset.value);
    }});
    return result;
  }}

  // 渲染饼图
  function renderPie(containerId, title, pieData) {{
    var el = document.getElementById(containerId);
    if (!el) return;

    if (charts[containerId]) {{
      charts[containerId].dispose();
    }}
    var chart = echarts.init(el, null, {{ renderer: 'svg' }});
    charts[containerId] = chart;

    if (pieData.length === 0) {{
      chart.setOption({{
        title: {{ text: '暂无数据', left: 'center', top: 'center', textStyle: {{ color: '#6c757d', fontSize: 14 }} }}
      }});
      return;
    }}

    chart.setOption({{
      animation: false,
      tooltip: {{ trigger: 'item', appendToBody: true, formatter: '{{b}}: {{c}} ({{d}}%)' }},
      legend: {{
        type: 'scroll', bottom: 0, left: 'center',
        textStyle: {{ color: '#6c757d', fontSize: 11 }},
        itemWidth: 10, itemHeight: 10
      }},
      color: palette,
      series: [{{
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '42%'],
        label: {{
          color: '#1a1a2e',
          fontSize: 11,
          formatter: function(p) {{
            return p.value > 0 ? p.name + '\\n' + p.percent + '%' : '';
          }}
        }},
        labelLine: {{ length: 10, length2: 8 }},
        data: pieData
      }}]
    }});

    window.addEventListener('resize', function() {{ chart.resize(); }});
  }}

  // 渲染差异对比表
  function renderDiffTable() {{
    var tbody = document.getElementById('diff_tbody');
    var columns = {json.dumps(diff_columns, ensure_ascii=False)};
    var labels = {json.dumps(diff_col_labels, ensure_ascii=False)};
    var dimCols = {json.dumps(dim_list, ensure_ascii=False)};

    diffData.forEach(function(row) {{
      var tr = document.createElement('tr');
      columns.forEach(function(col) {{
        var td = document.createElement('td');
        var val = row[col];
        if (col === 'count') {{
          td.style.fontWeight = '600';
          td.style.color = '#4361ee';
        }}
        // 维度列允许换行
        if (dimCols.indexOf(col) >= 0) {{
          td.className = 'allow-wrap';
        }}
        td.textContent = val !== undefined && val !== null ? val : '-';
        tr.appendChild(td);
      }});
      tbody.appendChild(tr);
    }});
  }}

  // 渲染条状图
  function renderBarCharts() {{
    var grid = document.getElementById('bar_chart_grid');
    barCharts.forEach(function(bc) {{
      var card = document.createElement('div');
      card.className = 'chart-card';
      var title = document.createElement('div');
      title.className = 'chart-title';
      title.textContent = bc.title;
      var container = document.createElement('div');
      container.className = 'chart-container';
      container.id = bc.id;
      container.style.minHeight = '360px';
      card.appendChild(title);
      card.appendChild(container);
      grid.appendChild(card);

      var el = document.getElementById(bc.id);
      var chart = echarts.init(el, null, {{ renderer: 'svg' }});
      charts[bc.id] = chart;

      var series = bc.series.map(function(s, i) {{
        return {{ name: s.name, type: 'bar', data: s.data, itemStyle: {{ color: palette[i % palette.length] }} }};
      }});

      chart.setOption({{
        animation: false,
        tooltip: {{ trigger: 'axis', appendToBody: true, axisPointer: {{ type: 'shadow' }} }},
        legend: {{ bottom: 0, textStyle: {{ color: '#6c757d', fontSize: 11 }}, itemWidth: 10, itemHeight: 10 }},
        grid: {{ left: '3%', right: '4%', bottom: '15%', top: '8%', containLabel: true }},
        xAxis: {{
          type: 'category', data: bc.categories,
          axisLabel: {{ color: '#6c757d', fontSize: 10, rotate: bc.categories.length > 6 ? 35 : 0 }}
        }},
        yAxis: {{ type: 'value', axisLabel: {{ color: '#6c757d', formatter: '{{value}}%' }} }},
        series: series
      }});

      window.addEventListener('resize', function() {{ chart.resize(); }});
    }});
  }}

  renderDiffTable();
  renderBarCharts();
  onFilterChange();
}})();
</script>
</body>
</html>
"""

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"HTML 报告已保存至: {output_file}")


# ============================================================
# 主流程
# ============================================================

def main():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    # 加载全部数据（含失败记录，用于请求统计）
    df_all = load_data(INPUT_FILE)
    df_all = prepare_categories(df_all)

    # 过滤有效记录（用于画像统计）
    df_valid = filter_valid(df_all)
    tag_series = prepare_dimensions(df_valid)

    sheets = {}

    # ====== Part 1: 统计报告 ======

    # Sheet: 请求总量统计
    sheets["请求总量统计"] = request_overview_stats(df_all)

    # Sheet: 按业务线分组的标签分布
    if "business_type" in df_valid.columns:
        bt_cat = df_valid["business_type"]
        sheets["按业务线-综合统计"] = category_summary_stats(df_valid, "business_type", "业务线")
        sheets["按业务线-标签频率"] = cross_dim_by_category(tag_series, bt_cat, "业务线")
        # 交叉表（每个维度一个）
        for dim_name, ts in tag_series.items():
            pivot = tag_distribution_pivot(ts, bt_cat, dim_name, "业务线")
            if not pivot.empty:
                sheets[f"交叉表-{dim_name}×业务线"] = pivot

    # Sheet: 按轮次分组的标签分布
    if "epoch_num" in df_valid.columns:
        ep_cat = df_valid["epoch_num"]
        sheets["按轮次-综合统计"] = category_summary_stats(df_valid, "epoch_num", "轮次")
        sheets["按轮次-标签频率"] = cross_dim_by_category(tag_series, ep_cat, "轮次")
        for dim_name, ts in tag_series.items():
            pivot = tag_distribution_pivot(ts, ep_cat, dim_name, "轮次")
            if not pivot.empty:
                sheets[f"交叉表-{dim_name}×轮次"] = pivot

    # Sheet: 按留资分组的标签分布
    if "lead_tag" in df_valid.columns:
        ld_cat = df_valid["lead_tag"]
        sheets["按留资-综合统计"] = category_summary_stats(df_valid, "lead_tag", "留资结果")
        sheets["按留资-标签频率"] = cross_dim_by_category(tag_series, ld_cat, "留资结果")
        for dim_name, ts in tag_series.items():
            pivot = tag_distribution_pivot(ts, ld_cat, dim_name, "留资结果")
            if not pivot.empty:
                sheets[f"交叉表-{dim_name}×留资"] = pivot

    # Sheet: 按业务线×轮次组合分组的标签频率
    if "business_type" in df_valid.columns and "epoch_num" in df_valid.columns:
        cat_df = df_valid[["business_type", "epoch_num"]].copy()
        for dim_name, ts in tag_series.items():
            combo_freq = tag_freq_by_multi_categories(ts, cat_df, dim_name, ["business_type", "epoch_num"])
            if not combo_freq.empty:
                sheets[f"组合-业务线×轮次-{dim_name}"] = combo_freq

    # Sheet: 按业务线×留资组合分组的标签频率
    if "business_type" in df_valid.columns and "lead_tag" in df_valid.columns:
        cat_df = df_valid[["business_type", "lead_tag"]].copy()
        for dim_name, ts in tag_series.items():
            combo_freq = tag_freq_by_multi_categories(ts, cat_df, dim_name, ["business_type", "lead_tag"])
            if not combo_freq.empty:
                sheets[f"组合-业务线×留资-{dim_name}"] = combo_freq

    # Sheet: 额外标签
    extra_df = extra_tags_stats(df_valid)
    if not extra_df.empty:
        sheets["额外标签"] = extra_df

    # ====== Part 2: 分类统计 ======

    # Sheet: 业务线分布
    sheets["分类-业务线分布"] = category_distribution(df_all, "business_type", "业务线")

    # Sheet: 轮次分布
    sheets["分类-轮次分布"] = category_distribution(df_all, "epoch_num", "轮次")

    # Sheet: 留资分布
    sheets["分类-留资分布"] = category_distribution(df_all, "lead_tag", "留资结果")

    # Sheet: 业务线×轮次 交叉分布
    if "business_type" in df_all.columns and "epoch_num" in df_all.columns:
        cross = df_all.groupby(["business_type", "epoch_num"]).size().reset_index(name="记录数")
        cross["占比"] = (cross["记录数"] / len(df_all) * 100).round(2)
        sheets["分类-业务线×轮次"] = cross

    # Sheet: 业务线×留资 交叉分布
    if "business_type" in df_all.columns and "lead_tag" in df_all.columns:
        cross = df_all.groupby(["business_type", "lead_tag"]).size().reset_index(name="记录数")
        cross["占比"] = (cross["记录数"] / len(df_all) * 100).round(2)
        sheets["分类-业务线×留资"] = cross

    # Sheet: 轮次×留资 交叉分布
    if "epoch_num" in df_all.columns and "lead_tag" in df_all.columns:
        cross = df_all.groupby(["epoch_num", "lead_tag"]).size().reset_index(name="记录数")
        cross["占比"] = (cross["记录数"] / len(df_all) * 100).round(2)
        sheets["分类-轮次×留资"] = cross

    # 保存 Excel
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        for sheet_name, sheet_df in sheets.items():
            # Excel sheet 名最长 31 字符
            safe_name = sheet_name[:31]
            sheet_df.to_excel(writer, sheet_name=safe_name, index=False)

    print(f"\nExcel 结果保存至: {OUTPUT_FILE}")
    print(f"共 {len(sheets)} 个 Sheet:")
    for name in sheets.keys():
        print(f"  - {name}")

    # 生成 HTML 报告
    generate_html_report(sheets, df_all, df_valid, tag_series, HTML_REPORT_FILE)


if __name__ == "__main__":
    main()
