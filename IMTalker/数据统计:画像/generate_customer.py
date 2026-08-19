# -*- coding: utf-8 -*-
"""
租赁模拟客户提示词生成器

根据难度等级从 customer_profiles.json 中按概率分布随机抽取画像标签，
填充到系统提示词模板中，生成一个完整的模拟客户系统提示词。

用法:
    # 命令行：生成一个中等难度客户
    python generate_customer.py --level medium

    # 指定输出文件
    python generate_customer.py --level hard --output ./output/customer_001.txt

    # 生成多个客户
    python generate_customer.py --level easy --count 5 --output_dir ./output/

    # 在代码中调用
    from generate_customer import CustomerGenerator
    gen = CustomerGenerator()
    prompt = gen.generate("medium")
"""

import json
import os
import random
import argparse
from typing import Dict, List, Tuple, Optional


class CustomerGenerator:
    """模拟客户提示词生成器"""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        self.base_dir = base_dir
        self.profiles_path = os.path.join(base_dir, "customer_profiles.json")
        self.template_path = os.path.join(base_dir, "system_prompt_template.txt")
        self._load_data()

    def _load_data(self):
        with open(self.profiles_path, "r", encoding="utf-8") as f:
            self.profiles = json.load(f)
        with open(self.template_path, "r", encoding="utf-8") as f:
            self.template = f.read()

    def _weighted_sample(self, weights: Dict[str, float], n: int = 1) -> List[str]:
        """按权重从字典中抽取 n 个不重复的键"""
        items = list(weights.items())
        keys = [k for k, _ in items]
        probs = [w for _, w in items]
        # 归一化
        total = sum(probs)
        probs = [p / total for p in probs]
        if n >= len(keys):
            return keys
        return list(random.choices(keys, weights=probs, k=n))

    def _weighted_sample_unique(self, weights: Dict[str, float], n: int) -> List[str]:
        """按权重抽取 n 个不重复的键"""
        items = list(weights.items())
        keys = [k for k, _ in items]
        probs = [w for _, w in items]
        total = sum(probs)
        probs = [p / total for p in probs]

        selected = []
        remaining_keys = list(keys)
        remaining_probs = list(probs)

        for _ in range(min(n, len(keys))):
            choice = random.choices(remaining_keys, weights=remaining_probs, k=1)[0]
            selected.append(choice)
            idx = remaining_keys.index(choice)
            remaining_keys.pop(idx)
            remaining_probs.pop(idx)
            # 重新归一化
            s = sum(remaining_probs)
            if s > 0:
                remaining_probs = [p / s for p in remaining_probs]

        return selected

    def _sample_dimension(self, dim_config: dict) -> List[str]:
        """从单个维度配置中抽取标签"""
        min_tags = dim_config.get("min_tags", 1)
        max_tags = dim_config.get("max_tags", 1)

        # communication_style 特殊处理：活跃度+开放度各抽1个
        if "active_weights" in dim_config and "openness_weights" in dim_config:
            active = self._weighted_sample(dim_config["active_weights"], 1)
            openness = self._weighted_sample(dim_config["openness_weights"], 1)
            return active + openness

        weights = dim_config.get("weights", {})
        n = random.randint(min_tags, max_tags)
        return self._weighted_sample_unique(weights, n)

    def _apply_mutation(self, level_key: str, sampled: Dict[str, List[str]]) -> Dict:
        """应用变异机制"""
        mutation_config = self.profiles.get("mutation_rules", {})
        mutations = []

        # 1. 特征越级
        cross_cfg = mutation_config.get("cross_level_feature", {})
        if random.random() < cross_cfg.get("probability", 0):
            levels = list(self.profiles["levels"].keys())
            current_idx = levels.index(level_key)
            if current_idx < len(levels) - 1:
                higher_level = self.profiles["levels"][levels[current_idx + 1]]
                # 随机选一个维度从高一级抽取
                dim_names = [d for d in sampled if d != "communication_style"]
                if dim_names:
                    mut_dim = random.choice(dim_names)
                    higher_dim = higher_level["dimensions"].get(mut_dim, {})
                    if higher_dim:
                        new_tags = self._sample_dimension(higher_dim)
                        old_tags = sampled[mut_dim]
                        sampled[mut_dim] = new_tags
                        mutations.append({
                            "type": "cross_level_feature",
                            "dimension": mut_dim,
                            "old": old_tags,
                            "new": new_tags
                        })

        # 2. 隐藏需求
        hidden_cfg = mutation_config.get("hidden_need", {})
        prob_range = hidden_cfg.get("probability_range", [0, 0])
        hidden_prob = random.uniform(prob_range[0], prob_range[1])
        if random.random() < hidden_prob:
            level_config = self.profiles["levels"][level_key]
            needs_config = level_config["dimensions"]["core_needs"]
            pool = needs_config.get("pool", [])
            current_needs = set(sampled.get("core_needs", []))
            available = [n for n in pool if n not in current_needs]
            if available:
                hidden_need = random.choice(available)
                mutations.append({
                    "type": "hidden_need",
                    "need": hidden_need,
                    "trigger": "对话进行到中后期时自然表达此需求"
                })

        # 3. 行为突变
        behavior_cfg = mutation_config.get("behavior_mutation", {})
        prob_range = behavior_cfg.get("probability_range", [0, 0])
        behavior_prob = random.uniform(prob_range[0], prob_range[1])
        if random.random() < behavior_prob:
            mut_dims = ["personality", "decision_mode"]
            mut_dim = random.choice(mut_dims)
            if mut_dim in sampled and len(sampled[mut_dim]) > 0:
                old_tag = sampled[mut_dim][0]
                level_config = self.profiles["levels"][level_key]
                dim_config = level_config["dimensions"][mut_dim]
                weights = dim_config.get("weights", {})
                other_tags = [t for t in weights if t not in sampled[mut_dim]]
                if other_tags:
                    new_tag = random.choice(other_tags)
                    sampled[mut_dim] = [new_tag] + sampled[mut_dim][1:]
                    mutations.append({
                        "type": "behavior_mutation",
                        "dimension": mut_dim,
                        "old": old_tag,
                        "new": new_tag,
                        "trigger_point": "对话进行到 40%-60% 时发生"
                    })

        # 4. 触发点
        trigger_cfg = mutation_config.get("trigger_point", {})
        conditions = trigger_cfg.get("conditions", [])
        if conditions:
            selected_conditions = random.sample(conditions, min(2, len(conditions)))
            mutations.append({
                "type": "trigger_point",
                "conditions": selected_conditions,
                "effect": trigger_cfg.get("effect", "")
            })

        return mutations

    def _format_profile_section(self, sampled: Dict[str, List[str]], tag_names: Dict) -> str:
        """格式化画像特征部分"""
        dim_labels = {
            "personality": "性格特征",
            "rental_purpose": "租赁目的",
            "decision_mode": "决策模式",
            "price_sensitivity": "价格敏感度",
            "intent_stage": "意向阶段",
            "communication_style": "沟通风格",
            "core_needs": "核心需求",
        }

        lines = []
        for dim_key, tags in sampled.items():
            label = dim_labels.get(dim_key, dim_key)
            name_map = tag_names.get(dim_key, {})
            tag_strs = [name_map.get(t, t) for t in tags]
            lines.append(f"- {label}：{', '.join(tag_strs)}")

        return "\n".join(lines)

    def _format_behavior_section(self, behavior_params: dict) -> str:
        """格式化行为参数部分"""
        lines = []
        for key, val in behavior_params.items():
            label_map = {
                "reply_length": "回复长度",
                "reply_speed": "回复速度",
                "emotion_stability": "情绪稳定性",
                "compromise_willingness": "妥协意愿",
                "objection_probability": "异议概率",
                "hidden_need_probability": "隐藏需求概率",
                "behavior_mutation_probability": "行为突变概率",
                "hesitation_probability": "犹豫概率",
                "comparison_probability": "多房源对比概率",
                "bargaining_probability": "议价概率",
                "competitor_pressure_probability": "竞品施压概率",
                "post_viewing_change_probability": "约看后改变条件概率",
                "leave_phone_baseline": "留资意愿基线",
                "refuse_threshold": "拒绝满意度阈值",
                "leave_phone_satisfaction_threshold": "留资满意度阈值",
                "max_mismatch_count": "最大不匹配次数",
            }
            label = label_map.get(key, key)
            if isinstance(val, float):
                lines.append(f"- {label}：{val:.0%}")
            elif isinstance(val, list):
                lines.append(f"- {label}：")
                for item in val:
                    lines.append(f"  · {item}")
            else:
                lines.append(f"- {label}：{val}")
        return "\n".join(lines)

    def _format_mutation_section(self, mutations: List[Dict]) -> str:
        """格式化变异机制部分"""
        if not mutations:
            return "本次生成未触发变异机制，客户行为将保持一致性。"

        lines = ["本次生成触发了以下变异机制："]
        for m in mutations:
            if m["type"] == "cross_level_feature":
                lines.append(f"- 特征越级：{m['dimension']} 维度出现了高难度特征 {m['new']}（原为 {m['old']}）")
            elif m["type"] == "hidden_need":
                name_map = self.profiles.get("tag_names", {}).get("core_needs", {})
                need_name = name_map.get(m["need"], m["need"])
                lines.append(f"- 隐藏需求：客户有一个未在初始表达的需求「{need_name}」，{m['trigger']}")
            elif m["type"] == "behavior_mutation":
                lines.append(f"- 行为突变：{m['dimension']} 从 {m['old']} 变为 {m['new']}，{m['trigger_point']}")
            elif m["type"] == "trigger_point":
                lines.append(f"- 触发点机制：当满足以下条件时，客户行为可能发生质变：")
                for cond in m["conditions"]:
                    lines.append(f"  · {cond}")
                lines.append(f"  效果：{m['effect']}")

        return "\n".join(lines)

    def _format_needs_detail(self, sampled_needs: List[str], customer_needs: dict) -> str:
        """格式化核心需求详情，用具体值填充占位符，无值则标记为未明确"""
        need_templates = self.profiles.get("need_templates", {})
        tag_names = self.profiles.get("tag_names", {}).get("core_needs", {})

        lines = []
        for need_id in sampled_needs:
            template = need_templates.get(need_id)
            # 统一使用中文名称
            cn_name = tag_names.get(need_id, need_id)

            if not template:
                lines.append(f"- {cn_name}：未明确")
                continue

            placeholder = template["placeholder"]
            # 占位符名（去掉 {{ }}）
            ph_key = placeholder.strip("{}").strip()

            # 优先使用外部传入的值
            if customer_needs and ph_key in customer_needs:
                value = customer_needs[ph_key]
                if value is None or value == "":
                    lines.append(f"- {cn_name}：未明确")
                else:
                    lines.append(f"- {cn_name}：{value}")
            else:
                # 未传入 → 未明确
                lines.append(f"- {cn_name}：未明确")

        return "\n".join(lines) if lines else "- 无具体需求参数"

    def generate(self, level: str, seed: int = None, customer_needs: dict = None) -> str:
        """生成一个完整的模拟客户系统提示词

        Args:
            level: 难度等级，可选 easy/medium/hard/expert
            seed: 随机种子，用于复现
            customer_needs: 客户需求具体值字典，键为占位符名（如 budget/area/layout），
                           值为具体内容。如果某键的值为 None 或空字符串，该需求标记为"未明确"。
                           未传入的键使用默认值。

        Returns:
            完整的系统提示词字符串
        """
        if seed is not None:
            random.seed(seed)

        if level not in self.profiles["levels"]:
            raise ValueError(f"无效的难度等级: {level}，可选: {list(self.profiles['levels'].keys())}")

        level_config = self.profiles["levels"][level]
        dimensions = level_config["dimensions"]
        tag_names = self.profiles.get("tag_names", {})

        # 抽取各维度标签
        sampled = {}
        for dim_key, dim_config in dimensions.items():
            sampled[dim_key] = self._sample_dimension(dim_config)

        # 应用变异机制
        mutations = self._apply_mutation(level, sampled)

        # 格式化各部分
        profile_section = self._format_profile_section(sampled, tag_names)
        behavior_section = self._format_behavior_section(level_config["behavior_params"])
        mutation_section = self._format_mutation_section(mutations)
        needs_detail_section = self._format_needs_detail(sampled.get("core_needs", []), customer_needs)

        epoch_range = level_config["epoch_range"]
        behavior = level_config["behavior_params"]
        reply_length = behavior.get("reply_length", "1-3句话")
        compromise = behavior.get("compromise_willingness", 0.5)
        bargaining = behavior.get("bargaining_probability", 0)
        leave_phone_baseline = behavior.get("leave_phone_baseline", 0.2)
        leave_phone_threshold = behavior.get("leave_phone_satisfaction_threshold", 65)
        refuse_threshold = behavior.get("refuse_threshold", 25)
        max_mismatch = behavior.get("max_mismatch_count", 4)
        leave_triggers = behavior.get("leave_phone_triggers", [])
        refuse_triggers = behavior.get("refuse_triggers", [])

        # 格式化触发条件列表
        leave_triggers_text = "\n".join([f"   - {t}" for t in leave_triggers]) if leave_triggers else "   - （无特定触发条件，按满意度阈值判断）"
        refuse_triggers_text = "\n".join([f"   - {t}" for t in refuse_triggers]) if refuse_triggers else "   - （无特定触发条件，按满意度阈值判断）"

        # 填充模板
        prompt = self.template.format(
            profile_section=profile_section,
            needs_detail_section=needs_detail_section,
            behavior_section=behavior_section,
            mutation_section=mutation_section,
            epoch_min=epoch_range[0],
            epoch_max=epoch_range[1] if epoch_range[1] < 999 else "不限",
            reply_length=reply_length,
            compromise_willingness=f"{compromise:.0%}",
            bargaining_probability=f"{bargaining:.0%}",
            leave_phone_baseline=f"{leave_phone_baseline:.0%}",
            leave_phone_satisfaction_threshold=leave_phone_threshold,
            refuse_threshold=refuse_threshold,
            max_mismatch_count=max_mismatch,
            leave_phone_triggers=leave_triggers_text,
            refuse_triggers=refuse_triggers_text,
        )

        return prompt

    def generate_to_file(self, level: str, output_path: str, seed: int = None,
                         customer_needs: dict = None) -> str:
        """生成提示词并保存到文件"""
        prompt = self.generate(level, seed=seed, customer_needs=customer_needs)
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(prompt)
        return output_path

    def generate_batch(self, level: str, count: int, output_dir: str, prefix: str = "customer",
                       customer_needs_list: List[dict] = None) -> List[str]:
        """批量生成多个客户提示词"""
        os.makedirs(output_dir, exist_ok=True)
        paths = []
        for i in range(count):
            output_path = os.path.join(output_dir, f"{prefix}_{level}_{i+1:03d}.txt")
            needs = customer_needs_list[i] if customer_needs_list and i < len(customer_needs_list) else None
            self.generate_to_file(level, output_path, customer_needs=needs)
            paths.append(output_path)
        return paths


def main():
    parser = argparse.ArgumentParser(description="租赁模拟客户提示词生成器")
    parser.add_argument("--level", type=str, default="easy",
                        choices=["easy", "medium", "hard", "expert"],
                        help="难度等级: easy(入门) / medium(中等) / hard(中高) / expert(高等)")
    parser.add_argument("--output", type=str, default="./customer_prompts/test_customer_prompt.txt",
                        help="输出文件路径（单个生成时使用）")
    parser.add_argument("--count", type=int, default=1,
                        help="生成数量（批量生成时使用）")
    parser.add_argument("--output_dir", type=str, default="./customer_prompts",
                        help="输出目录（批量生成时使用）")
    parser.add_argument("--seed", type=int, default=None,
                        help="随机种子，用于复现")
    parser.add_argument("--needs", type=str, default='{"budget": "3000", "area": "40-60平米"}',
                        help="客户需求 JSON 字符串，如 '{\"budget\": \"3000\", \"area\": \"40-60平米\"}'。"
                             "键为占位符名（如 budget/area/layout），值为具体内容。"
                             "值为 null 时该需求标记为'未明确'，未传入的键也标记为'未明确'。")

    args = parser.parse_args()

    # 解析 customer_needs（直接解析 JSON 字符串）
    customer_needs = None
    if args.needs:
        customer_needs = json.loads(args.needs)

    gen = CustomerGenerator()

    if args.count > 1:
        paths = gen.generate_batch(args.level, args.count, args.output_dir)
        print(f"已生成 {len(paths)} 个 {args.level} 难度客户提示词:")
        for p in paths:
            print(f"  - {p}")
    else:
        if args.output:
            path = gen.generate_to_file(args.level, args.output, seed=args.seed,
                                        customer_needs=customer_needs)
            print(f"已生成客户提示词: {path}")
            return path
        else:
            prompt = gen.generate(args.level, seed=args.seed, customer_needs=customer_needs)
            return prompt


if __name__ == "__main__":
    prompt = main()
