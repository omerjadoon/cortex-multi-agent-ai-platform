"""Unit tests for AST static code validator and security checks."""

import ast
from backend.agents.nodes.validator import _check_forbidden, validate_code


def test_validator_blocks_eval_exec():
    """Verify builtins eval and exec are flagged as forbidden."""
    code_eval = "x = eval('1 + 1')"
    tree_eval = ast.parse(code_eval)
    errors_eval = _check_forbidden(tree_eval)
    assert any("eval" in err for err in errors_eval)

    code_exec = "exec('import os')"
    tree_exec = ast.parse(code_exec)
    errors_exec = _check_forbidden(tree_exec)
    assert any("exec" in err for err in errors_exec)


def test_validator_blocks_subprocess_import():
    """Verify subprocess module import is forbidden."""
    code = "import subprocess\nsubprocess.run(['ls'])"
    tree = ast.parse(code)
    errors = _check_forbidden(tree)
    assert any("subprocess" in err for err in errors)


def test_validator_blocks_os_system_and_environ():
    """Verify os.system call and os.environ access are forbidden."""
    code_system = "import os\nos.system('rm -rf /')"
    tree_system = ast.parse(code_system)
    errors_system = _check_forbidden(tree_system)
    assert any("os.system" in err for err in errors_system)

    code_env = "import os\nsecret = os.environ.get('GROQ_API_KEY')"
    tree_env = ast.parse(code_env)
    errors_env = _check_forbidden(tree_env)
    assert any("os.environ" in err for err in errors_env)


def test_validator_allows_safe_code():
    """Verify standard data structures and math functions pass validation."""
    code = """
import math

def calculate_stats(numbers):
    total = sum(numbers)
    mean = total / len(numbers)
    return {"mean": mean, "sqrt": math.sqrt(mean)}
"""
    state = {"code": code, "progress_events": []}
    result = validate_code(state)
    assert result["validation_errors"] == ""
