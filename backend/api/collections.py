from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, distinct, func, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.rbac import get_current_user, require_role, UserContext
from backend.auth.models import Document, RoleCollection
from backend.db.session import get_db
from backend.search.semantic import semantic_search
from backend.search.bm25 import bm25_index
from backend.ingestion.ingest import ingest_document

router = APIRouter(tags=["collections"])


class CreateCollectionRequest(BaseModel):
    name: str


class UpdateDocumentRequest(BaseModel):
    content: str


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

    # Delete old chunks
    await db.execute(
        sql_delete(Document).where(Document.collection_name == name, Document.filename == filename)
    )
    await db.commit()
    await semantic_search.delete_by_filename(name, filename)

    # Re-ingest with new content
    chunks = await ingest_document(name, filename, body.content)
    return {"collection": name, "filename": filename, "chunks": chunks, "status": "updated"}
