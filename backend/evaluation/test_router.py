"""DeepEval Router Intent Classification evaluation test suite for Cortex using Groq API."""

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, SingleTurnParams
from deepeval.metrics import GEval

from backend.agents.nodes.router import route_intent
from backend.evaluation.groq_model import GroqEvalModel
from backend.evaluation.datasets import ROUTER_EVAL_DATASET


# Initialize Groq judge model
eval_model = GroqEvalModel(model_name="llama-3.3-70b-versatile")


@pytest.mark.asyncio
@pytest.mark.parametrize("item", ROUTER_EVAL_DATASET)
async def test_router_intent_routing(item):
    """Evaluates router intent node output against expected intent."""
    state = {
        "messages": [{"role": "user", "content": item.query}],
        "user_id": "eval_user",
    }

    # Execute router node
    out_state = await route_intent(state)
    detected_intent = out_state.get("intent", "rag")

    test_case = LLMTestCase(
        input=item.query,
        actual_output=detected_intent,
        expected_output=item.expected_intent,
    )

    router_accuracy_metric = GEval(
        name="Router Intent Accuracy",
        criteria=(
            "Verify if the router accurately categorized user query intent into 'rag' "
            "(for information/retrieval questions) or 'codegen' (for coding/script creation requests)."
        ),
        evaluation_params=[
            SingleTurnParams.INPUT,
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.EXPECTED_OUTPUT,
        ],
        threshold=0.8,
        model=eval_model,
    )

    assert_test(test_case, [router_accuracy_metric])
