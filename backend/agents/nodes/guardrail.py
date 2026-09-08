"""Guardrail node for LangGraph agent pipeline: checks user input for prompt injection."""

import asyncio
import logging
from backend.agents.state import AgentState, get_last_user_message
from backend.security.guardrails import guardrail_manager

logger = logging.getLogger(__name__)


def _classify_severity(reason: str) -> str:
    """Classify incident severity based on block reason text."""
    lower = reason.lower()
    if any(k in lower for k in ("jailbreak", "dan mode", "override", "injection")):
        return "high"
    if any(k in lower for k in ("system prompt", "reveal", "internal instructions", "bypass")):
        return "high"
    if any(k in lower for k in ("inappropriate", "offensive", "profane", "security violation")):
        return "medium"
    return "low"


def guardrail_check(state: AgentState) -> dict:
    """Run NeMo Guardrails & input security checks before agent routing."""
    last_message = get_last_user_message(state)
    progress_events = list(state.get("progress_events", []))

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            is_blocked, reason = guardrail_manager.evaluate_input_sync(last_message)
        else:
            is_blocked, reason = loop.run_until_complete(guardrail_manager.evaluate_input(last_message))
    except Exception:
        from backend.security.guardrails import check_heuristic_prompt_injection
        is_blocked = check_heuristic_prompt_injection(last_message)
        reason = "Heuristic check flagged potential prompt injection." if is_blocked else "Passed fallback guardrail check."

    if is_blocked:
        progress_events.append({
            "step": "guardrail",
            "status": "failed",
            "detail": f"BLOCKED: {reason}",
        })

        # Persist the incident for admin review (fire-and-forget)
        try:
            from backend.api.security import log_security_incident
            severity = _classify_severity(reason)
            user_id = state.get("user_id")
            user_email = state.get("user_email")  # may be None if not passed

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(
                        log_security_incident(
                            prompt=last_message,
                            reason=reason,
                            user_id=user_id,
                            user_email=user_email,
                            severity=severity,
                        )
                    )
                else:
                    loop.run_until_complete(
                        log_security_incident(
                            prompt=last_message,
                            reason=reason,
                            user_id=user_id,
                            user_email=user_email,
                            severity=severity,
                        )
                    )
            except Exception as e:
                logger.debug("Async incident log task creation failed: %s", e)
        except Exception as exc:
            logger.warning("Failed to dispatch security incident logging: %s", exc)

        return {
            "error": reason,
            "final_answer": f"[Security Alert] {reason}",
            "progress_events": progress_events,
        }

    progress_events.append({
        "step": "guardrail",
        "status": "done",
        "detail": "Passed NeMo Guardrails security check",
    })
    return {"progress_events": progress_events}
