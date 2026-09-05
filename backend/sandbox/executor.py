import subprocess
import tempfile
import os
from pathlib import Path

ALLOWED_IMPORTS = {
    "os", "sys", "json", "csv", "re", "math", "datetime", "time",
    "collections", "itertools", "functools", "pathlib", "typing",
    "dataclasses", "abc", "enum", "logging", "io", "copy", "random",
    "pandas", "numpy", "matplotlib", "seaborn", "requests",
    "sklearn", "scipy", "PIL", "pytest",
}


def run_in_sandbox(code: str, test_code: str, timeout: int = 30) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "cortex_script.py"
        test_path = Path(tmpdir) / "test_cortex_script.py"

        script_path.write_text(code, encoding="utf-8")

        # Prepend sys.path injection so the test can import the script
        full_test = (
            f"import sys\nsys.path.insert(0, {repr(tmpdir)})\n"
            + test_code
        )
        test_path.write_text(full_test, encoding="utf-8")

        safe_env = {
            **os.environ,
            "PYTHONPATH": tmpdir,
            "MPLBACKEND": "Agg",  # non-interactive matplotlib backend
        }

        try:
            result = subprocess.run(
                [
                    "python", "-m", "pytest",
                    str(test_path),
                    "-v", "--tb=short",
                    f"--timeout={timeout}",
                    "--no-header",
                ],
                capture_output=True,
                text=True,
                timeout=timeout + 15,
                cwd=tmpdir,
                env=safe_env,
            )
            return {
                "passed": result.returncode == 0,
                "stdout": result.stdout[-3000:],
                "stderr": result.stderr[-1000:],
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {
                "passed": False,
                "stdout": "",
                "stderr": f"Test execution timed out after {timeout + 15}s",
                "returncode": -1,
            }
        except Exception as exc:
            return {
                "passed": False,
                "stdout": "",
                "stderr": str(exc),
                "returncode": -1,
            }
