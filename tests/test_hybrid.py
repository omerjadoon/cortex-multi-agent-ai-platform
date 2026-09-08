"""Tests for identity-based reciprocal-rank fusion."""

from backend.search.hybrid import fuse_results


def test_fusion_uses_chunk_id_not_content_prefix():
    """Different chunks with identical prefixes must remain distinct."""
    bm25 = [
        {"id": "chunk-a", "collection": "docs", "content": "Same prefix " + "A" * 100, "bm25_score": 2.0},
        {"id": "chunk-b", "collection": "docs", "content": "Same prefix " + "B" * 100, "bm25_score": 1.0},
    ]
    semantic = [
        {"id": "chunk-b", "collection": "docs", "content": bm25[1]["content"], "semantic_score": 0.9},
        {"id": "chunk-a", "collection": "docs", "content": bm25[0]["content"], "semantic_score": 0.8},
    ]

    results = fuse_results(bm25, semantic)

    assert {result["id"] for result in results} == {"chunk-a", "chunk-b"}
    assert all("rrf_score" in result for result in results)


def test_fusion_combines_ranks_for_matching_chunk_id():
    results = fuse_results(
        [{"id": "shared", "content": "keyword", "bm25_score": 3.0}],
        [{"id": "shared", "content": "semantic", "semantic_score": 0.95}],
    )

    assert len(results) == 1
    assert results[0]["id"] == "shared"
    assert results[0]["bm25_score"] == 3.0
    assert results[0]["semantic_score"] == 0.95


def test_fusion_falls_back_gracefully_when_id_missing():
    results = fuse_results(
        [{"collection": "docs", "content": "Legacy content A", "bm25_score": 2.0}],
        [{"collection": "docs", "content": "Legacy content B", "semantic_score": 0.8}],
    )
    assert len(results) == 2


import pytest


@pytest.mark.asyncio
async def test_run_rag_retrieves_once_and_fuses_without_redundancy(monkeypatch):
    """Verify run_rag queries BM25 and semantic once concurrently and never calls hybrid_search."""
    from backend.agents.nodes import rag

    bm25_called = 0
    semantic_called = 0
    hybrid_called = 0

    async def mock_bm25_search(query, collections, top_k=10):
        nonlocal bm25_called
        bm25_called += 1
        return [{"id": "chunk-1", "content": "BM25 match", "filename": "doc.md", "bm25_score": 2.5}]

    async def mock_semantic_search(query, collections, top_k=10):
        nonlocal semantic_called
        semantic_called += 1
        return [{"id": "chunk-1", "content": "Semantic match", "filename": "doc.md", "semantic_score": 0.92}]

    async def mock_hybrid_search(query, collections, top_k=8):
        nonlocal hybrid_called
        hybrid_called += 1
        return []

    class MockLLM:
        async def ainvoke(self, messages):
            class MockResponse:
                content = "Mock answer generated from context."
            return MockResponse()

    monkeypatch.setattr(rag.bm25_index, "search", mock_bm25_search)
    monkeypatch.setattr(rag.semantic_search, "search", mock_semantic_search)
    monkeypatch.setattr(rag, "_llm", MockLLM())

    state = {
        "messages": [{"role": "user", "content": "What is Cortex?"}],
        "allowed_collections": ["cortex"],
        "progress_events": [],
    }

    result = await rag.run_rag(state)

    # BM25 and semantic search each called exactly once
    assert bm25_called == 1
    assert semantic_called == 1
    # hybrid_search was NOT called, preventing duplicate retrieval
    assert hybrid_called == 0
    # Both sources fused into 1 merged chunk keyed by chunk-1 ID
    assert len(result["retrieved_chunks"]) == 1
    merged = result["retrieved_chunks"][0]
    assert merged["id"] == "chunk-1"
    assert merged["bm25_score"] == 2.5
    assert merged["semantic_score"] == 0.92
    assert "rrf_score" in merged
    assert result["final_answer"] == "Mock answer generated from context."

