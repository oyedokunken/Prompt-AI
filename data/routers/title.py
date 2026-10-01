"""POST /title, a short inferred title for a conversation."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from core.context import assemble_title_source
from core.prompts.system_prompts import title_system_prompt
from core.providers import get_provider
from core.providers.base import ModelProvider, ProviderError, ProviderMessage, ProviderResponseError
from schemas.requests import TitleRequest
from schemas.responses import TitleResponse

logger = logging.getLogger("data.title")

router = APIRouter()

MAX_TITLE_LENGTH = 60


def clean_title(raw: object) -> str:
    if not isinstance(raw, str):
        return ""
    title = " ".join(raw.split()).strip().strip("\"'").rstrip(".!?:;,").strip()
    return title[:MAX_TITLE_LENGTH].strip()


@router.post("/title", response_model=TitleResponse)
async def title(
    body: TitleRequest,
    provider: ModelProvider = Depends(get_provider),
) -> TitleResponse:
    source = assemble_title_source(body)
    if not source:
        raise HTTPException(status_code=400, detail="No message text to title")

    try:
        raw = await provider.complete_json(
            model=provider.resolve_model("", fast=True),
            system=title_system_prompt(),
            messages=[ProviderMessage(role="user", text=source)],
            max_tokens=40,
            temperature=0.3,
            step="title",
        )
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("title inference failed: %s", exc)
        raise HTTPException(status_code=502, detail="Title inference failed") from exc

    inferred = clean_title(raw.get("title"))
    if not inferred:
        raise HTTPException(status_code=502, detail="Title inference returned nothing")
    return TitleResponse(title=inferred)
