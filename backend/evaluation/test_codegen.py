"""DeepEval Code Generation Pipeline evaluation test suite for Cortex using Groq API."""

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, SingleTurnParams
from deepeval.metrics import GEval

from backend.agents.graph import graph
from backend.evaluation.groq_model import GroqEvalModel
from backend.evaluation.datasets import CODEGEN_EVAL_DATASET


# Initialize Groq judge model
eval_model = GroqEvalModel(model_name="llama-3.3-70b-versatile")


@pytest.mark.asyncio
@pytest.mark.parametrize("item", CODEGEN_EVAL_DATASET)
async def test_codegen_pipeline_quality(item):
    """Evaluates generated Python code using G-Eval custom metrics with Groq judge."""
    initial_state = {
        "messages": [{"role": "user", "content": item.query}],
        "user_id": "eval_user",
        "thread_id": "codegen_eval_thread",
    }
    
    # Run Cortex agent graph
    result = await graph.ainvoke(initial_state)

    generated_code = result.get("final_code", "") or result.get("code", "")

    test_case = LLMTestCase(
        input=item.query,
        actual_output=generated_code if generated_code else "No code generated.",
        expected_output=item.expected_functionality,
    )

    code_quality_metric = GEval(
        name="Python Code Quality & Correctness",
        criteria=(
            "Evaluate whether the generated Python code is syntactically valid, "
            "fully satisfies the prompt requirements, implements efficient logic, "
            "includes proper type hints/docstrings, and avoids unsafe operations."
        ),
        evaluation_params=[
            SingleTurnParams.INPUT,
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.EXPECTED_OUTPUT,
        ],
        threshold=0.75,
        model=eval_model,
    )

    assert_test(test_case, [code_quality_metric])
