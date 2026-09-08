"""Planner node: evaluates request clarity and generates a step-by-step plan or asks for clarification."""

import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState, get_last_user_message

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0.2,
)

_SYSTEM_PROMPT = """\
You are an expert software architect & Python engineer. Evaluate the user's coding request and create a step-by-step implementation plan.

DECISION PROTOCOL:
- DEFAULT POLICY: Make sensible, best-practice assumptions and proceed immediately with a step-by-step implementation plan.
- Human clarification is STRICTLY OPTIONAL and should be skipped for self-contained, standard, or simple requests (e.g. "generate a script that print hello world", "calculate fibonacci", "write a python function").
- ONLY request clarification (`CLARIFICATION_REQUIRED: <question>`) if the request is completely blank, uninterpretable, or 100% impossible to proceed with writing code.

Keep your output concise and direct. Do NOT output Python code yet—only the numbered implementation steps.
"""


def plan_code(state: AgentState) -> dict:
    """Generate a structured plan or request human clarification if details are missing."""
    user_request = get_last_user_message(state)
    progress_events = list(state.get("progress_events", []))

    try:
        response = _llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=f"User request: {user_request}"),
        ])
        content = response.content.strip()
    except Exception as exc:
        logger.error("Planning failed: %s", exc)
        content = f"1. Parse requirements for: {user_request}\n2. Write Python script logic\n3. Validate execution and error handling"

    # Override clarification requirement if request is self-contained or standard
    if content.startswith("CLARIFICATION_REQUIRED:"):
        lower_req = user_request.lower()
        if len(user_request.strip()) > 3 and not any(w in lower_req for w in ["???", "unclear"]):
            logger.info("Overriding clarification requirement to skip prompt interruption for: %s", user_request[:60])
            content = f"1. Parse task requirement for: '{user_request}'\n2. Write executable Python script\n3. Add basic output validation"

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
        "detail": content,
    })

    return {
        "needs_clarification": False,
        "clarification_question": "",
        "plan": content,
        "progress_events": progress_events,
    }
