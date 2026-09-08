"""Validator node: AST syntax check + pyflakes static analysis + forbidden-import scan + inappropriate content filter."""

import ast
import re
import logging
from io import StringIO

from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

# Patterns that are strictly disallowed in generated code for host safety
_FORBIDDEN_CALLS = {
    "os.system", "os.popen", "os.spawn", "os.exec", "os.execl", "os.execv",
    "os.execve", "os.execvp", "os.execvpe", "shutil.rmtree"
}
_FORBIDDEN_BUILTINS = {"eval", "exec", "compile", "__import__"}
_FORBIDDEN_MODULES = {"subprocess", "shutil", "socket", "ctypes", "pickle", "pty", "multiprocessing"}

# Inappropriate / profane / abusive output pattern filter
_BAD_OUTPUT_PATTERNS = [
    r"\b(fuck|shit|bitch|asshole|cunt|bastard|dick|pussy|nigger|faggot|retard|idiot|stupid|hate|kill|abuse)\b",
    r"bad\s+things",
    r"offensive\s+content",
    r"profanity",
]
_COMPILED_BAD_PATTERNS = [re.compile(p, re.IGNORECASE) for p in _BAD_OUTPUT_PATTERNS]

# System prompt / internal instruction leakage patterns
# These detect if the LLM embedded sensitive internal text into a generated script's string literals
_PROMPT_LEAK_PATTERNS = [
    r"you\s+are\s+(an\s+)?expert\s+python\s+software\s+engineer\s+for\s+openmind",
    r"you\s+are\s+(the\s+)?openmind\s+ai\s+assistant",
    r"you\s+are\s+an\s+intent\s+classifier",
    r"you\s+are\s+(an\s+)?expert\s+software\s+architect",
    r"critical\s+instructions.*output\s+raw\s+executable",
    r"safety\s+requirement.*must\s+not\s+generate",
    r"confidentiality\s+requirement",
    r"system\s+prompt.*override",
    r"reveal.*system\s+prompt",
    r"internal\s+system\s+instructions",
]
_COMPILED_LEAK_PATTERNS = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in _PROMPT_LEAK_PATTERNS]


def _check_forbidden(tree: ast.AST) -> list[str]:
    """Walk the AST and return a list of forbidden usage descriptions and inappropriate output checks."""
    errors: list[str] = []

    for node in ast.walk(tree):
        # 1. Forbidden calls & builtins
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute):
                val_id = getattr(node.func.value, 'id', '')
                full = f"{val_id}.{node.func.attr}".replace(" ", "")
                if full in _FORBIDDEN_CALLS:
                    errors.append(f"Forbidden call: {full}()")
                if val_id == "os" and node.func.attr == "environ":
                    errors.append("Forbidden access: os.environ")
            elif isinstance(node.func, ast.Name):
                if node.func.id in _FORBIDDEN_BUILTINS:
                    errors.append(f"Forbidden built-in: {node.func.id}()")

        # 2. Forbidden attribute access
        if isinstance(node, ast.Attribute):
            val_id = getattr(node.value, 'id', '')
            if val_id == "os" and node.attr == "environ":
                errors.append("Forbidden access: os.environ")

        # 3. Forbidden imports
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    mod = alias.name.split(".")[0]
                    if mod in _FORBIDDEN_MODULES:
                        errors.append(f"Forbidden import: {alias.name}")
            else:
                if node.module:
                    mod = node.module.split(".")[0]
                    if mod in _FORBIDDEN_MODULES:
                        errors.append(f"Forbidden import: {node.module}")

        # 4. Inappropriate / profane string literal check in code output
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            val = node.value
            for pattern in _COMPILED_BAD_PATTERNS:
                if pattern.search(val):
                    errors.append(f"Security Violation: Generated code contains inappropriate or offensive text output ('{val[:30]}...')")
                    break
            # 5. System prompt / internal instructions leakage check
            for pattern in _COMPILED_LEAK_PATTERNS:
                if pattern.search(val):
                    errors.append(f"Security Violation: Generated code contains internal system prompt or instruction content. Request refused.")
                    break

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

    # 2. Forbidden imports / calls / inappropriate strings
    errors.extend(_check_forbidden(tree))

    # 3. pyflakes static analysis (critical errors only: undefined name / syntax)
    try:
        import pyflakes.api as pyflakes_api  # type: ignore
        import pyflakes.checker  # noqa: F401 ensure available
        import sys
        old_stdout, sys.stdout = sys.stdout, StringIO()
        try:
            warning_count = pyflakes_api.check(code, "<generated>")
            pyflakes_output = sys.stdout.getvalue()
        finally:
            sys.stdout = old_stdout

        if warning_count > 0 and pyflakes_output.strip():
            for line in pyflakes_output.strip().splitlines():
                line_str = line.strip()
                # Only treat critical undefined name or syntax failures as validation errors
                if "undefined name" in line_str.lower() or "syntax error" in line_str.lower():
                    errors.append(f"pyflakes: {line_str}")
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
