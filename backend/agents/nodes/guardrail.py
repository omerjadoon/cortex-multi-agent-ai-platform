"""Guardrail node for LangGraph agent pipeline: checks user input for prompt injection."""

import asyncio
import logging
from backend.agents.state import AgentState
from backend.security.guardrails import guardrail_manager

logger = logging.getLogger(__name__)


def guardrail_check(state: AgentState) -> dict:
    """Run NeMo Guardrails & input security checks before agent routing."""
    # Extract last human message
    last_message = ""
    for msg in reversed(state.get("messages", [])):
        if hasattr(msg, "content") and msg.type in ("human", "user"):
            last_message = msg.content
            break

    if not last_message and state.get("messages"):
        last_message = state["messages"][-1].content if hasattr(state["messages"][-1], "content") else ""

    progress_events = list(state.get("progress_events", []))

    try:
        # Run async evaluation synchronously inside node
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # In an existing event loop, create task or execute heuristic check directly
            is_blocked, reason = guardrail_manager.evaluate_input_sync(last_message)
        else:
            is_blocked, reason = loop.run_until_complete(guardrail_manager.evaluate_input(last_message))
    except Exception:
        # Fallback to sync heuristic check
        from backend.security.guardrails import check_heuristic_prompt_injection
        is_blocked = check_heuristic_prompt_injection(last_message)
        reason = "Heuristic check flagged potential prompt injection." if is_blocked else "Passed fallback guardrail check."

    if is_blocked:
        progress_events.append({
            "step": "guardrail",
            "status": "failed",
            "detail": f"BLOCKED: {reason}",
        })
        return {
            "error": reason,
            "final_answer": f"[Security Alert] {reason}",
            "progress_events": progress_events,
        }

    progress_events.append({
        "step": "guardrail",
        "status": "done",
        "detail": "Passed NeMo Guardrails security check",
    })
    return {"progress_events": progress_events}
