"""Provider selection. Routers depend on `get_provider`, never on a concrete class."""

from __future__ import annotations

from functools import lru_cache

from config import get_settings
from core.providers.base import ModelProvider
from core.providers.openai_provider import OpenAIProvider


@lru_cache
def get_provider() -> ModelProvider:
    settings = get_settings()
    return OpenAIProvider(
        api_key=settings.openai_api_key,
        default_model=settings.openai_model,
        fast_model=settings.openai_fast_model,
        transcribe_model=settings.openai_transcribe_model,
        embed_model=settings.openai_embed_model,
        timeout_seconds=settings.openai_timeout_seconds,
        reasoning_effort=settings.openai_reasoning_effort,
        fallback_model=settings.openai_fallback_model,
        step_models={
            "intent": settings.openai_intent_model,
            "construct": settings.openai_construct_model,
            "answer": settings.openai_answer_model,
            "vision": settings.openai_vision_model,
            "search": settings.openai_search_model,
        },
    )
