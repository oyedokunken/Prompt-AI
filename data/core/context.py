"""Context assembly.

The one place that turns what /api sent into the shape the rest of the
pipeline works with. Routers call this and pass the result on, nothing
downstream reads a raw request.
"""

from __future__ import annotations

import dataclasses
import logging
import math
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

from schemas.requests import (
    Attachment,
    ClarifyState,
    GenerateRequest,
    HistoryMessage,
    Memory,
    SourceNote,
    TitleRequest,
    UserProfile,
)

from core.providers.base import ProviderError, ProviderResponseError

if TYPE_CHECKING:
    from core.providers.base import ModelProvider

logger = logging.getLogger("data.context")

# Bounds how much prior conversation is replayed into each call, the
# smallest amount that still gives the model real continuity.
MAX_HISTORY_MESSAGES = 20
# How a long conversation is kept bounded. The most recent messages are sent
# in full, clipped to a size, and everything older is condensed into a short
# digest, so what a request costs does not grow with the length of the chat.
RECENT_MESSAGES = 6
MAX_RECENT_CHARS = 1500
# The latest assistant message is often a prompt the user is about to ask to
# change ("make it shorter"), so it keeps more of its text.
MAX_LATEST_ASSISTANT_CHARS = 4000
DIGEST_OLDER_MESSAGES = 14
DIGEST_CHARS_PER_MESSAGE = 140
MAX_DIGEST_CHARS = 1600
# The intent step only needs enough to follow a short reply or an edit request.
INTENT_HISTORY_MESSAGES = 4
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
    # Older turns condensed to a line each, sent as context instead of in full.
    history_digest: str = ""
    # Files attached to this message, not yet read.
    attachments: list[Attachment] = field(default_factory=list)
    # Everything read or looked up for this request: attachment text and
    # web findings. This is what construction builds on.
    sources: list[SourceNote] = field(default_factory=list)
    clarify_state: Optional[ClarifyState] = None
    is_clarify_answer: bool = False
    # True when relevant_memories is the whole store, so it can be described as complete.
    memory_complete: bool = False

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


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit].rstrip() + " [clipped]"


def bound_history(messages: list[HistoryMessage]) -> tuple[list[HistoryMessage], str]:
    """Split a conversation into a short recent window and a condensed digest of the rest."""
    recent = messages[-RECENT_MESSAGES:]
    older = messages[:-RECENT_MESSAGES][-DIGEST_OLDER_MESSAGES:]

    latest_assistant = max((i for i, m in enumerate(recent) if m.role == "assistant"), default=-1)
    clipped = [
        HistoryMessage(
            role=m.role,
            content=_clip(m.content, MAX_LATEST_ASSISTANT_CHARS if i == latest_assistant else MAX_RECENT_CHARS),
        )
        for i, m in enumerate(recent)
    ]

    lines = []
    for m in older:
        flat = " ".join(m.content.split())
        lines.append(f"{'User' if m.role == 'user' else 'Assistant'}: {_clip(flat, DIGEST_CHARS_PER_MESSAGE)}")
    digest = "\n".join(lines)
    if len(digest) > MAX_DIGEST_CHARS:
        digest = digest[-MAX_DIGEST_CHARS:]
    return clipped, digest


def assemble_context(request: GenerateRequest) -> PipelineContext:
    profile = UserProfile(
        preferred_name=_clean(request.profile.preferred_name),
        role=_clean(request.profile.role),
        about=_clean(request.profile.about),
        working_on=_clean(request.profile.working_on),
        primary_use=_clean(request.profile.primary_use),
    )
    memories = [m for m in request.memories if m.key.strip() and m.value.strip()]
    history, history_digest = bound_history([m for m in request.history if m.content.strip()][-MAX_HISTORY_MESSAGES:])
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
        history_digest=history_digest,
        attachments=list(request.attachments),
        # Material gathered earlier in an open clarifying sequence.
        sources=list(state.sources) if state else [],
        clarify_state=state,
        is_clarify_answer=request.is_clarify_answer and state is not None,
    )


def assemble_title_source(request: TitleRequest) -> str:
    """The opening of a conversation, trimmed to what a title needs."""
    parts = [m.strip() for m in request.messages if m.strip()]
    return "\n\n".join(parts)[:MAX_TITLE_SOURCE_CHARS]


# ---------------------------------------------------------------------------
# External context
#
# Attachments and web findings join the context here, before anything is
# constructed, so every later stage reads them from the same place.
# ---------------------------------------------------------------------------

def _merge_sources(existing: list[SourceNote], new: list[SourceNote]) -> list[SourceNote]:
    keys = {(n.kind, n.label) for n in new}
    return [s for s in existing if (s.kind, s.label) not in keys] + new


async def read_attachments(ctx: PipelineContext, provider: "ModelProvider") -> PipelineContext:
    """Read this message's attachments and add what was found to the context."""
    if not ctx.attachments:
        return ctx
    from core.pipeline import ingest

    notes = await ingest.ingest(ctx.attachments, provider, provider.resolve_model(ctx.target_model, step="vision"))
    return dataclasses.replace(ctx, sources=_merge_sources(ctx.sources, notes), attachments=[])


async def run_research(ctx: PipelineContext, queries: list[str], provider: "ModelProvider") -> PipelineContext:
    """Run the planned web searches and add the findings to the context."""
    if not queries:
        return ctx
    from core.pipeline import research

    notes = await research.search(queries, provider, provider.resolve_model(ctx.target_model, step="search"))
    return dataclasses.replace(ctx, sources=_merge_sources(ctx.sources, notes))


# ---------------------------------------------------------------------------
# Memory retrieval
#
# Every request consults stored memory before anything is generated, casual
# banter included. What is selected is the part of memory that bears on this
# request, not everything that is stored, and it is reported back so the user
# can see which details informed a reply.
# ---------------------------------------------------------------------------

# Similarity at or above this counts as related. Tuned against real
# embeddings: unrelated pairs sit well below it, related ones above.
RELEVANCE_THRESHOLD = 0.30
MAX_RELEVANT_MEMORIES_SEMANTIC = 6
# When the message is about the user themselves, the whole store is relevant.
MAX_WIDENED_MEMORIES = 25
_EMBED_CACHE_LIMIT = 2000
_embed_cache: dict[str, list[float]] = {}
VALID_MEMORY_CATEGORIES = {"about", "preferences", "projects", "skills", "other"}


def _memory_text(memory: Memory) -> str:
    return f"{memory.key}: {memory.value}"


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


async def _embeddings(texts: list[str], provider: "ModelProvider") -> dict[str, list[float]]:
    """Vectors for the given texts, fetching only the ones not seen before."""
    missing = [t for t in dict.fromkeys(texts) if t not in _embed_cache]
    if missing:
        vectors = await provider.embed(missing)
        if len(vectors) != len(missing):
            raise ProviderResponseError("The embeddings response did not match the request")
        if len(_embed_cache) + len(missing) > _EMBED_CACHE_LIMIT:
            _embed_cache.clear()
        _embed_cache.update(zip(missing, vectors))
    return {t: _embed_cache[t] for t in texts}


async def select_memories_semantic(
    memories: list[Memory], message: str, recent_user_text: str, provider: "ModelProvider"
) -> list[Memory]:
    """Rank stored memory against the request by meaning, keeping what is related."""
    if not memories:
        return []
    # A very short reply such as "yes" says nothing alone, borrow the last topic.
    query = message if len(message.split()) >= 5 or not recent_user_text else f"{recent_user_text}\n{message}"
    texts = [_memory_text(m) for m in memories]
    try:
        vectors = await _embeddings([query, *texts], provider)
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("semantic memory selection failed, using keyword overlap: %s", exc)
        return select_relevant_memories(memories, message)

    query_vector = vectors[query]
    keyword = {id(m) for m in select_relevant_memories(memories, message, limit=len(memories)) if m.category != "about"}
    scored = []
    for memory, text in zip(memories, texts):
        score = _cosine(query_vector, vectors[text])
        if score >= RELEVANCE_THRESHOLD or id(memory) in keyword:
            scored.append((score, memory))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [m for _, m in scored[:MAX_RELEVANT_MEMORIES_SEMANTIC]]


async def attach_memory(ctx: PipelineContext, provider: "ModelProvider") -> PipelineContext:
    """Select the stored memory that bears on this request and add it to the context."""
    recent = next((m.content for m in reversed(ctx.history) if m.role == "user"), "")
    selected = await select_memories_semantic(ctx.all_memories, ctx.message, recent, provider)
    return dataclasses.replace(ctx, relevant_memories=selected)


def widen_memory(ctx: PipelineContext) -> PipelineContext:
    """For a message about the user themselves, bring in everything stored."""
    return dataclasses.replace(
        ctx,
        relevant_memories=ctx.all_memories[:MAX_WIDENED_MEMORIES],
        memory_complete=len(ctx.all_memories) <= MAX_WIDENED_MEMORIES,
    )


def fresh_memory_candidates(candidates: list, existing: list[Memory]) -> list:
    """Drop proposals that repeat what is already stored, and normalize categories."""
    known = {(m.key.strip().lower(), m.value.strip().lower()) for m in existing}
    out = []
    for c in candidates:
        if (c.key.strip().lower(), c.value.strip().lower()) in known:
            continue
        if c.category not in VALID_MEMORY_CATEGORIES:
            c = c.model_copy(update={"category": "other"})
        out.append(c)
    return out
