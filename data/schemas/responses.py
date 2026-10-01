"""Response models: stage events, terminal events and plain responses."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from schemas.requests import ClarifyQuestion, ClarifyState, SourceLink

Stage = Literal[
    "intent", "reading", "searching", "clarifying", "answering", "constructing", "scoring", "finalizing"
]


class StageEvent(BaseModel):
    type: Literal["stage"] = "stage"
    stage: Stage
    message: str


class UsageSummary(BaseModel):
    """What producing this reply cost, from the real token counts of its calls."""

    calls: int = 0
    prompt_tokens: int = 0
    cached_tokens: int = 0
    completion_tokens: int = 0
    est_cost_usd: float = 0.0


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
    usage: Optional[UsageSummary] = None


class MemoryCandidate(BaseModel):
    category: str
    key: str
    value: str
    confidence: Optional[float] = None


class MemoryRef(BaseModel):
    """A stored memory that informed a reply, shown to the user."""

    category: str
    key: str
    value: str


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
    # Stable facts the user revealed in this exchange, worth keeping.
    memory_candidates: list["MemoryCandidate"] = Field(default_factory=list)
    # The stored memory that informed this reply.
    memory_used: list[MemoryRef] = Field(default_factory=list)
    usage: Optional[UsageSummary] = None


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
    # Facts taken from attached files or web searches, not said by the
    # user and not guessed by the model.
    researched: list[str] = Field(default_factory=list)


class SourceSummary(BaseModel):
    """The user facing part of a SourceNote. The raw content stays server side."""

    kind: Literal["attachment", "search"]
    label: str
    summary: str = ""
    links: list[SourceLink] = Field(default_factory=list)


class ResultEvent(BaseModel):
    type: Literal["result"] = "result"
    # The conversational wrapper, kept apart from the deliverable so the
    # prompt can be copied on its own.
    message: Optional[str] = None
    content: str
    score: int
    diff: PromptDiff
    structured: StructuredPrompt
    readiness: Readiness
    explanation: Optional[str] = None
    memory_candidates: list[MemoryCandidate] = Field(default_factory=list)
    sources: list[SourceSummary] = Field(default_factory=list)
    memory_used: list[MemoryRef] = Field(default_factory=list)
    usage: Optional[UsageSummary] = None
    patterns_used: list[str] = Field(default_factory=list)
    format_style: str = "plain"
    template_version: str


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str


class MemorySummaryResponse(BaseModel):
    summary: str


class TitleResponse(BaseModel):
    title: str


class TranscribeResponse(BaseModel):
    text: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "prompt-ai-data"
    version: str
    template_version: str
