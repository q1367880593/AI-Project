import io
import json
import os
import unittest
from unittest.mock import patch

from fetch_news.llm import LLMError, OpenAIClient


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8")
        self.status = 200

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self.payload


class OpenAIClientTests(unittest.TestCase):
    def setUp(self):
        self.client = OpenAIClient(
            "https://api.openai.com/v1",
            "gpt-5.6-sol",
            api_key_env="TEST_OPENAI_API_KEY",
        )

    def test_requires_api_key(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(LLMError, "TEST_OPENAI_API_KEY"):
                self.client.generate_json("生成 JSON")

    def test_rejects_invalid_options(self):
        with self.assertRaisesRegex(ValueError, "reasoning_effort"):
            OpenAIClient("https://api.openai.com/v1", "model", reasoning_effort="fast")
        with self.assertRaisesRegex(ValueError, "max_output_tokens"):
            OpenAIClient("https://api.openai.com/v1", "model", max_output_tokens=0)

    def test_responses_request_and_parsing(self):
        event = {
            "title_zh": "测试事件",
            "summary_zh": "这是摘要。",
            "impact_zh": "影响待观察。",
            "background_zh": "暂无背景。",
            "importance": 60,
            "credibility": 70,
            "confidence_note_zh": "单一来源。",
            "topics": ["测试"],
        }
        response = {
            "status": "completed",
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": json.dumps(event, ensure_ascii=False)}],
                }
            ],
        }
        captured = {}

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["authorization"] = request.headers["Authorization"]
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            return FakeResponse(response)

        with patch.dict(os.environ, {"TEST_OPENAI_API_KEY": "secret-key"}):
            with patch("urllib.request.urlopen", side_effect=fake_urlopen):
                result = self.client.generate_json("生成 JSON")

        self.assertEqual(result, event)
        self.assertEqual(captured["url"], "https://api.openai.com/v1/responses")
        self.assertEqual(captured["authorization"], "Bearer secret-key")
        self.assertEqual(captured["payload"]["model"], "gpt-5.6-sol")
        self.assertEqual(captured["payload"]["reasoning"], {"effort": "low"})
        output_format = captured["payload"]["text"]["format"]
        self.assertEqual(output_format["type"], "json_schema")
        self.assertTrue(output_format["strict"])

    def test_incomplete_response_is_rejected(self):
        response = {
            "status": "incomplete",
            "incomplete_details": {"reason": "max_output_tokens"},
            "output": [],
        }
        with patch.dict(os.environ, {"TEST_OPENAI_API_KEY": "secret-key"}):
            with patch("urllib.request.urlopen", return_value=FakeResponse(response)):
                with self.assertRaisesRegex(LLMError, "max_output_tokens"):
                    self.client.generate_json("生成 JSON")


if __name__ == "__main__":
    unittest.main()
