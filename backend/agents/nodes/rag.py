"""RAG node: hybrid search + LLM answer generation."""

import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState
from backend.search.hybrid import hybrid_search

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0.2,
)

_ANSWER_SYSTEM = """\
You are a helpful assistant. Use the provided context chunks to answer the user's question.
Be concise, accurate, and cite relevant information from the context.
If the context does not contain the answer, say so clearly.
"""


async def run_rag(state: AgentState) -> dict:
    """Run hybrid search asynchronously and generate an answer from retrieved chunks."""
    # Extract user query from last human message
    query = ""
    for msg in reversed(state["messages"]):
        if hasattr(msg, "content") and msg.type in ("human", "user"):
            query = msg.content
            break

    allowed_collections = state.get("allowed_collections", [])
    progress_events = list(state.get("progress_events", []))

    progress_events.append({"step": "bm25", "status": "running"})
    progress_events.append({"step": "semantic", "status": "running"})

    try:
        chunks = await hybrid_search(query, allowed_collections)
    except Exception as exc:
        logger.error("hybrid_search failed: %s", exc)
        chunks = []

    progress_events.append({"step": "bm25", "status": "done"})
    progress_events.append({"step": "semantic", "status": "done"})
    progress_events.append({"step": "merging", "status": "done", "detail": f"{len(chunks)} chunks"})

    # Build context string
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        text = chunk.get("text") or chunk.get("content") or str(chunk)
        source = chunk.get("source") or chunk.get("metadata", {}).get("source", "")
        header = f"[{i}] {source}" if source else f"[{i}]"
        context_parts.append(f"{header}\n{text}")

    context = "\n\n".join(context_parts) if context_parts else "No relevant context found."

    # Generate answer
    try:
        response = await _llm.ainvoke([
            SystemMessage(content=_ANSWER_SYSTEM),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}"),
        ])
        answer = response.content.strip()
    except Exception as exc:
        logger.error("LLM answer generation failed: %s", exc)
        answer = f"Error generating answer: {exc}"

    progress_events.append({"step": "answering", "status": "done"})

    return {
        "retrieved_chunks": chunks,
        "final_answer": answer,
        "progress_events": progress_events,
    }
