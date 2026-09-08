"""Security Incidents API — log and retrieve guardrail-blocked prompts for admin review."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.rbac import get_current_user, require_role, UserContext
from backend.db.session import get_db, AsyncSessionLocal
from backend.auth.models import SecurityIncident, SecurityIncidentSeverity

logger = logging.getLogger(__name__)

router = APIRouter(tags=["security"])


class SecurityIncidentCreate(BaseModel):
    prompt: str
    reason: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    severity: str = "medium"


# ── Internal helper ── called directly from the guardrail node (no auth needed) ──

async def log_security_incident(
    prompt: str,
    reason: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    severity: str = "medium",
) -> None:
    """Persist a security incident to the database. Silently swallows errors."""
    try:
        sev = SecurityIncidentSeverity(severity) if severity in ("low", "medium", "high") else SecurityIncidentSeverity.medium
        async with AsyncSessionLocal() as db:
            incident = SecurityIncident(
                user_id=uuid.UUID(user_id) if user_id else None,
                user_email=user_email,
                prompt=prompt[:4000],  # cap length
                reason=reason[:2000],
                severity=sev,
            )
            db.add(incident)
            await db.commit()
            logger.info("Security incident logged for prompt: %s...", prompt[:60])
    except Exception as exc:
        logger.warning("Failed to log security incident: %s", exc)


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/security/incidents", dependencies=[Depends(require_role("admin"))])
async def list_incidents(
    reviewed: Optional[bool] = Query(None, description="Filter by reviewed status"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all security incidents, optionally filtered by reviewed status."""
    stmt = select(SecurityIncident).order_by(SecurityIncident.created_at.desc()).limit(limit)
    if reviewed is not None:
        stmt = stmt.where(SecurityIncident.reviewed == reviewed)
    result = await db.execute(stmt)
    incidents = result.scalars().all()

    return [
        {
            "id": str(i.id),
            "user_email": i.user_email,
            "prompt": i.prompt,
            "reason": i.reason,
            "severity": i.severity.value,
            "reviewed": i.reviewed,
            "created_at": i.created_at.isoformat(),
        }
        for i in incidents
    ]


@router.patch("/security/incidents/{incident_id}/review", dependencies=[Depends(require_role("admin"))])
async def mark_reviewed(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Mark a security incident as reviewed."""
    try:
        inc_uuid = uuid.UUID(incident_id)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid incident_id")

    await db.execute(
        update(SecurityIncident)
        .where(SecurityIncident.id == inc_uuid)
        .values(reviewed=True)
    )
    await db.commit()
    return {"status": "reviewed", "id": incident_id}
