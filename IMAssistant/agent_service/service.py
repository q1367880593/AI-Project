from __future__ import annotations

import json
import time
from collections.abc import Iterator

from pydantic import ValidationError

from .llm import LocalLLMClient
from .prompts import ANALYZE_SYSTEM_PROMPT, REPLY_SYSTEM_PROMPT, build_analyze_prompt, build_reply_prompt
from .schemas import AnalyzeRequest, AnalyzeResponse, ConversationUpdateRequest
from .scoring import analyze_with_rules
from .store import ConversationStore


class LeadAgentService:
    def __init__(self, llm_client: LocalLLMClient | None = None) -> None:
        self.llm_client = llm_client or LocalLLMClient()
        self.store = ConversationStore()

    def analyze(self, req: AnalyzeRequest) -> AnalyzeResponse:
        rule_result = analyze_with_rules(req)
        result = self._try_llm_analyze(req, rule_result) or rule_result
        result = self._apply_guardrails(result, rule_result)
        self.store.set_analysis(req.conversation_id, result)
        return result

    def update_conversation(self, req: ConversationUpdateRequest) -> AnalyzeResponse:
        self.store.apply_update(
            conversation_id=req.conversation_id,
            user_profile=req.user_profile,
            property_context=req.property_context,
            behaviors=req.behaviors,
            messages=req.messages,
        )
        analyze_req = self.store.build_analyze_request(req.conversation_id)
        return self.analyze(analyze_req)

    def stream_reply(self, conversation_id: str) -> Iterator[str]:
        analysis = self.store.get_or_create(conversation_id).latest_analysis
        if not analysis:
            yield "您好，我先帮您确认下房源情况，再给您同步更准确的信息。"
            return

        if self.llm_client.enabled:
            prompt = build_reply_prompt(analysis)
            emitted = False
            for delta in self.llm_client.stream_text(REPLY_SYSTEM_PROMPT, prompt):
                emitted = True
                yield delta
            if emitted:
                return

        yield analysis.suggested_reply

    def stream_window(self, conversation_id: str) -> Iterator[AnalyzeResponse]:
        state = self.store.get_or_create(conversation_id)
        version = -1
        while True:
            state = self.store.wait_for_update(conversation_id, version)
            version = state.version
            analysis = state.latest_analysis
            if analysis is None:
                analyze_req = self.store.build_analyze_request(conversation_id)
                if analyze_req.latest_message or analyze_req.conversation_history or analyze_req.recent_behaviors:
                    analysis = self.analyze(analyze_req)
            if analysis is not None:
                yield analysis

    def get_state_snapshot(self, conversation_id: str) -> dict:
        state = self.store.get_or_create(conversation_id)
        with state.condition:
            return {
                "conversation_id": conversation_id,
                "version": state.version,
                "user_profile": state.user_profile,
                "property_context": state.property_context,
                "recent_behaviors": list(state.recent_behaviors),
                "conversation_history": [message.model_dump() for message in state.conversation_history],
                "behavior_count": len(state.recent_behaviors),
                "message_count": len(state.conversation_history),
                "latest_analysis": state.latest_analysis.model_dump() if state.latest_analysis else None,
            }

    def list_conversations(self) -> list[dict]:
        items = []
        for conversation_id in self.store.list_conversation_ids():
            snapshot = self.get_state_snapshot(conversation_id)
            latest_analysis = snapshot.get("latest_analysis") or {}
            items.append(
                {
                    "conversation_id": conversation_id,
                    "version": snapshot.get("version", 0),
                    "stage": latest_analysis.get("stage"),
                    "lead_score": latest_analysis.get("lead_score"),
                    "prompt_level": latest_analysis.get("prompt_level"),
                    "message_count": snapshot.get("message_count", 0),
                    "behavior_count": snapshot.get("behavior_count", 0),
                }
            )
        return items

    def _try_llm_analyze(self, req: AnalyzeRequest, rule_result: AnalyzeResponse) -> AnalyzeResponse | None:
        if not self.llm_client.enabled:
            return None

        prompt = build_analyze_prompt(req, rule_result)
        data = self.llm_client.chat_json(ANALYZE_SYSTEM_PROMPT, prompt)
        if not data:
            return None

        data["conversation_id"] = req.conversation_id
        data["source"] = "ollama"
        try:
            return AnalyzeResponse.model_validate(data)
        except ValidationError:
            return None

    def _apply_guardrails(self, result: AnalyzeResponse, rule_result: AnalyzeResponse) -> AnalyzeResponse:
        if "phone_refusal" in rule_result.risk_flags or "churn_risk" in rule_result.risk_flags:
            result.should_prompt_agent = False
            result.prompt_level = "warning"
            result.risk_flags = sorted(set(result.risk_flags + rule_result.risk_flags))

        if rule_result.stage == "objection_handling" and result.should_prompt_agent:
            result.should_prompt_agent = False
            result.prompt_level = "warning"
            result.reason = "用户当前仍有费用、真实性或价格顾虑，建议先处理顾虑后再判断是否留资。"

        result.lead_score = max(0, min(100, result.lead_score))
        if not result.do_not_say:
            result.do_not_say = rule_result.do_not_say
        return result

    def feedback(self, payload: dict) -> dict:
        # MVP 阶段先返回确认。生产可在这里写入埋点、日志或训练数据平台。
        return {"ok": True, "received": payload}


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def sse_comment(text: str) -> str:
    return f": {text} {int(time.time())}\n\n"
