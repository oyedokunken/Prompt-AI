"""Context assembly.

The one place that turns what /api sent into the shape the rest of the
pipeline works with. Routers call this and pass the result on, nothing
downstream reads a raw request.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from schemas.requests import (
    ClarifyState,
    GenerateRequest,
    HistoryMessage,
    Memory,
    TitleRequest,
    UserProfile,
)

# Bounds how much prior conversation is replayed into each call, the
# smallest amount that still gives the model real continuity.
MAX_HISTORY_MESSAGES = 20
MAX_RELEVANT_MEMORIES = 8
MAX_TITLE_SOURCE_CHARS = 1500

_STOPWORDS = frozenset(
    """the a an and or for to of in on with is are be that this it as at by from i me my you your
    want need please prompt write create build make generate can""".split()
)

_PROFILE_FIELDS = (
    ("preferred_name", "Name"),
    ("role", "Role"),
    ("about", "What they do"),
    ("working_on", "Currently working on"),
    ("primary_use", "Primary use for Prompt AI"),
)


@dataclass(frozen=True)
class PipelineContext:
    message: str
    target_model: str
    profile: UserProfile
    # Every stored memory, used when answering what is known about the user.
    all_memories: list[Memory]
    # The subset relevant to this request, used when constructing a prompt.
    relevant_memories: list[Memory]
    history: list[HistoryMessage]
    image_urls: list[str] = field(default_factory=list)
    unreadable_attachments: list[str] = field(default_factory=list)
    clarify_state: Optional[ClarifyState] = None
    is_clarify_answer: bool = False

    @property
    def profile_lines(self) -> list[tuple[str, Optional[str]]]:
        """Every profile field with its label, None where nothing is stored."""
        return [(label, getattr(self.profile, name)) for name, label in _PROFILE_FIELDS]

    @property
    def knows_little(self) -> bool:
        return not self.profile.about and not self.profile.working_on and not self.all_memories


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _tokenize(text: str) -> set[str]:
    return {w for w in re.split(r"[^a-z0-9+.]+", text.lower()) if len(w) > 2 and w not in _STOPWORDS}


def select_relevant_memories(
    memories: list[Memory], message: str, limit: int = MAX_RELEVANT_MEMORIES
) -> list[Memory]:
    """Pick the memories worth putting in front of the model for this request.

    No vector search, on purpose. Most users have a small memory store, so
    keyword overlap gets most of the value. Identity level memories
    (category "about") are always kept, the rest are ranked by how many of
    the request's own words they share and dropped when they share none.
    """
    if not memories:
        return []
    query = _tokenize(message)
    always = [m for m in memories if m.category == "about"]
    scored = []
    for memory in memories:
        if memory.category == "about":
            continue
        overlap = len(_tokenize(f"{memory.key} {memory.value}") & query)
        if overlap > 0:
            scored.append((overlap, memory))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return (always + [m for _, m in scored])[:limit]


def assemble_context(request: GenerateRequest) -> PipelineContext:
    profile = UserProfile(
        preferred_name=_clean(request.profile.preferred_name),
        role=_clean(request.profile.role),
        about=_clean(request.profile.about),
        working_on=_clean(request.profile.working_on),
        primary_use=_clean(request.profile.primary_use),
    )
    memories = [m for m in request.memories if m.key.strip() and m.value.strip()]
    history = [m for m in request.history if m.content.strip()][-MAX_HISTORY_MESSAGES:]
    message = request.message.strip()

    state = request.clarify_state
    if state is not None and not state.questions:
        state = None

    return PipelineContext(
        message=message,
        target_model=request.model,
        profile=profile,
        all_memories=memories,
        relevant_memories=select_relevant_memories(memories, message),
        history=history,
        image_urls=[a.data_url for a in request.attachments if a.data_url],
        unreadable_attachments=[a.name for a in request.attachments if not a.data_url],
        clarify_state=state,
        is_clarify_answer=request.is_clarify_answer and state is not None,
    )


def assemble_title_source(request: TitleRequest) -> str:
    """The opening of a conversation, trimmed to what a title needs."""
    parts = [m.strip() for m in request.messages if m.strip()]
    return "\n\n".join(parts)[:MAX_TITLE_SOURCE_CHARS]
