import json
import os
import uuid
from datetime import datetime

STATE_FILE = os.path.join(os.path.dirname(__file__), "task_state.json")
SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "sessions")


def new_state(project_path: str, requirement: str) -> dict:
    return {
        "session_id": str(uuid.uuid4()),
        "created_at": datetime.now().isoformat(),
        "project_path": project_path,
        "requirement": requirement,
        "tasks": [],
        "agent_outputs": {}
    }


def load_state() -> dict | None:
    if not os.path.exists(STATE_FILE):
        return None
    with open(STATE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def update_task_status(state: dict, task_type: str, status: str) -> None:
    for task in state["tasks"]:
        if task["type"] == task_type:
            task["status"] = status
            break


def set_agent_output(state: dict, agent_type: str, output: dict) -> None:
    state["agent_outputs"][agent_type] = output
    update_task_status(state, agent_type, "completed")
    save_state(state)


def get_agent_context(state: dict, agent_type: str) -> dict:
    """Build context dict for an agent from prior agents' outputs."""
    ctx = {
        "session_id": state["session_id"],
        "project_path": state["project_path"],
        "requirement": state["requirement"],
        "tasks": state["tasks"],
    }
    order = ["requirements", "code", "test", "release"]
    idx = order.index(agent_type) if agent_type in order else len(order)
    for prior in order[:idx]:
        if prior in state["agent_outputs"]:
            ctx[f"{prior}_output"] = state["agent_outputs"][prior]
    return ctx


def save_session_history(state: dict) -> str:
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(SESSIONS_DIR, f"session_{ts}_{state['session_id'][:8]}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    return path
