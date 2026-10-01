"""POST /transcribe, the only place in the system that transcribes audio."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from core.providers import get_provider
from core.providers.base import ModelProvider, ProviderError
from schemas.responses import TranscribeResponse

logger = logging.getLogger("data.transcribe")

router = APIRouter()

MAX_AUDIO_BYTES = 15 * 1024 * 1024


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    provider: ModelProvider = Depends(get_provider),
) -> TranscribeResponse:
    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Recording is too long, keep voice messages under 15MB")

    try:
        text = await provider.transcribe(
            filename=audio.filename or "voice-message.webm",
            content=content,
            content_type=audio.content_type or "audio/webm",
        )
    except ProviderError as exc:
        logger.error("transcription failed status=%s code=%s: %s", exc.status, exc.code, exc)
        raise HTTPException(status_code=502, detail="Could not transcribe audio") from exc

    return TranscribeResponse(text=text)
