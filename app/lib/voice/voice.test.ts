import test from "node:test";
import assert from "node:assert/strict";
import { Resampler, toInt16, level } from "./pcm";
import { TranscriptAssembler } from "./transcriptAssembler";

test("48kHz audio is resampled to half as many 24kHz samples", () => {
  const r = new Resampler(48_000, 24_000);
  const out = r.push(new Float32Array(4800).fill(0.5));
  assert.equal(out.length, 2400);
  assert.ok(out.every((v) => v === toInt16(0.5)));
});

test("the output rate stays exact across chunk boundaries at 44.1kHz", () => {
  const r = new Resampler(44_100, 24_000);
  let total = 0;
  for (let i = 0; i < 100; i++) total += r.push(new Float32Array(2048)).length;
  const expected = (100 * 2048 * 24_000) / 44_100;
  assert.ok(Math.abs(total - expected) <= 1, `got ${total}, expected about ${expected}`);
});

test("samples are clamped and scaled to 16 bit", () => {
  assert.equal(toInt16(1), 0x7fff);
  assert.equal(toInt16(-1), -0x8000);
  assert.equal(toInt16(3), 0x7fff);
  assert.equal(toInt16(0), 0);
  assert.equal(level(new Float32Array(10)), 0);
  assert.ok(level(new Float32Array(10).fill(0.5)) > 0.5);
});

test("deltas build a phrase and the final text replaces them", () => {
  const t = new TranscriptAssembler();
  t.apply({ type: "order", itemId: "a", previousItemId: null });
  t.apply({ type: "delta", itemId: "a", text: "Hello" });
  t.apply({ type: "delta", itemId: "a", text: " wor" });
  assert.equal(t.text(), "Hello wor");
  t.apply({ type: "final", itemId: "a", text: "Hello world." });
  t.apply({ type: "delta", itemId: "a", text: " stray" });
  assert.equal(t.text(), "Hello world.");
});

test("phrases keep the server's order even when they finish out of order", () => {
  const t = new TranscriptAssembler();
  t.apply({ type: "order", itemId: "a", previousItemId: null });
  t.apply({ type: "order", itemId: "b", previousItemId: "a" });
  t.apply({ type: "final", itemId: "b", text: "second." });
  assert.equal(t.text(), "second.");
  t.apply({ type: "final", itemId: "a", text: "First." });
  assert.equal(t.text(), "First. second.");
});

test("empty phrases add nothing and unknown items are tolerated", () => {
  const t = new TranscriptAssembler();
  t.apply({ type: "final", itemId: "x", text: "" });
  assert.equal(t.hasText(), false);
  t.apply({ type: "delta", itemId: "late", text: "hi" });
  assert.equal(t.text(), "hi");
});

import { EndpointDetector } from "./endpointing";

test("recording ends after quiet that follows speech, and not before", () => {
  const d = new EndpointDetector();
  assert.equal(d.update(0.02, 0), "listening");
  assert.equal(d.update(0.5, 1000), "listening");
  assert.equal(d.update(0.4, 2000), "listening");
  // quiet, but not yet long enough
  assert.equal(d.update(0.02, 3000), "listening");
  assert.equal(d.update(0.03, 3700), "listening");
  assert.equal(d.update(0.02, 3900), "silence");
});

test("a pause shorter than the limit does not end the message", () => {
  const d = new EndpointDetector();
  d.update(0.6, 0);
  assert.equal(d.update(0.01, 1500), "listening");
  assert.equal(d.update(0.6, 1700), "listening");
  assert.equal(d.update(0.01, 3000), "listening");
});

test("new text counts as the speaker still talking, even when the audio is soft", () => {
  const d = new EndpointDetector();
  d.update(0.5, 0);
  d.noteText(1500);
  assert.equal(d.update(0.02, 3000), "listening");
  assert.equal(d.update(0.02, 3400), "silence");
});

test("silence from the start gives up, and a long message is cut off at the ceiling", () => {
  const quiet = new EndpointDetector();
  assert.equal(quiet.update(0.01, 0), "listening");
  assert.equal(quiet.update(0.01, 10_000), "no-speech");

  const long = new EndpointDetector({ speechLevel: 0.1, silenceMs: 1800, noSpeechMs: 10_000, maxMs: 5000 });
  long.update(0.5, 0);
  assert.equal(long.update(0.5, 5000), "too-long");
});
