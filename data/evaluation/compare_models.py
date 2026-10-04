"""Build the same requests with different construction models and write the
results side by side to a markdown file, for a person to read.

Real model calls, a few cents each. Usage:

    python evaluation/compare_models.py out.md gpt-4o gpt-4.1 gpt-5.1
    python evaluation/compare_models.py out.md --requests 1,3 gpt-5.1
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.context import assemble_context  # noqa: E402
from core.providers import get_provider  # noqa: E402
from routers.generate import run_pipeline  # noqa: E402
from schemas.requests import GenerateRequest  # noqa: E402

REQUESTS = [
    "Write a prompt that reviews pull requests for a Rust CLI that parses logs. It should flag unsafe code, missing tests, and unclear error handling, and answer with a short checklist.",
    "I need a system prompt for a customer support agent for a B2B invoicing SaaS called Ledgerly. It handles refund disputes, can issue credits up to $100 on its own, and must escalate any legal threat to a human.",
    "Turn my rough meeting notes into a weekly status email for my VP. The VP is not technical and wants decisions and blockers first.",
    "A prompt to extract structured data from photographed receipts: vendor, date, total, tax and line items, returned as JSON.",
    "A prompt for a coding assistant that helps me migrate a Django 3.2 codebase to Django 5 safely, one app at a time.",
    "Write a prompt that generates Instagram marketing copy for a pineapple juice brand aimed at gym goers.",
]


async def run_one(provider, message: str, model: str):
    # Only the construction step uses the model under test.
    name, _, effort = model.partition("@")
    provider._step_models["construct"] = name
    if effort:
        provider._reasoning_effort = effort
    request = GenerateRequest.model_validate(
        {"message": message, "model": "gpt-4o", "profile": {"preferred_name": "Kenny", "role": "Software engineer"}, "memories": [], "history": []}
    )
    result = None
    async for event in run_pipeline(assemble_context(request), provider):
        if getattr(event, "type", "") in ("result", "clarifying_question", "answer", "error"):
            result = event
    return result


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("out")
    parser.add_argument("models", nargs="+")
    parser.add_argument("--requests", default="")
    args = parser.parse_args()
    picks = [int(i) - 1 for i in args.requests.split(",")] if args.requests else list(range(len(REQUESTS)))

    lines: list[str] = []
    for index in picks:
        message = REQUESTS[index]
        lines.append(f"\n\n# Request {index + 1}\n\n> {message}\n")
        for model in args.models:
            provider = get_provider()
            started = time.monotonic()
            try:
                result = await run_one(provider, message, model)
            except Exception as exc:  # noqa: BLE001
                lines.append(f"\n## {model}\n\nFAILED: {exc}\n")
                continue
            if result is None or result.type != "result":
                lines.append(f"\n## {model}\n\nNo prompt, got: {getattr(result, 'type', None)}\n")
                continue
            usage = result.usage
            seconds = time.monotonic() - started
            lines.append(
                f"\n## {model}  |  {len(result.content.split())} words  |  score {result.score}  |  ${usage.est_cost_usd:.4f}  |  {seconds:.0f}s\n\n{result.content}\n\n"
                f"_assumptions_: {'; '.join(result.diff.inferred)}\n"
            )
            print(f"request {index + 1} {model}: {len(result.content.split())} words ${usage.est_cost_usd:.4f} {seconds:.0f}s")
    Path(args.out).write_text("".join(lines), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
