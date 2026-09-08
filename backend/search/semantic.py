import asyncio
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchAny, MatchValue
from sentence_transformers import SentenceTransformer
import uuid
from backend.config import settings

VECTOR_SIZE = 384  # all-MiniLM-L6-v2 output size


class SemanticSearch:
    def __init__(self):
        self.client = AsyncQdrantClient(url=settings.QDRANT_URL)
        self.encoder = SentenceTransformer(settings.EMBEDDING_MODEL)

    def _encode(self, text: str) -> list[float]:
        return self.encoder.encode(text).tolist()

    async def _encode_async(self, text: str) -> list[float]:
        """Offload CPU-bound SentenceTransformer embedding generation to worker thread."""
        return await asyncio.to_thread(self._encode, text)

    async def ensure_collection(self, collection: str) -> None:
        existing = await self.client.get_collections()
        names = [c.name for c in existing.collections]
        if collection not in names:
            await self.client.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )

    async def upsert(self, collection: str, chunks: list[dict]) -> None:
        await self.ensure_collection(collection)
        points = []
        for chunk in chunks:
            vector = await self._encode_async(chunk["content"])
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "content": chunk["content"],
                        "filename": chunk.get("filename", ""),
                        "collection": collection,
                    },
                )
            )
        await self.client.upsert(collection_name=collection, points=points)

    async def _search_single_collection(self, collection: str, vector: list[float], top_k: int) -> list[dict]:
        """Query a single Qdrant collection."""
        try:
            hits = await self.client.search(
                collection_name=collection,
                query_vector=vector,
                limit=top_k,
                with_payload=True,
            )
            return [
                {
                    "id": str(hit.id),
                    "content": hit.payload.get("content", ""),
                    "filename": hit.payload.get("filename", ""),
                    "collection": collection,
                    "semantic_score": hit.score,
                }
                for hit in hits
            ]
        except Exception:
            return []

    async def search(self, query: str, collections: list[str], top_k: int = 10) -> list[dict]:
        vector = await self._encode_async(query)

        existing = await self.client.get_collections()
        existing_names = {c.name for c in existing.collections}

        if not collections or "*" in collections or "all" in collections:
            target = list(existing_names)
        else:
            target = [c for c in collections if c in existing_names]

        if not target:
            return []

        # Query all target collections concurrently
        tasks = [self._search_single_collection(col, vector, top_k) for col in target]
        results_nested = await asyncio.gather(*tasks)

        results = [doc for sublist in results_nested for doc in sublist]
        results.sort(key=lambda x: x["semantic_score"], reverse=True)
        return results[:top_k]

    async def delete_by_filename(self, collection: str, filename: str) -> None:
        """Delete all Qdrant points whose payload filename matches."""
        try:
            await self.client.delete(
                collection_name=collection,
                points_selector=Filter(
                    must=[FieldCondition(key="filename", match=MatchValue(value=filename))]
                ),
            )
        except Exception:
            pass  # collection may not exist yet


semantic_search = SemanticSearch()
