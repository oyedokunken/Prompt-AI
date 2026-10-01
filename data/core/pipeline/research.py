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


async def _search_one(query: str, provider: ModelProvider, model: str) -> SourceNote:
    try:
        outcome = await provider.search(model=model, query=query)
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("search failed for %r: %s", query, exc)
        return SourceNote(kind="search", label=query, summary="The search failed, nothing from it was used.")
    text = outcome.summary[:MAX_SUMMARY_CHARS]
    first = text.split(". ")[0].strip()
    return SourceNote(
        kind="search",
        label=query,
        summary=first if first.endswith(".") else first + ".",
        content=text,
        links=[SourceLink(title=s.title, url=s.url) for s in outcome.sources],
    )


async def search(queries: list[str], provider: ModelProvider, model: str) -> list[SourceNote]:
    return list(await asyncio.gather(*(_search_one(q, provider, model) for q in queries[:MAX_QUERIES])))


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
