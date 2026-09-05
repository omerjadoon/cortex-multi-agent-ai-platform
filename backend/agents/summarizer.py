"""Module for summarizing long chat conversation history to optimize LLM context window."""

import os
import logging
from typing import List, Dict, Optional
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

_SUMMARIZER_PROMPT = """\
You are a conversation summarizer for an AI agent workspace (Cortex CNC/CAD & Python Intelligence).
Your task is to maintain a concise, comprehensive running summary of a chat thread conversation history.

Existing Thread Summary (if any):
{existing_summary}

New Messages to Incorporate into Summary:
{new_messages_text}

Instructions:
1. Retain essential context: user goals, technical specs (e.g. G-code coordinates, tool numbers, algorithm constraints, Python library details), code generation outcomes, and key agent answers.
2. Omit filler phrases, raw greetings, or verbatim code repetitions unless critical.
3. Keep the overall summary under 300 words, structured into clear bullet points.
4. Output ONLY the updated thread summary text (no markdown intro/outro wrappers).
"""


def _get_llm():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    return ChatGroq(
        model="openai/gpt-oss-20b",
        api_key=api_key,
        temperature=0.1,
    )


async def generate_updated_summary(
    existing_summary: Optional[str],
    messages_to_summarize: List[Dict[str, str]],
) -> str:
    """Summarizes older conversation turns to optimize context window size."""
    if not messages_to_summarize:
        return existing_summary or ""

    formatted_messages = []
    for msg in messages_to_summarize:
        role_label = "User" if msg.get("role") == "user" else "Assistant"
        content = msg.get("content", "").strip()
        code_info = f" [Code snippet generated]" if msg.get("code") else ""
        formatted_messages.append(f"{role_label}: {content}{code_info}")

    new_messages_text = "\n".join(formatted_messages)

    llm = _get_llm()
    if llm:
        try:
            prompt = _SUMMARIZER_PROMPT.format(
                existing_summary=existing_summary or "None",
                new_messages_text=new_messages_text,
            )
            response = await llm.ainvoke([
                SystemMessage(content="You summarize chat history accurately."),
                HumanMessage(content=prompt),
            ])
            summary = response.content.strip()
            if summary:
                return summary
        except Exception as exc:
            logger.warning("LLM summarization failed: %s. Falling back to rule-based summary.", exc)

    # Fallback rule-based summary if LLM is unavailable or fails
    bullets = []
    if existing_summary:
        bullets.append(existing_summary)
    
    for msg in messages_to_summarize:
        role = "User" if msg.get("role") == "user" else "Assistant"
        text = msg.get("content", "")[:120].replace("\n", " ")
        bullets.append(f"• {role}: {text}")

    # Keep last 10 bullets max in fallback
    return "\n".join(bullets[-10:])
