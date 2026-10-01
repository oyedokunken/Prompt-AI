"""Runs the eval set against the pipeline.

THE DEFAULT COSTS NOTHING. With no flags this runs in mock mode: no API key,
no network, no spend. A scripted provider answers from each case's own
expectations, so it checks the pipeline's wiring and the check logic after a
code change, and it says nothing about model quality.

Real model calls need a deliberate choice, because a full run costs roughly a
dollar and the quality questions it answers are only worth asking at a
checkpoint, before and after a change to the prompts or the models:

    python evaluation/run_eval.py                                       mock, free, for routine iteration
    python evaluation/run_eval.py --live --only conv-roast --yes        a few real cases
    python evaluation/run_eval.py --live --full --yes                   the whole set against OpenAI
    python evaluation/run_eval.py --live --full --yes --judge           and score each prompt with a reviewer
    python evaluation/run_eval.py --live --full --yes --save-baseline   record the result as the baseline
    python evaluation/run_eval.py --live --cheap --only vague-blog --yes  smoke test on the small model

A live run prints an estimated cost first and refuses to start without --yes
(or EVAL_CONFIRM_SPEND=1), refuses to run the whole set without --full, and
prints the real spend, from the usage log, when it finishes.

Run live checkpoints before and after any change to core/prompts/templates or
to a step's model. A case that passed in the baseline and fails now is
reported as a regression, and the process exits non zero.

Checks are deliberately mechanical: the right decision (clarify, ready or
conversation), required terms present, forbidden terms absent, sane
structure, filler phrases and memory behavior. The good_prompt_notes on each
case are for a person reading a failure, they are not graded automatically.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import usage  # noqa: E402
from core.context import assemble_context  # noqa: E402
from core.prompts.loader import ACTIVE_VERSION  # noqa: E402
from core.providers import get_provider  # noqa: E402
from core.providers.base import ModelProvider, ProviderMessage, SearchOutcome  # noqa: E402
from routers.generate import run_pipeline  # noqa: E402
from schemas.requests import GenerateRequest  # noqa: E402

EVAL_DIR = Path(__file__).parent
EVAL_SET = EVAL_DIR / "eval_set.json"
BASELINE = EVAL_DIR / "baseline.json"
RESULTS_DIR = EVAL_DIR / "results"

# Stock phrases that sound structured but change nothing about what a model
# does. A prompt leaning on them is padded, not engineered.
FILLER_PHRASES = [
    "ensure", "at all times", "polite and professional", "clear and concise", "concise and informative",
    "constructive feedback", "best practices", "where necessary", "as needed", "when necessary",
    "high quality", "high-quality", "accurate and helpful", "maintain confidentiality", "user-friendly",
    "universally relatable", "easy to understand", "comprehensive", "thorough", "ensuring",
]
MAX_FILLER_HITS = 3

JUDGE_PROMPT = """You are a strict but fair reviewer of prompts written for other AI models. You are given the request a user made and the prompt an assistant produced for it.

Use the whole scale. Anchors, apply them to each dimension:
1 = unusable or entirely generic.
2 = mostly restates the request in a fixed template, with several stock lines.
3 = competent: faithful to the request and usable, but a good share of the lines are generic or repeat each other.
4 = strong: nearly every line changes the model's behavior, with some expert additions the user did not state.
5 = exceptional and rare: every line is load bearing, with decision rules, tie breaks, a concrete output skeleton or example, and nothing padded.
A prompt that merely covers the stated requirements cleanly and adds nothing is a 3, not a 1. Reserve 1 and 2 for prompts that are actually padded or templated.

Dimensions:
- specificity: concrete, request specific instructions, thresholds and examples, versus statements that fit any request.
- fit: role, constraints and format shaped by this exact request, versus a template with blanks filled in.
- filler: absence of padding. Stock lines such as "ensure clarity", "be polite and professional", "provide helpful feedback", or the same constraint repeated across sections lower it.
- value: engineering added beyond restating the request, such as failure handling, tie breaks, structure and examples.

Respond with a single JSON object and nothing outside it:
{ "weakest_line": "the most generic line you found, quoted", "strongest_line": "the most load bearing line, quoted", "note": "two sentences of reasoning, written before the scores", "specificity": <integer 1 to 5>, "fit": <integer 1 to 5>, "filler": <integer 1 to 5>, "value": <integer 1 to 5> }"""

DECISION_BY_EVENT = {"clarifying_question": "clarify", "result": "ready", "answer": "conversation", "error": "error"}
CONCURRENCY = 4
JUDGE = False


def filler_hits(text: str) -> list[str]:
    lowered = text.lower()
    return [p for p in FILLER_PHRASES if p in lowered]


async def judge(case_input: str, output: str) -> dict[str, Any]:
    provider = get_provider()
    raw = await provider.complete_json(
        model=provider.resolve_model("gpt-4o"),
        system=JUDGE_PROMPT,
        messages=[ProviderMessage(role="user", text=f"REQUEST:\n{case_input}\n\nPROMPT PRODUCED:\n{output}")],
        max_tokens=300,
        temperature=0.0,
        step="eval_judge",
    )
    return {k: raw.get(k) for k in ("specificity", "fit", "filler", "value", "weakest_line", "note")}


def check_case(case: dict[str, Any], events: list[Any]) -> tuple[bool, list[str], dict[str, Any]]:
    expect = case["expect"]
    final = events[-1]
    decision = DECISION_BY_EVENT.get(final.type, final.type)
    failures: list[str] = []
    detail: dict[str, Any] = {"decision": decision, "stages": [e.stage for e in events if e.type == "stage"]}

    allowed = expect["decision"] if isinstance(expect["decision"], list) else [expect["decision"]]
    if decision not in allowed:
        failures.append(f"expected decision '{expect['decision']}', got '{decision}'")

    text = ""
    if final.type == "result":
        text = final.content
        detail.update(score=final.score, stated=len(final.diff.stated), inferred=len(final.diff.inferred))
        minimum = expect.get("min_chars", 200)
        if len(final.content) < minimum:
            failures.append(f"prompt content is under {minimum} characters")
        if not final.structured.role or not final.structured.format:
            failures.append("structured role or format is missing")
        if not 30 <= final.score <= 97:
            failures.append(f"score {final.score} is out of range")
        if expect.get("format", "plain") == "plain" and re.search(r"^\s*#{1,6}\s|\*\*|^\s*```|^\s*\|.*\|\s*$", final.content, re.M):
            failures.append("prompt uses heavy markdown where plain text was expected")
        hits = filler_hits(final.content)
        detail["filler"] = hits
        if len(hits) > MAX_FILLER_HITS:
            failures.append(f"{len(hits)} stock filler phrases: {hits}")
        detail["has_message"] = bool(final.message)
        if expect.get("message", True) and not final.message:
            failures.append("no conversational message accompanies the prompt")
        searched = "searching" in detail["stages"]
        if "search" in expect and searched != expect["search"]:
            failures.append(f"search ran: {searched}, expected {expect['search']}")
    elif final.type == "answer":
        detail["memory_candidates"] = [c.key for c in final.memory_candidates]
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
    used = getattr(final, "memory_used", None)
    if used is not None:
        detail["memory_used"] = [m.key for m in used]
        if "memory_used" in expect and bool(used) != expect["memory_used"]:
            failures.append(f"memory used: {bool(used)}, expected {expect['memory_used']}")
    if "memory_candidate" in expect:
        saved = bool(getattr(final, "memory_candidates", None))
        if saved != expect["memory_candidate"]:
            failures.append(f"memory candidate proposed: {saved}, expected {expect['memory_candidate']}")
    lowered = text.lower()
    if decision in allowed:
        for group in expect.get("must_include", []):
            if not any(term.lower() in lowered for term in group):
                failures.append(f"missing any of {group}")
        for term in expect.get("must_not_include", []):
            if term.lower() in lowered:
                failures.append(f"contains forbidden term '{term}'")

    return not failures, failures, detail


MOCK = True
# A typical measured cost of one case against the live API, used only for the
# estimate printed before a live run. The real spend is printed afterwards.
LIVE_COST_PER_CASE_USD = 0.013
JUDGE_COST_PER_PROMPT_USD = 0.003


class MockProvider(ModelProvider):
    """Answers from the case's own expectations. No network, no cost, no quality signal."""

    name = "mock"

    def __init__(self, case: dict[str, Any]) -> None:
        self.case = case
        expect = case["expect"]
        decision = expect["decision"]
        self.decision = decision[0] if isinstance(decision, list) else decision
        self.terms = [group[0] for group in expect.get("must_include", []) if group]
        self.minimum = expect.get("min_chars", 200)

    def resolve_model(self, requested: str, *, fast: bool = False, step: str | None = None) -> str:
        return "mock"

    async def complete_json(self, *, model, system, messages, max_tokens, temperature, step=""):
        expect = self.case["expect"]
        if step == "intent":
            if self.decision == "clarify":
                return {"kind": "prompt_request", "sufficient": False, "intro": "Happy to help.",
                        "questions": [{"text": "Which one do you mean?", "options": ["First", "Second"]}]}
            if self.decision == "conversation":
                return {"kind": "conversation", "about_user": bool(self.case.get("memories"))}
            return {"kind": "prompt_request", "sufficient": True,
                    "search_queries": ["mock query"] if expect.get("search") else []}
        if step == "answer":
            candidates = [{"category": "skills", "key": "Mock fact", "value": "A mock stable fact", "confidence": 0.9}] if expect.get("memory_candidate") else []
            return {"reply": "Mock reply. " + ", ".join(self.terms), "memory_candidates": candidates}
        if step == "construct":
            body = "Role\nMock prompt covering " + ", ".join(self.terms) + ". "
            body += "Detail. " * max(0, (self.minimum - len(body)) // 8 + 1)
            return {"message": "Mock message.", "content": body, "stated": [], "assumptions": [],
                    "structured": {"role": "mock", "format": "mock"}, "readiness": {"status": "ready"}}
        return {}

    async def complete_text(self, *, model, system, messages, max_tokens, temperature, step=""):
        return ""

    async def embed(self, texts, *, step=""):
        out = []
        for text in texts:
            vec = [0.0] * 64
            for word in re.findall(r"[a-z0-9]+", text.lower()):
                if len(word) > 2:
                    vec[int(hashlib.md5(word.encode()).hexdigest(), 16) % 64] += 1.0
            out.append(vec)
        return out

    async def search(self, *, model, query, step=""):
        return SearchOutcome(summary="Mock findings.")

    async def transcribe(self, *, filename, content, content_type):
        return ""


async def run_case(case: dict[str, Any], semaphore: asyncio.Semaphore) -> dict[str, Any]:
    request = GenerateRequest(
        message=case["input"],
        profile=case.get("profile") or {},
        memories=case.get("memories") or [],
        history=case.get("history") or [],
    )
    async with semaphore:
        provider = MockProvider(case) if MOCK else get_provider()
        events = [event async for event in run_pipeline(assemble_context(request), provider)]
    passed, failures, detail = check_case(case, events)
    result = {"id": case["id"], "passed": passed, "failures": failures, **detail}
    if JUDGE and not MOCK and events[-1].type == "result":
        result["judge"] = await judge(case["input"], detail["output"])
    return result


async def run_all(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    semaphore = asyncio.Semaphore(CONCURRENCY)
    return list(await asyncio.gather(*(run_case(case, semaphore) for case in cases)))


def summarize_judge(scores: list[dict[str, Any]]) -> str:
    keys = ("specificity", "fit", "filler", "value")
    rows = [s for s in scores if all(isinstance(s.get(k), (int, float)) for k in keys)]
    if not rows:
        return "no judged prompts"
    parts = [f"{k} {sum(r[k] for r in rows) / len(rows):.2f}" for k in keys]
    return f"{len(rows)} prompts, mean of 5: " + ", ".join(parts)


async def rejudge(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    cases = {c["id"]: c for c in json.loads(EVAL_SET.read_text(encoding="utf-8"))["cases"]}
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(r: dict[str, Any]) -> dict[str, Any]:
        async with sem:
            return {"id": r["id"], **await judge(cases[r["id"]]["input"], r["output"])}

    targets = [r for r in data["results"] if r.get("decision") == "ready" and r["id"] in cases]
    scores = await asyncio.gather(*(one(r) for r in targets))
    for sc in scores:
        print(f"  {sc['id']}: spec {sc['specificity']} fit {sc['fit']} filler {sc['filler']} value {sc['value']} | {sc.get('weakest_line')}")
    print(summarize_judge(list(scores)))
    return 0


def estimate_live_cost(cases: int, judge: bool) -> float:
    return cases * (LIVE_COST_PER_CASE_USD + (JUDGE_COST_PER_PROMPT_USD if judge else 0.0))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Prompt AI eval set. Free mock mode by default.")
    parser.add_argument("--live", action="store_true", help="call the real model provider, this costs money")
    parser.add_argument("--full", action="store_true", help="with --live, allow running the whole set")
    parser.add_argument("--yes", action="store_true", help="with --live, confirm the spend (or set EVAL_CONFIRM_SPEND=1)")
    parser.add_argument("--cheap", action="store_true", help="with --live, run every step on the small model, a smoke test only")
    parser.add_argument("--save-baseline", action="store_true", help="store this live run as the new baseline")
    parser.add_argument("--only", nargs="*", help="run only these case ids")
    parser.add_argument("--judge", action="store_true", help="with --live, also score each prompt with a reviewer model")
    parser.add_argument("--rejudge", metavar="RESULTS_JSON", help="with --live, score the stored outputs of an earlier run")
    args = parser.parse_args()

    global JUDGE, MOCK
    JUDGE = args.judge
    MOCK = not args.live

    cases = json.loads(EVAL_SET.read_text(encoding="utf-8"))["cases"]
    if args.only:
        cases = [c for c in cases if c["id"] in set(args.only)]
    if not cases:
        print("No cases selected")
        return 2

    if MOCK:
        for flag, name in ((args.judge, "--judge"), (args.save_baseline, "--save-baseline"), (args.rejudge, "--rejudge"), (args.cheap, "--cheap"), (args.full, "--full")):
            if flag:
                print(f"{name} needs --live, because it uses the real model and costs money.")
                return 2
        print("MOCK MODE: no model calls and no cost. This checks pipeline wiring only, it says nothing about model quality.")
        print("Use --live with --only or --full, and --yes, for a real run.\n")
    else:
        count = len(cases)
        if args.rejudge:
            count = sum(1 for r in json.loads(Path(args.rejudge).read_text(encoding="utf-8"))["results"] if r.get("decision") == "ready")
        if not args.only and not args.full and not args.rejudge:
            print(f"Refusing to run all {count} cases against the live API without --full. Pick cases with --only, or add --full.")
            return 2
        estimate = estimate_live_cost(count, args.judge or bool(args.rejudge))
        if args.cheap:
            estimate /= 10
        print(f"LIVE MODE: {count} cases against the real API, estimated cost about ${estimate:.2f}.")
        if not (args.yes or os.environ.get("EVAL_CONFIRM_SPEND") == "1"):
            print("Not started. Add --yes (or set EVAL_CONFIRM_SPEND=1) to confirm the spend.")
            return 2
        if args.cheap:
            for name in ("OPENAI_MODEL", "OPENAI_INTENT_MODEL", "OPENAI_CONSTRUCT_MODEL", "OPENAI_ANSWER_MODEL", "OPENAI_VISION_MODEL", "OPENAI_SEARCH_MODEL"):
                os.environ[name] = "gpt-4o-mini"
            print("Cheap mode: every step on gpt-4o-mini. Results are a smoke test, not comparable with the baseline.")
        if args.rejudge:
            code = asyncio.run(rejudge(Path(args.rejudge)))
            print_spend()
            return code

    results = asyncio.run(run_all(cases))
    passed = [r for r in results if r["passed"]]
    failed = [r for r in results if not r["passed"]]

    baseline: dict[str, bool] = {}
    if BASELINE.is_file():
        baseline = json.loads(BASELINE.read_text(encoding="utf-8")).get("cases", {})
    regressions = [r["id"] for r in failed if baseline.get(r["id"]) is True and not MOCK and not args.cheap]
    fixed = [r["id"] for r in passed if baseline.get(r["id"]) is False]

    run = {
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": "mock" if MOCK else ("live-cheap" if args.cheap else "live"),
        "template_version": ACTIVE_VERSION,
        "passed": len(passed),
        "total": len(results),
        "regressions": regressions,
        "spend": {
            "calls": usage.process_meter.calls,
            "prompt_tokens": usage.process_meter.prompt_tokens,
            "cached_tokens": usage.process_meter.cached_tokens,
            "completion_tokens": usage.process_meter.completion_tokens,
            "est_cost_usd": round(usage.process_meter.cost_usd, 4),
            "by_step": {k: round(v, 4) for k, v in usage.process_meter.by_step().items()},
        },
        "results": results,
    }
    RESULTS_DIR.mkdir(exist_ok=True)
    out_path = RESULTS_DIR / f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_path.write_text(json.dumps(run, indent=2, ensure_ascii=False), encoding="utf-8")

    if JUDGE and not MOCK:
        print("Judge: " + summarize_judge([r["judge"] for r in results if "judge" in r]))
    print(f"Template version: {ACTIVE_VERSION}  mode: {run['mode']}")
    print(f"Passed {len(passed)} of {len(results)}")
    for result in failed:
        print(f"  FAIL {result['id']}: {'; '.join(result['failures'])}")
    if baseline and not MOCK:
        print(f"Against baseline: {len(regressions)} regressions, {len(fixed)} newly passing")
        for case_id in regressions:
            print(f"  REGRESSION {case_id}")
    elif not MOCK:
        print("No baseline yet, run with --save-baseline to create one")
    print(f"Full results: {out_path}")
    if not MOCK:
        print_spend()

    if args.save_baseline and not args.only and not args.cheap:
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

    return 1 if regressions or (MOCK and failed) else 0


def print_spend() -> None:
    meter = usage.process_meter
    print(
        f"SPEND this run: {meter.calls} calls, {meter.prompt_tokens:,} prompt tokens "
        f"({meter.cached_tokens:,} cached), {meter.completion_tokens:,} completion tokens, "
        f"estimated ${meter.cost_usd:.3f}"
    )
    for step, cost in sorted(meter.by_step().items(), key=lambda kv: -kv[1]):
        print(f"  {step:12s} ${cost:.4f}")


if __name__ == "__main__":
    sys.exit(main())
