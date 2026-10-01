import test from "node:test";
import assert from "node:assert/strict";
import { findOpenClarifyState, recordFromTerminalEvent, splitSseFrames } from "./chatState";

const state = { original_message: "a bot", questions: [{ id: "q1", text: "Which product?" }], answers: [] };

test("an open clarify state is recovered from the latest assistant message", () => {
  const rows = [
    { role: "user", content: "a bot", metadata: {} },
    { role: "assistant", content: "Which product?", metadata: { mode: "clarify", clarifyState: state } },
    { role: "user", content: "what do you know about me?", metadata: {} },
    { role: "assistant", content: "Nothing stored.", metadata: { mode: "answer", clarifyState: state } },
  ];
  assert.deepEqual(findOpenClarifyState(rows), state);
});

test("a finished prompt closes the clarifying sequence", () => {
  const rows = [
    { role: "assistant", content: "Which product?", metadata: { mode: "clarify", clarifyState: state } },
    { role: "assistant", content: "## Role", metadata: { mode: "ready" } },
  ];
  assert.equal(findOpenClarifyState(rows), null);
});

test("a plain direct answer with no pending question leaves no state behind", () => {
  const rows = [{ role: "assistant", content: "Hi", metadata: { mode: "answer" } }];
  assert.equal(findOpenClarifyState(rows), null);
});

test("sse frames are split without altering their raw text, and a partial tail is kept", () => {
  const first = 'event: stage\ndata: {"type":"stage","stage":"intent","message":"Working"}\n\n';
  const { frames, rest } = splitSseFrames(first + "event: result\ndata: {\"ty");
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.raw, first);
  assert.equal(frames[0]?.event, "stage");
  assert.equal(rest, 'event: result\ndata: {"ty');
});

test("a clarifying question becomes a one question message with the intro on the first only", () => {
  const first = recordFromTerminalEvent("clarifying_question", {
    question: { id: "q1", text: "Which product?" }, position: 1, total: 2, intro: "Happy to help.", clarify_state: state,
  });
  assert.equal(first?.content, "Happy to help.\n\nWhich product?");
  assert.equal(first?.metadata.mode, "clarify");
  const second = recordFromTerminalEvent("clarifying_question", {
    question: { id: "q2", text: "Which tone?" }, position: 2, total: 2, clarify_state: state,
  });
  assert.equal(second?.content, "Which tone?");
});

test("a result keeps inferred items under assumptions and stores the stated versus inferred diff", () => {
  const rec = recordFromTerminalEvent("result", {
    content: "## Role", score: 84, diff: { stated: ["B2B"], inferred: ["English only"] }, template_version: "v1",
  });
  assert.equal(rec?.metadata.mode, "ready");
  assert.deepEqual(rec?.metadata.assumptions, ["English only"]);
  assert.equal(rec?.metadata.score, 84);
});

test("an answer that hands back a pending question stays pending, a plain one does not", () => {
  const withPending = recordFromTerminalEvent("answer", { content: "Only your name.", pending_question: { id: "q1", text: "Which product?" }, position: 1, total: 2, clarify_state: state });
  assert.equal(withPending?.metadata.clarifyState, state);
  const plain = recordFromTerminalEvent("answer", { content: "Hello." });
  assert.equal(plain?.metadata.clarifyState, undefined);
});

test("stage events are not terminal", () => {
  assert.equal(recordFromTerminalEvent("stage", {}), null);
});

test("a result keeps the conversational wrapper apart from the deliverable and carries what memory informed it", () => {
  const rec = recordFromTerminalEvent("result", {
    message: "Built around your Go stack.", content: "Role\nYou review Go code.", score: 80,
    diff: { stated: [], inferred: [] }, memory_used: [{ category: "skills", key: "Stack", value: "Go" }],
    memory_candidates: [{ category: "skills", key: "Language", value: "Go", confidence: 0.9 }],
  });
  assert.equal(rec?.content, "Role\nYou review Go code.");
  assert.equal(rec?.metadata.preamble, "Built around your Go stack.");
  assert.deepEqual(rec?.metadata.memoryUsed, [{ category: "skills", key: "Stack", value: "Go" }]);
  assert.equal(rec?.memoryCandidates?.length, 1);
  assert.equal("memoryCandidates" in (rec?.metadata ?? {}), false);
});

test("a casual answer carries memory used and candidates out of band", () => {
  const rec = recordFromTerminalEvent("answer", {
    content: "Rust, huh.", memory_used: [], memory_candidates: [{ category: "skills", key: "Language", value: "Rust" }],
  });
  assert.equal(rec?.metadata.mode, "answer");
  assert.equal(rec?.memoryCandidates?.length, 1);
});
