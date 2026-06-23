from __future__ import annotations

import re
from dataclasses import dataclass, field

from .schemas import AnalyzeRequest, AnalyzeResponse, Message, Stage


PHONE_RE = re.compile(r"(1[3-9]\d{9})|(\d{3,4}[- ]?\d{7,8})")

VISIT_KEYWORDS = ("看房", "能看", "约看", "什么时候", "周末", "今天", "明天", "有空", "方便看")
OBJECTION_KEYWORDS = ("中介费", "押一付", "押金", "费用", "真假", "真实", "假房源", "能便宜", "贵")
COMPARISON_KEYWORDS = ("还有", "类似", "对比", "哪个好", "别的", "附近")
PROPERTY_INTEREST_KEYWORDS = ("还在", "几楼", "朝向", "地铁", "多远", "面积", "户型", "价格")
CHURN_KEYWORDS = ("算了", "不用了", "再看看", "太贵", "不考虑", "不需要")
REFUSAL_KEYWORDS = ("不留", "不方便留", "不想留", "别打电话", "不要电话")


@dataclass
class RuleSignals:
    score: int = 0
    reasons: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)
    missing_info: list[str] = field(default_factory=list)
    has_visit_intent: bool = False
    has_objection: bool = False
    has_refusal: bool = False
    has_churn: bool = False
    agent_already_answered: bool = False


def analyze_with_rules(req: AnalyzeRequest) -> AnalyzeResponse:
    messages = _messages(req)
    text = "\n".join(m.content for m in messages)
    latest_user_text = _latest_text(messages, "user")
    latest_agent_text = _latest_text(messages, "agent")

    signals = RuleSignals(score=20)
    _score_behaviors(req, signals)
    _score_profile_match(req, signals)
    _score_conversation(text, latest_user_text, latest_agent_text, signals)

    stage = _stage_from_signals(latest_user_text, text, signals)
    _infer_missing_info(req, text, signals)

    lead_score = max(0, min(100, signals.score))
    should_prompt = _should_prompt(stage, lead_score, signals)
    prompt_level = _prompt_level(stage, lead_score, should_prompt, signals)

    reason = _reason(stage, signals)
    strategy, reply, next_question = _strategy_and_reply(stage, req, signals)

    return AnalyzeResponse(
        conversation_id=req.conversation_id,
        stage=stage,
        lead_score=lead_score,
        confidence=_confidence(stage, signals),
        should_prompt_agent=should_prompt,
        prompt_level=prompt_level,
        reason=reason,
        agent_strategy=strategy,
        suggested_reply=reply,
        next_best_question=next_question,
        missing_info=signals.missing_info,
        risk_flags=signals.risk_flags,
        do_not_say=[
            "不留电话不能看房",
            "先留电话再说",
            "反复催促用户留手机号",
        ],
        source="rules",
    )


def _messages(req: AnalyzeRequest) -> list[Message]:
    messages = list(req.conversation_history)
    if req.latest_message:
        messages.append(req.latest_message)
    return messages


def _latest_text(messages: list[Message], sender: str) -> str:
    for message in reversed(messages):
        if message.sender == sender:
            return message.content
    return ""


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _score_behaviors(req: AnalyzeRequest, signals: RuleSignals) -> None:
    behavior_scores = {
        "im_start": 15,
        "click_agent_booth": 10,
        "favorite": 10,
        "view_vr": 8,
        "view_floor_plan": 8,
        "view_map": 8,
        "repeat_visit": 12,
        "compare": 8,
    }
    for behavior in req.recent_behaviors:
        event_type = str(behavior.get("type", ""))
        delta = behavior_scores.get(event_type, 0)
        if delta:
            signals.score += delta
            signals.reasons.append(f"存在高意向行为：{event_type}")
        if event_type == "property_view" and int(behavior.get("duration_seconds", 0) or 0) >= 30:
            signals.score += 5
            signals.reasons.append("当前房源浏览时长较长")


def _score_profile_match(req: AnalyzeRequest, signals: RuleSignals) -> None:
    profile = req.user_profile
    prop = req.property_context

    budget = profile.get("budget_range")
    price = prop.get("price")
    if isinstance(budget, list) and len(budget) == 2 and isinstance(price, (int, float)):
        if budget[0] <= price <= budget[1]:
            signals.score += 10
            signals.reasons.append("房源价格匹配用户预算")

    if profile.get("target_area") and profile.get("target_area") == prop.get("district"):
        signals.score += 10
        signals.reasons.append("房源区域匹配用户偏好")

    if profile.get("room_type_preference") and profile.get("room_type_preference") == prop.get("layout"):
        signals.score += 8
        signals.reasons.append("房源户型匹配用户偏好")

    if profile.get("move_in_time"):
        signals.score += 8
        signals.reasons.append("用户已有入住时间信息")


def _score_conversation(text: str, latest_user_text: str, latest_agent_text: str, signals: RuleSignals) -> None:
    if _contains_any(latest_user_text, VISIT_KEYWORDS):
        signals.score += 25
        signals.has_visit_intent = True
        signals.reasons.append("用户询问看房时间，存在明确行动意图")

    if _contains_any(latest_user_text, OBJECTION_KEYWORDS):
        signals.score += 4
        signals.has_objection = True
        signals.risk_flags.append("objection_or_fee_concern")
        signals.reasons.append("用户正在关注费用、真实性或价格顾虑")

    if _contains_any(latest_user_text, COMPARISON_KEYWORDS):
        signals.score += 12
        signals.reasons.append("用户要求推荐或比较房源")

    if _contains_any(latest_user_text, PROPERTY_INTEREST_KEYWORDS):
        signals.score += 8
        signals.reasons.append("用户对房源细节有兴趣")

    if _contains_any(latest_user_text, REFUSAL_KEYWORDS):
        signals.score -= 30
        signals.has_refusal = True
        signals.risk_flags.append("phone_refusal")
        signals.reasons.append("用户已表达不愿留电话")

    if _contains_any(latest_user_text, CHURN_KEYWORDS):
        signals.score -= 18
        signals.has_churn = True
        signals.risk_flags.append("churn_risk")
        signals.reasons.append("用户出现流失信号")

    if PHONE_RE.search(text):
        signals.score = 100
        signals.reasons.append("会话中已出现手机号")

    if latest_agent_text and any(k in latest_agent_text for k in ("可以", "我帮您确认", "这套", "费用", "目前")):
        signals.agent_already_answered = True
        signals.score += 6


def _stage_from_signals(latest_user_text: str, text: str, signals: RuleSignals) -> Stage:
    if PHONE_RE.search(text):
        return "lead_capture_window"
    if signals.has_refusal or signals.has_churn:
        return "churn_risk"
    if signals.has_objection and not signals.has_visit_intent:
        return "objection_handling"
    if signals.has_visit_intent:
        return "visit_intent"
    if _contains_any(latest_user_text, COMPARISON_KEYWORDS):
        return "comparison"
    if _contains_any(latest_user_text, PROPERTY_INTEREST_KEYWORDS):
        return "property_interest"
    if latest_user_text:
        return "need_clarification"
    return "cold_browse"


def _infer_missing_info(req: AnalyzeRequest, text: str, signals: RuleSignals) -> None:
    profile = req.user_profile
    checks = [
        ("预算", profile.get("budget_range") or ("预算" in text)),
        ("目标区域", profile.get("target_area") or ("附近" in text) or ("地铁" in text)),
        ("入住时间", profile.get("move_in_time") or ("入住" in text) or ("周末" in text)),
    ]
    signals.missing_info = [name for name, exists in checks if not exists]


def _should_prompt(stage: Stage, lead_score: int, signals: RuleSignals) -> bool:
    if signals.has_refusal or signals.has_churn:
        return False
    if stage == "visit_intent" and lead_score >= 70:
        return True
    if stage == "lead_capture_window" and lead_score >= 75:
        return True
    if stage == "comparison" and lead_score >= 75:
        return True
    return False


def _prompt_level(stage: Stage, lead_score: int, should_prompt: bool, signals: RuleSignals) -> str:
    if signals.has_refusal or signals.has_churn or (signals.has_objection and lead_score < 70):
        return "warning"
    if should_prompt and lead_score >= 75:
        return "strong"
    if lead_score >= 60:
        return "soft"
    if lead_score >= 40:
        return "passive"
    return "none"


def _reason(stage: Stage, signals: RuleSignals) -> str:
    if signals.reasons:
        priority = []
        if signals.has_visit_intent:
            priority.append("用户询问看房时间，存在明确行动意图")
        if signals.has_objection:
            priority.append("用户正在关注费用、真实性或价格顾虑")
        if signals.has_refusal:
            priority.append("用户已表达不愿留电话")
        if signals.has_churn:
            priority.append("用户出现流失信号")
        merged = list(dict.fromkeys(priority + signals.reasons))
        return "；".join(merged[:3]) + "。"
    reasons = {
        "cold_browse": "用户暂无明确找房意图，建议先提供基础信息。",
        "need_clarification": "用户已有咨询动作，但关键需求仍不完整。",
        "property_interest": "用户正在了解房源细节，可先回答问题并继续澄清需求。",
        "comparison": "用户正在比较或请求推荐，可体现经纪人的筛选价值。",
        "objection_handling": "用户存在费用、真实性或价格顾虑，应先处理顾虑。",
        "visit_intent": "用户出现看房意向，适合以确认看房安排为理由引导留资。",
        "lead_capture_window": "当前留资理由自然成立，可以提示经纪人引导留资。",
        "churn_risk": "用户出现拒绝或流失信号，不宜继续催促留资。",
    }
    return reasons[stage]


def _strategy_and_reply(stage: Stage, req: AnalyzeRequest, signals: RuleSignals) -> tuple[str, str, str | None]:
    prop_name = req.property_context.get("community") or "这套"
    if stage in ("visit_intent", "lead_capture_window"):
        return (
            "先回应用户看房诉求，再用确认看房安排作为理由引导留手机号。",
            f"{prop_name}可以帮您约看，我先确认下房东和钥匙时间。方便留个电话吗？确认好后我第一时间同步您。",
            None,
        )
    if stage == "comparison":
        return (
            "先承接用户的比较需求，用整理匹配房源作为低压留资理由。",
            "您刚才提到的需求我了解了，我可以帮您把附近几套更匹配的整理一下。方便的话留个电话，筛好后我直接同步您。",
            None,
        )
    if stage == "objection_handling":
        return (
            "先解释用户关心的费用、真实性或价格问题，暂缓索要手机号。",
            "我先把费用和看房情况跟您说清楚，避免您白跑。您觉得合适的话，我们再约具体看房时间，不着急。",
            "您更关注总月租，还是付款方式灵活一些？",
        )
    if stage == "churn_risk":
        return (
            "降低压迫感，提供替代选择或后续轻量跟进，不建议继续索要手机号。",
            "没关系，我再帮您看看有没有价格或位置更合适的，有合适的我在这里发您参考。",
            None,
        )
    return (
        "先补齐关键需求，再根据用户反馈判断是否进入留资窗口。",
        "这套目前我先帮您看下情况。您这边大概什么时候入住？预算和通勤范围方便说一下吗？我可以按您的需求一起筛。",
        "您这边大概什么时候入住？",
    )


def _confidence(stage: Stage, signals: RuleSignals) -> float:
    base = 0.62
    if signals.has_visit_intent:
        base += 0.22
    if signals.has_refusal or signals.has_churn:
        base += 0.18
    if signals.has_objection:
        base += 0.10
    if stage in ("need_clarification", "cold_browse"):
        base -= 0.06
    return round(max(0.45, min(0.92, base)), 2)
