"""Groq LLM evaluation model wrapper for DeepEval metrics."""

import os
from typing import Optional
from deepeval.models.base_model import DeepEvalBaseLLM
from langchain_groq import ChatGroq
from backend.config import settings


class GroqEvalModel(DeepEvalBaseLLM):
    """Custom DeepEval LLM evaluator class using Groq API as the judge."""

    def __init__(
        self,
        model_name: str = "llama-3.3-70b-versatile",
        api_key: Optional[str] = None,
        temperature: float = 0.0,
    ):
        self.model_name = model_name
        self.api_key = api_key or os.getenv("GROQ_API_KEY") or getattr(settings, "groq_api_key", "")
        self.temperature = temperature
        self._model = self.load_model()

    def load_model(self) -> ChatGroq:
        """Loads and returns the ChatGroq LangChain model instance."""
        return ChatGroq(
            model_name=self.model_name,
            groq_api_key=self.api_key if self.api_key else None,
            temperature=self.temperature,
        )

    def generate(self, prompt: str) -> str:
        """Synchronous response generation for DeepEval evaluation prompts."""
        res = self._model.invoke(prompt)
        return res.content if hasattr(res, "content") else str(res)

    async def a_generate(self, prompt: str) -> str:
        """Asynchronous response generation for DeepEval evaluation prompts."""
        res = await self._model.ainvoke(prompt)
        return res.content if hasattr(res, "content") else str(res)

    def get_model_name(self) -> str:
        """Returns the configured model name."""
        return self.model_name
