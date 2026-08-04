"""LLM 客户端 - 支持 Ollama 和 OpenAI 兼容接口"""

import json
import os
import re
import yaml
import httpx
from typing import Optional


class LLMClient:
    """大模型客户端"""

    def __init__(self, config_path: str = "config/source.yaml"):
        with open(config_path) as f:
            config = yaml.safe_load(f)
        cfg = config.get("sources", {}).get("llm", {})

        self.provider = cfg.get("provider", "ollama")
        self.base_url = cfg.get("base_url", "http://localhost:11434")
        self.model = cfg.get("model", "qwen2.5:7b")
        self.api_key = cfg.get("api_key") or os.getenv("OPENAI_API_KEY", "")
        self.client = httpx.Client(timeout=120.0)

    def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """发送对话请求"""
        if self.provider == "ollama":
            return self._chat_ollama(system_prompt, user_prompt, temperature)
        else:
            return self._chat_openai(system_prompt, user_prompt, temperature)

    def _chat_ollama(self, system: str, user: str, temperature: float) -> str:
        try:
            resp = self.client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                    "options": {"temperature": temperature},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except Exception as e:
            print(f"[LLM/Ollama] 请求失败: {e}")
            return ""

    def _chat_openai(self, system: str, user: str, temperature: float) -> str:
        try:
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            resp = self.client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": temperature,
                },
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            print(f"[LLM/OpenAI] 请求失败: {e}")
            return ""

    def extract_json(self, text: str) -> Optional[dict]:
        """从 LLM 回复中提取 JSON"""
        if not text:
            return None
        # 尝试匹配 JSON 块
        match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if match:
            text = match.group(1).strip()
        # 尝试找第一个 { 或 [
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # 尝试提取 {...} 或 [...]
            for pattern in [r'\{[\s\S]*\}', r'\[[\s\S]*\]']:
                match = re.search(pattern, text)
                if match:
                    try:
                        return json.loads(match.group())
                    except json.JSONDecodeError:
                        continue
        return None