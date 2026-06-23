from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from collections.abc import Iterator
from typing import Any


class LocalLLMClient:
    def __init__(self) -> None:
        self.provider = os.getenv("AGENT_LLM_PROVIDER", "rules").strip().lower()
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        self.timeout_seconds = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))
        self.fast_mode = os.getenv("OLLAMA_FAST_MODE", "true").strip().lower() not in ("0", "false", "no")
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "512"))
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))

    @property
    def enabled(self) -> bool:
        return self.provider == "ollama"

    def chat_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        content = self._ollama_chat(system_prompt, user_prompt, stream=False)
        if not isinstance(content, str) or not content.strip():
            return None

        return _extract_json(_strip_thinking(content))

    def stream_text(self, system_prompt: str, user_prompt: str) -> Iterator[str]:
        if not self.enabled:
            return iter(())
        return self._ollama_stream(system_prompt, user_prompt)

    def _ollama_chat(self, system_prompt: str, user_prompt: str, stream: bool) -> str | None:
        payload = {
            "model": self.ollama_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": self._format_user_prompt(user_prompt)},
            ],
            "stream": stream,
            "format": "json",
            "options": {
                "temperature": self.temperature,
                "num_predict": self.num_predict,
            },
        }
        try:
            body = _post_json(f"{self.ollama_base_url}/api/chat", payload, self.timeout_seconds)
            data = json.loads(body)
            return data.get("message", {}).get("content")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
            return None

    def _ollama_stream(self, system_prompt: str, user_prompt: str) -> Iterator[str]:
        payload = {
            "model": self.ollama_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": self._format_user_prompt(user_prompt)},
            ],
            "stream": True,
            "options": {
                "temperature": self.temperature,
                "num_predict": self.num_predict,
            },
        }
        request = urllib.request.Request(
            f"{self.ollama_base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                for raw_line in response:
                    line = raw_line.decode("utf-8").strip()
                    if not line:
                        continue
                    data = json.loads(line)
                    text = data.get("message", {}).get("content", "")
                    if text:
                        visible_text = _strip_stream_thinking(text)
                        if visible_text:
                            yield visible_text
                    if data.get("done"):
                        break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return

    def _format_user_prompt(self, user_prompt: str) -> str:
        if not self.fast_mode:
            return user_prompt
        # Qwen3 supports mode switching in chat prompts; /no_think avoids slow reasoning output.
        return f"/no_think\n{user_prompt}"


def _post_json(url: str, payload: dict[str, Any], timeout_seconds: float) -> str:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return response.read().decode("utf-8")


def _extract_json(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _strip_stream_thinking(text: str) -> str:
    # Streaming chunks may split tags; keep this conservative and remove complete tags when present.
    return _strip_thinking(text).replace("<think>", "").replace("</think>", "")
