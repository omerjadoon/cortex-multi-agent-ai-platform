"""Validator node: AST syntax check + pyflakes static analysis + forbidden-import scan."""

import ast
import logging
from io import StringIO

from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

# Patterns that are never allowed in generated code
_FORBIDDEN_CALLS = {"os.system", "__import__"}
_FORBIDDEN_MODULES = {"subprocess"}  # top-level subprocess import disallowed


def _check_forbidden(tree: ast.AST) -> list[str]:
    """Walk the AST and return a list of forbidden usage descriptions."""
    errors: list[str] = []

    for node in ast.walk(tree):
        # Forbidden attribute calls: os.system(...)
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute):
                full = f"{getattr(node.func.value, 'id', '')}. {node.func.attr}".replace(" ", "")
                if full in _FORBIDDEN_CALLS:
                    errors.append(f"Forbidden call: {full}()")
            elif isinstance(node.func, ast.Name):
                if node.func.id == "__import__":
                    errors.append("Forbidden built-in: __import__()")

        # Forbidden top-level imports: import subprocess / from subprocess import ...
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.split(".")[0] in _FORBIDDEN_MODULES:
                        errors.append(f"Forbidden import: {alias.name}")
            else:
                if node.module and node.module.split(".")[0] in _FORBIDDEN_MODULES:
                    errors.append(f"Forbidden import: {node.module}")

    return errors


def validate_code(state: AgentState) -> dict:
    """Run syntax, static analysis, and security checks on the generated code."""
    code = state.get("code", "")
    progress_events = list(state.get("progress_events", []))
    errors: list[str] = []

    # 1. AST syntax check
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        errors.append(f"SyntaxError: {exc}")
        progress_events.append({
            "step": "validating",
            "status": "failed",
            "detail": "; ".join(errors),
        })
        return {"validation_errors": "; ".join(errors), "progress_events": progress_events}

    # 2. Forbidden imports / calls
    errors.extend(_check_forbidden(tree))

    # 3. pyflakes static analysis (optional — skip gracefully if not installed)
    try:
        import pyflakes.api as pyflakes_api  # type: ignore
        import pyflakes.checker  # noqa: F401 ensure available

        warning_count = pyflakes_api.check(code, "<generated>")
        # pyflakes.api.check prints to stdout; capture via StringIO trick
        # Re-run with stdout capture for details
        import sys
        old_stdout, sys.stdout = sys.stdout, StringIO()
        try:
            pyflakes_api.check(code, "<generated>")
            pyflakes_output = sys.stdout.getvalue()
        finally:
            sys.stdout = old_stdout

        if warning_count > 0 and pyflakes_output.strip():
            for line in pyflakes_output.strip().splitlines():
                errors.append(f"pyflakes: {line.strip()}")
    except ImportError:
        logger.debug("pyflakes not installed, skipping static analysis")
    except Exception as exc:
        logger.warning("pyflakes check failed: %s", exc)

    validation_errors = "; ".join(errors)
    status = "failed" if errors else "done"

    progress_events.append({
        "step": "validating",
        "status": status,
        "detail": validation_errors if errors else "All checks passed",
    })

    return {"validation_errors": validation_errors, "progress_events": progress_events}
