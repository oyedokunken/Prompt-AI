process.env.TZ = "UTC";

import test from "node:test";
import assert from "node:assert/strict";
import { RANGES, buildSeries, describeSeries, formatValue, metricValue, type UsageMessage } from "./usageSeries";

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ready = (when: number, extra: Partial<UsageMessage["metadata"]> = {}, content = "one two three four"): UsageMessage => ({
  role: "assistant", content, created_at: ago(when),
  metadata: { mode: "ready", score: 80, usage: { promptTokens: 1000, completionTokens: 200, estCostUsd: 0.01 }, ...extra },
});

test("each range has the right number of buckets", () => {
  const counts = Object.fromEntries(RANGES.map((r) => [r.id, buildSeries([], r.id, NOW).buckets.length]));
  assert.deepEqual(counts, { "1d": 24, "3d": 12, "7d": 7, "1m": 30, "3m": 13 });
});

test("messages land in the bucket that contains them and outside the window they are ignored", () => {
  const s = buildSeries([ready(30 * 60_000), ready(5 * HOUR), ready(2 * DAY)], "1d", NOW);
  assert.equal(s.totals.prompts, 2);
  const at = (ms: number) => s.buckets.find((b) => NOW - ms >= b.start && NOW - ms < b.end);
  assert.equal(at(30 * 60_000)?.prompts, 1);
  assert.equal(at(5 * HOUR)?.prompts, 1);
  assert.equal(buildSeries([ready(2 * DAY)], "3d", NOW).totals.prompts, 1);
});

test("daily buckets are real calendar days and the last one is today", () => {
  const s = buildSeries([ready(HOUR)], "7d", NOW);
  const today = s.buckets[s.buckets.length - 1]!;
  assert.equal(new Date(today.start).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(new Date(today.end).toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(today.prompts, 1);
  assert.equal(s.buckets[0]!.label, new Date(s.buckets[0]!.start).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  for (let i = 1; i < s.buckets.length; i++) assert.equal(s.buckets[i]!.start, s.buckets[i - 1]!.end);
});

test("hourly buckets are real hours", () => {
  const s = buildSeries([], "1d", NOW);
  assert.equal(new Date(s.buckets[s.buckets.length - 1]!.start).toISOString(), "2026-10-01T12:00:00.000Z");
  assert.equal(s.buckets[0]!.end - s.buckets[0]!.start, HOUR);
});

test("tokens add input and output, and only counted messages are tracked", () => {
  const untracked: UsageMessage = { role: "assistant", content: "x y", created_at: ago(HOUR), metadata: { mode: "ready", score: 60 } };
  const s = buildSeries([ready(HOUR), untracked], "7d", NOW);
  assert.equal(s.totals.tokens, 1200);
  assert.equal(s.trackedMessages, 1);
  assert.equal(s.assistantMessages, 2);
});

test("averages are null, not zero, when there is nothing to average", () => {
  const s = buildSeries([], "7d", NOW);
  for (const m of ["outputLength", "score", "approval"] as const) assert.equal(metricValue(s.totals, m), null);
  assert.equal(metricValue(s.totals, "prompts"), 0);
  assert.equal(formatValue(null, "score"), "no data");
});

test("output length is words per generated prompt and the score is an average", () => {
  const s = buildSeries([ready(HOUR, { score: 70 }, "a b c d e f"), ready(2 * HOUR, { score: 90 }, "a b")], "1d", NOW);
  assert.equal(metricValue(s.totals, "outputLength"), 4);
  assert.equal(metricValue(s.totals, "score"), 80);
});

test("clarifying questions and the helpful rate are counted from the right messages", () => {
  const clarify: UsageMessage = { role: "assistant", content: "Which?", created_at: ago(HOUR), metadata: { mode: "clarify", usage: { promptTokens: 500, completionTokens: 50 } } };
  const up = ready(HOUR, { feedback: { rating: "up" } });
  const down = ready(2 * HOUR, { feedback: { rating: "down" } });
  const up2 = ready(3 * HOUR, { feedback: { rating: "up" } });
  const s = buildSeries([clarify, up, down, up2, { role: "user", content: "hi", created_at: ago(HOUR), metadata: {} }], "1d", NOW);
  assert.equal(s.totals.questions, 1);
  assert.equal(s.totals.prompts, 3);
  assert.equal(metricValue(s.totals, "approval"), 67);
});

test("switching range changes what is counted", () => {
  const msgs = [ready(HOUR), ready(2 * DAY), ready(20 * DAY), ready(60 * DAY)];
  const counts = RANGES.map((r) => buildSeries(msgs, r.id, NOW).totals.prompts);
  assert.deepEqual(counts, [1, 2, 2, 3, 4]);
});

test("the description only states what is in the totals", () => {
  assert.match(describeSeries(buildSeries([], "7d", NOW), "7 days"), /Nothing yet/);
  const text = describeSeries(buildSeries([ready(HOUR)], "7d", NOW), "7 days");
  assert.match(text, /built 1 prompt at an average completeness of 80/);
  assert.match(text, /1,200 tokens/);
});

test("direct answers are counted on their own, so a range of answers is not shown as zero activity", () => {
  const answer = (agoMs: number, withSearch: boolean) =>
    ({
      role: "assistant",
      content: "An answer.",
      created_at: new Date(NOW - agoMs).toISOString(),
      metadata: { mode: "answer", sources: withSearch ? [{ kind: "search" }] : [], usage: { promptTokens: 4000, completionTokens: 700, estCostUsd: 0.01 } },
    }) as UsageMessage;
  const series = buildSeries([answer(HOUR, true), answer(2 * HOUR, false), answer(3 * HOUR, false)], "7d", NOW);
  assert.equal(series.totals.prompts, 0);
  assert.equal(series.totals.answers, 3);
  assert.equal(series.totals.lookups, 1);
  assert.equal(series.totals.tokens, 14100);
  const text = describeSeries(series, "7 days");
  assert.match(text, /built 0 prompts/);
  assert.match(text, /3 direct answers, 1 of them from a web search/);
});
