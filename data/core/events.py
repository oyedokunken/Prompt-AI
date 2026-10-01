"""Stage events emitted while a /generate response is streaming.

Each stage is emitted at the moment that work actually starts, so the
status a user sees always describes what the service is really doing.
"""

from __future__ import annotations

from pydantic import BaseModel

from schemas.responses import StageEvent


def intent_parsing(has_pending_question: bool) -> StageEvent:
    message = (
        "Reading your reply against the open question"
        if has_pending_question
        else "Working out what you are asking for"
    )
    return StageEvent(stage="intent", message=message)


def clarifying_question(position: int, total: int) -> StageEvent:
    if position == 1:
        message = "Details are missing, picking the first question to ask"
    else:
        message = f"Answer recorded, moving to question {position} of {total}"
    return StageEvent(stage="clarifying", message=message)


def answering() -> StageEvent:
    return StageEvent(stage="answering", message="Answering directly from what is stored about you")


def constructing(answer_count: int) -> StageEvent:
    if answer_count == 0:
        message = "Building the prompt from your request"
    elif answer_count == 1:
        message = "Building the prompt from your request and your answer"
    else:
        message = f"Building the prompt from your request and your {answer_count} answers"
    return StageEvent(stage="constructing", message=message)


def scoring() -> StageEvent:
    return StageEvent(stage="scoring", message="Scoring completeness and separating stated from inferred")


def finalizing() -> StageEvent:
    return StageEvent(stage="finalizing", message="Finalizing your prompt")


def encode_sse(event: BaseModel) -> str:
    """Serialize one event as a server-sent event frame."""
    payload = event.model_dump_json(exclude_none=True)
    event_type = getattr(event, "type", "message")
    return f"event: {event_type}\ndata: {payload}\n\n"
