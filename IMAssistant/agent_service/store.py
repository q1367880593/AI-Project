from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

from .schemas import AnalyzeRequest, AnalyzeResponse, Message


@dataclass
class ConversationState:
    conversation_id: str
    user_profile: dict[str, Any] = field(default_factory=dict)
    property_context: dict[str, Any] = field(default_factory=dict)
    recent_behaviors: list[dict[str, Any]] = field(default_factory=list)
    conversation_history: list[Message] = field(default_factory=list)
    latest_analysis: AnalyzeResponse | None = None
    version: int = 0
    condition: threading.Condition = field(default_factory=threading.Condition)


class ConversationStore:
    def __init__(self) -> None:
        self._states: dict[str, ConversationState] = {}
        self._lock = threading.Lock()

    def get_or_create(self, conversation_id: str) -> ConversationState:
        with self._lock:
            state = self._states.get(conversation_id)
            if state is None:
                state = ConversationState(conversation_id=conversation_id)
            self._states[conversation_id] = state
            return state

    def list_conversation_ids(self) -> list[str]:
        with self._lock:
            return sorted(self._states.keys())

    def apply_update(
        self,
        conversation_id: str,
        user_profile: dict[str, Any] | None = None,
        property_context: dict[str, Any] | None = None,
        behaviors: list[dict[str, Any]] | None = None,
        messages: list[Message] | None = None,
        max_history: int = 50,
        max_behaviors: int = 100,
    ) -> ConversationState:
        state = self.get_or_create(conversation_id)
        with state.condition:
            if user_profile:
                state.user_profile.update(user_profile)
            if property_context:
                state.property_context.update(property_context)
            if behaviors:
                state.recent_behaviors.extend(behaviors)
                state.recent_behaviors = state.recent_behaviors[-max_behaviors:]
            if messages:
                state.conversation_history.extend(messages)
                state.conversation_history = state.conversation_history[-max_history:]
            state.version += 1
            state.condition.notify_all()
        return state

    def set_analysis(self, conversation_id: str, analysis: AnalyzeResponse) -> None:
        state = self.get_or_create(conversation_id)
        with state.condition:
            state.latest_analysis = analysis
            state.version += 1
            state.condition.notify_all()

    def build_analyze_request(self, conversation_id: str) -> AnalyzeRequest:
        state = self.get_or_create(conversation_id)
        with state.condition:
            history = list(state.conversation_history)
            latest = history[-1] if history else None
            return AnalyzeRequest(
                conversation_id=conversation_id,
                user_profile=dict(state.user_profile),
                property_context=dict(state.property_context),
                recent_behaviors=list(state.recent_behaviors),
                conversation_history=history[:-1] if latest else history,
                latest_message=latest,
            )

    def wait_for_update(self, conversation_id: str, after_version: int, timeout: float = 30.0) -> ConversationState:
        state = self.get_or_create(conversation_id)
        with state.condition:
            if state.version <= after_version:
                state.condition.wait(timeout=timeout)
            return state
