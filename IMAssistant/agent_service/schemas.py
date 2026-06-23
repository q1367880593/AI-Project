from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


Stage = Literal[
    "cold_browse",
    "need_clarification",
    "property_interest",
    "comparison",
    "objection_handling",
    "visit_intent",
    "lead_capture_window",
    "churn_risk",
]

PromptLevel = Literal["none", "passive", "soft", "strong", "warning"]


class Message(BaseModel):
    sender: Literal["user", "agent"]
    content: str
    message_type: str = "text"
    timestamp: int | None = None
    referenced_property_id: str | None = None


class AnalyzeRequest(BaseModel):
    conversation_id: str
    latest_message: Message | None = None
    user_profile: dict[str, Any] = Field(default_factory=dict)
    property_context: dict[str, Any] = Field(default_factory=dict)
    recent_behaviors: list[dict[str, Any]] = Field(default_factory=list)
    conversation_history: list[Message] = Field(default_factory=list)


class ConversationUpdateRequest(BaseModel):
    conversation_id: str
    user_profile: dict[str, Any] | None = None
    property_context: dict[str, Any] | None = None
    behaviors: list[dict[str, Any]] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    conversation_id: str
    stage: Stage
    lead_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    should_prompt_agent: bool
    prompt_level: PromptLevel
    reason: str
    agent_strategy: str
    suggested_reply: str
    next_best_question: str | None = None
    missing_info: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    do_not_say: list[str] = Field(default_factory=list)
    source: Literal["rules", "ollama", "hybrid"] = "rules"


class FeedbackRequest(BaseModel):
    conversation_id: str
    suggestion_id: str | None = None
    agent_action: Literal["accepted", "modified", "ignored", "disliked", "sent"]
    final_sent_text: str | None = None
    user_left_phone: bool | None = None
    phone_left_time: int | None = None
