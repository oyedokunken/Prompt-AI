"""Completeness scoring and the stated versus inferred diff.

The score is computed here, the same way every time, rather than taken
from the model's own opinion of its work. It measures how much of the
prompt rests on what the user actually said.
"""

from __future__ import annotations

from dataclasses import dataclass

from core.pipeline.construct import ConstructedPrompt
from schemas.responses import PromptDiff

BASE_SCORE = 90
ASSUMPTION_PENALTY = 6
MAX_ASSUMPTION_PENALTY = 40
MISSING_PENALTY = 10
NEEDS_CONTEXT_PENALTY = 15
MIN_SCORE = 30
MAX_SCORE = 97


@dataclass(frozen=True)
class ScoredPrompt:
    score: int
    diff: PromptDiff


def completeness_score(prompt: ConstructedPrompt) -> int:
    score = BASE_SCORE
    score -= min(len(prompt.assumptions) * ASSUMPTION_PENALTY, MAX_ASSUMPTION_PENALTY)
    score -= len(prompt.readiness.missing) * MISSING_PENALTY
    if prompt.readiness.status == "needs_context":
        score -= NEEDS_CONTEXT_PENALTY
    return max(MIN_SCORE, min(MAX_SCORE, round(score)))


def build_diff(prompt: ConstructedPrompt) -> PromptDiff:
    return PromptDiff(
        stated=list(prompt.stated),
        inferred=list(prompt.assumptions),
        researched=list(prompt.researched),
    )


def score(prompt: ConstructedPrompt) -> ScoredPrompt:
    return ScoredPrompt(score=completeness_score(prompt), diff=build_diff(prompt))
