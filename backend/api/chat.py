import json
import asyncio
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sse_starlette.sse import EventSourceResponse
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from pydantic import BaseModel
from sqlalchemy import select, delete, func, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.rbac import get_current_user, require_role, UserContext
from backend.db.session import get_db, AsyncSessionLocal
from backend.auth.models import ChatThread, ChatMessage
from backend.agents.graph import graph
from backend.agents.summarizer import generate_updated_summary
from backend.monitoring.langfuse import get_langfuse_callback
from backend.ingestion.ingest import ingest_document

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

MAX_CONTEXT_MESSAGES = 6  # Recent messages kept unsummarized in LLM context


class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None


class ThreadCreateRequest(BaseModel):
    title: Optional[str] = None


class ThreadUpdateRequest(BaseModel):
    title: str


# --- THREAD CRUD ENDPOINTS ---

@router.get("/threads")
async def list_threads(
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all chat threads for the current user."""
    stmt = (
        select(ChatThread)
        .where(ChatThread.user_id == uuid.UUID(user.user_id))
        .options(selectinload(ChatThread.messages))
        .order_by(ChatThread.updated_at.desc())
    )
    result = await db.execute(stmt)
    threads = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "title": t.title,
            "summary": t.summary,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
            "message_count": len(t.messages),
        }
        for t in threads
    ]


@router.post("/threads")
async def create_thread(
    body: ThreadCreateRequest = ThreadCreateRequest(),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly create a new chat thread."""
    title = body.title.strip() if body.title and body.title.strip() else "New Chat"
    new_thread = ChatThread(
        user_id=uuid.UUID(user.user_id),
        title=title,
    )
    db.add(new_thread)
    await db.commit()
    await db.refresh(new_thread)

    return {
        "id": str(new_thread.id),
        "title": new_thread.title,
        "summary": new_thread.summary,
        "created_at": new_thread.created_at.isoformat(),
        "updated_at": new_thread.updated_at.isoformat(),
        "message_count": 0,
        "messages": [],
    }


@router.get("/threads/{thread_id}")
async def get_thread(
    thread_id: str,
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get thread metadata and complete message history."""
    try:
        t_uuid = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread_id format")

    stmt = (
        select(ChatThread)
        .where(ChatThread.id == t_uuid, ChatThread.user_id == uuid.UUID(user.user_id))
        .options(selectinload(ChatThread.messages))
    )
    result = await db.execute(stmt)
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    messages = [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "code": m.code,
            "testCode": m.test_code,
            "timestamp": m.created_at.isoformat(),
        }
        for m in thread.messages
    ]

    return {
        "id": str(thread.id),
        "title": thread.title,
        "summary": thread.summary,
        "created_at": thread.created_at.isoformat(),
        "updated_at": thread.updated_at.isoformat(),
        "message_count": len(messages),
        "messages": messages,
    }


@router.patch("/threads/{thread_id}")
async def update_thread(
    thread_id: str,
    body: ThreadUpdateRequest,
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update thread title."""
    try:
        t_uuid = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread_id format")

    stmt = (
        select(ChatThread)
        .where(ChatThread.id == t_uuid, ChatThread.user_id == uuid.UUID(user.user_id))
    )
    result = await db.execute(stmt)
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    thread.title = body.title.strip() or "Untitled Chat"
    thread.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"id": str(thread.id), "title": thread.title, "updated_at": thread.updated_at.isoformat()}


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat thread and all associated messages."""
    try:
        t_uuid = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread_id format")

    stmt = (
        select(ChatThread)
        .where(ChatThread.id == t_uuid, ChatThread.user_id == uuid.UUID(user.user_id))
    )
    result = await db.execute(stmt)
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    await db.delete(thread)
    await db.commit()

    return {"status": "deleted", "thread_id": thread_id}


# --- CHAT STREAMING WITH THREAD ISOLATION & HISTORY OPTIMIZATION ---

@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    user: UserContext = Depends(get_current_user),
):
    if user.role == "viewer" and _is_codegen_request(body.message):
        raise HTTPException(status_code=403, detail="Viewers cannot generate code")

    async def event_generator():
        async with AsyncSessionLocal() as db:
            user_uuid = uuid.UUID(user.user_id)
            thread = None

            # 1. Resolve or create thread
            if body.thread_id:
                try:
                    t_uuid = uuid.UUID(body.thread_id)
                    stmt = (
                        select(ChatThread)
                        .where(ChatThread.id == t_uuid, ChatThread.user_id == user_uuid)
                        .options(selectinload(ChatThread.messages))
                    )
                    res = await db.execute(stmt)
                    thread = res.scalar_one_or_none()
                except ValueError:
                    thread = None

            if not thread:
                # Derive title from user message snippet
                title_snippet = body.message.strip().split("\n")[0][:40]
                if len(body.message.strip()) > 40:
                    title_snippet += "..."
                thread = ChatThread(
                    user_id=user_uuid,
                    title=title_snippet or "New Chat",
                )
                db.add(thread)
                await db.commit()
                await db.refresh(thread)
                stmt = select(ChatThread).where(ChatThread.id == thread.id).options(selectinload(ChatThread.messages))
                res = await db.execute(stmt)
                thread = res.scalar_one_or_none()

            # Emit initial thread info event to client
            yield {
                "data": json.dumps({
                    "step": "thread_info",
                    "status": "info",
                    "thread_id": str(thread.id),
                    "thread_title": thread.title,
                })
            }
            await asyncio.sleep(0)

            # 2. Add incoming user message to database
            user_msg = ChatMessage(
                thread_id=thread.id,
                role="user",
                content=body.message,
            )
            db.add(user_msg)
            thread.updated_at = datetime.now(timezone.utc)
            await db.commit()

            # Fetch fresh list of messages in chronological order
            stmt = select(ChatMessage).where(ChatMessage.thread_id == thread.id).order_by(ChatMessage.created_at.asc())
            all_messages = (await db.execute(stmt)).scalars().all()

            # 3. OPTIMIZATION OF LONG CHAT HISTORY (SUMMARIZATION)
            # Past messages excluding the newly added user message
            past_messages = [m for m in all_messages if m.id != user_msg.id]
            
            # If past message count exceeds MAX_CONTEXT_MESSAGES, summarize older ones
            if len(past_messages) > MAX_CONTEXT_MESSAGES:
                older_to_summarize = past_messages[:-MAX_CONTEXT_MESSAGES]
                recent_past = past_messages[-MAX_CONTEXT_MESSAGES:]

                messages_payload = [
                    {"role": m.role, "content": m.content, "code": m.code or ""}
                    for m in older_to_summarize
                ]
                
                new_summary = await generate_updated_summary(thread.summary, messages_payload)
                if new_summary != thread.summary:
                    thread.summary = new_summary
                    await db.commit()
            else:
                recent_past = past_messages

            # 4. Construct LangChain messages for AgentState
            langchain_msgs = []
            if thread.summary:
                langchain_msgs.append(
                    SystemMessage(content=f"Summary of prior conversation in this thread:\n{thread.summary}")
                )

            for m in recent_past:
                if m.role == "user":
                    langchain_msgs.append(HumanMessage(content=m.content))
                else:
                    langchain_msgs.append(AIMessage(content=m.content))

            # Append current human message
            langchain_msgs.append(HumanMessage(content=body.message))

            initial_state = {
                "messages": langchain_msgs,
                "user_id": user.user_id,
                "user_email": user.email,
                "thread_id": str(thread.id),
                "role": user.role,
                "allowed_collections": user.allowed_collections,
                "progress_events": [],
                "retry_count": 0,
                "max_retries": 3,
            }

            cb = get_langfuse_callback(
                session_id=str(thread.id),
                user_id=user.user_id,
                trace_name=f"chat_thread_{thread.id}",
            )
            stream_config = {"callbacks": [cb]} if cb else None

            seen_events: set[int] = set()
            final_state: dict = {}

            try:
                async for chunk in graph.astream(initial_state, config=stream_config, stream_mode="updates"):
                    for node_name, node_output in chunk.items():
                        if not isinstance(node_output, dict):
                            continue
                        final_state.update(node_output)
                        events = node_output.get("progress_events", [])
                        for idx, event in enumerate(events):
                            eid = hash(json.dumps(event, sort_keys=True))
                            if eid not in seen_events:
                                seen_events.add(eid)
                                yield {"data": json.dumps(event)}
                                await asyncio.sleep(0)

                # Send final payload
                answer = final_state.get("final_answer") or final_state.get("code", "")
                code = final_state.get("code", "") if final_state.get("intent") == "codegen" else ""
                test_code = final_state.get("test_code", "")

                # 5. Save assistant response to DB
                assistant_msg = ChatMessage(
                    thread_id=thread.id,
                    role="assistant",
                    content=answer,
                    code=code if code else None,
                    test_code=test_code if test_code else None,
                )
                db.add(assistant_msg)
                thread.updated_at = datetime.now(timezone.utc)
                await db.commit()

                yield {
                    "data": json.dumps({
                        "step": "done",
                        "status": "done",
                        "payload": answer,
                        "code": code,
                        "test_code": test_code,
                        "detail": "Completed",
                        "thread_id": str(thread.id),
                    })
                }
            except Exception as exc:
                logger.error("Chat streaming execution failed: %s", exc)
                yield {"data": json.dumps({"step": "done", "status": "failed", "detail": str(exc)})}

    return EventSourceResponse(event_generator())


def _is_codegen_request(message: str) -> bool:
    keywords = ["write", "generate", "create", "build", "script", "code", "function", "program"]
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in keywords)


@router.post("/ingest", dependencies=[Depends(require_role("admin"))])
async def ingest_file(
    file: UploadFile = File(...),
    collection: str = Form(...),
):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text")

    count = await ingest_document(collection, file.filename or "upload", text)
    return {"collection": collection, "filename": file.filename, "chunks_created": count}
