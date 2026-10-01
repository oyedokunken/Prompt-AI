"""The clarifying question sequence.

One question is asked at a time. /data holds nothing between requests, so
every function here takes a state and returns a new one. The state leaves
in a response, /api stores it, and it comes back with the next message.
"""

from __future__ import annotations

from typing import Optional

from schemas.requests import ClarifyAnswer, ClarifyQuestion, ClarifyState

MAX_QUESTIONS = 3


class ClarifyError(Exception):
    pass


def start(original_message: str, intro: str, questions: list[ClarifyQuestion]) -> ClarifyState:
    if not questions:
        raise ClarifyError("A clarifying sequence needs at least one question")
    return ClarifyState(
        original_message=original_message,
        intro=intro,
        questions=questions[:MAX_QUESTIONS],
        answers=[],
    )


def pending_question(state: ClarifyState) -> Optional[ClarifyQuestion]:
    """The first planned question that has no answer yet."""
    answered = {a.question_id for a in state.answers}
    for question in state.questions:
        if question.id not in answered:
            return question
    return None


def is_complete(state: ClarifyState) -> bool:
    return pending_question(state) is None


def position(state: ClarifyState) -> tuple[int, int]:
    """1 based position of the pending question, and the total planned."""
    total = len(state.questions)
    pending = pending_question(state)
    if pending is None:
        return total, total
    return state.questions.index(pending) + 1, total


def record_answer(state: ClarifyState, answer: str) -> ClarifyState:
    """Record the answer to the pending question and return the advanced state."""
    pending = pending_question(state)
    if pending is None:
        raise ClarifyError("Every clarifying question has already been answered")
    text = answer.strip()
    if not text:
        raise ClarifyError("An answer cannot be empty")
    return state.model_copy(
        update={"answers": [*state.answers, ClarifyAnswer(question_id=pending.id, answer=text)]}
    )


def question_answer_pairs(state: ClarifyState) -> list[tuple[str, str]]:
    """Answered questions in the order they were asked."""
    by_id = {a.question_id: a.answer for a in state.answers}
    return [(q.text, by_id[q.id]) for q in state.questions if q.id in by_id]
