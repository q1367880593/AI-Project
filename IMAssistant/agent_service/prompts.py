from __future__ import annotations

import json

from .schemas import AnalyzeRequest, AnalyzeResponse


ANALYZE_SYSTEM_PROMPT = """你是房产 IM 场景中的经纪人辅助助手。
你的任务是判断当前是否适合引导用户留下手机号，并给经纪人生成自然、合规、低打扰的回复建议。

约束：
1. 先判断用户当前阶段。
2. 不要在用户问题未被回答前建议索要手机号。
3. 不要在用户表达拒绝或反感后继续催促。
4. 留资必须有合理理由，例如约看、确认房源状态、整理推荐、同步价格。
5. 不得承诺无法保证的事项。
6. 只输出 JSON，不要输出 Markdown。
"""


REPLY_SYSTEM_PROMPT = """你是房产经纪人的 IM 话术助手。
根据当前会话阶段和策略，生成一句自然、简短、低压的中文回复。
不要输出解释，不要使用 Markdown。
"""


def build_analyze_prompt(req: AnalyzeRequest, rule_result: AnalyzeResponse) -> str:
    payload = {
        "user_profile": req.user_profile,
        "property_context": req.property_context,
        "recent_behaviors": req.recent_behaviors,
        "conversation_history": [m.model_dump() for m in req.conversation_history],
        "latest_message": req.latest_message.model_dump() if req.latest_message else None,
        "rule_reference": rule_result.model_dump(),
        "required_output_schema": {
            "stage": "cold_browse|need_clarification|property_interest|comparison|objection_handling|visit_intent|lead_capture_window|churn_risk",
            "lead_score": "0-100 integer",
            "confidence": "0-1 number",
            "should_prompt_agent": "boolean",
            "prompt_level": "none|passive|soft|strong|warning",
            "reason": "string",
            "agent_strategy": "string",
            "suggested_reply": "string",
            "next_best_question": "string|null",
            "missing_info": "string[]",
            "risk_flags": "string[]",
            "do_not_say": "string[]",
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def build_reply_prompt(analysis: AnalyzeResponse) -> str:
    payload = {
        "stage": analysis.stage,
        "lead_score": analysis.lead_score,
        "reason": analysis.reason,
        "agent_strategy": analysis.agent_strategy,
        "reference_reply": analysis.suggested_reply,
        "requirements": [
            "一句话即可",
            "先回应用户诉求",
            "如需留电话，必须给出自然服务理由",
            "不要强迫，不要夸大承诺",
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)
