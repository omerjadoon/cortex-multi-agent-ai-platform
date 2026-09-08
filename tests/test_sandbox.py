"""Tests for Docker-only generated-code execution."""

import subprocess

from backend.sandbox import executor


def test_docker_unavailable_fails_closed(monkeypatch):
    """Generated code must never fall back to a host subprocess."""
    monkeypatch.setattr(executor, "is_docker_available", lambda: False)

    result = executor.run_in_sandbox(
        code="raise AssertionError('this must not execute')",
        test_code="def test_never_runs(): assert False",
    )

    assert result["passed"] is False
    assert result["mode"] == "unavailable"
    assert "not executed" in result["stderr"]


def test_docker_command_has_required_isolation_controls(monkeypatch, tmp_path):
    """The Docker invocation must retain its hardening flags."""
    seen = []

    def fake_run(command, **kwargs):
        seen.append(command)
        return subprocess.CompletedProcess(command, 0, "1 passed\n", "")

    monkeypatch.setattr(executor.subprocess, "run", fake_run)
    result = executor._run_in_docker_sandbox(str(tmp_path), timeout=10, image="test-image")

    assert result["passed"] is True
    command = next(command for command in seen if command[:2] == ["docker", "run"])
    for flag in ("--network", "--read-only", "--cap-drop", "--pids-limit", "--memory", "--user", "--tmpfs"):
        assert flag in command
    assert command[command.index("--network") + 1] == "none"
    assert command[command.index("--cap-drop") + 1] == "ALL"
    assert command[command.index("--user") + 1] == "65534:65534"
    mount = command[command.index("--mount") + 1]
    assert mount.startswith("type=volume,source=openmind-sandbox-")
    assert mount.endswith(",target=/sandbox,readonly")
    assert "test-image" in command
    assert any(command[:2] == ["docker", "cp"] for command in seen)
    assert any(command[:3] == ["docker", "volume", "rm"] for command in seen)


def test_agent_test_runner_uses_docker_executor(monkeypatch):
    """The production LangGraph node must not reintroduce host subprocesses."""
    from backend.agents.nodes import testrunner

    observed = {}

    def fake_sandbox(**kwargs):
        observed.update(kwargs)
        return {
            "passed": True,
            "stdout": "1 passed\n",
            "stderr": "",
            "returncode": 0,
            "mode": "docker",
        }

    monkeypatch.setattr(testrunner, "run_in_sandbox", fake_sandbox)
    result = testrunner.run_tests({"code": "def add(a, b): return a + b", "test_code": ""})

    assert observed["timeout"] == 30
    assert result["test_output"] == "1 passed"
    assert result["progress_events"][-1]["status"] == "done"
