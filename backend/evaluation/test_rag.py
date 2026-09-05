"""DeepEval RAG Pipeline evaluation test suite for Cortex using Groq API."""

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import (
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
)

from backend.agents.graph import graph
from backend.evaluation.groq_model import GroqEvalModel
from backend.evaluation.datasets import RAG_EVAL_DATASET


# Initialize Groq judge model
eval_model = GroqEvalModel(model_name="llama-3.3-70b-versatile")


@pytest.mark.asyncio
@pytest.mark.parametrize("item", RAG_EVAL_DATASET)
async def test_rag_faithfulness_and_relevancy(item):
    """Evaluates RAG pipeline responses for context grounding, answer relevancy, and context precision."""
    initial_state = {
        "messages": [{"role": "user", "content": item.query}],
        "user_id": "eval_user",
        "thread_id": "rag_eval_thread",
    }
    
    # Run Cortex agent graph
    result = await graph.ainvoke(initial_state)

    retrieved_texts = [
        chunk.get("text", str(chunk))
        for chunk in result.get("retrieved_chunks", [])
    ]
    actual_output = result.get("final_answer", "")

    # Build DeepEval Test Case
    test_case = LLMTestCase(
        input=item.query,
        actual_output=actual_output if actual_output else "No response generated.",
        expected_output=item.expected_output,
        retrieval_context=retrieved_texts if retrieved_texts else item.expected_context,
    )

    # Initialize metrics with Groq evaluation judge
    faithfulness = FaithfulnessMetric(threshold=0.7, model=eval_model)
    relevancy = AnswerRelevancyMetric(threshold=0.7, model=eval_model)
    precision = ContextualPrecisionMetric(threshold=0.6, model=eval_model)
    recall = ContextualRecallMetric(threshold=0.6, model=eval_model)

    assert_test(test_case, [faithfulness, relevancy, precision, recall])
