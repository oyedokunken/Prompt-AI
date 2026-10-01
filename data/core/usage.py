"""Token and cost accounting for every real model call.

Each call logs one line in a fixed format, and a per request meter adds them
up, so spend can be traced from the logs after the fact instead of being
discovered as a surprising balance. Prices are list prices in US dollars per
million tokens and are estimates: check them against the current price page
before relying on a total.

Log format, one line per call:
    usage step=intent model=gpt-4o prompt_tokens=2681 cached_tokens=0 completion_tokens=140 est_cost_usd=0.008105
and one line per request:
    turn_usage calls=3 prompt_tokens=5581 cached_tokens=2048 completion_tokens=1040 est_cost_usd=0.021
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("data.usage")

# (input, cached input, output) in USD per million tokens.
PRICES: dict[str, tuple[float, float, float]] = {
    "gpt-4o": (2.50, 1.25, 10.00),
    "gpt-4o-mini": (0.15, 0.075, 0.60),
    "text-embedding-3-small": (0.02, 0.02, 0.0),
}
# When a model is not in the table, assume the expensive one so a mistake
# overstates spend instead of hiding it.
FALLBACK_PRICE = PRICES["gpt-4o"]
# The web search tool is billed per call on top of the tokens it uses.
SEARCH_CALL_USD = 0.025
# Transcription is billed per minute of audio.
TRANSCRIBE_USD_PER_MINUTE = 0.006
# Recorded voice messages are small compressed audio, roughly 2KB a second.
APPROX_AUDIO_BYTES_PER_MINUTE = 120_000


def estimate_cost(model: str, prompt_tokens: int, cached_tokens: int, completion_tokens: int) -> float:
    inp, cached, out = PRICES.get(model, FALLBACK_PRICE)
    fresh = max(prompt_tokens - cached_tokens, 0)
    return (fresh * inp + cached_tokens * cached + completion_tokens * out) / 1_000_000


@dataclass(frozen=True)
class UsageRecord:
    step: str
    model: str
    prompt_tokens: int
    cached_tokens: int
    completion_tokens: int
    cost_usd: float


@dataclass
class UsageMeter:
    records: list[UsageRecord] = field(default_factory=list)

    @property
    def calls(self) -> int:
        return len(self.records)

    @property
    def prompt_tokens(self) -> int:
        return sum(r.prompt_tokens for r in self.records)

    @property
    def cached_tokens(self) -> int:
        return sum(r.cached_tokens for r in self.records)

    @property
    def completion_tokens(self) -> int:
        return sum(r.completion_tokens for r in self.records)

    @property
    def cost_usd(self) -> float:
        return sum(r.cost_usd for r in self.records)

    def by_step(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for r in self.records:
            out[r.step] = out.get(r.step, 0.0) + r.cost_usd
        return out

    def snapshot(self) -> dict[str, float | int]:
        return {
            "calls": self.calls,
            "prompt_tokens": self.prompt_tokens,
            "cached_tokens": self.cached_tokens,
            "completion_tokens": self.completion_tokens,
            "est_cost_usd": round(self.cost_usd, 6),
        }

    def log_summary(self, label: str = "turn_usage") -> None:
        logger.info(
            "%s calls=%d prompt_tokens=%d cached_tokens=%d completion_tokens=%d est_cost_usd=%.6f",
            label, self.calls, self.prompt_tokens, self.cached_tokens, self.completion_tokens, self.cost_usd,
        )


_current: ContextVar[Optional[UsageMeter]] = ContextVar("usage_meter", default=None)
# Everything recorded in this process, for tools such as the eval runner that
# want a grand total across many requests.
process_meter = UsageMeter()


def start_meter() -> UsageMeter:
    """Begin metering the current request. Calls made after this add to it."""
    meter = UsageMeter()
    _current.set(meter)
    return meter


def record(
    step: str,
    model: str,
    *,
    prompt_tokens: int = 0,
    cached_tokens: int = 0,
    completion_tokens: int = 0,
    extra_cost_usd: float = 0.0,
) -> UsageRecord:
    cost = estimate_cost(model, prompt_tokens, cached_tokens, completion_tokens) + extra_cost_usd
    rec = UsageRecord(step, model, prompt_tokens, cached_tokens, completion_tokens, cost)
    logger.info(
        "usage step=%s model=%s prompt_tokens=%d cached_tokens=%d completion_tokens=%d est_cost_usd=%.6f",
        step or "unlabelled", model, prompt_tokens, cached_tokens, completion_tokens, cost,
    )
    process_meter.records.append(rec)
    meter = _current.get()
    if meter is not None:
        meter.records.append(rec)
    return rec
