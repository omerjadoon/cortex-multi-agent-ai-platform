"""Code generation node: produces a complete Python script from the plan."""

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
You are an expert Python software engineer. Given a design plan and user request, write a production-ready Python script.

CRITICAL INSTRUCTIONS:
- Output raw executable Python code ONLY. No markdown code blocks (no ```), no conversational filler, no explanations.
- Define clearly named functions/classes with full type annotations and docstrings.
- Do NOT embed unittest or test classes inside the script (unit tests are generated separately).
- Include defensive input validation, proper error handling (raising ValueError/TypeError where appropriate), and return values.
- Do NOT use forbidden modules or functions (subprocess, os.system, __import__).
- Always include an `if __name__ == "__main__":` block at the bottom demonstrating simple usage.
"""


def generate_code(state: AgentState) -> dict:
    """Generate a complete Python script from the plan and user request."""
    user_request = ""
    for msg in reversed(state["messages"]):
        if hasattr(msg, "content") and msg.type in ("human", "user"):
            user_request = msg.content
            break

    plan = state.get("plan", "")
    progress_events = list(state.get("progress_events", []))

    prompt = f"User request:\n{user_request}\n\nImplementation plan:\n{plan}"

    try:
        response = _llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ])
        code = response.content.strip()
        # Strip markdown fences if the model added them
        if code.startswith("```"):
            lines = code.splitlines()
            # Remove first and last fence lines
            start = 1 if lines[0].startswith("```") else 0
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            code = "\n".join(lines[start:end]).strip()
    except Exception as exc:
        logger.error("Code generation failed: %s", exc)
        code = f"# Code generation failed: {exc}\npass"

    progress_events.append({"step": "codegen", "status": "done", "detail": code})

    return {"code": code, "progress_events": progress_events}
