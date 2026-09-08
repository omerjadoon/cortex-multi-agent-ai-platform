"""Execute generated tests in short-lived, locked-down Docker containers."""

import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Optional

DEFAULT_IMAGE = "openmind-sandbox:latest"
MAX_TIMEOUT_SECONDS = 60


def is_docker_available() -> bool:
    """Return whether the Docker client can talk to a daemon."""
    if not shutil.which("docker"):
        return False
    try:
        result = subprocess.run(
            ["docker", "info"], capture_output=True, text=True, timeout=3, check=False
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _result(*, passed: bool = False, stdout: str = "", stderr: str = "", returncode: int = -1,
            mode: str = "docker") -> dict:
    return {
        "passed": passed,
        "stdout": stdout[-3000:],
        "stderr": stderr[-1000:],
        "returncode": returncode,
        "mode": mode,
    }


def _best_effort_cleanup(container_name: str, volume_name: str) -> None:
    """Remove resources even if Docker's CLI process was interrupted."""
    for command in (
        ["docker", "rm", "--force", container_name],
        ["docker", "volume", "rm", "--force", volume_name],
    ):
        try:
            subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
        except (OSError, subprocess.TimeoutExpired):
            pass


def _run_in_docker_sandbox(tmpdir: str, timeout: int = 30, image: Optional[str] = None) -> dict:
    """Run pytest with no network, capabilities, or host filesystem mount."""
    timeout = max(1, min(timeout, MAX_TIMEOUT_SECONDS))
    docker_image = image or os.environ.get("DOCKER_SANDBOX_IMAGE", DEFAULT_IMAGE)
    run_id = uuid.uuid4().hex
    container_name = f"openmind-sandbox-{run_id}"
    staging_name = f"{container_name}-staging"
    workspace_volume = f"{container_name}-workspace"

    # A host Docker daemon cannot bind-mount a path that exists only in the API
    # container. Docker cp transfers the files through the daemon API into a
    # unique named volume; the test container receives that volume read-only.
    try:
        staging = subprocess.run(
            [
                "docker", "create", "--name", staging_name,
                "--mount", f"type=volume,source={workspace_volume},target=/sandbox",
                docker_image, "python", "-c", "pass",
            ],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if staging.returncode != 0:
            return _result(stdout=staging.stdout, stderr=staging.stderr, returncode=staging.returncode)

        copied = subprocess.run(
            ["docker", "cp", f"{tmpdir}/.", f"{staging_name}:/sandbox"],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if copied.returncode != 0:
            return _result(stdout=copied.stdout, stderr=copied.stderr, returncode=copied.returncode)

        removed = subprocess.run(
            ["docker", "rm", staging_name],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if removed.returncode != 0:
            return _result(stdout=removed.stdout, stderr=removed.stderr, returncode=removed.returncode)

        cmd = [
            "docker", "run", "--rm", "--name", container_name,
            "--network", "none",
            "--read-only",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "--pids-limit", "64",
            "--memory", "256m",
            "--memory-swap", "256m",
            "--cpus", "0.5",
            "--user", "65534:65534",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
            "--mount", f"type=volume,source={workspace_volume},target=/sandbox,readonly",
            "--workdir", "/sandbox",
            "--env", "HOME=/tmp",
            "--env", "PYTHONDONTWRITEBYTECODE=1",
            "--env", "PYTEST_DISABLE_PLUGIN_AUTOLOAD=1",
            "--env", "MPLBACKEND=Agg",
            docker_image,
            "python", "-m", "pytest", "/sandbox/test_cortex_script.py",
            "-v", "--tb=short", "--no-header", "-p", "no:cacheprovider",
        ]
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5, check=False)
        return _result(passed=completed.returncode == 0, stdout=completed.stdout,
                       stderr=completed.stderr, returncode=completed.returncode)
    except subprocess.TimeoutExpired:
        return _result(stderr=f"Docker sandbox timed out after {timeout}s")
    except OSError as exc:
        return _result(stderr=f"Unable to start Docker sandbox: {exc}")
    finally:
        _best_effort_cleanup(staging_name, workspace_volume)


def run_in_sandbox(
    code: str,
    test_code: str,
    timeout: int = 30,
    use_docker: Optional[bool] = None,
) -> dict:
    """Run generated code and tests safely; host execution is never permitted."""
    if use_docker is False:
        return _result(
            stderr="Host sandbox execution is disabled. Use the Docker sandbox instead.",
            mode="disabled",
        )
    if not is_docker_available():
        return _result(
            stderr=("Docker sandbox is unavailable. Install/start Docker and build "
                    f"the {DEFAULT_IMAGE} image; generated code was not executed."),
            mode="unavailable",
        )

    with tempfile.TemporaryDirectory(prefix="openmind-sandbox-") as tmpdir:
        script_path = Path(tmpdir) / "cortex_script.py"
        test_path = Path(tmpdir) / "test_cortex_script.py"
        script_path.write_text(code, encoding="utf-8")
        test_path.write_text(
            "import sys, pathlib\n"
            "sys.path.insert(0, str(pathlib.Path(__file__).parent.resolve()))\n"
            + test_code,
            encoding="utf-8",
        )
        Path(tmpdir).chmod(0o755)
        return _run_in_docker_sandbox(tmpdir, timeout=timeout)
