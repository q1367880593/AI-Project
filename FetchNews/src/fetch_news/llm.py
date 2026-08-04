from __future__ import annotations

import json
import urllib.request


class LLMError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: int = 90):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def generate_json(self, prompt: str) -> dict:
        payload = json.dumps(
            {"model": self.model, "prompt": prompt, "stream": False, "format": "json"},
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                outer = json.loads(response.read().decode("utf-8"))
            result = json.loads(outer.get("response", "{}"))
            if not isinstance(result, dict):
                raise ValueError("返回值不是 JSON 对象")
            return result
        except Exception as error:
            raise LLMError(f"Ollama 调用失败：{error}") from error

    def healthcheck(self) -> bool:
        request = urllib.request.Request(f"{self.base_url}/api/tags")
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                return response.status == 200
        except Exception:
            return False

