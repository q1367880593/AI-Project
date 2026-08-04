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
        self.client = httpx.Client(timeout=5.0)
        self._error_shown = False  # 只显示一次错误
        self._disabled = False  # 首次失败后彻底禁用

    def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """发送对话请求"""
        if self._disabled:
            return ""
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
            self._error_shown = False  # 重置，连接恢复后可以再次提示
            return data.get("message", {}).get("content", "")
        except Exception as e:
            if not self._error_shown:
                print(f"[LLM] 本地模型不可用 ({type(e).__name__})，使用内置算法降级分析")
                self._error_shown = True
            self._disabled = True
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
            self._error_shown = False
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            if not self._error_shown:
                print(f"[LLM] API 不可用 ({type(e).__name__})，使用内置算法降级分析")
                self._error_shown = True
            self._disabled = True
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