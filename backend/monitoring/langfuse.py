import os
import io
import logging
import inspect
import contextlib
from functools import wraps

logger = logging.getLogger(__name__)

langfuse = None
LANGFUSE_ENABLED = False

try:
    from langfuse import Langfuse
    from langfuse.callback import CallbackHandler

    secret_key = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    host = os.getenv("LANGFUSE_HOST") or os.getenv("LANGFUSE_BASE_URL") or "http://langfuse:3000"

    # Only attempt initialization if keys are provided and not dummy placeholders
    if secret_key and public_key and not secret_key.startswith("your_") and secret_key != "sk-lf-dummy":
        try:
            client = Langfuse(
                secret_key=secret_key,
                public_key=public_key,
                host=host,
            )
            # Suppress internal library stderr printing during auth check
            f = io.StringIO()
            with contextlib.redirect_stderr(f), contextlib.redirect_stdout(f):
                is_authed = client.auth_check()

            if is_authed:
                langfuse = client
                LANGFUSE_ENABLED = True
                logger.info("Langfuse monitoring active (host: %s)", host)
            else:
                logger.info("Langfuse credentials invalid; telemetry disabled.")
        except Exception:
            logger.info("Langfuse credentials unauthenticated; telemetry disabled.")
    else:
        logger.info("Langfuse credentials not provided; telemetry disabled.")
except Exception:
        logger.info("Langfuse package not available or not configured; telemetry disabled.")


def get_langfuse_callback(
    session_id: str | None = None,
    user_id: str | None = None,
    trace_name: str | None = None,
):
    """Return a LangChain CallbackHandler configured with session_id for Langfuse."""
    if not LANGFUSE_ENABLED or not langfuse:
        return None
    try:
        secret_key = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
        public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
        host = os.getenv("LANGFUSE_HOST") or os.getenv("LANGFUSE_BASE_URL") or "http://langfuse:3000"
        
        kwargs = {
            "secret_key": secret_key,
            "public_key": public_key,
            "host": host,
        }
        if session_id:
            kwargs["session_id"] = str(session_id)
        if user_id:
            kwargs["user_id"] = str(user_id)
        if trace_name:
            kwargs["trace_name"] = str(trace_name)

        return CallbackHandler(**kwargs)
    except Exception:
        return None


def trace_node(name: str):
    """Wrap a LangGraph node function (sync or async) with a Langfuse trace span including session_id."""
    def decorator(fn):
        if inspect.iscoroutinefunction(fn):
            @wraps(fn)
            async def async_wrapper(state, *args, **kwargs):
                if not LANGFUSE_ENABLED or langfuse is None:
                    return await fn(state, *args, **kwargs)

                session_id = state.get("thread_id") or state.get("session_id")
                trace_kwargs = {
                    "name": name,
                    "user_id": state.get("user_id", "anonymous"),
                    "metadata": {
                        "role": state.get("role", ""),
                        "intent": state.get("intent", ""),
                        "collections": state.get("allowed_collections", []),
                    },
                }
                if session_id:
                    trace_kwargs["session_id"] = str(session_id)

                try:
                    trace = langfuse.trace(**trace_kwargs)
                    span = trace.span(name=name)
                    result = await fn(state, *args, **kwargs)
                    events = result.get("progress_events", [])
                    span.end(output={"last_event": events[-1] if events else {}})
                    return result
                except Exception:
                    return await fn(state, *args, **kwargs)
            return async_wrapper
        else:
            @wraps(fn)
            def sync_wrapper(state, *args, **kwargs):
                if not LANGFUSE_ENABLED or langfuse is None:
                    return fn(state, *args, **kwargs)

                session_id = state.get("thread_id") or state.get("session_id")
                trace_kwargs = {
                    "name": name,
                    "user_id": state.get("user_id", "anonymous"),
                    "metadata": {
                        "role": state.get("role", ""),
                        "intent": state.get("intent", ""),
                        "collections": state.get("allowed_collections", []),
                    },
                }
                if session_id:
                    trace_kwargs["session_id"] = str(session_id)

                try:
                    trace = langfuse.trace(**trace_kwargs)
                    span = trace.span(name=name)
                    result = fn(state, *args, **kwargs)
                    events = result.get("progress_events", [])
                    span.end(output={"last_event": events[-1] if events else {}})
                    return result
                except Exception:
                    return fn(state, *args, **kwargs)
            return sync_wrapper
    return decorator
