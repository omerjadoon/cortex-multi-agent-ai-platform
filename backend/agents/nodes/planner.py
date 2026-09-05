"""Planner node: evaluates request clarity and generates a step-by-step plan or asks for clarification."""

import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0.2,
)

_SYSTEM_PROMPT = """\
You are an expert software architect & CNC engineer. Evaluate the user's coding/G-code request carefully.

DECISION PROTOCOL:
1. IF the request is extremely vague, incomplete, or missing critical required details (e.g. "write code for my file", "mill a pocket" without dimensions/depth, or unstated target APIs/formats), start your response EXACTLY with:
   `CLARIFICATION_REQUIRED: <Specific polite question asking for the missing details>`

2. OTHERWISE (if the request provides sufficient detail or is a clear self-contained prompt), produce a clear, numbered step-by-step implementation plan. Do NOT output code yet.

Keep your output concise and direct.
"""


def plan_code(state: AgentState) -> dict:
    """Generate a structured plan or request human clarification if details are missing."""
    # Build conversation context from human messages
    user_request = ""
    for msg in reversed(state["messages"]):
        if hasattr(msg, "content") and msg.type in ("human", "user"):
            user_request = msg.content
            break

    progress_events = list(state.get("progress_events", []))

    try:
        response = _llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=f"User request: {user_request}"),
        ])
        content = response.content.strip()
    except Exception as exc:
        logger.error("Planning failed: %s", exc)
        content = "1. Implement requested logic\n2. Add error handling\n3. Provide unit test suite"

    if content.startswith("CLARIFICATION_REQUIRED:"):
        question = content.replace("CLARIFICATION_REQUIRED:", "").strip()
        progress_events.append({
            "step": "clarification",
            "status": "waiting",
            "detail": question,
        })
        return {
            "needs_clarification": True,
            "clarification_question": question,
            "final_answer": f"🤖 **Human Input Needed**: {question}",
            "progress_events": progress_events,
        }

    progress_events.append({
        "step": "planning",
        "status": "done",
        "detail": content[:150],
    })

    return {
        "needs_clarification": False,
        "clarification_question": "",
        "plan": content,
        "progress_events": progress_events,
    }
