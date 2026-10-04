"""OpenAI implementation of the provider interface.

This is the only module in the whole system that talks to OpenAI.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from core import usage
from core.providers.base import (
    ModelProvider,
    ProviderError,
    ProviderMessage,
    ProviderResponseError,
    SearchOutcome,
    SearchSource,
)

logger = logging.getLogger("data.provider.openai")

def _strip_tracking(url: str) -> str:
    """Drop the provider's utm_source tag, keeping any other query parameters."""
    parts = urlsplit(url)
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "utm_source"])
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


# Target models the interface offers that this provider can actually run.
_SUPPORTED_MODELS = {"gpt-4o", "gpt-4o-mini"}


_REASONING_MODEL = re.compile(r"^(gpt-5|o[0-9])")


def is_reasoning_model(model: str) -> bool:
    """The GPT-5 family and the o series take different parameters from earlier chat models."""
    return bool(_REASONING_MODEL.match(model)) and "chat-latest" not in model


class OpenAIProvider(ModelProvider):
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str,
        default_model: str,
        fast_model: str,
        transcribe_model: str,
        embed_model: str,
        timeout_seconds: float,
        step_models: Optional[dict[str, str]] = None,
        reasoning_effort: str = "low",
        fallback_model: Optional[str] = None,
    ) -> None:
        self._fallback_model = fallback_model
        self._reasoning_effort = reasoning_effort
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=1)
        self._default_model = default_model
        self._fast_model = fast_model
        self._transcribe_model = transcribe_model
        self._embed_model = embed_model
        self._step_models = {k: v for k, v in (step_models or {}).items() if v}

    def resolve_model(self, requested: str, *, fast: bool = False, step: Optional[str] = None) -> str:
        if fast:
            return self._fast_model
        if step and step in self._step_models:
            return self._step_models[step]
        # Older sessions can still carry a target model with no provider
        # behind it, those run on the default model.
        return requested if requested in _SUPPORTED_MODELS else self._default_model

    def fallback_model(self, model: str) -> Optional[str]:
        return self._fallback_model if self._fallback_model and self._fallback_model != model else None

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

    @staticmethod
    def _record_chat_usage(step: str, model: str, completion: Any) -> None:
        u = getattr(completion, "usage", None)
        if u is None:
            return
        details = getattr(u, "prompt_tokens_details", None)
        usage.record(
            step,
            model,
            prompt_tokens=getattr(u, "prompt_tokens", 0) or 0,
            cached_tokens=(getattr(details, "cached_tokens", 0) or 0) if details else 0,
            completion_tokens=getattr(u, "completion_tokens", 0) or 0,
        )

    async def _complete(
        self,
        *,
        model: str,
        system: str,
        messages: list[ProviderMessage],
        max_tokens: int,
        temperature: float,
        json_mode: bool,
        step: str,
    ) -> str:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": self._to_openai_messages(system, messages),
        }
        if is_reasoning_model(model):
            # Reasoning models spend part of the budget thinking before they
            # write, so the cap covers both. They fix their own temperature.
            kwargs["max_completion_tokens"] = max_tokens
            kwargs["reasoning_effort"] = self._reasoning_effort
        else:
            kwargs["max_tokens"] = max_tokens
            kwargs["temperature"] = temperature
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

        self._record_chat_usage(step, model, completion)
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
        step: str = "",
    ) -> dict[str, Any]:
        raw = await self._complete(
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=True,
            step=step,
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
        step: str = "",
    ) -> str:
        raw = await self._complete(
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=False,
            step=step,
        )
        return raw.strip()

    async def search(self, *, model: str, query: str, step: str = "search") -> SearchOutcome:
        """Web search through the provider's own search tool.

        The model decides what to read and answers from it, and the
        citations it attaches are returned as the sources.
        """
        # A lookup answers a question about a real person, place or fact, so it
        # reads wider and reports more than the short research note that only
        # feeds a prompt.
        lookup = step == "lookup"
        if lookup:
            instruction = (
                "Search the web and report what is publicly known about the query below, drawing on more than one source. "
                "Plain text, no markdown, at most 250 words. Give full names, current and past roles with the organisations and dates, "
                "and the most notable facts. If more than one real person or thing matches the query, say so and describe each briefly. "
                "Report only what the sources support, and leave out anything you cannot tie to a source.\n\n"
            )
        else:
            instruction = (
                "Search the web and report concise, factual findings for the query below. "
                "Plain text, no markdown, at most 150 words. State dates where they matter.\n\n"
            )
        try:
            response = await self._client.responses.create(
                model=model,
                tools=[{"type": "web_search_preview", "search_context_size": "medium" if lookup else "low"}],
                max_output_tokens=1000 if lookup else 500,
                input=f"{instruction}Query: {query}",
            )
        except APIStatusError as exc:
            logger.error("OpenAI search error status=%s code=%s message=%s", exc.status_code, exc.code, exc.message)
            raise ProviderError(exc.message, status=exc.status_code, code=exc.code) from exc
        except (APITimeoutError, APIConnectionError) as exc:
            logger.error("OpenAI search connection error: %s", exc)
            raise ProviderError("Could not reach the model provider", code="connection_error") from exc

        u = getattr(response, "usage", None)
        if u is not None:
            details = getattr(u, "input_tokens_details", None)
            usage.record(
                step,
                model,
                prompt_tokens=getattr(u, "input_tokens", 0) or 0,
                cached_tokens=(getattr(details, "cached_tokens", 0) or 0) if details else 0,
                completion_tokens=getattr(u, "output_tokens", 0) or 0,
                extra_cost_usd=usage.SEARCH_CALL_USD,
            )

        sources: list[SearchSource] = []
        seen: set[str] = set()
        for item in response.output:
            if getattr(item, "type", None) != "message":
                continue
            for part in getattr(item, "content", []) or []:
                for annotation in getattr(part, "annotations", []) or []:
                    url = getattr(annotation, "url", None)
                    if getattr(annotation, "type", "") != "url_citation" or not url:
                        continue
                    clean = _strip_tracking(url)
                    if clean in seen:
                        continue
                    seen.add(clean)
                    sources.append(SearchSource(title=(getattr(annotation, "title", "") or "").strip(), url=clean))

        # Citations are returned separately, drop the inline markdown links.
        text = re.sub(r"\s*\(\[[^\]]*\]\([^)]*\)\)", "", response.output_text or "")
        text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text).strip()
        if not text:
            raise ProviderResponseError("The search returned nothing")
        return SearchOutcome(summary=text, sources=sources[:5])

    async def embed(self, texts: list[str], *, step: str = "memory_embed") -> list[list[float]]:
        if not texts:
            return []
        try:
            result = await self._client.embeddings.create(model=self._embed_model, input=texts)
        except APIStatusError as exc:
            logger.error("OpenAI embeddings error status=%s code=%s", exc.status_code, exc.code)
            raise ProviderError(exc.message, status=exc.status_code, code=exc.code) from exc
        except (APITimeoutError, APIConnectionError) as exc:
            logger.error("OpenAI embeddings connection error: %s", exc)
            raise ProviderError("Could not reach the model provider", code="connection_error") from exc
        u = getattr(result, "usage", None)
        if u is not None:
            usage.record(step, self._embed_model, prompt_tokens=getattr(u, "prompt_tokens", 0) or 0)
        return [item.embedding for item in result.data]

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
        minutes = len(content) / usage.APPROX_AUDIO_BYTES_PER_MINUTE
        usage.record("transcribe", self._transcribe_model, extra_cost_usd=minutes * usage.TRANSCRIBE_USD_PER_MINUTE)
        return (result.text or "").strip()
