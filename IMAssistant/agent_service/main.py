from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .schemas import AnalyzeRequest, AnalyzeResponse, ConversationUpdateRequest, FeedbackRequest
from .service import LeadAgentService, sse_comment, sse_event


app = FastAPI(title="IMAssistant Local Lead Agent", version="0.1.0")
agent_service = LeadAgentService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "lead-agent"}


@app.post("/agent/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    return agent_service.analyze(req)


@app.post("/agent/conversation/update", response_model=AnalyzeResponse)
def conversation_update(req: ConversationUpdateRequest) -> AnalyzeResponse:
    return agent_service.update_conversation(req)


@app.get("/agent/reply/stream")
def reply_stream(conversation_id: str) -> StreamingResponse:
    def events():
        for text in agent_service.stream_reply(conversation_id):
            yield sse_event("delta", {"text": text})
        yield sse_event("done", {})

    return StreamingResponse(events(), media_type="text/event-stream")


@app.get("/agent/window/stream")
def window_stream(conversation_id: str) -> StreamingResponse:
    def events():
        yield sse_event("connected", {"conversation_id": conversation_id})
        for analysis in agent_service.stream_window(conversation_id):
            yield sse_comment("heartbeat")
            yield sse_event("analysis", analysis.model_dump())

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/agent/conversation/state")
def conversation_state(conversation_id: str) -> dict:
    return agent_service.get_state_snapshot(conversation_id)


@app.get("/agent/conversations")
def conversations() -> dict:
    return {"items": agent_service.list_conversations()}


@app.get("/monitor")
def monitor() -> FileResponse:
    return FileResponse("monitor/index.html")


@app.post("/agent/feedback")
def feedback(req: FeedbackRequest) -> dict:
    return agent_service.feedback(req.model_dump())
