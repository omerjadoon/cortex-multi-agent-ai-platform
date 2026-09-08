import asyncio
from backend.search.bm25 import bm25_index
from backend.search.semantic import semantic_search


def _rrf_score(ranks: list[int], k: int = 60) -> float:
    return sum(1.0 / (k + r) for r in ranks)


def fuse_results(
    bm25_results: list[dict], semantic_results: list[dict], top_k: int = 8
) -> list[dict]:
    """Fuse already-retrieved results using the persistent chunk ID.

    Documents and Qdrant points share this ID at ingestion time.  It avoids the
    ambiguous content-prefix matching previously used for deduplication and lets
    callers reuse retrieval results instead of issuing a second pair of queries.
    """
    def ranked_by_id(results: list[dict]) -> dict[str, tuple[int, dict]]:
        ranked: dict[str, tuple[int, dict]] = {}
        for rank, document in enumerate(results, start=1):
            chunk_id = document.get("id")
            if chunk_id is None:
                chunk_id = f"{document.get('collection', '')}::{document.get('content', '')[:80]}"
            # A backend can occasionally return the same point twice; retain its
            # best rank rather than allowing it to overwrite a better one.
            ranked.setdefault(str(chunk_id), (rank, document))
        return ranked

    bm25_ranked = ranked_by_id(bm25_results)
    semantic_ranked = ranked_by_id(semantic_results)
    scored: list[tuple[float, dict]] = []

    for chunk_id in bm25_ranked.keys() | semantic_ranked.keys():
        ranks: list[int] = []
        # Prefer the semantic result's metadata when both stores have the chunk,
        # while retaining scores from both retrieval methods in the response.
        document = semantic_ranked.get(chunk_id, bm25_ranked.get(chunk_id))[1].copy()
        if chunk_id in bm25_ranked:
            rank, bm25_document = bm25_ranked[chunk_id]
            ranks.append(rank)
            document["bm25_score"] = bm25_document.get("bm25_score")
        if chunk_id in semantic_ranked:
            rank, semantic_document = semantic_ranked[chunk_id]
            ranks.append(rank)
            document["semantic_score"] = semantic_document.get("semantic_score")
        document["rrf_score"] = _rrf_score(ranks)
        scored.append((document["rrf_score"], document))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [document for _, document in scored[:top_k]]


async def hybrid_search(query: str, collections: list[str], top_k: int = 8) -> list[dict]:
    bm25_results, semantic_results = await asyncio.gather(
        bm25_index.search(query, collections, top_k=20),
        semantic_search.search(query, collections, top_k=20),
    )
    return fuse_results(bm25_results, semantic_results, top_k=top_k)
