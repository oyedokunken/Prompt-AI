"""Web research.

Search is a deliberate step. The intent stage decides whether current or
external information would materially improve the prompt and plans the
queries, nothing here runs on a request that did not ask for it.
"""

from __future__ import annotations

import asyncio
import logging
import re

from core.providers.base import ModelProvider, ProviderError, ProviderMessage, ProviderResponseError
from schemas.requests import SourceLink, SourceNote

logger = logging.getLogger("data.research")

MAX_QUERIES = 2
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


PLANNER_SYSTEM_PROMPT = """You plan web searches. The user is asking for a prompt that depends on current, external information. List the 1 or 2 most useful, specific web search queries that would fetch the facts the prompt needs, such as the current version of a named tool and what changed in it.

Respond with a single JSON object and nothing outside it: { "search_queries": ["query one", "query two"] }
Use an empty array if no search would help."""


async def plan_queries(message: str, provider: ModelProvider) -> list[str]:
    try:
        raw = await provider.complete_json(
            model=provider.resolve_model("", fast=True),
            system=PLANNER_SYSTEM_PROMPT,
            messages=[ProviderMessage(role="user", text=message)],
            max_tokens=120,
            temperature=0.1,
        )
    except (ProviderError, ProviderResponseError) as exc:
        logger.error("search planning failed: %s", exc)
        return []
    return clean_queries(raw.get("search_queries"))
