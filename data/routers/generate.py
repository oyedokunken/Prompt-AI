"""POST /generate, the core chat and prompt construction endpoint.

Streams stage events as each step of the pipeline actually starts, then
exactly one terminal event: a clarifying question, a direct answer, a
final result, or an error.
"""

from __future__ import annotations

import dataclasses
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import events
from core.context import PipelineContext, assemble_context, read_attachments, run_research
from core.pipeline import clarify, construct, intent, research, score
from core.prompts.loader import ACTIVE_VERSION
from core.providers import get_provider
from core.providers.base import ModelProvider, ProviderError, ProviderResponseError
from schemas.requests import ClarifyState, GenerateRequest, SourceNote
from schemas.responses import (
    AnswerEvent,
    ClarifyingQuestionEvent,
    ErrorEvent,
    ResultEvent,
    SourceSummary,
)

logger = logging.getLogger("data.generate")

router = APIRouter()

# Shown to the user when generation genuinely fails. Never dressed up as a
# real result: no prompt, no score, nothing that implies work happened.
GENERATION_FAILED_MESSAGE = "Generation failed. Please try again."


def _question_event(state: ClarifyState) -> ClarifyingQuestionEvent:
    pending = clarify.pending_question(state)
    assert pending is not None
    position, total = clarify.position(state)
    return ClarifyingQuestionEvent(
        question=pending,
        position=position,
        total=total,
        intro=state.intro or None if position == 1 else None,
        clarify_state=state,
    )


def _summaries(sources: list[SourceNote]) -> list[SourceSummary]:
    """What the user is shown. The extracted text itself stays server side."""
    return [SourceSummary(kind=s.kind, label=s.label, summary=s.summary, links=s.links) for s in sources]


async def run_pipeline(ctx: PipelineContext, provider: ModelProvider) -> AsyncIterator[BaseModel]:
    """Run one request through the pipeline, yielding events as it goes."""
    state = ctx.clarify_state
    pending = clarify.pending_question(state) if state else None

    try:
        # Attachments are read first, so intent detection can see what is in
        # them. A file can answer what would otherwise have been asked.
        if ctx.attachments:
            yield events.reading_attachments()
            ctx = await read_attachments(ctx, provider)

        yield events.intent_parsing(has_pending_question=pending is not None)
        decision = await intent.detect(ctx, provider)

        # A request that plainly depends on something current gets a search
        # planned even when the intent model forgot to, a fresh request only.
        if (
            decision.kind == "prompt_request"
            and not decision.search_queries
            and state is None
            and research.looks_time_sensitive(ctx.message)
        ):
            planned = await research.plan_queries(ctx.message, provider)
            decision = dataclasses.replace(decision, search_queries=planned)

        # The model planned a search and also wants to ask. A search can close
        # the gap it would have asked about, so look first, then judge again
        # with the findings in hand. This runs at most once.
        searched_early = False
        if decision.needs_clarification and decision.search_queries and decision.kind == "prompt_request":
            yield events.searching()
            ctx = await run_research(ctx, decision.search_queries, provider)
            searched_early = True
            yield events.intent_parsing(has_pending_question=False)
            decision = await intent.detect(ctx, provider)

        if decision.kind == "conversation":
            yield events.answering()
            text = await construct.answer_directly(ctx, provider)
            # A direct question does not consume the pending clarifying
            # question, it is handed back still waiting.
            position, total = clarify.position(state) if pending and state else (None, None)
            yield AnswerEvent(
                content=text,
                clarify_state=state if pending else None,
                pending_question=pending,
                position=position,
                total=total,
            )
            return

        queries: list[str] = []
        if decision.kind == "answer" and state is not None:
            state = clarify.record_answer(state, ctx.message)
            if not clarify.is_complete(state):
                position, total = clarify.position(state)
                yield events.clarifying_question(position, total)
                yield _question_event(state)
                return
            queries = state.search_queries
        elif decision.needs_clarification:
            # Keep what was read from attachments and the searches planned,
            # so the rest of the sequence builds on the same material.
            state = clarify.start(
                ctx.message,
                decision.intro,
                decision.questions,
                ctx.sources,
                [] if searched_early else decision.search_queries,
            )
            yield events.clarifying_question(1, len(state.questions))
            yield _question_event(state)
            return
        else:
            # A fresh request with enough detail, any earlier unfinished
            # sequence no longer applies.
            state = None
            queries = [] if searched_early else decision.search_queries

        # Web search runs only when the intent stage planned it.
        if queries:
            yield events.searching()
            ctx = await run_research(ctx, queries, provider)

        yield events.constructing(len(state.answers) if state else 0)
        built = await construct.construct(ctx, state, provider)

        yield events.scoring()
        scored = score.score(built)

        yield events.finalizing()
        yield ResultEvent(
            content=built.content,
            score=scored.score,
            diff=scored.diff,
            structured=built.structured,
            readiness=built.readiness,
            explanation=built.explanation,
            memory_candidates=built.memory_candidates,
            sources=_summaries(ctx.sources),
            format_style=construct.format_style_for(ctx, state),
            template_version=ACTIVE_VERSION,
        )
    except ProviderError as exc:
        logger.error("provider failure status=%s code=%s: %s", exc.status, exc.code, exc)
        yield ErrorEvent(code="provider_error", message=GENERATION_FAILED_MESSAGE)
    except ProviderResponseError as exc:
        logger.error("unusable provider response: %s", exc)
        yield ErrorEvent(code="invalid_model_response", message=GENERATION_FAILED_MESSAGE)
    except clarify.ClarifyError as exc:
        logger.error("clarify state error: %s", exc)
        yield ErrorEvent(code="invalid_clarify_state", message=GENERATION_FAILED_MESSAGE)
    except Exception:
        logger.exception("unexpected pipeline failure")
        yield ErrorEvent(code="internal_error", message=GENERATION_FAILED_MESSAGE)


@router.post("/generate")
async def generate(
    body: GenerateRequest,
    provider: ModelProvider = Depends(get_provider),
) -> StreamingResponse:
    ctx = assemble_context(body)

    async def stream() -> AsyncIterator[str]:
        async for event in run_pipeline(ctx, provider):
            yield events.encode_sse(event)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
