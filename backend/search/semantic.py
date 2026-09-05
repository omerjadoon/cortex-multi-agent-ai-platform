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
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=self._encode(chunk["content"]),
                payload={
                    "content": chunk["content"],
                    "filename": chunk.get("filename", ""),
                    "collection": collection,
                },
            )
            for chunk in chunks
        ]
        await self.client.upsert(collection_name=collection, points=points)

    async def search(self, query: str, collections: list[str], top_k: int = 10) -> list[dict]:
        vector = self._encode(query)
        results: list[dict] = []

        existing = await self.client.get_collections()
        existing_names = {c.name for c in existing.collections}

        target = list(existing_names) if "*" in collections else [c for c in collections if c in existing_names]

        for collection in target:
            hits = await self.client.search(
                collection_name=collection,
                query_vector=vector,
                limit=top_k,
                with_payload=True,
            )
            for hit in hits:
                results.append({
                    "id": str(hit.id),
                    "content": hit.payload.get("content", ""),
                    "filename": hit.payload.get("filename", ""),
                    "collection": collection,
                    "semantic_score": hit.score,
                })

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
