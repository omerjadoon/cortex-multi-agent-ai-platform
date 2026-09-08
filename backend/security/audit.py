"""Structured Security Audit Logger for Enterprise Governance & Compliance."""

import logging
import json
from datetime import datetime, timezone
from typing import Optional, Any

logger = logging.getLogger("cortex.security.audit")


def log_audit_event(
    event_type: str,
    action: str,
    user_id: Optional[str] = None,
    tenant_id: str = "default_tenant",
    resource: Optional[str] = None,
    status: str = "SUCCESS",
    details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Log a structured security audit record.
    
    Args:
        event_type: Category of event (e.g. 'AUTHENTICATION', 'AUTHORIZATION', 'DATA_INGESTION', 'CODE_EXECUTION', 'ADMIN_ACTION')
        action: Specific operation performed (e.g. 'LOGIN_SUCCESS', 'DELETE_DOCUMENT', 'GENERATE_CODE', 'ROLE_UPDATE')
        user_id: ID of the acting user
        tenant_id: Organization / Tenant ID
        resource: Target resource or URI
        status: Operation outcome ('SUCCESS', 'DENIED', 'FAILED')
        details: Additional context payload
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "action": action,
        "user_id": user_id or "anonymous",
        "tenant_id": tenant_id,
        "resource": resource or "none",
        "status": status,
        "details": details or {},
    }

    # Output structured JSON audit line for SIEM / Log Collectors (Splunk, Datadog, ELK)
    logger.info("AUDIT_LOG %s", json.dumps(record))
    return record
