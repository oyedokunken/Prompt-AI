"""Intent detection.

Decides what an incoming message is, and whether there is enough to build
a prompt or clarifying questions are needed first.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional

from core.context import PipelineContext
from core.pipeline import clarify, research
from core.prompts.system_prompts import intent_system_prompt
from core.providers.base import ModelProvider, ProviderMessage
from schemas.requests import ClarifyQuestion

IntentKind = Literal["prompt_request", "conversation", "answer"]

MIN_OPTIONS = 2
MAX_OPTIONS = 6


@dataclass(frozen=True)
class IntentDecision:
    kind: IntentKind
    sufficient: bool = True
    intro: str = ""
    questions: list[ClarifyQuestion] = field(default_factory=list)
    # Web searches the model decided are worth running, usually none.
    search_queries: list[str] = field(default_factory=list)
    reason: str = ""

    @property
    def needs_clarification(self) -> bool:
        return self.kind == "prompt_request" and not self.sufficient


def _parse_questions(raw: Any) -> list[ClarifyQuestion]:
    if not isinstance(raw, list):
        return []
    questions: list[ClarifyQuestion] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())

        options: Optional[list[str]] = None
        raw_options = item.get("options")
        if isinstance(raw_options, list):
            cleaned = list(dict.fromkeys(str(o).strip() for o in raw_options if str(o).strip()))
            # Fewer than two options is not a real choice, fall back to a
            # text answer rather than forcing one.
            if len(cleaned) >= MIN_OPTIONS:
                options = cleaned[:MAX_OPTIONS]

        questions.append(
            ClarifyQuestion(
                id=f"q{len(questions) + 1}",
                text=text,
                options=options,
                multiple=bool(item.get("multiple")) and options is not None,
            )
        )
        if len(questions) == clarify.MAX_QUESTIONS:
            break
    return questions


def parse_intent(raw: dict[str, Any], *, has_pending_question: bool) -> IntentDecision:
    """Turn the model's classification into a decision the pipeline can trust."""
    kind = raw.get("kind")
    reason = str(raw.get("reason") or "").strip()

    if kind == "conversation":
        return IntentDecision(kind="conversation", reason=reason)
    if kind == "answer" and has_pending_question:
        return IntentDecision(kind="answer", reason=reason)

    # Anything else, including an "answer" with no question pending, is
    # treated as a prompt request.
    questions = _parse_questions(raw.get("questions"))
    sufficient = raw.get("sufficient") is not False or not questions
    queries = research.clean_queries(raw.get("search_queries"))
    if sufficient:
        return IntentDecision(kind="prompt_request", sufficient=True, search_queries=queries, reason=reason)
    return IntentDecision(
        kind="prompt_request",
        sufficient=False,
        intro=str(raw.get("intro") or "").strip(),
        questions=questions,
        search_queries=queries,
        reason=reason,
    )


def build_messages(ctx: PipelineContext) -> list[ProviderMessage]:
    messages = [ProviderMessage(role=m.role, text=m.content) for m in ctx.history]
    messages.append(ProviderMessage(role="user", text=ctx.message))
    return messages


async def detect(ctx: PipelineContext, provider: ModelProvider) -> IntentDecision:
    pending = clarify.pending_question(ctx.clarify_state) if ctx.clarify_state else None

    # Submitted through the question interface, so it is the answer to the
    # pending question by construction. No model call needed.
    if ctx.is_clarify_answer and pending is not None:
        return IntentDecision(kind="answer", reason="Submitted as the answer to the pending question")

    # The main model, not the fast one. The small model asks needless
    # questions about details a sensible default would cover, which the
    # eval set measures.
    raw = await provider.complete_json(
        model=provider.resolve_model(ctx.target_model),
        system=intent_system_prompt(ctx, pending),
        messages=build_messages(ctx),
        max_tokens=700,
        temperature=0.1,
    )
    return parse_intent(raw, has_pending_question=pending is not None)
