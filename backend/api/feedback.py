from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.rbac import get_current_user, require_role, UserContext
from backend.auth.models import Feedback, FeedbackStatus, User
from backend.db.session import get_db
from backend.ingestion.ingest import ingest_document

router = APIRouter(tags=["feedback"])


class SubmitFeedbackRequest(BaseModel):
    rating: int          # 1 = thumbs up, -1 = thumbs down
    question: str
    answer: str


class IngestFeedbackRequest(BaseModel):
    collection: str
    question: str        # admin may edit before ingesting
    answer: str


@router.post("/", status_code=201)
async def submit_feedback(
    body: SubmitFeedbackRequest,
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.rating not in (1, -1):
        raise HTTPException(status_code=422, detail="rating must be 1 or -1")
    fb = Feedback(
        user_id=user.user_id,
        rating=body.rating,
        question=body.question,
        answer=body.answer,
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return {"id": str(fb.id), "status": "created"}


@router.get("/", dependencies=[Depends(require_role("admin"))])
async def list_feedback(
    status: str = "pending",
    db: AsyncSession = Depends(get_db),
):
    try:
        fb_status = FeedbackStatus(status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {status}")

    result = await db.execute(
        select(Feedback, User.email)
        .join(User, Feedback.user_id == User.id)
        .where(Feedback.status == fb_status)
        .order_by(Feedback.created_at.desc())
    )
    rows = result.all()
    return {
        "feedback": [
            {
                "id": str(fb.id),
                "rating": fb.rating,
                "question": fb.question,
                "answer": fb.answer,
                "status": fb.status,
                "collection": fb.collection,
                "created_at": fb.created_at.isoformat(),
                "user_email": email,
            }
            for fb, email in rows
        ]
    }


@router.post("/{feedback_id}/ingest", dependencies=[Depends(require_role("admin"))])
async def ingest_feedback(
    feedback_id: str,
    body: IngestFeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if fb is None:
        raise HTTPException(status_code=404, detail="Feedback not found")

    content = f"Q: {body.question}\n\nA: {body.answer}"
    filename = f"feedback_{feedback_id[:8]}.txt"
    chunks = await ingest_document(body.collection, filename, content)

    fb.status = FeedbackStatus.ingested
    fb.collection = body.collection
    await db.commit()

    return {"id": feedback_id, "collection": body.collection, "chunks": chunks, "status": "ingested"}


@router.delete("/{feedback_id}", dependencies=[Depends(require_role("admin"))])
async def dismiss_feedback(feedback_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if fb is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    fb.status = FeedbackStatus.dismissed
    await db.commit()
    return {"id": feedback_id, "status": "dismissed"}
