from backend.auth.models import Document
from backend.search.bm25 import bm25_index
from backend.search.semantic import semantic_search
from backend.db.session import AsyncSessionLocal
from backend.config import settings


def _chunk_text(text: str, size: int = 512, overlap: int = 64) -> list[str]:
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


async def ingest_document(collection: str, filename: str, content: str) -> int:
    chunks = _chunk_text(content, settings.chunk_size, settings.chunk_overlap)

    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            doc = Document(
                collection_name=collection,
                filename=filename,
                content=chunk,
            )
            session.add(doc)
        await session.commit()

    chunk_dicts = [{"content": c, "filename": filename} for c in chunks]
    await semantic_search.upsert(collection, chunk_dicts)
    await bm25_index.rebuild_collection(collection)

    return len(chunks)
