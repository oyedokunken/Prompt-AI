"""Prompt construction.

Assembles the final structured prompt from the original message, the
clarifying answers that were gathered, and the active template.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from core.context import PipelineContext
from core.pipeline import clarify
from core.prompts.system_prompts import answer_system_prompt, construct_system_prompt
from core.prompts.targets import FormatStyle, choose_format
from core.providers.base import ModelProvider, ProviderMessage, ProviderResponseError
from schemas.requests import ClarifyState
from schemas.responses import MemoryCandidate, Readiness, StructuredPrompt

# A comprehensive, production ready prompt can legitimately run long. A
# tighter budget cut detailed requests off mid JSON.
CONSTRUCT_MAX_TOKENS = 6000


@dataclass(frozen=True)
class ConstructedPrompt:
    content: str
    stated: list[str] = field(default_factory=list)
    researched: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    structured: StructuredPrompt = field(default_factory=StructuredPrompt)
    readiness: Readiness = field(default_factory=Readiness)
    explanation: Optional[str] = None
    memory_candidates: list[MemoryCandidate] = field(default_factory=list)
    # The conversational wrapper around the deliverable.
    message: Optional[str] = None


@dataclass(frozen=True)
class AnswerResult:
    text: str
    memory_candidates: list[MemoryCandidate] = field(default_factory=list)


def build_user_turn(ctx: PipelineContext, state: Optional[ClarifyState]) -> str:
    """The final user turn handed to the model.

    When a clarifying sequence ran, the original request and every answer
    are restated together, so the prompt is built from the whole exchange
    and not only from the last thing the user typed.
    """
    if state is None:
        text = ctx.message
    else:
        lines = [f"Original request:\n{state.original_message}", "", "Answers to your clarifying questions:"]
        for index, (question, answer) in enumerate(clarify.question_answer_pairs(state), start=1):
            lines.append(f"{index}. {question}\n   Answer: {answer}")
        lines.append("")
        lines.append("Build the final prompt now, using the original request and every answer above.")
        text = "\n".join(lines)

    return text


def build_messages(ctx: PipelineContext, state: Optional[ClarifyState]) -> list[ProviderMessage]:
    messages = [ProviderMessage(role=m.role, text=m.content) for m in ctx.history]
    messages.append(ProviderMessage(role="user", text=build_user_turn(ctx, state)))
    return messages


def _string_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if isinstance(item, (str, int, float)) and str(item).strip()]


def _optional_text(raw: Any) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    return raw.strip() or None


def parse_memory_candidates(raw: Any) -> list[MemoryCandidate]:
    """Facts the model proposes to remember, kept only when well formed."""
    candidates: list[MemoryCandidate] = []
    if not isinstance(raw, list):
        return candidates
    for item in raw:
        if not isinstance(item, dict):
            continue
        key, value = _optional_text(item.get("key")), _optional_text(item.get("value"))
        if not key or not value:
            continue
        confidence = item.get("confidence")
        candidates.append(
            MemoryCandidate(
                category=_optional_text(item.get("category")) or "other",
                key=key,
                value=value,
                confidence=float(confidence) if isinstance(confidence, (int, float)) else None,
            )
        )
    return candidates


def parse_construction(raw: dict[str, Any]) -> ConstructedPrompt:
    content = raw.get("content")
    if not isinstance(content, str) or not content.strip():
        raise ProviderResponseError("The model returned no prompt content")

    structured_raw = raw.get("structured") if isinstance(raw.get("structured"), dict) else {}
    readiness_raw = raw.get("readiness") if isinstance(raw.get("readiness"), dict) else {}

    stated = _string_list(raw.get("stated"))
    # Nothing may sit in two lists. Stated wins over researched, which wins
    # over inferred: if the user said it, or a source held it, it was not a guess.
    stated_keys = {s.lower() for s in stated}
    researched = [r for r in _string_list(raw.get("researched")) if r.lower() not in stated_keys]
    known = stated_keys | {r.lower() for r in researched}
    assumptions = [a for a in _string_list(raw.get("assumptions")) if a.lower() not in known]

    candidates = parse_memory_candidates(raw.get("memory_candidates"))

    return ConstructedPrompt(
        message=_optional_text(raw.get("message")),
        content=content.strip(),
        stated=stated,
        researched=researched,
        assumptions=assumptions,
        structured=StructuredPrompt(
            role=_optional_text(structured_raw.get("role")),
            context=_optional_text(structured_raw.get("context")),
            constraints=_string_list(structured_raw.get("constraints")),
            format=_optional_text(structured_raw.get("format")),
        ),
        readiness=Readiness(
            status="needs_context" if readiness_raw.get("status") == "needs_context" else "ready",
            missing=_string_list(readiness_raw.get("missing")),
            notes=_optional_text(readiness_raw.get("notes")),
        ),
        explanation=_optional_text(raw.get("explanation")),
        memory_candidates=candidates,
    )


def format_style_for(ctx: PipelineContext, state: Optional[ClarifyState]) -> FormatStyle:
    """Plain by default, markdown or tagged sections only when the destination calls for it."""
    parts = [state.original_message if state else ctx.message]
    if state:
        parts.extend(answer for _, answer in clarify.question_answer_pairs(state))
    else:
        parts.append(ctx.message)
    return choose_format(ctx.target_model, "\n".join(parts))


def leaks_user_name(prompt: ConstructedPrompt, name: Optional[str]) -> bool:
    """True when the user's own name appears inside the generated prompt.

    The prompt is addressed to a different AI, so the name has no place in
    it. Checked in code because a rule in the instructions alone is not
    reliably followed.
    """
    if not name:
        return False
    pattern = re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE)
    haystack = " ".join(
        [prompt.content, prompt.structured.role or "", prompt.structured.context or ""]
    )
    return bool(pattern.search(haystack))


NAME_CORRECTION = (
    "Your last attempt put the user's name inside the prompt. The prompt is addressed to a "
    "different AI, so the name must not appear anywhere in it. Rebuild it, referring to "
    "\"the user\" or to their role instead where needed."
)


async def construct(
    ctx: PipelineContext, state: Optional[ClarifyState], provider: ModelProvider
) -> ConstructedPrompt:
    messages = build_messages(ctx, state)
    style = format_style_for(ctx, state)
    built: Optional[ConstructedPrompt] = None

    # One corrective retry at most, never a loop.
    for attempt in range(2):
        raw = await provider.complete_json(
            model=provider.resolve_model(ctx.target_model),
            system=construct_system_prompt(ctx, style),
            messages=messages,
            max_tokens=CONSTRUCT_MAX_TOKENS,
            temperature=0.4,
        )
        built = parse_construction(raw)
        if not leaks_user_name(built, ctx.profile.preferred_name):
            return built
        if attempt == 0:
            messages = [*messages, ProviderMessage(role="assistant", text=json.dumps(raw)), ProviderMessage(role="user", text=NAME_CORRECTION)]

    # Still there after the retry. Strip it rather than ship it.
    assert built is not None
    name = ctx.profile.preferred_name or ""
    scrub = re.compile(rf"\b{re.escape(name)}(?:'s)?\b", re.IGNORECASE)
    return ConstructedPrompt(
        message=built.message,
        content=scrub.sub("the user", built.content),
        stated=built.stated,
        researched=built.researched,
        assumptions=built.assumptions,
        structured=StructuredPrompt(
            role=built.structured.role,
            context=scrub.sub("the user", built.structured.context) if built.structured.context else None,
            constraints=built.structured.constraints,
            format=built.structured.format,
        ),
        readiness=built.readiness,
        explanation=built.explanation,
        memory_candidates=built.memory_candidates,
    )


async def answer_directly(ctx: PipelineContext, provider: ModelProvider) -> AnswerResult:
    """Reply conversationally: questions about the user, banter, anything that is not a prompt request.

    Returns the reply together with any stable fact the user revealed, so
    memory can grow from casual conversation too.
    """
    messages = [ProviderMessage(role=m.role, text=m.content) for m in ctx.history]
    messages.append(ProviderMessage(role="user", text=ctx.message))
    raw = await provider.complete_json(
        model=provider.resolve_model(ctx.target_model),
        system=answer_system_prompt(ctx),
        messages=messages,
        max_tokens=900,
        temperature=0.7,
    )
    reply = _optional_text(raw.get("reply"))
    if not reply:
        raise ProviderResponseError("The model returned no reply")
    return AnswerResult(text=reply, memory_candidates=parse_memory_candidates(raw.get("memory_candidates")))
