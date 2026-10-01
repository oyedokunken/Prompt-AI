"""Runs the eval set against the current pipeline.

Usage, from the data directory, with OPENAI_API_KEY and API_SHARED_SECRET set:

    python evaluation/run_eval.py                  run and compare to the baseline
    python evaluation/run_eval.py --save-baseline  run and store this run as the baseline
    python evaluation/run_eval.py --only vague-blog full-sql-review

Run it before and after any change to core/prompts/templates. A case that
passed in the baseline and fails now is reported as a regression, and the
process exits non zero.

Checks are deliberately mechanical: the right decision (clarify, ready or
conversation), required terms present, forbidden terms absent, and sane
structure. The good_prompt_notes on each case are for a person reading a
failure, they are not graded automatically.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.context import assemble_context  # noqa: E402
from core.prompts.loader import ACTIVE_VERSION  # noqa: E402
from core.providers import get_provider  # noqa: E402
from routers.generate import run_pipeline  # noqa: E402
from schemas.requests import GenerateRequest  # noqa: E402

EVAL_DIR = Path(__file__).parent
EVAL_SET = EVAL_DIR / "eval_set.json"
BASELINE = EVAL_DIR / "baseline.json"
RESULTS_DIR = EVAL_DIR / "results"

DECISION_BY_EVENT = {"clarifying_question": "clarify", "result": "ready", "answer": "conversation", "error": "error"}
CONCURRENCY = 4


def check_case(case: dict[str, Any], events: list[Any]) -> tuple[bool, list[str], dict[str, Any]]:
    expect = case["expect"]
    final = events[-1]
    decision = DECISION_BY_EVENT.get(final.type, final.type)
    failures: list[str] = []
    detail: dict[str, Any] = {"decision": decision, "stages": [e.stage for e in events if e.type == "stage"]}

    if decision != expect["decision"]:
        failures.append(f"expected decision '{expect['decision']}', got '{decision}'")

    text = ""
    if final.type == "result":
        text = final.content
        detail.update(score=final.score, stated=len(final.diff.stated), inferred=len(final.diff.inferred))
        if len(final.content) < 200:
            failures.append("prompt content is under 200 characters")
        if not final.structured.role or not final.structured.format:
            failures.append("structured role or format is missing")
        if not 30 <= final.score <= 97:
            failures.append(f"score {final.score} is out of range")
    elif final.type == "answer":
        text = final.content
        if text.lstrip().startswith("{"):
            failures.append("answer is JSON, expected plain text")
    elif final.type == "clarifying_question":
        text = final.question.text
        detail.update(question=final.question.text, total=final.total)
        if final.position != 1:
            failures.append("first clarifying event is not question 1")
        if not 1 <= final.total <= 3:
            failures.append(f"{final.total} questions planned, expected 1 to 3")
    elif final.type == "error":
        failures.append(f"pipeline error: {final.code}")

    detail["output"] = text
    lowered = text.lower()
    if decision == expect["decision"]:
        for group in expect.get("must_include", []):
            if not any(term.lower() in lowered for term in group):
                failures.append(f"missing any of {group}")
        for term in expect.get("must_not_include", []):
            if term.lower() in lowered:
                failures.append(f"contains forbidden term '{term}'")

    return not failures, failures, detail


async def run_case(case: dict[str, Any], semaphore: asyncio.Semaphore) -> dict[str, Any]:
    request = GenerateRequest(
        message=case["input"],
        profile=case.get("profile") or {},
        memories=case.get("memories") or [],
        history=case.get("history") or [],
    )
    async with semaphore:
        events = [event async for event in run_pipeline(assemble_context(request), get_provider())]
    passed, failures, detail = check_case(case, events)
    return {"id": case["id"], "passed": passed, "failures": failures, **detail}


async def run_all(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    semaphore = asyncio.Semaphore(CONCURRENCY)
    return list(await asyncio.gather(*(run_case(case, semaphore) for case in cases)))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Prompt AI eval set")
    parser.add_argument("--save-baseline", action="store_true", help="store this run as the new baseline")
    parser.add_argument("--only", nargs="*", help="run only these case ids")
    args = parser.parse_args()

    cases = json.loads(EVAL_SET.read_text(encoding="utf-8"))["cases"]
    if args.only:
        cases = [c for c in cases if c["id"] in set(args.only)]
    if not cases:
        print("No cases selected")
        return 2

    results = asyncio.run(run_all(cases))
    passed = [r for r in results if r["passed"]]
    failed = [r for r in results if not r["passed"]]

    baseline: dict[str, bool] = {}
    if BASELINE.is_file():
        baseline = json.loads(BASELINE.read_text(encoding="utf-8")).get("cases", {})
    regressions = [r["id"] for r in failed if baseline.get(r["id"]) is True]
    fixed = [r["id"] for r in passed if baseline.get(r["id"]) is False]

    run = {
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "template_version": ACTIVE_VERSION,
        "passed": len(passed),
        "total": len(results),
        "regressions": regressions,
        "results": results,
    }
    RESULTS_DIR.mkdir(exist_ok=True)
    out_path = RESULTS_DIR / f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_path.write_text(json.dumps(run, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Template version: {ACTIVE_VERSION}")
    print(f"Passed {len(passed)} of {len(results)}")
    for result in failed:
        print(f"  FAIL {result['id']}: {'; '.join(result['failures'])}")
    if baseline:
        print(f"Against baseline: {len(regressions)} regressions, {len(fixed)} newly passing")
        for case_id in regressions:
            print(f"  REGRESSION {case_id}")
    else:
        print("No baseline yet, run with --save-baseline to create one")
    print(f"Full results: {out_path}")

    if args.save_baseline and not args.only:
        BASELINE.write_text(
            json.dumps(
                {
                    "saved_at": run["ran_at"],
                    "template_version": ACTIVE_VERSION,
                    "cases": {r["id"]: r["passed"] for r in results},
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"Baseline saved: {BASELINE}")

    return 1 if regressions else 0


if __name__ == "__main__":
    sys.exit(main())
