"""Router node: classifies the user's intent as 'rag', 'codegen', or 'out_of_scope'."""

import json
import os
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import AgentState, get_last_user_message

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=os.environ.get("GROQ_API_KEY"),
    temperature=0,
)

_SYSTEM_PROMPT = """\
You are an intent classifier for OpenMind AI. Given a user message, classify it into exactly one of three categories:

1. "codegen": The user wants ANY code, Python script, programming function, hello world script, software task, or automation written or generated. ANY request containing phrases like "generate a script", "write code", "write a python program", "create a script", "make a function", "print hello world", "i wanna use python", etc. MUST BE CLASSIFIED AS "codegen".
2. "rag": The user is asking a question related to OpenMind, company contact info, address, email, phone numbers, Cortex platform, system architecture, CNC/CAD intelligence, vector search, code analysis, RBAC, or platform features.
3. "out_of_scope": The user is asking completely general/unrelated questions (e.g. general history, weather, sports, cooking, trivia, jokes, or casual chit-chat with ZERO relation to OpenMind or programming).

IMPORTANT RULES:
- Prompts asking to write, generate, or code scripts/programs (including harmless scripts like "generate a script that print hello world", "fibonacci script", "data parser") are ALWAYS "codegen".
- Follow-up responses providing programming choices (e.g. "i wanna use python", "python 3", "use fastapi") in a coding thread are ALWAYS "codegen".
- Queries asking about OpenMind, contact info, support, phone, email, address, company locations, CNC/CAD, or software architecture are ALWAYS "rag".
- NEVER classify OpenMind, contact, support, or programming-related queries as "out_of_scope". If uncertain, default to "rag".

Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{"intent": "codegen"}
or
{"intent": "rag"}
or
{"intent": "out_of_scope"}
"""

CODEGEN_PHRASES = [
    "generate a script", "write a script", "create a script", "build a script",
    "python script", "write python", "generate python", "print hello world",
    "hello world", "write code", "generate code", "create code", "write a function",
    "write function", "make a script", "make a python", "code a script", "script that",
    "use python", "wanna use python", "want to use python", "in python"
]

RAG_PHRASES = [
    "openmind", "open mind", "cortex", "contact", "phone", "email", "address",
    "support", "documentation", "info", "help", "about", "feature", "vector",
    "qdrant", "bm25", "search", "hypermill", "cnc", "cad", "user", "admin",
    "rbac", "login", "collection", "ingest", "chunk", "rag", "location",
    "headquarters", "office", "germany", "uk", "india", "japan", "us"
]


def route_intent(state: AgentState) -> dict:
    """Classify user intent using fast heuristics and LLM fallback."""
    last_message = get_last_user_message(state)
    lower_msg = last_message.lower().strip()

    # Check if thread has prior coding context
    has_codegen_context = False
    for msg in state.get("messages", []):
        content = get_last_user_message({"messages": [msg]}).lower()
        if any(phrase in content for phrase in CODEGEN_PHRASES):
            has_codegen_context = True
            break

    # 1. Fast heuristic check for explicit code generation requests or follow-ups
    if any(phrase in lower_msg for phrase in CODEGEN_PHRASES) or (has_codegen_context and "python" in lower_msg):
        intent = "codegen"
        logger.info("Matched heuristic 'codegen' for prompt: %s", last_message[:60])
    # 2. Fast heuristic check for OpenMind knowledge base / RAG queries
    elif any(phrase in lower_msg for phrase in RAG_PHRASES):
        intent = "rag"
        logger.info("Matched heuristic 'rag' for prompt: %s", last_message[:60])
    # 3. LLM classification fallback
    else:
        try:
            response = _llm.invoke([
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=last_message),
            ])
            raw = response.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = json.loads(raw)
            intent = parsed.get("intent", "rag")
            if intent not in ("rag", "codegen", "out_of_scope"):
                intent = "rag"
        except Exception as exc:
            logger.warning("Intent classification failed (%s), defaulting to 'rag'", exc)
            intent = "rag"

    progress_events = list(state.get("progress_events", []))
    progress_events.append({
        "step": "routing",
        "status": "done",
        "detail": f"Intent: {intent}",
    })

    return {"intent": intent, "progress_events": progress_events}
