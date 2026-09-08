"""Test-runner node backed by the isolated Docker sandbox."""

import logging

from backend.agents.state import AgentState
from backend.sandbox.executor import run_in_sandbox

logger = logging.getLogger(__name__)


def run_tests(state: AgentState) -> dict:
    """Run generated code and tests without executing either on the backend host."""
    progress_events = list(state.get("progress_events", []))
    result = run_in_sandbox(
        code=state.get("code", ""),
        test_code=state.get("test_code", ""),
        timeout=30,
    )

    output = (result["stdout"] + result["stderr"]).strip()
    if not output:
        output = "Docker sandbox completed without output."
    status = "done" if result["passed"] else "failed"

    logger.info("Generated test execution finished in %s mode: %s", result["mode"], status)
    progress_events.append({
        "step": "testrun",
        "status": status,
        "detail": output,
    })
    return {"test_output": output, "progress_events": progress_events}
