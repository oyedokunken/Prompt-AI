"""OpenAI implementation of the provider interface.

This is the only module in the whole system that talks to OpenAI.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from core.providers.base import ModelProvider, ProviderError, ProviderMessage, ProviderResponseError

logger = logging.getLogger("data.provider.openai")

# Target models the interface offers that this provider can actually run.
_SUPPORTED_MODELS = {"gpt-4o", "gpt-4o-mini"}


class OpenAIProvider(ModelProvider):
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str,
        default_model: str,
        fast_model: str,
        transcribe_model: str,
        timeout_seconds: float,
    ) -> None:
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=1)
        self._default_model = default_model
        self._fast_model = fast_model
        self._transcribe_model = transcribe_model

    def resolve_model(self, requested: str, *, fast: bool = False) -> str:
        if fast:
            return self._fast_model
        # Older sessions can still carry a target model with no provider
        # behind it, those run on the default model.
        return requested if requested in _SUPPORTED_MODELS else self._default_model

    @staticmethod
    def _to_openai_messages(system: str, messages: list[ProviderMessage]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = [{"role": "system", "content": system}]
        for message in messages:
            if message.images and message.role == "user":
                parts: list[dict[str, Any]] = [{"type": "text", "text": message.text}]
                parts.extend({"type": "image_url", "image_url": {"url": url}} for url in message.images)
                out.append({"role": "user", "content": parts})
            else:
                out.append({"role": message.role, "content": message.text})
        return out

    async def _complete(
        self,
        *,
        model: str,
        system: str,
        messages: list[ProviderMessage],
        max_tokens: int,
        temperature: float,
        json_mode: bool,
    ) -> str:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": self._to_openai_messages(system, messages),
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            completion = await self._client.chat.completions.create(**kwargs)
        except APIStatusError as exc:
            logger.error("OpenAI API error status=%s code=%s message=%s", exc.status_code, exc.code, exc.message)
            raise ProviderError(exc.message, status=exc.status_code, code=exc.code) from exc
        except APITimeoutError as exc:
            logger.error("OpenAI request timed out")
            raise ProviderError("The model provider timed out", code="timeout") from exc
        except APIConnectionError as exc:
            logger.error("OpenAI connection error: %s", exc)
            raise ProviderError("Could not reach the model provider", code="connection_error") from exc

        choice = completion.choices[0] if completion.choices else None
        text = (choice.message.content or "") if choice else ""
        if choice is not None and choice.finish_reason == "length":
            logger.error("OpenAI response truncated by the token limit, length=%d", len(text))
            raise ProviderResponseError("The model response was cut off by the token limit")
        if not text.strip():
            raise ProviderResponseError("The model returned an empty response")
        return text

    async def complete_json(
        self,
        *,
        model: str,
        system: str,
        messages: list[ProviderMessage],
        max_tokens: int,
        temperature: float,
    ) -> dict[str, Any]:
        raw = await self._complete(
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=True,
        )
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error("OpenAI response was not valid JSON, head=%r tail=%r", raw[:200], raw[-200:])
            raise ProviderResponseError("The model response was not valid JSON") from exc
        if not isinstance(parsed, dict):
            raise ProviderResponseError("The model response was not a JSON object")
        return parsed

    async def complete_text(
        self,
        *,
        model: str,
        system: str,
        messages: list[ProviderMessage],
        max_tokens: int,
        temperature: float,
    ) -> str:
        raw = await self._complete(
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=False,
        )
        return raw.strip()

    async def transcribe(self, *, filename: str, content: bytes, content_type: str) -> str:
        try:
            result = await self._client.audio.transcriptions.create(
                model=self._transcribe_model,
                file=(filename, content, content_type),
            )
        except APIStatusError as exc:
            logger.error("OpenAI transcription error status=%s code=%s", exc.status_code, exc.code)
            raise ProviderError(exc.message, status=exc.status_code, code=exc.code) from exc
        except (APITimeoutError, APIConnectionError) as exc:
            logger.error("OpenAI transcription connection error: %s", exc)
            raise ProviderError("Could not reach the model provider", code="connection_error") from exc
        return (result.text or "").strip()
