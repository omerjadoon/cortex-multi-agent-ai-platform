import asyncio
from backend.search.bm25 import bm25_index
from backend.search.semantic import semantic_search


def _rrf_score(ranks: list[int], k: int = 60) -> float:
    return sum(1.0 / (k + r) for r in ranks)


async def hybrid_search(query: str, collections: list[str], top_k: int = 8) -> list[dict]:
    bm25_results, semantic_results = await asyncio.gather(
        bm25_index.search(query, collections, top_k=20),
        semantic_search.search(query, collections, top_k=20),
    )

    # Build rank maps keyed by (collection, content[:80]) to deduplicate
    def key(doc: dict) -> str:
        return f"{doc.get('collection', '')}::{doc.get('content', '')[:80]}"

    bm25_rank = {key(doc): idx + 1 for idx, doc in enumerate(bm25_results)}
    sem_rank = {key(doc): idx + 1 for idx, doc in enumerate(semantic_results)}

    all_keys = set(bm25_rank) | set(sem_rank)

    scored: list[tuple[float, dict]] = []
    doc_map: dict[str, dict] = {key(d): d for d in bm25_results + semantic_results}

    for k_ in all_keys:
        ranks = []
        if k_ in bm25_rank:
            ranks.append(bm25_rank[k_])
        if k_ in sem_rank:
            ranks.append(sem_rank[k_])
        scored.append((_rrf_score(ranks), doc_map[k_]))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [doc for _, doc in scored[:top_k]]
