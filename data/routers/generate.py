"""POST /generate, the core chat and prompt construction endpoint.

Streams stage events as each step of the pipeline actually starts, then
exactly one terminal event: a clarifying question, a direct answer, a
final result, or an error.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import events
from core.context import PipelineContext, assemble_context
from core.pipeline import clarify, construct, intent, score
from core.prompts.loader import ACTIVE_VERSION
from core.providers import get_provider
from core.providers.base import ModelProvider, ProviderError, ProviderResponseError
from schemas.requests import ClarifyState, GenerateRequest
from schemas.responses import AnswerEvent, ClarifyingQuestionEvent, ErrorEvent, ResultEvent

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


async def run_pipeline(ctx: PipelineContext, provider: ModelProvider) -> AsyncIterator[BaseModel]:
    """Run one request through the pipeline, yielding events as it goes."""
    state = ctx.clarify_state
    pending = clarify.pending_question(state) if state else None

    try:
        yield events.intent_parsing(has_pending_question=pending is not None)
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

        if decision.kind == "answer" and state is not None:
            state = clarify.record_answer(state, ctx.message)
            if not clarify.is_complete(state):
                position, total = clarify.position(state)
                yield events.clarifying_question(position, total)
                yield _question_event(state)
                return
        elif decision.needs_clarification:
            state = clarify.start(ctx.message, decision.intro, decision.questions)
            yield events.clarifying_question(1, len(state.questions))
            yield _question_event(state)
            return
        else:
            # A fresh request with enough detail, any earlier unfinished
            # sequence no longer applies.
            state = None

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
