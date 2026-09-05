"""Test runner node: writes code to /tmp and runs pytest."""

import os
import subprocess
import logging
import tempfile
import sys

from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

# Use a stable temp directory prefix so we can name files predictably
_TMP_DIR = tempfile.gettempdir()
_SCRIPT_PATH = os.path.join(_TMP_DIR, "cortex_script.py")
_TEST_PATH = os.path.join(_TMP_DIR, "cortex_test.py")


def run_tests(state: AgentState) -> dict:
    """Write generated code and tests to disk, then execute pytest."""
    code = state.get("code", "")
    test_code = state.get("test_code", "")
    progress_events = list(state.get("progress_events", []))

    # Write the main script
    try:
        with open(_SCRIPT_PATH, "w", encoding="utf-8") as f:
            f.write(code)
    except OSError as exc:
        err = f"Failed to write script: {exc}"
        logger.error(err)
        progress_events.append({"step": "testrun", "status": "failed", "detail": err})
        return {"test_output": err, "progress_events": progress_events}

    # Write the test file (inject sys.path so cortex_script is importable)
    path_inject = (
        f"import sys, os\n"
        f"sys.path.insert(0, {repr(_TMP_DIR)})\n\n"
    )
    try:
        with open(_TEST_PATH, "w", encoding="utf-8") as f:
            f.write(path_inject + test_code)
    except OSError as exc:
        err = f"Failed to write test file: {exc}"
        logger.error(err)
        progress_events.append({"step": "testrun", "status": "failed", "detail": err})
        return {"test_output": err, "progress_events": progress_events}

    # Run pytest
    output = ""
    try:
        result = subprocess.run(
            [
                sys.executable, "-m", "pytest",
                _TEST_PATH,
                "-v",
                "--tb=short",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = (result.stdout + result.stderr).strip()
        passed = result.returncode == 0
    except subprocess.TimeoutExpired:
        output = "pytest timed out after 60 seconds"
        passed = False
    except Exception as exc:
        output = f"pytest execution error: {exc}"
        passed = False

    status = "done" if passed else "failed"

    progress_events.append({
        "step": "testrun",
        "status": status,
        "detail": output[-500:],
    })

    return {"test_output": output, "progress_events": progress_events}
