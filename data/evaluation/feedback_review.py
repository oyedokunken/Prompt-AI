"""Turns thumbs up and thumbs down feedback into material a person can review.

This is a review loop, not automatic learning. Nothing here changes the model,
the templates or the eval set on its own. It exports rated responses, shows
where the ratings cluster, and drafts eval cases from the thumbs down items so
that a person can read them, write down what a good result would have been,
and decide whether each belongs in evaluation/eval_set.json. The same export
shows which template version produced the well and badly rated prompts, which
is the signal to look at when refining a template.

Usage, from the data directory:

    python evaluation/feedback_review.py --fetch        read rated responses from Supabase and summarize
    python evaluation/feedback_review.py --candidates   also write draft eval cases for the thumbs down items

Fetching needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
The exports contain real user content, so they are git ignored and should stay
on the machine that made them.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

EVAL_DIR = Path(__file__).parent
EXPORT_PATH = EVAL_DIR / "feedback_export.json"
CANDIDATES_PATH = EVAL_DIR / "feedback_candidates.json"
OUTPUT_PREVIEW_CHARS = 500


@dataclass(frozen=True)
class FeedbackItem:
    rating: str
    request: str
    output: str
    mode: str
    score: Optional[int]
    template_version: Optional[str]
    at: str


def parse_rows(rows: list[dict[str, Any]]) -> list[FeedbackItem]:
    """Rated assistant messages, as stored, into plain items. Anything malformed is skipped."""
    items: list[FeedbackItem] = []
    for row in rows:
        meta = row.get("metadata") or {}
        feedback = meta.get("feedback")
        if not isinstance(feedback, dict) or feedback.get("rating") not in ("up", "down"):
            continue
        score = feedback.get("score")
        items.append(
            FeedbackItem(
                rating=feedback["rating"],
                request=str(feedback.get("request") or ""),
                output=str(row.get("content") or ""),
                mode=str(meta.get("mode") or "ready"),
                score=int(score) if isinstance(score, (int, float)) else None,
                template_version=feedback.get("templateVersion") or meta.get("templateVersion"),
                at=str(feedback.get("at") or row.get("created_at") or ""),
            )
        )
    return items


def summarize(items: list[FeedbackItem]) -> dict[str, Any]:
    """Counts and averages, overall and per template version."""

    def block(group: list[FeedbackItem]) -> dict[str, Any]:
        up = [i for i in group if i.rating == "up"]
        down = [i for i in group if i.rating == "down"]
        mean = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
        return {
            "total": len(group),
            "up": len(up),
            "down": len(down),
            "helpful_rate": round(100 * len(up) / len(group)) if group else None,
            "mean_score_when_up": mean([i.score for i in up if i.score is not None]),
            "mean_score_when_down": mean([i.score for i in down if i.score is not None]),
        }

    by_version: dict[str, list[FeedbackItem]] = defaultdict(list)
    for item in items:
        by_version[item.template_version or "unknown"].append(item)
    return {"overall": block(items), "by_template_version": {v: block(g) for v, g in sorted(by_version.items())}}


def to_candidate_cases(items: list[FeedbackItem]) -> list[dict[str, Any]]:
    """Draft eval cases from thumbs down items, for a person to review.

    Each draft is marked needs_review and carries the output that was rated
    down, so the reviewer can write what a good result should have been in
    place of the placeholder note. Nothing is added to the eval set from here.
    """
    cases: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        if item.rating != "down" or not item.request.strip():
            continue
        digest = hashlib.sha1(item.request.strip().lower().encode()).hexdigest()[:8]
        if digest in seen:
            continue
        seen.add(digest)
        decision = "conversation" if item.mode == "answer" else "ready"
        cases.append(
            {
                "id": f"feedback-{digest}",
                "needs_review": True,
                "input": item.request.strip(),
                "profile": {},
                "memories": [],
                "expect": {"decision": decision, "must_include": [], "must_not_include": []},
                "good_prompt_notes": (
                    "DRAFT from a thumbs down, replace this note with what a good result looks like before adding. "
                    f"Template {item.template_version or 'unknown'}, score {item.score}. "
                    f"The output that was rated down began: {item.output[:OUTPUT_PREVIEW_CHARS]!r}"
                ),
            }
        )
    return cases


def fetch_rows(base_url: str, service_key: str, limit: int = 500) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "select": "content,created_at,metadata",
            "role": "eq.assistant",
            "metadata->feedback": "not.is.null",
            "order": "created_at.desc",
            "limit": str(limit),
        }
    )
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/rest/v1/messages?{query}",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Review thumbs up and down feedback")
    parser.add_argument("--fetch", action="store_true", help="read rated responses from Supabase")
    parser.add_argument("--candidates", action="store_true", help="also write draft eval cases from thumbs down items")
    args = parser.parse_args()
    if not (args.fetch or args.candidates):
        parser.print_help()
        return 2

    base_url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to read feedback.")
        return 2

    items = parse_rows(fetch_rows(base_url, key))
    EXPORT_PATH.write_text(json.dumps([asdict(i) for i in items], indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(items)} rated responses exported to {EXPORT_PATH}")
    print(json.dumps(summarize(items), indent=2))
    if args.candidates:
        cases = to_candidate_cases(items)
        CANDIDATES_PATH.write_text(json.dumps(cases, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{len(cases)} draft cases written to {CANDIDATES_PATH}. Review each one before adding it to eval_set.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
