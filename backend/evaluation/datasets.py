"""Curated benchmark evaluation datasets for Cortex agent testing."""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class RAGTestCaseData:
    query: str
    expected_output: str
    expected_context: List[str]


@dataclass
class CodeGenTestCaseData:
    query: str
    expected_functionality: str


@dataclass
class RouterTestCaseData:
    query: str
    expected_intent: str


# Sample RAG Test Dataset
RAG_EVAL_DATASET: List[RAGTestCaseData] = [
    RAGTestCaseData(
        query="What architecture does Cortex use for agent orchestration?",
        expected_output="Cortex uses LangGraph StateGraph to orchestrate multi-agent nodes including router, RAG, planner, codegen, validator, testgen, testrunner, and fixer.",
        expected_context=[
            "Cortex leverages LangGraph StateGraph for multi-agent execution.",
            "The architecture consists of router, rag, planner, codegen, validator, testgen, testrunner, and fixer nodes.",
        ],
    ),
    RAGTestCaseData(
        query="Which vector database is configured in Cortex?",
        expected_output="Cortex uses Qdrant as its vector database for storing and searching embeddings.",
        expected_context=[
            "Qdrant vector search is integrated into Cortex for document retrieval.",
        ],
    ),
]


# Sample Code Generation Test Dataset
CODEGEN_EVAL_DATASET: List[CodeGenTestCaseData] = [
    CodeGenTestCaseData(
        query="Write a Python function `fibonacci(n: int) -> int` that returns the n-th Fibonacci number using dynamic programming.",
        expected_functionality="Calculates the n-th Fibonacci number efficiently with O(n) time and O(1) space.",
    ),
    CodeGenTestCaseData(
        query="Write a Python function `is_valid_email(email: str) -> bool` using regex to validate email format.",
        expected_functionality="Validates email syntax correctly using standard regular expressions.",
    ),
]


# Sample Router Intent Dataset
ROUTER_EVAL_DATASET: List[RouterTestCaseData] = [
    RouterTestCaseData(
        query="What is the mission of Cortex?",
        expected_intent="rag",
    ),
    RouterTestCaseData(
        query="Write a quicksort algorithm in Python.",
        expected_intent="codegen",
    ),
    RouterTestCaseData(
        query="How does the system calculate hybrid BM25 + dense retrieval scores?",
        expected_intent="rag",
    ),
    RouterTestCaseData(
        query="Create a FastAPI endpoint that accepts JSON data and saves it to PostgreSQL.",
        expected_intent="codegen",
    ),
]
