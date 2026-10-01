"""Stage events emitted while a /generate response is streaming.

Each stage is emitted at the moment that work actually starts, so the
status a user sees always describes what the service is really doing.
Every stage has a small pool of messages, short single words mixed with
fuller phrases, so the sequence reads as alive rather than as one rigid
sentence pattern. The pools are fixed per stage, never invented.
"""

from __future__ import annotations

import random

from pydantic import BaseModel

from schemas.responses import StageEvent

INTENT_POOL = [
    "Understanding",
    "Figuring",
    "Reading",
    "Parsing",
    "Working out what you are asking for",
    "Understanding your request",
    "Figuring out what you need",
]
INTENT_PENDING_POOL = [
    "Reading",
    "Matching",
    "Reading your reply against the open question",
    "Checking your reply against the question",
]
READING_POOL = [
    "Reading",
    "Scanning",
    "Absorbing",
    "Reading your attached files",
    "Going through what you attached",
]
SEARCHING_POOL = [
    "Searching",
    "Looking up",
    "Researching",
    "Searching the web for current information",
    "Looking this up on the web",
]
CLARIFYING_FIRST_POOL = [
    "Mulling",
    "Wondering",
    "Details are missing, picking the first question to ask",
    "Deciding what to ask you first",
]
ANSWERING_POOL = [
    "Recalling",
    "Checking",
    "Answering directly from what is stored about you",
    "Looking at what is stored about you",
]
SCORING_POOL = [
    "Scoring",
    "Weighing",
    "Measuring",
    "Scoring completeness and separating stated from inferred",
    "Checking how complete this is",
]
FINALIZING_POOL = [
    "Finalizing",
    "Polishing",
    "Wrapping up",
    "Finalizing your prompt",
    "Putting the finishing touches on your prompt",
]
CONSTRUCTING_BARE_POOL = [
    "Building",
    "Drafting",
    "Composing",
    "Building the prompt from your request",
    "Drafting the prompt from what you described",
]


def _pick(pool: list[str]) -> str:
    return random.choice(pool)


def intent_parsing(has_pending_question: bool) -> StageEvent:
    return StageEvent(stage="intent", message=_pick(INTENT_PENDING_POOL if has_pending_question else INTENT_POOL))


def reading_attachments() -> StageEvent:
    return StageEvent(stage="reading", message=_pick(READING_POOL))


def searching() -> StageEvent:
    return StageEvent(stage="searching", message=_pick(SEARCHING_POOL))


def clarifying_pool(position: int, total: int) -> list[str]:
    if position == 1:
        return CLARIFYING_FIRST_POOL
    return [
        "Noted",
        "Next",
        f"Answer recorded, moving to question {position} of {total}",
        f"Got it, on to question {position} of {total}",
    ]


def clarifying_question(position: int, total: int) -> StageEvent:
    return StageEvent(stage="clarifying", message=_pick(clarifying_pool(position, total)))


def answering() -> StageEvent:
    return StageEvent(stage="answering", message=_pick(ANSWERING_POOL))


def constructing_pool(answer_count: int) -> list[str]:
    if answer_count == 0:
        return CONSTRUCTING_BARE_POOL
    if answer_count == 1:
        return ["Building", "Composing", "Building the prompt from your request and your answer"]
    return ["Building", "Composing", f"Building the prompt from your request and your {answer_count} answers"]


def constructing(answer_count: int) -> StageEvent:
    return StageEvent(stage="constructing", message=_pick(constructing_pool(answer_count)))


def scoring() -> StageEvent:
    return StageEvent(stage="scoring", message=_pick(SCORING_POOL))


def finalizing() -> StageEvent:
    return StageEvent(stage="finalizing", message=_pick(FINALIZING_POOL))


def encode_sse(event: BaseModel) -> str:
    """Serialize one event as a server-sent event frame."""
    payload = event.model_dump_json(exclude_none=True)
    event_type = getattr(event, "type", "message")
    return f"event: {event_type}\ndata: {payload}\n\n"
