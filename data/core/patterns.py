"""Retrieval of known effective prompt patterns.

Construction does not rely on the model's own generation alone. For each
request the pipeline retrieves the patterns that fit it by meaning, from a
library of proven approaches per task type, and hands them to the
construction step as craft guidance: decision rules, failure handling and
output shapes that a prompt for that kind of task needs.

The index is an in-process vector index over the library file, built with the
same embedding model as memory selection. /data is deliberately stateless and
has no database, so the library lives next to the code and its vectors are
computed once per process and cached. `PatternIndex.search` is the seam: a
database backed vector store can replace this class without touching the
pipeline.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from core.context import cosine_similarity, embed_texts
from core.providers.base import ProviderError, ProviderResponseError

if TYPE_CHECKING:
    from core.providers.base import ModelProvider

logger = logging.getLogger("data.patterns")

LIBRARY_PATH = Path(__file__).parent / "patterns_library.json"

# How many patterns a request receives, and how close a match must be. Tuned
# against real embeddings and the eval set: an unrelated pattern adds tokens and
# can pull a prompt toward the wrong shape, so a weak match is left out.
MAX_PATTERNS = 2
MIN_SIMILARITY = 0.30
# The second pattern is only added when it is nearly as good as the first.
SECOND_PATTERN_RATIO = 0.85


@dataclass(frozen=True)
class Pattern:
    id: str
    name: str
    summary: str
    tags: tuple[str, ...]
    craft: tuple[str, ...]
    skeleton: str = ""

    @property
    def retrieval_text(self) -> str:
        return f"{self.name}. {self.summary} Tags: {', '.join(self.tags)}."


@dataclass(frozen=True)
class PatternMatch:
    pattern: Pattern
    score: float


class PatternLibraryError(Exception):
    pass


@lru_cache
def load_library() -> tuple[Pattern, ...]:
    raw = json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    patterns: list[Pattern] = []
    seen: set[str] = set()
    for entry in raw.get("patterns", []):
        try:
            pattern = Pattern(
                id=entry["id"],
                name=entry["name"],
                summary=entry["summary"],
                tags=tuple(entry.get("tags", [])),
                craft=tuple(entry["craft"]),
                skeleton=entry.get("skeleton", ""),
            )
        except (KeyError, TypeError) as exc:
            raise PatternLibraryError(f"A pattern is missing a field: {exc}") from exc
        if pattern.id in seen:
            raise PatternLibraryError(f"Duplicate pattern id {pattern.id}")
        if len(pattern.craft) < 3:
            raise PatternLibraryError(f"Pattern {pattern.id} needs at least three craft points")
        seen.add(pattern.id)
        patterns.append(pattern)
    if not patterns:
        raise PatternLibraryError("The pattern library is empty")
    return tuple(patterns)


def validate_library() -> None:
    """Called at startup so a broken library fails the deploy, not a request."""
    load_library()


class PatternIndex:
    """Ranks the library against a request by meaning."""

    def __init__(self, patterns: tuple[Pattern, ...]) -> None:
        self._patterns = patterns

    async def search(self, query: str, provider: "ModelProvider") -> list[tuple[Pattern, float]]:
        texts = [p.retrieval_text for p in self._patterns]
        vectors = await embed_texts([query, *texts], provider, step="pattern_embed")
        query_vector = vectors[query]
        scored = [(p, cosine_similarity(query_vector, vectors[t])) for p, t in zip(self._patterns, texts)]
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored


async def retrieve(query: str, provider: "ModelProvider", *, index: Optional[PatternIndex] = None) -> list[PatternMatch]:
    """The patterns that fit this request, best first. An embeddings failure retrieves nothing."""
    if not query.strip():
        return []
    index = index or PatternIndex(load_library())
    try:
        ranked = await index.search(query, provider)
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("pattern retrieval failed, constructing without patterns: %s", exc)
        return []

    matches: list[PatternMatch] = []
    for pattern, score in ranked[:MAX_PATTERNS]:
        if score < MIN_SIMILARITY:
            break
        if matches and score < matches[0].score * SECOND_PATTERN_RATIO:
            break
        matches.append(PatternMatch(pattern, score))
    return matches


def patterns_block(matches: list[PatternMatch]) -> str:
    """Render retrieved patterns for the construction prompt."""
    if not matches:
        return ""
    parts = [
        "KNOWN EFFECTIVE PATTERNS RETRIEVED FOR THIS REQUEST",
        "These are proven approaches for this kind of task. Use them as craft guidance: adopt the points that fit, adapt them to what the user actually asked for, and drop any that do not apply. They never override what the user said and they are not text to copy.",
    ]
    for match in matches:
        p = match.pattern
        lines = [f"[Pattern: {p.name}]"] + [f"- {point}" for point in p.craft]
        if p.skeleton:
            lines.append(f"An output shape that works: {p.skeleton}")
        parts.append("\n".join(lines))
    return "\n\n".join(parts)
