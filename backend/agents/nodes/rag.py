"""RAG node: hybrid search + LLM answer generation with scope enforcement."""

import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState, get_last_user_message
from backend.search.semantic import semantic_search
from backend.search.bm25 import bm25_index
from backend.search.hybrid import hybrid_search

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0.2,
)

_ANSWER_SYSTEM = """\
You are the OpenMind AI assistant. Use the provided context chunks to answer the user's question accurately.

IMPORTANT BOUNDARY INSTRUCTIONS:
- You ONLY assist with questions related to OpenMind, Cortex platform, CNC/CAD intelligence, code search, and system features.
- If the user asks a general question unrelated to OpenMind or Python programming, politely reply: "I am the OpenMind AI assistant. I can only help if you have questions related to OpenMind or want to generate a Python script. How can I assist you with OpenMind or Python programming today?"
- Be concise, accurate, and cite relevant information from the context.
- Maintain a professional, clean tone. Do NOT generate profane, offensive, or inappropriate text under any circumstances.
"""


async def run_rag(state: AgentState) -> dict:
    """Run hybrid search asynchronously and generate an answer from retrieved chunks."""
    query = get_last_user_message(state)
    allowed_collections = state.get("allowed_collections", [])
    progress_events = list(state.get("progress_events", []))

    # 1. BM25 Keyword Search
    try:
        bm25_chunks = await bm25_index.search(query, allowed_collections, top_k=10)
    except Exception as exc:
        logger.error("bm25_index search failed: %s", exc)
        bm25_chunks = []

    if bm25_chunks:
        bm25_detail = f"Retrieved {len(bm25_chunks)} BM25 keyword matches:\n\n" + "\n\n".join([
            f"[{idx+1}] {c.get('filename', 'doc')} (BM25 Score: {c.get('bm25_score', 0):.2f})\n{c.get('content', '')}"
            for idx, c in enumerate(bm25_chunks)
        ])
    else:
        bm25_detail = f"No BM25 keyword matches found for query: '{query}'"

    progress_events.append({"step": "bm25", "status": "done", "detail": bm25_detail})

    # 2. Semantic Vector Search
    try:
        semantic_chunks = await semantic_search.search(query, allowed_collections, top_k=10)
    except Exception as exc:
        logger.error("semantic_search failed: %s", exc)
        semantic_chunks = []

    if semantic_chunks:
        semantic_detail = f"Retrieved {len(semantic_chunks)} Semantic vector matches:\n\n" + "\n\n".join([
            f"[{idx+1}] {c.get('filename', 'doc')} (Similarity Score: {c.get('semantic_score', 0):.4f})\n{c.get('content', '')}"
            for idx, c in enumerate(semantic_chunks)
        ])
    else:
        semantic_detail = f"No semantic vector matches found for query: '{query}'"

    progress_events.append({"step": "semantic", "status": "done", "detail": semantic_detail})

    # 3. Hybrid Reranking (RRF)
    try:
        chunks = await hybrid_search(query, allowed_collections)
    except Exception as exc:
        logger.error("hybrid_search failed: %s", exc)
        chunks = []

    if chunks:
        merging_detail = f"Reciprocal Rank Fusion (RRF, k=60) merged top {len(chunks)} context chunks:\n\n" + "\n\n".join([
            f"[{idx+1}] {c.get('filename', 'doc')}\n{c.get('content', '')}"
            for idx, c in enumerate(chunks)
        ])
    else:
        merging_detail = "No candidate chunks retained after hybrid reranking."

    progress_events.append({"step": "merging", "status": "done", "detail": merging_detail})

    # 4. Prepare context & LLM generation
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        text = chunk.get("text") or chunk.get("content") or str(chunk)
        source = chunk.get("source") or chunk.get("filename") or chunk.get("metadata", {}).get("source", "")
        header = f"[{i}] {source}" if source else f"[{i}]"
        context_parts.append(f"{header}\n{text}")

    context = "\n\n".join(context_parts) if context_parts else "No relevant context found."

    try:
        response = await _llm.ainvoke([
            SystemMessage(content=_ANSWER_SYSTEM),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}"),
        ])
        answer = response.content.strip()
    except Exception as exc:
        logger.error("LLM answer generation failed: %s", exc)
        answer = f"Error generating answer: {exc}"

    answering_detail = f"Generated answer using {len(chunks)} context chunks.\n\nResponse:\n{answer}"
    progress_events.append({"step": "answering", "status": "done", "detail": answering_detail})

    return {
        "retrieved_chunks": chunks,
        "final_answer": answer,
        "progress_events": progress_events,
    }
