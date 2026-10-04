"""Run one message through the real pipeline and print every event.

A hand review tool, not a test. It makes real model calls, so each run costs
a few cents. Usage:

    python evaluation/live_probe.py "who is Lila Ibrahim"
    python evaluation/live_probe.py --name Kenny --memory "about:Role:Software engineer" "write a prompt for ..."
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.context import assemble_context  # noqa: E402
from core.providers import get_provider  # noqa: E402
from routers.generate import run_pipeline  # noqa: E402
from schemas.requests import GenerateRequest  # noqa: E402


def build_request(args: argparse.Namespace) -> GenerateRequest:
    memories = []
    for raw in args.memory:
        category, key, value = raw.split(":", 2)
        memories.append({"category": category, "key": key, "value": value})
    return GenerateRequest.model_validate(
        {
            "message": args.message,
            "model": "gpt-4o",
            "profile": {"preferred_name": args.name, "role": args.role},
            "memories": memories,
            "history": [],
        }
    )


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("message")
    parser.add_argument("--name", default=None)
    parser.add_argument("--role", default=None)
    parser.add_argument("--memory", action="append", default=[])
    parser.add_argument("--json", action="store_true", help="print the terminal event as JSON")
    args = parser.parse_args()

    provider = get_provider()
    ctx = assemble_context(build_request(args))
    async for event in run_pipeline(ctx, provider):
        kind = getattr(event, "type", "?")
        if kind == "stage":
            print(f"[stage:{event.stage}] {event.message}")
            continue
        print(f"\n[{kind}]")
        if args.json:
            print(event.model_dump_json(indent=2, exclude_none=True))
            continue
        data = event.model_dump(exclude_none=True)
        if kind == "answer":
            print(data["content"])
        elif kind == "result":
            print(data.get("message", ""))
            print("\n--- PROMPT ---\n" + data["content"] + "\n--- END ---")
            print("score", data.get("score"), "| words", len(data["content"].split()))
        else:
            print(json.dumps(data, indent=2)[:2000])
        for src in data.get("sources", []):
            print("source:", src.get("kind"), src.get("label"), [l["url"] for l in src.get("links", [])][:4])
        print("usage", data.get("usage"))


if __name__ == "__main__":
    asyncio.run(main())
