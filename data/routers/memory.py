"""POST /memory-summary, a short plain prose description of what is stored about a user."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from core.providers import get_provider
from core.providers.base import ModelProvider, ProviderError, ProviderMessage, ProviderResponseError
from core.pipeline.construct import plain_dashes
from schemas.requests import MemorySummaryRequest
from schemas.responses import MemorySummaryResponse

logger = logging.getLogger("data.memory")

router = APIRouter()

SYSTEM_PROMPT = """You write a short description of a person from the details Prompt AI has stored about them, addressed to that person.

Write 2 to 5 sentences of natural, conversational prose in the second person, the way a thoughtful colleague would sum you up. For example: "You're Kenny, a software developer with three years of experience, and right now you're building a prompt engineering tool. You like working in React and Next.js."

Rules:
- Use only the stored details given. Never add, guess or embellish. If a detail is not there, it is not in your description.
- Weave related details together into sentences. Do not list them, do not use bullet points, headings or markdown, and do not repeat the same fact twice.
- Use their name only if it is stored. Never assume a gender and never use he, she or they for them, speak to them as "you".
- Keep every number, name and project exactly as stored.
- If very little is stored, say so honestly in one or two sentences and do not pad.
- No em dashes.

Respond with a single JSON object and nothing outside it: { "summary": "the prose" }"""


def _render(body: MemorySummaryRequest) -> str:
    lines = []
    for label, value in (
        ("Name", body.profile.preferred_name),
        ("Role", body.profile.role),
        ("What they do", body.profile.about),
        ("Currently working on", body.profile.working_on),
        ("Main use for Prompt AI", body.profile.primary_use),
    ):
        if value and value.strip():
            lines.append(f"- {label}: {value.strip()}")
    for m in body.memories:
        lines.append(f"- [{m.category}] {m.key}: {m.value}")
    return "\n".join(lines) or "- nothing stored"


@router.post("/memory-summary", response_model=MemorySummaryResponse)
async def memory_summary(
    body: MemorySummaryRequest,
    provider: ModelProvider = Depends(get_provider),
) -> MemorySummaryResponse:
    try:
        raw = await provider.complete_json(
            model=provider.resolve_model("", fast=True),
            system=SYSTEM_PROMPT,
            messages=[ProviderMessage(role="user", text="STORED DETAILS\n" + _render(body))],
            max_tokens=300,
            temperature=0.3,
            step="memory_summary",
        )
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("memory summary failed: %s", exc)
        raise HTTPException(status_code=502, detail="Memory summary failed") from exc

    summary = plain_dashes(str(raw.get("summary") or "")).strip()
    if not summary:
        raise HTTPException(status_code=502, detail="Memory summary returned nothing")
    return MemorySummaryResponse(summary=summary)
