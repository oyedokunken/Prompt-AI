"""Unit tests for intent detection, clarify sequencing and prompt construction.

No network. The model provider is replaced with a scripted fake, so these
test the pipeline's own logic, not the model.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

os.environ["OPENAI_API_KEY"] = ("sk-test_aaaaaaaaaaaaaaaaaaaaaaaaaaaa")
os.environ["API_SHARED_SECRET"] = "unit-test-shared-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from config import Settings  # noqa: E402
from core.context import assemble_context, select_relevant_memories  # noqa: E402
from core.pipeline import clarify, construct, intent, score  # noqa: E402
from core.prompts import system_prompts  # noqa: E402
from core.providers import get_provider  # noqa: E402
from core.providers.base import ModelProvider, ProviderError, ProviderMessage  # noqa: E402
from main import app  # noqa: E402
from routers.generate import run_pipeline  # noqa: E402
from routers.title import clean_title  # noqa: E402
from schemas.requests import ClarifyQuestion, GenerateRequest, Memory  # noqa: E402

AUTH = {"Authorization": "Bearer unit-test-shared-secret"}


class FakeProvider(ModelProvider):
    """Returns scripted responses in order and records every call."""

    name = "fake"

    def __init__(self, responses: list[Any]) -> None:
        self.responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    def resolve_model(self, requested: str, *, fast: bool = False) -> str:
        return "fake-fast" if fast else "fake-main"

    def _next(self, **call: Any) -> Any:
        self.calls.append(call)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    async def complete_json(self, *, model, system, messages, max_tokens, temperature):
        return self._next(kind="json", model=model, system=system, messages=messages)

    async def complete_text(self, *, model, system, messages, max_tokens, temperature):
        return self._next(kind="text", model=model, system=system, messages=messages)

    async def transcribe(self, *, filename, content, content_type):
        return self._next(kind="transcribe", filename=filename, size=len(content))


def make_request(**overrides: Any) -> GenerateRequest:
    base: dict[str, Any] = {"message": "write me a prompt for a support bot"}
    base.update(overrides)
    return GenerateRequest(**base)


def collect(ctx, provider) -> list[Any]:
    async def run() -> list[Any]:
        return [event async for event in run_pipeline(ctx, provider)]

    return asyncio.run(run())


READY_CONSTRUCTION = {
    "content": "## Role\nYou are a support agent for a B2B invoicing product.",
    "stated": ["B2B invoicing product", "Friendly tone"],
    "assumptions": ["English only", "Friendly tone"],
    "structured": {"role": "Support agent", "context": "B2B invoicing", "constraints": ["Be brief"], "format": "Plain text"},
    "readiness": {"status": "ready", "missing": [], "notes": "Complete"},
    "explanation": "Clear role and escalation rules.",
    "memory_candidates": [{"category": "projects", "key": "Product", "value": "B2B invoicing", "confidence": 0.8}],
}

TWO_QUESTIONS = {
    "kind": "prompt_request",
    "sufficient": False,
    "intro": "Happy to build that.",
    "questions": [
        {"text": "What product is it for?"},
        {"text": "What tone should it use?", "options": ["Friendly", "Formal"], "multiple": False},
    ],
}


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def test_openai_key_is_trimmed_on_load():
    settings = Settings(OPENAI_API_KEY="  sk-test_aaaaaaaaaaaaaaaaaaaaaaaaaaaa\n", API_SHARED_SECRET="a" * 16)
    assert settings.openai_api_key == "sk-test_aaaaaaaaaaaaaaaaaaaaaaaaaaaa"


@pytest.mark.parametrize("bad_key", ["", "   ", "sk-abc\\n trailing junk", "not-a-key", "sk-short"])
def test_malformed_openai_key_fails_loudly(bad_key):
    with pytest.raises(ValidationError):
        Settings(OPENAI_API_KEY=bad_key, API_SHARED_SECRET="a" * 16)


def test_short_shared_secret_fails():
    with pytest.raises(ValidationError):
        Settings(OPENAI_API_KEY="sk-test_aaaaaaaaaaaaaaaaaaaaaaaaaaaa", API_SHARED_SECRET="short")


# ---------------------------------------------------------------------------
# Context assembly
# ---------------------------------------------------------------------------

def test_context_normalizes_blank_profile_fields_and_bounds_history():
    history = [{"role": "user", "content": f"m{i}"} for i in range(30)]
    ctx = assemble_context(make_request(profile={"preferred_name": "  Ada ", "role": "   "}, history=history))
    assert ctx.profile.preferred_name == "Ada"
    assert ctx.profile.role is None
    assert len(ctx.history) == 20
    assert ctx.history[-1].content == "m29"


def test_relevant_memories_keep_about_and_rank_by_overlap():
    memories = [
        Memory(category="about", key="Job", value="Backend engineer"),
        Memory(category="skills", key="Stack", value="Django and Postgres"),
        Memory(category="preferences", key="Coffee", value="Flat white"),
    ]
    selected = select_relevant_memories(memories, "a prompt for reviewing Django migrations")
    assert [m.key for m in selected] == ["Job", "Stack"]


def test_attachments_split_into_images_and_unreadable_names():
    ctx = assemble_context(
        make_request(
            attachments=[
                {"name": "a.png", "type": "image/png", "data_url": "data:image/png;base64,AAA"},
                {"name": "b.pdf", "type": "application/pdf"},
            ]
        )
    )
    assert ctx.image_urls == ["data:image/png;base64,AAA"]
    assert ctx.unreadable_attachments == ["b.pdf"]


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------

def test_intent_sufficient_request_needs_no_questions():
    decision = intent.parse_intent({"kind": "prompt_request", "sufficient": True, "questions": []}, has_pending_question=False)
    assert decision.kind == "prompt_request"
    assert not decision.needs_clarification


def test_intent_insufficient_request_plans_questions_with_ids():
    decision = intent.parse_intent(TWO_QUESTIONS, has_pending_question=False)
    assert decision.needs_clarification
    assert [q.id for q in decision.questions] == ["q1", "q2"]
    assert decision.questions[0].options is None
    assert decision.questions[1].options == ["Friendly", "Formal"]


def test_intent_caps_questions_at_three_and_drops_duplicates_and_blanks():
    raw = {
        "kind": "prompt_request",
        "sufficient": False,
        "questions": [{"text": "A?"}, {"text": "a?"}, {"text": ""}, {"text": "B?"}, {"text": "C?"}, {"text": "D?"}],
    }
    decision = intent.parse_intent(raw, has_pending_question=False)
    assert [q.text for q in decision.questions] == ["A?", "B?", "C?"]


def test_intent_single_option_falls_back_to_text_answer():
    raw = {"kind": "prompt_request", "sufficient": False, "questions": [{"text": "Which?", "options": ["Only"], "multiple": True}]}
    question = intent.parse_intent(raw, has_pending_question=False).questions[0]
    assert question.options is None
    assert question.multiple is False


def test_intent_insufficient_without_usable_questions_proceeds():
    decision = intent.parse_intent({"kind": "prompt_request", "sufficient": False, "questions": []}, has_pending_question=False)
    assert not decision.needs_clarification


def test_intent_answer_kind_is_only_valid_with_a_pending_question():
    assert intent.parse_intent({"kind": "answer"}, has_pending_question=True).kind == "answer"
    assert intent.parse_intent({"kind": "answer"}, has_pending_question=False).kind == "prompt_request"


def test_intent_conversation_kind():
    assert intent.parse_intent({"kind": "conversation"}, has_pending_question=False).kind == "conversation"


def test_interview_answer_skips_the_model_call():
    state = clarify.start("req", "", [ClarifyQuestion(id="q1", text="Which product?")])
    ctx = assemble_context(make_request(message="Invoicing", clarify_state=state, is_clarify_answer=True))
    provider = FakeProvider([])
    decision = asyncio.run(intent.detect(ctx, provider))
    assert decision.kind == "answer"
    assert provider.calls == []


# ---------------------------------------------------------------------------
# Clarify sequencing
# ---------------------------------------------------------------------------

def _three_question_state():
    return clarify.start(
        "build a bot",
        "Sure.",
        [ClarifyQuestion(id=f"q{i}", text=f"Question {i}?") for i in (1, 2, 3)],
    )


def test_clarify_asks_one_question_at_a_time_in_order():
    state = _three_question_state()
    assert clarify.pending_question(state).id == "q1"
    assert clarify.position(state) == (1, 3)

    state = clarify.record_answer(state, " first ")
    assert clarify.pending_question(state).id == "q2"
    assert clarify.position(state) == (2, 3)
    assert not clarify.is_complete(state)

    state = clarify.record_answer(state, "second")
    state = clarify.record_answer(state, "third")
    assert clarify.is_complete(state)
    assert clarify.question_answer_pairs(state) == [
        ("Question 1?", "first"),
        ("Question 2?", "second"),
        ("Question 3?", "third"),
    ]


def test_clarify_state_is_not_mutated_and_survives_a_json_round_trip():
    state = _three_question_state()
    advanced = clarify.record_answer(state, "first")
    assert state.answers == []
    restored = type(advanced).model_validate(json.loads(advanced.model_dump_json()))
    assert clarify.pending_question(restored).id == "q2"


def test_clarify_rejects_empty_answer_and_answer_after_completion():
    state = clarify.start("req", "", [ClarifyQuestion(id="q1", text="Only?")])
    with pytest.raises(clarify.ClarifyError):
        clarify.record_answer(state, "   ")
    done = clarify.record_answer(state, "yes")
    with pytest.raises(clarify.ClarifyError):
        clarify.record_answer(done, "again")


def test_clarify_caps_planned_questions():
    questions = [ClarifyQuestion(id=f"q{i}", text=f"Q{i}?") for i in range(1, 6)]
    assert len(clarify.start("req", "", questions).questions) == clarify.MAX_QUESTIONS


# ---------------------------------------------------------------------------
# Prompt construction and scoring
# ---------------------------------------------------------------------------

def test_user_turn_restates_original_request_and_every_answer():
    state = clarify.record_answer(clarify.record_answer(_three_question_state(), "alpha"), "beta")
    ctx = assemble_context(make_request(message="beta", clarify_state=state))
    turn = construct.build_user_turn(ctx, state)
    assert "build a bot" in turn
    assert "Question 1?" in turn and "Answer: alpha" in turn
    assert "Question 2?" in turn and "Answer: beta" in turn
    assert "Question 3?" not in turn


def test_user_turn_without_clarification_is_the_message_itself():
    ctx = assemble_context(make_request(message="  summarize this report  "))
    assert construct.build_user_turn(ctx, None) == "summarize this report"


def test_parse_construction_never_lists_an_item_as_both_stated_and_inferred():
    built = construct.parse_construction(READY_CONSTRUCTION)
    assert built.stated == ["B2B invoicing product", "Friendly tone"]
    assert built.assumptions == ["English only"]
    assert built.memory_candidates[0].key == "Product"


def test_parse_construction_without_content_is_an_error_not_a_fabrication():
    from core.providers.base import ProviderResponseError

    with pytest.raises(ProviderResponseError):
        construct.parse_construction({"content": "  ", "assumptions": []})


def test_score_falls_with_assumptions_and_missing_context():
    clean = construct.parse_construction({"content": "x", "stated": ["a"], "assumptions": []})
    loose = construct.parse_construction(
        {
            "content": "x",
            "assumptions": ["a", "b", "c"],
            "readiness": {"status": "needs_context", "missing": ["audience"]},
        }
    )
    assert score.completeness_score(clean) == 90
    assert score.completeness_score(loose) == 90 - 18 - 10 - 15
    assert score.build_diff(loose).inferred == ["a", "b", "c"]


def test_score_is_clamped():
    worst = construct.parse_construction(
        {"content": "x", "assumptions": [str(i) for i in range(20)], "readiness": {"status": "needs_context", "missing": ["a", "b", "c"]}}
    )
    assert score.completeness_score(worst) == score.MIN_SCORE


def test_user_name_inside_a_constructed_prompt_triggers_one_corrective_retry():
    leaky = {**READY_CONSTRUCTION, "content": "## Role - Help Tunde with his project."}
    clean = {**READY_CONSTRUCTION, "content": "## Role - Help the user with their project."}
    provider = FakeProvider([leaky, clean])
    ctx = assemble_context(make_request(profile={"preferred_name": "Tunde"}))
    built = asyncio.run(construct.construct(ctx, None, provider))
    assert "Tunde" not in built.content
    assert len(provider.calls) == 2
    assert "name inside the prompt" in provider.calls[1]["messages"][-1].text


def test_user_name_still_present_after_the_retry_is_scrubbed_not_shipped():
    leaky = {**READY_CONSTRUCTION, "content": "## Role - Help Tunde's team."}
    provider = FakeProvider([leaky, leaky])
    ctx = assemble_context(make_request(profile={"preferred_name": "Tunde"}))
    built = asyncio.run(construct.construct(ctx, None, provider))
    assert "tunde" not in built.content.lower()
    assert len(provider.calls) == 2


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

def test_knowledge_block_lists_empty_fields_as_nothing_stored():
    ctx = assemble_context(make_request(profile={"preferred_name": "Ada"}))
    prompt = system_prompts.answer_system_prompt(ctx)
    assert "Name: Ada" in prompt
    assert "Role: nothing stored" in prompt
    assert "Saved memory (everything saved):\n- nothing stored" in prompt
    assert "say plainly that you have nothing stored" in prompt


def test_answer_prompt_sees_every_memory_construct_prompt_only_relevant_ones():
    memories = [
        {"category": "preferences", "key": "Coffee", "value": "Flat white"},
        {"category": "skills", "key": "Stack", "value": "Django"},
    ]
    ctx = assemble_context(make_request(message="a prompt for Django code review", memories=memories))
    assert "Flat white" in system_prompts.answer_system_prompt(ctx)
    assert "Flat white" not in system_prompts.construct_system_prompt(ctx)
    assert "Django" in system_prompts.construct_system_prompt(ctx)


# ---------------------------------------------------------------------------
# Full pipeline, scripted provider
# ---------------------------------------------------------------------------

def test_pipeline_sufficient_request_emits_distinct_stages_then_result():
    provider = FakeProvider([{"kind": "prompt_request", "sufficient": True}, READY_CONSTRUCTION])
    out = collect(assemble_context(make_request()), provider)
    assert [e.stage for e in out[:-1]] == ["intent", "constructing", "scoring", "finalizing"]
    assert len({e.message for e in out[:-1]}) == 4
    result = out[-1]
    assert result.type == "result"
    assert result.score == 84
    assert result.diff.inferred == ["English only"]


def test_pipeline_underspecified_request_asks_only_the_first_question():
    provider = FakeProvider([TWO_QUESTIONS])
    out = collect(assemble_context(make_request()), provider)
    assert [e.type for e in out] == ["stage", "stage", "clarifying_question"]
    question = out[-1]
    assert question.question.text == "What product is it for?"
    assert (question.position, question.total) == (1, 2)
    assert question.intro == "Happy to build that."
    assert len(provider.calls) == 1


def test_pipeline_full_clarify_sequence_then_result_reflecting_every_answer():
    first = collect(assemble_context(make_request()), FakeProvider([TWO_QUESTIONS]))[-1]

    second = collect(
        assemble_context(make_request(message="Invoicing", clarify_state=first.clarify_state, is_clarify_answer=True)),
        FakeProvider([]),
    )
    assert [e.type for e in second] == ["stage", "stage", "clarifying_question"]
    assert second[-1].question.text == "What tone should it use?"
    assert (second[-1].position, second[-1].total) == (2, 2)
    assert second[-1].intro is None

    provider = FakeProvider([READY_CONSTRUCTION])
    third = collect(
        assemble_context(make_request(message="Friendly", clarify_state=second[-1].clarify_state, is_clarify_answer=True)),
        provider,
    )
    assert third[-1].type == "result"
    assert "your 2 answers" in third[1].message
    final_turn: ProviderMessage = provider.calls[0]["messages"][-1]
    assert "write me a prompt for a support bot" in final_turn.text
    assert "Answer: Invoicing" in final_turn.text
    assert "Answer: Friendly" in final_turn.text


def test_pipeline_direct_question_mid_sequence_keeps_the_pending_question():
    first = collect(assemble_context(make_request()), FakeProvider([TWO_QUESTIONS]))[-1]
    provider = FakeProvider([{"kind": "conversation"}, "I have your name stored as Ada. Nothing else."])
    ctx = assemble_context(
        make_request(message="what do you know about me?", clarify_state=first.clarify_state, profile={"preferred_name": "Ada"})
    )
    out = collect(ctx, provider)
    assert [e.type for e in out] == ["stage", "stage", "answer"]
    assert out[1].stage == "answering"
    answer = out[-1]
    assert answer.pending_question.text == "What product is it for?"
    assert answer.clarify_state.answers == []
    assert "Role: nothing stored" in provider.calls[1]["system"]


def test_pipeline_typed_reply_classified_as_answer_advances_the_sequence():
    first = collect(assemble_context(make_request()), FakeProvider([TWO_QUESTIONS]))[-1]
    out = collect(
        assemble_context(make_request(message="it is for invoicing", clarify_state=first.clarify_state)),
        FakeProvider([{"kind": "answer"}]),
    )
    assert out[-1].type == "clarifying_question"
    assert out[-1].clarify_state.answers[0].answer == "it is for invoicing"


def test_pipeline_provider_failure_is_an_honest_error_with_no_fabricated_result():
    provider = FakeProvider([ProviderError("boom", status=401, code="invalid_api_key")])
    out = collect(assemble_context(make_request()), provider)
    assert out[-1].type == "error"
    assert out[-1].code == "provider_error"
    assert not any(e.type == "result" for e in out)


# ---------------------------------------------------------------------------
# HTTP surface
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_is_open_and_everything_else_requires_the_shared_secret(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.post("/generate", json={"message": "hi"}).status_code == 401
    assert client.post("/title", json={"messages": ["hi"]}, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).status_code == 401


def test_generate_streams_server_sent_events(client):
    app.dependency_overrides[get_provider] = lambda: FakeProvider([TWO_QUESTIONS])
    response = client.post("/generate", json={"message": "a support bot"}, headers=AUTH)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    frames = [f for f in response.text.split("\n\n") if f]
    assert [f.split("\n")[0] for f in frames] == ["event: stage", "event: stage", "event: clarifying_question"]
    payload = json.loads(frames[-1].split("\n")[1][len("data: "):])
    assert payload["clarify_state"]["original_message"] == "a support bot"


def test_title_endpoint_cleans_the_inferred_title(client):
    app.dependency_overrides[get_provider] = lambda: FakeProvider([{"title": '"Invoicing support agent."'}])
    response = client.post("/title", json={"messages": ["write me a prompt for a support bot"]}, headers=AUTH)
    assert response.json() == {"title": "Invoicing support agent"}


def test_clean_title_rejects_non_strings():
    assert clean_title(None) == ""


def test_transcribe_endpoint_returns_text(client):
    app.dependency_overrides[get_provider] = lambda: FakeProvider(["hello there"])
    response = client.post("/transcribe", files={"audio": ("a.webm", b"abc", "audio/webm")}, headers=AUTH)
    assert response.json() == {"text": "hello there"}
