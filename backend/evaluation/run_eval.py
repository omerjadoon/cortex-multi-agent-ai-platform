"""CLI runner script for executing Cortex DeepEval evaluations with Groq API."""

import sys
import subprocess
import argparse


def run_evaluations(test_suite: str = "all", verbose: bool = True):
    """Executes DeepEval test suites using pytest CLI with Groq judge."""
    cmd = ["pytest"]
    
    if verbose:
        cmd.append("-v")
        
    if test_suite == "rag":
        cmd.append("backend/evaluation/test_rag.py")
    elif test_suite == "codegen":
        cmd.append("backend/evaluation/test_codegen.py")
    elif test_suite == "router":
        cmd.append("backend/evaluation/test_router.py")
    else:
        cmd.append("backend/evaluation/")

    print(f"Executing DeepEval evaluation command: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    sys.exit(result.returncode)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Cortex LLM evaluation suite using DeepEval & Groq.")
    parser.add_argument(
        "--suite",
        type=str,
        choices=["all", "rag", "codegen", "router"],
        default="all",
        help="Specific evaluation test suite to run (default: all)",
    )
    args = parser.parse_args()
    run_evaluations(test_suite=args.suite)
