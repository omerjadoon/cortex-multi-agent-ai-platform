"""Router node: classifies the user's intent as 'rag' or 'codegen'."""

import json
import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0,
)

_SYSTEM_PROMPT = """\
You are an intent classifier. Given a user message, classify it into exactly one of two categories:
- "rag": the user is asking a question, wants information retrieved, or wants to search documents.
- "codegen": the user wants code written, generated, or a script created.

Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{"intent": "rag"}
or
{"intent": "codegen"}
"""


def route_intent(state: AgentState) -> dict:
    """Classify user intent and update state."""
    # Get the last human message
    last_message = ""
    for msg in reversed(state["messages"]):
        if hasattr(msg, "content") and msg.type in ("human", "user"):
            last_message = msg.content
            break

    if not last_message:
        # Fallback: check all messages
        last_message = state["messages"][-1].content if state["messages"] else ""

    try:
        response = _llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=last_message),
        ])
        raw = response.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        intent = parsed.get("intent", "rag")
        if intent not in ("rag", "codegen"):
            intent = "rag"
    except Exception as exc:
        logger.warning("Intent classification failed (%s), defaulting to 'rag'", exc)
        intent = "rag"

    progress_events = list(state.get("progress_events", []))
    progress_events.append({
        "step": "routing",
        "status": "done",
        "detail": f"Intent: {intent}",
    })

    return {"intent": intent, "progress_events": progress_events}
