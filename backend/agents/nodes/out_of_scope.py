"""Out of scope node: handles general queries unrelated to OpenMind or Python script generation."""

import logging
from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

POLITE_OUT_OF_SCOPE_RESPONSE = (
    "I am the OpenMind AI assistant. I can only help if you have questions related to OpenMind "
    "or want to generate a Python script. How can I assist you with OpenMind or Python programming today?"
)


def handle_out_of_scope(state: AgentState) -> dict:
    """Politely decline out-of-scope queries and remind user of capabilities."""
    progress_events = list(state.get("progress_events", []))
    progress_events.append({
        "step": "out_of_scope",
        "status": "done",
        "detail": "Politely declined query outside OpenMind / Python code scope",
    })

    return {
        "final_answer": POLITE_OUT_OF_SCOPE_RESPONSE,
        "progress_events": progress_events,
    }
