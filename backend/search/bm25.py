import re
from rank_bm25 import BM25Okapi
from sqlalchemy import select
from backend.db.session import AsyncSessionLocal
from backend.auth.models import Document


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


class BM25Index:
    def __init__(self):
        self._indices: dict[str, BM25Okapi] = {}
        self._docs: dict[str, list[dict]] = {}

    async def build(self, collection: str) -> None:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Document).where(Document.collection_name == collection)
            )
            docs = result.scalars().all()

        if not docs:
            return

        self._docs[collection] = [
            {"id": str(d.id), "content": d.content, "filename": d.filename, "collection": collection}
            for d in docs
        ]
        corpus = [_tokenize(d.content) for d in docs]
        self._indices[collection] = BM25Okapi(corpus)

    async def rebuild_collection(self, collection: str) -> None:
        await self.build(collection)

    async def search(self, query: str, collections: list[str], top_k: int = 10) -> list[dict]:
        tokens = _tokenize(query)
        results: list[dict] = []

        target = list(self._docs.keys()) if "*" in collections else collections

        for col in target:
            if col not in self._indices:
                await self.build(col)
            if col not in self._indices:
                continue

            scores = self._indices[col].get_scores(tokens)
            docs = self._docs[col]
            ranked = sorted(
                zip(scores, docs), key=lambda x: x[0], reverse=True
            )[:top_k]
            for score, doc in ranked:
                if score > 0:
                    results.append({**doc, "bm25_score": float(score)})

        results.sort(key=lambda x: x["bm25_score"], reverse=True)
        return results[:top_k]


bm25_index = BM25Index()
