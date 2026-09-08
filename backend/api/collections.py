import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, distinct, func, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.rbac import get_current_user, require_role, UserContext
from backend.auth.models import Document, RoleCollection
from backend.db.session import get_db
from backend.search.semantic import semantic_search
from backend.search.bm25 import bm25_index
from backend.search.hybrid import hybrid_search, fuse_results
from backend.ingestion.ingest import ingest_document

router = APIRouter(tags=["collections"])


class CreateCollectionRequest(BaseModel):
    name: str


class UpdateDocumentRequest(BaseModel):
    content: str


class SearchInspectRequest(BaseModel):
    query: str
    collections: list[str] = []
    top_k: int = 5


@router.get("/")
async def list_collections(user: UserContext = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == "admin":
        result = await db.execute(select(distinct(Document.collection_name)))
        collections = [row[0] for row in result.all()]
    else:
        result = await db.execute(
            select(RoleCollection.collection_name).where(RoleCollection.user_id == user.user_id)
        )
        collections = [row[0] for row in result.all()]
    return {"collections": collections}


@router.post("/", dependencies=[Depends(require_role("admin"))], status_code=201)
async def create_collection(body: CreateCollectionRequest):
    await semantic_search.ensure_collection(body.name)
    return {"collection": body.name, "status": "created"}


@router.delete("/{name}", dependencies=[Depends(require_role("admin"))])
async def delete_collection(name: str, db: AsyncSession = Depends(get_db)):
    await db.execute(sql_delete(Document).where(Document.collection_name == name))
    await db.commit()
    try:
        await semantic_search.client.delete_collection(name)
    except Exception:
        pass
    return {"collection": name, "status": "deleted"}


# ── Document management ────────────────────────────────────────────────────────

@router.get("/{name}/documents", dependencies=[Depends(require_role("admin"))])
async def list_documents(name: str, db: AsyncSession = Depends(get_db)):
    """Return unique filenames and chunk counts for a collection."""
    result = await db.execute(
        select(Document.filename, func.count(Document.id).label("chunks"))
        .where(Document.collection_name == name)
        .group_by(Document.filename)
        .order_by(Document.filename)
    )
    rows = result.all()
    return {
        "collection": name,
        "documents": [{"filename": r.filename, "chunks": r.chunks} for r in rows],
    }


@router.get("/{name}/chunks", dependencies=[Depends(require_role("admin"))])
async def list_chunks(name: str, filename: str | None = None, db: AsyncSession = Depends(get_db)):
    """Return all document chunks for a collection (optionally filtered by filename)."""
    stmt = select(Document).where(Document.collection_name == name)
    if filename:
        stmt = stmt.where(Document.filename == filename)
    stmt = stmt.order_by(Document.filename, Document.id)

    result = await db.execute(stmt)
    chunks = result.scalars().all()

    return {
        "collection": name,
        "filename": filename,
        "total_chunks": len(chunks),
        "chunking_strategy": {
            "name": "Recursive Hierarchical Semantic & Structural Chunking",
            "target_chunk_size": 512,
            "chunk_overlap": 64,
            "type": "Recursive Boundary Splitter"
        },
        "chunks": [
            {
                "id": str(c.id),
                "filename": c.filename,
                "content": c.content,
                "length": len(c.content),
            }
            for c in chunks
        ],
    }


@router.delete("/{name}/documents", dependencies=[Depends(require_role("admin"))])
async def delete_document(name: str, filename: str, db: AsyncSession = Depends(get_db)):
    """Delete all chunks for a given filename from Postgres + Qdrant + BM25."""
    result = await db.execute(
        select(Document).where(Document.collection_name == name, Document.filename == filename)
    )
    docs = result.scalars().all()
    if not docs:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.execute(
        sql_delete(Document).where(Document.collection_name == name, Document.filename == filename)
    )
    await db.commit()

    await semantic_search.delete_by_filename(name, filename)
    await bm25_index.rebuild_collection(name)

    return {"collection": name, "filename": filename, "status": "deleted"}


@router.put("/{name}/documents", dependencies=[Depends(require_role("admin"))])
async def update_document(name: str, filename: str, body: UpdateDocumentRequest, db: AsyncSession = Depends(get_db)):
    """Replace a document's content by deleting old chunks and re-ingesting new content."""
    result = await db.execute(
        select(Document).where(Document.collection_name == name, Document.filename == filename).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.execute(
        sql_delete(Document).where(Document.collection_name == name, Document.filename == filename)
    )
    await db.commit()
    await semantic_search.delete_by_filename(name, filename)

    chunks = await ingest_document(name, filename, body.content)
    return {"collection": name, "filename": filename, "chunks": chunks, "status": "updated"}


# ── RAG Search Inspector ──────────────────────────────────────────────────────

@router.post("/inspect-search", dependencies=[Depends(require_role("admin"))])
async def inspect_search(body: SearchInspectRequest):
    """Inspect RAG search retrieval pipeline stages: Semantic, BM25, and RRF Reranked."""
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    top_k = max(1, min(body.top_k, 20))
    collections = body.collections

    bm25_chunks, semantic_chunks = await asyncio.gather(
        bm25_index.search(query, collections, top_k=top_k),
        semantic_search.search(query, collections, top_k=top_k),
    )
    reranked_chunks = fuse_results(bm25_chunks, semantic_chunks, top_k=top_k)

    return {
        "query": query,
        "collections": collections,
        "top_k": top_k,
        "chunking_strategy": {
            "name": "Recursive Hierarchical Semantic & Structural Chunking",
            "target_chunk_size": 512,
            "chunk_overlap": 64,
            "description": "Splits document text along natural document boundaries (Paragraphs -> Section Headers -> Sentences -> Words) to preserve complete semantic context and avoid splitting mid-sentence or mid-word.",
            "embedding_model": "BAAI/bge-small-en-v1.5 (384 dimensions)",
            "vector_store": "Qdrant Vector DB",
            "lexical_store": "BM25 In-Memory Index",
            "reranker": "Reciprocal Rank Fusion (RRF, k=60)"
        },
        "semantic_chunks": semantic_chunks,
        "bm25_chunks": bm25_chunks,
        "reranked_chunks": reranked_chunks,
    }
