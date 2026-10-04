"""Web research.

Search is a deliberate step. The intent stage decides whether current or
external information would materially improve the prompt and plans the
queries, nothing here runs on a request that did not ask for it.
"""

from __future__ import annotations

import asyncio
import logging
import re

from core.providers.base import ModelProvider, ProviderError, ProviderResponseError
from schemas.requests import SourceLink, SourceNote

logger = logging.getLogger("data.research")

# One search per turn. Each search call carries a flat fee on top of its tokens,
# so a second query has to earn it, and one well phrased query covers a request.
MAX_QUERIES = 1
MAX_QUERY_CHARS = 200
MAX_SUMMARY_CHARS = 1500
# A lookup is the whole basis of a direct answer, so it keeps more of what was found.
MAX_LOOKUP_CHARS = 3200


def clean_queries(raw: object) -> list[str]:
    """Normalize the model's planned queries: strings only, deduplicated, capped."""
    if not isinstance(raw, list):
        return []
    queries: list[str] = []
    for item in raw:
        query = " ".join(str(item).split()).strip() if isinstance(item, (str, int, float)) else ""
        if query and query.lower() not in {q.lower() for q in queries}:
            queries.append(query[:200])
        if len(queries) == MAX_QUERIES:
            break
    return queries


async def _search_one(query: str, provider: ModelProvider, model: str, step: str = "search") -> SourceNote:
    try:
        outcome = await provider.search(model=model, query=query, step=step)
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("search failed for %r: %s", query, exc)
        return SourceNote(kind="search", label=query, summary="The search failed, nothing from it was used.")
    text = outcome.summary[: MAX_LOOKUP_CHARS if step == "lookup" else MAX_SUMMARY_CHARS]
    first = text.split(". ")[0].strip()
    return SourceNote(
        kind="search",
        label=query,
        summary=first if first.endswith(".") else first + ".",
        content=text,
        links=[SourceLink(title=s.title, url=s.url) for s in outcome.sources],
    )


async def search(queries: list[str], provider: ModelProvider, model: str, step: str = "search") -> list[SourceNote]:
    return list(await asyncio.gather(*(_search_one(q, provider, model, step) for q in queries[:MAX_QUERIES])))


# ---------------------------------------------------------------------------
# Time sensitive requests
#
# The intent model is inconsistent about planning a search when a request
# plainly depends on current information, so that case has a deterministic
# trigger. It still only plans, it never searches a request that does not
# ask for something current.
# ---------------------------------------------------------------------------

_FRESHNESS = re.compile(
    r"\b(latest|newest|most recent|recent(ly)?|current(ly)?|up[- ]to[- ]date|this year|this month|right now|as of today)\b",
    re.IGNORECASE,
)
_CHANGING_SUBJECT = re.compile(
    r"\b(version|versions|release|releases|price|prices|pricing|news|law|laws|regulation|regulations|rankings?|changes|changelog|features|trends|policy|policies|api|benchmarks?|stable)\b",
    re.IGNORECASE,
)


def looks_time_sensitive(text: str) -> bool:
    """True when a request asks for something current about something that changes."""
    return bool(_FRESHNESS.search(text) and _CHANGING_SUBJECT.search(text))


def query_from_message(message: str) -> list[str]:
    """A search query taken straight from the user's own words.

    The search tool rewrites a natural language query itself, so a separate
    model call just to rephrase the request would only add cost and delay.
    """
    query = " ".join(message.split())[:MAX_QUERY_CHARS].strip()
    return [query] if query else []


# ---------------------------------------------------------------------------
# Questions about the outside world
#
# "Who is" a named person is not a question about the user and not something
# to answer from the model's memory of its training data, which may be wrong,
# thin or out of date. It is looked up. The intent model classifies this, and
# this is the net under it for the plain, unmistakable phrasings.
# ---------------------------------------------------------------------------

_LOOKUP_OPENING = re.compile(
    r"^\s*(?:(?:hey|hi|please|ok|okay|so)[,\s]+)*"
    r"(?:who(?:\s+(?:is|was|are|were)|'s)|tell\s+me\s+(?:more\s+)?about|what\s+do\s+you\s+know\s+about|do\s+you\s+know\s+(?:who|anything\s+about)|can\s+you\s+tell\s+me\s+(?:who|about))\s+(.+?)\s*[?.!]*\s*$",
    re.IGNORECASE,
)
# A subject that is the user, their things, the assistant, or a generic noun, never a lookup.
_NOT_A_LOOKUP_SUBJECT = re.compile(
    r"^(?:me|myself|i|my|mine|you|your|yourself|us|we|our|this|that|these|those|it|them|him|her|he|she|they|the\s+user|there|here|someone|somebody|anyone|anybody|everyone|everybody|nobody)\b",
    re.IGNORECASE,
)
_CAPITALISED_NAME = re.compile(r"[A-Z][\w'.-]+")


def lookup_subject(message: str) -> str:
    """The thing being asked about, when the message plainly asks who or what a named subject is.

    Only fires on a capitalised name (a person, place or organisation) so that
    "who is responsible for this bug" or "tell me about recursion" are left to
    the intent model, which can judge them with the full context.
    """
    match = _LOOKUP_OPENING.match(message.strip())
    if not match:
        return ""
    subject = match.group(1).strip()
    if not subject or _NOT_A_LOOKUP_SUBJECT.match(subject):
        return ""
    if not _CAPITALISED_NAME.search(subject):
        return ""
    return subject[:MAX_QUERY_CHARS]


def lookup_query(subject: str) -> list[str]:
    return [subject] if subject else []


def is_known_to_user(subject: str, ctx) -> bool:
    """True when the subject is the user themselves or already described in what is stored.

    Those are answered from memory, never searched.
    """
    needle = subject.lower().strip(" ?.!")
    if not needle:
        return False
    own_names = {
        (ctx.profile.preferred_name or "").lower(),
        *[w for w in (ctx.profile.preferred_name or "").lower().split() if len(w) > 2],
    }
    own_names.discard("")
    if needle in own_names or any(name == needle for name in own_names):
        return True
    stored = " ".join(f"{m.key} {m.value}" for m in ctx.all_memories).lower()
    return bool(stored) and needle in stored
