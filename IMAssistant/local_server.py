from __future__ import annotations

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from agent_service.schemas import AnalyzeRequest, ConversationUpdateRequest
from agent_service.service import LeadAgentService, sse_comment, sse_event


agent_service = LeadAgentService()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json({"ok": True, "service": "lead-agent-stdlib"})
            return

        if parsed.path == "/agent/reply/stream":
            query = parse_qs(parsed.query)
            conversation_id = query.get("conversation_id", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()
            for text in agent_service.stream_reply(conversation_id):
                self.wfile.write(sse_event("delta", {"text": text}).encode("utf-8"))
                self.wfile.flush()
            self.wfile.write(sse_event("done", {}).encode("utf-8"))
            self.wfile.flush()
            return

        if parsed.path == "/agent/window/stream":
            query = parse_qs(parsed.query)
            conversation_id = query.get("conversation_id", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(sse_event("connected", {"conversation_id": conversation_id}).encode("utf-8"))
            self.wfile.flush()
            for analysis in agent_service.stream_window(conversation_id):
                self.wfile.write(sse_comment("heartbeat").encode("utf-8"))
                self.wfile.write(sse_event("analysis", analysis.model_dump()).encode("utf-8"))
                self.wfile.flush()
            return

        if parsed.path == "/agent/conversation/state":
            query = parse_qs(parsed.query)
            conversation_id = query.get("conversation_id", [""])[0]
            self._send_json(agent_service.get_state_snapshot(conversation_id))
            return

        if parsed.path == "/agent/conversations":
            self._send_json({"items": agent_service.list_conversations()})
            return

        if parsed.path in ("/monitor", "/monitor/"):
            self._send_file(Path("monitor/index.html"))
            return

        if parsed.path.startswith("/monitor/"):
            self._send_file(Path(parsed.path.lstrip("/")))
            return

        self._send_json({"error": "not_found"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/agent/analyze":
            try:
                payload = self._read_json()
                req = AnalyzeRequest.model_validate(payload)
                result = agent_service.analyze(req)
                self._send_json(result.model_dump())
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=400)
            return

        if parsed.path == "/agent/conversation/update":
            try:
                payload = self._read_json()
                req = ConversationUpdateRequest.model_validate(payload)
                result = agent_service.update_conversation(req)
                self._send_json(result.model_dump())
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=400)
            return

        if parsed.path == "/agent/feedback":
            try:
                payload = self._read_json()
                self._send_json(agent_service.feedback(payload))
            except Exception as exc:
                self._send_json({"error": str(exc)}, status=400)
            return

        self._send_json({"error": "not_found"}, status=404)

    def log_message(self, format: str, *args) -> None:
        return

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self._send_json({"error": "not_found"}, status=404)
            return
        body = path.read_bytes()
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    # server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    # print("Lead Agent local server running at http://127.0.0.1:8000")

    server = ThreadingHTTPServer(("10.1.7.128", 8000), Handler)
    print("Lead Agent local server running at http://10.1.7.128:8000")

    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
