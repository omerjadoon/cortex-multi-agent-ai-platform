"""Fixer node: repairs code based on test failures or validation errors."""

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
You are an expert Python debugger. You will be given a Python script that has errors,
along with the error output. Fix the code so that all tests pass.

Requirements:
- Output ONLY the corrected Python code — no explanations, no markdown fences.
- Preserve the original intent and structure as much as possible.
- Do NOT use os.system(), subprocess for shell execution, or __import__().
- Ensure the fixed code is syntactically valid.
"""


def fix_code(state: AgentState) -> dict:
    """Increment retry count and attempt to fix the broken code."""
    retry_count = state.get("retry_count", 0) + 1
    code = state.get("code", "")
    test_output = state.get("test_output", "")
    validation_errors = state.get("validation_errors", "")
    progress_events = list(state.get("progress_events", []))

    # Combine all available error context
    error_context_parts = []
    if validation_errors:
        error_context_parts.append(f"Validation errors:\n{validation_errors}")
    if test_output:
        error_context_parts.append(f"Test output:\n{test_output[-2000:]}")
    error_context = "\n\n".join(error_context_parts) or "Unknown error"

    prompt = (
        f"Original code:\n\n{code}\n\n"
        f"Error information:\n\n{error_context}\n\n"
        f"Please fix the code."
    )

    try:
        response = _llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ])
        fixed_code = response.content.strip()
        # Strip markdown fences if present
        if fixed_code.startswith("```"):
            lines = fixed_code.splitlines()
            start = 1 if lines[0].startswith("```") else 0
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            fixed_code = "\n".join(lines[start:end]).strip()
    except Exception as exc:
        logger.error("Code fixing failed: %s", exc)
        fixed_code = code  # Keep original if fix fails

    progress_events.append({
        "step": "fixing",
        "status": "done",
        "detail": f"Retry {retry_count}",
    })

    return {
        "code": fixed_code,
        "retry_count": retry_count,
        # Reset validation errors so validator re-runs cleanly
        "validation_errors": "",
        "progress_events": progress_events,
    }
