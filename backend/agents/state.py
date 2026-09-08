from dataclasses import dataclass, field
from typing import Any, Optional
from langgraph.graph import MessagesState


class AgentState(MessagesState):
    # user context
    user_id: str = ""
    thread_id: str = ""
    role: str = ""
    allowed_collections: list[str] = field(default_factory=list)

    # routing
    intent: str = ""  # "rag", "codegen", or "out_of_scope"

    # RAG
    retrieved_chunks: list[dict] = field(default_factory=list)

    # Code agent (ReAct)
    plan: str = ""
    code: str = ""
    test_code: str = ""
    test_output: str = ""
    validation_errors: str = ""
    retry_count: int = 0
    max_retries: int = 3

    # Progress events emitted per node
    progress_events: list[dict] = field(default_factory=list)

    # Human in the Loop (HITL)
    needs_clarification: bool = False
    clarification_question: str = ""

    # Final answer
    final_answer: str = ""
    final_code: str = ""
    error: str = ""


def get_last_user_message(state: AgentState | dict) -> str:
    """Extract the last human/user text message from state (handles both dict and BaseMessage objects)."""
    messages = state.get("messages", []) if isinstance(state, dict) else getattr(state, "messages", [])
    for msg in reversed(messages):
        if isinstance(msg, dict):
            role = str(msg.get("type") or msg.get("role") or "").lower()
            content = msg.get("content") or ""
            if role in ("human", "user") and content:
                return str(content)
        elif hasattr(msg, "content"):
            role = str(getattr(msg, "type", getattr(msg, "role", ""))).lower()
            content = getattr(msg, "content", "")
            if role in ("human", "user") and content:
                return str(content)

    if messages:
        last = messages[-1]
        if isinstance(last, dict):
            return str(last.get("content", ""))
        return str(getattr(last, "content", ""))
    return ""
