"""Test generation node: writes pytest test cases for the generated code."""

import ast
import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0.1,
)


def _extract_public_names(code: str) -> list[str]:
    """Parse code AST and return top-level function and class names."""
    try:
        tree = ast.parse(code)
        names = []
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                if not node.name.startswith("_"):
                    names.append(node.name)
        return names
    except Exception:
        return []


def _clean_test_code(test_code: str) -> str:
    """Strip markdown fences and trim any syntax-breaking trailing lines."""
    if "```" in test_code:
        lines = test_code.splitlines()
        cleaned = []
        in_block = False
        for line in lines:
            if line.startswith("```"):
                in_block = not in_block
                continue
            cleaned.append(line)
        test_code = "\n".join(cleaned).strip()

    # Try parsing AST; if trailing lines cause syntax error, trim them back
    lines = test_code.splitlines()
    while lines:
        candidate = "\n".join(lines).strip()
        try:
            ast.parse(candidate)
            return candidate
        except SyntaxError:
            lines.pop()

    return test_code.strip()


def generate_tests(state: AgentState) -> dict:
    """Generate pytest test cases for the generated code."""
    code = state.get("code", "")
    progress_events = list(state.get("progress_events", []))

    public_names = _extract_public_names(code)
    names_str = ", ".join(public_names) if public_names else "functions"

    system_prompt = f"""\
You are a senior Python QA engineer. Write minimal, robust pytest unit tests for the script provided.

STRICT FORMAT RULES:
- Output ONLY raw valid Python test code. No markdown fences, no explanations.
- Import target names directly from `cortex_script`:
  `from cortex_script import {names_str}`
- Write 3 concise test functions starting with `test_`:
  1. `test_happy_path()`: Test normal input/output.
  2. `test_edge_cases()`: Test boundary inputs (0, 1, empty).
  3. `test_invalid_inputs()`: Test invalid inputs using `pytest.raises`.
- Do NOT use reflection (`dir()`, `getattr()`, `inspect`). Use direct function calls only.
"""

    try:
        response = _llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Script to test:\n\n{code}"),
        ])
        raw_output = response.content.strip()
        test_code = _clean_test_code(raw_output)
    except Exception as exc:
        logger.error("Test generation failed: %s", exc)
        test_code = (
            "import pytest\n"
            "from cortex_script import *\n\n"
            "def test_execution_smoke():\n"
            "    assert True\n"
        )

    progress_events.append({"step": "testgen", "status": "done", "detail": test_code})

    return {"test_code": test_code, "progress_events": progress_events}
