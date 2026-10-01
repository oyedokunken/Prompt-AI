"""Response models: stage events, terminal events and plain responses."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from schemas.requests import ClarifyQuestion, ClarifyState

Stage = Literal["intent", "clarifying", "answering", "constructing", "scoring", "finalizing"]


class StageEvent(BaseModel):
    type: Literal["stage"] = "stage"
    stage: Stage
    message: str


class ClarifyingQuestionEvent(BaseModel):
    """Exactly one question. The next one is only sent after this is answered."""

    type: Literal["clarifying_question"] = "clarifying_question"
    question: ClarifyQuestion
    # 1 based position of this question, and how many are planned in total.
    position: int
    total: int
    # A short acknowledgement, only present with the first question.
    intro: Optional[str] = None
    clarify_state: ClarifyState


class AnswerEvent(BaseModel):
    """A direct conversational answer, not a constructed prompt."""

    type: Literal["answer"] = "answer"
    content: str
    # If a clarifying sequence was in progress it is returned untouched,
    # with the question that is still waiting for an answer.
    clarify_state: Optional[ClarifyState] = None
    pending_question: Optional[ClarifyQuestion] = None
    position: Optional[int] = None
    total: Optional[int] = None


class StructuredPrompt(BaseModel):
    role: Optional[str] = None
    context: Optional[str] = None
    constraints: list[str] = Field(default_factory=list)
    format: Optional[str] = None


class Readiness(BaseModel):
    status: Literal["ready", "needs_context"] = "ready"
    missing: list[str] = Field(default_factory=list)
    notes: Optional[str] = None


class PromptDiff(BaseModel):
    """What the user actually said, against what was filled in for them."""

    stated: list[str] = Field(default_factory=list)
    inferred: list[str] = Field(default_factory=list)


class MemoryCandidate(BaseModel):
    category: str
    key: str
    value: str
    confidence: Optional[float] = None


class ResultEvent(BaseModel):
    type: Literal["result"] = "result"
    content: str
    score: int
    diff: PromptDiff
    structured: StructuredPrompt
    readiness: Readiness
    explanation: Optional[str] = None
    memory_candidates: list[MemoryCandidate] = Field(default_factory=list)
    template_version: str


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str


class TitleResponse(BaseModel):
    title: str


class TranscribeResponse(BaseModel):
    text: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "prompt-ai-data"
    version: str
    template_version: str
