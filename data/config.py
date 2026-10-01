"""Settings for the /data service.

Every value is loaded and validated once, at startup. A missing or
malformed value stops the process with a clear message instead of letting
a bad key reach the model provider at request time.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# An OpenAI secret key is only letters, digits, hyphens and underscores.
_OPENAI_KEY_PATTERN = re.compile(r"^sk-[A-Za-z0-9_-]{20,}$")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    api_shared_secret: str = Field(..., alias="API_SHARED_SECRET")
    port: int = Field(8000, alias="PORT")

    # The model used for prompt construction and direct answers, and the
    # cheaper one used for intent detection and title inference.
    openai_model: str = Field("gpt-4o", alias="OPENAI_MODEL")
    openai_fast_model: str = Field("gpt-4o-mini", alias="OPENAI_FAST_MODEL")
    openai_transcribe_model: str = Field("whisper-1", alias="OPENAI_TRANSCRIBE_MODEL")
    # Optional per step overrides. Each falls back to OPENAI_MODEL when unset,
    # so a step can be moved to a cheaper model by configuration alone.
    openai_intent_model: Optional[str] = Field(None, alias="OPENAI_INTENT_MODEL")
    openai_construct_model: Optional[str] = Field(None, alias="OPENAI_CONSTRUCT_MODEL")
    openai_answer_model: Optional[str] = Field(None, alias="OPENAI_ANSWER_MODEL")
    openai_vision_model: Optional[str] = Field(None, alias="OPENAI_VISION_MODEL")
    openai_search_model: Optional[str] = Field(None, alias="OPENAI_SEARCH_MODEL")
    openai_embed_model: str = Field("text-embedding-3-small", alias="OPENAI_EMBED_MODEL")
    openai_timeout_seconds: float = Field(90.0, alias="OPENAI_TIMEOUT_SECONDS")

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def _clean_openai_key(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("OPENAI_API_KEY must be a string")
        # Trim explicitly, a stray newline or trailing space pasted into a
        # dashboard must never reach the OpenAI client.
        trimmed = value.strip().strip('"').strip("'").strip()
        if not trimmed:
            raise ValueError("OPENAI_API_KEY is empty")
        if not _OPENAI_KEY_PATTERN.match(trimmed):
            # Deliberately not repaired. A key with junk appended is a
            # deployment mistake that should be fixed where it was made.
            raise ValueError(
                "OPENAI_API_KEY is malformed: expected 'sk-' followed only by letters, "
                "digits, hyphens and underscores, with no trailing characters"
            )
        return trimmed

    @field_validator("api_shared_secret", mode="before")
    @classmethod
    def _clean_shared_secret(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("API_SHARED_SECRET must be a string")
        trimmed = value.strip()
        if len(trimmed) < 16:
            raise ValueError("API_SHARED_SECRET must be at least 16 characters")
        return trimmed

    @field_validator("port")
    @classmethod
    def _valid_port(cls, value: int) -> int:
        if not 1 <= value <= 65535:
            raise ValueError("PORT must be between 1 and 65535")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
