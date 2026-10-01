// Turns stored messages into a time series for the Usage tab. Pure and
// dependency free, so the bucketing and the metrics can be tested without a
// browser. Everything is derived from what was actually stored on the
// messages, nothing is estimated or filled in.

export type RangeId = "1d" | "3d" | "7d" | "1m" | "3m";
export type MetricId = "prompts" | "tokens" | "outputLength" | "score" | "questions" | "approval";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const RANGES: { id: RangeId; label: string; windowMs: number; bucketMs: number }[] = [
  { id: "1d", label: "1 day", windowMs: DAY, bucketMs: HOUR },
  { id: "3d", label: "3 days", windowMs: 3 * DAY, bucketMs: 6 * HOUR },
  { id: "7d", label: "7 days", windowMs: 7 * DAY, bucketMs: DAY },
  { id: "1m", label: "1 month", windowMs: 30 * DAY, bucketMs: DAY },
  { id: "3m", label: "3 months", windowMs: 91 * DAY, bucketMs: 7 * DAY },
];

export const METRICS: { id: MetricId; label: string; unit: string; hint: string }[] = [
  { id: "prompts", label: "Prompts generated", unit: "", hint: "Finished prompts" },
  { id: "tokens", label: "Tokens used", unit: "", hint: "Input plus output, as billed by the model provider" },
  { id: "outputLength", label: "Output length", unit: " words", hint: "Average length of a generated prompt" },
  { id: "score", label: "Completeness", unit: "/100", hint: "Average completeness score" },
  { id: "questions", label: "Clarifying questions", unit: "", hint: "Questions Prompt AI asked before building" },
  { id: "approval", label: "Helpful rate", unit: "%", hint: "Share of rated responses marked helpful" },
];

export interface UsageMessage {
  role: string;
  content: string;
  created_at: string;
  metadata: {
    mode?: string;
    score?: number;
    usage?: { promptTokens?: number; completionTokens?: number; estCostUsd?: number };
    feedback?: { rating?: "up" | "down" };
  } | null;
}

export interface Bucket {
  start: number;
  end: number;
  label: string;
  prompts: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  tokenMessages: number;
  words: number;
  wordSamples: number;
  scoreSum: number;
  scoreSamples: number;
  questions: number;
  up: number;
  down: number;
  costUsd: number;
}

export interface Series {
  buckets: Bucket[];
  totals: Bucket;
  // How many assistant messages in range had token counts recorded, so the page can
  // say honestly when older messages predate tracking.
  trackedMessages: number;
  assistantMessages: number;
}

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function emptyBucket(start: number, end: number, label = ""): Bucket {
  return {
    start, end, label, prompts: 0, tokens: 0, promptTokens: 0, completionTokens: 0, tokenMessages: 0,
    words: 0, wordSamples: 0, scoreSum: 0, scoreSamples: 0, questions: 0, up: 0, down: 0, costUsd: 0,
  };
}

export function bucketLabel(range: RangeId, start: number, locale?: string): string {
  const d = new Date(start);
  if (range === "1d") return d.toLocaleTimeString(locale, { hour: "numeric" });
  if (range === "3d") return `${d.toLocaleDateString(locale, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(locale, { hour: "numeric" })}`;
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// Bucket edges are aligned to the clock, so a daily bucket is a real calendar
// day and an hourly one a real hour, and its label says what it covers. The last
// bucket is the current one and ends in the future.
function alignedBoundaries(range: RangeId, now: number, count: number): number[] {
  const d = new Date(now);
  const stepHours = range === "1d" ? 1 : range === "3d" ? 6 : 0;
  const stepDays = range === "3m" ? 7 : stepHours ? 0 : 1;
  const edges: number[] = [];

  if (stepHours) {
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - (d.getHours() % stepHours) + stepHours);
    const end = d.getTime();
    for (let i = count; i >= 0; i--) edges.push(end - i * stepHours * HOUR);
    return edges;
  }

  // Daily and weekly buckets end at the end of today, in local time.
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  const end = new Date(d);
  for (let i = count; i >= 0; i--) {
    const edge = new Date(end);
    edge.setDate(edge.getDate() - i * stepDays);
    edges.push(edge.getTime());
  }
  return edges;
}

export function buildSeries(messages: UsageMessage[], range: RangeId, now: number = Date.now(), locale?: string): Series {
  const cfg = RANGES.find((r) => r.id === range)!;
  const count = Math.round(cfg.windowMs / cfg.bucketMs);
  const edges = alignedBoundaries(range, now, count);
  const windowStart = edges[0] as number;

  const buckets: Bucket[] = Array.from({ length: count }, (_, i) =>
    emptyBucket(edges[i] as number, edges[i + 1] as number, bucketLabel(range, edges[i] as number, locale))
  );
  const totals = emptyBucket(windowStart, now, "Total");
  let tracked = 0;
  let assistant = 0;

  for (const m of messages) {
    if (m.role !== "assistant") continue;
    const t = new Date(m.created_at).getTime();
    if (Number.isNaN(t) || t < windowStart || t > now) continue;
    const index = buckets.findIndex((x) => t >= x.start && t < x.end);
    const b = buckets[index];
    if (!b) continue;
    assistant++;

    const mode = m.metadata?.mode ?? "ready";
    const targets = [b, totals];
    const usage = m.metadata?.usage;
    if (usage) {
      tracked++;
      const input = usage.promptTokens ?? 0;
      const output = usage.completionTokens ?? 0;
      for (const x of targets) {
        x.tokens += input + output;
        x.promptTokens += input;
        x.completionTokens += output;
        x.tokenMessages++;
        x.costUsd += usage.estCostUsd ?? 0;
      }
    }
    if (mode === "ready") {
      const w = words(m.content);
      for (const x of targets) {
        x.prompts++;
        x.words += w;
        x.wordSamples++;
        if (typeof m.metadata?.score === "number") {
          x.scoreSum += m.metadata.score;
          x.scoreSamples++;
        }
      }
    } else if (mode === "clarify") {
      for (const x of targets) x.questions++;
    }
    const rating = m.metadata?.feedback?.rating;
    if (rating) for (const x of targets) rating === "up" ? x.up++ : x.down++;
  }

  return { buckets, totals, trackedMessages: tracked, assistantMessages: assistant };
}

// The value of a metric for one bucket, or null when there is nothing to
// average. A null becomes a gap in the line, never a zero, so a quiet hour does
// not look like a score of nothing.
export function metricValue(b: Bucket, metric: MetricId): number | null {
  switch (metric) {
    case "prompts": return b.prompts;
    case "tokens": return b.tokens;
    case "questions": return b.questions;
    case "outputLength": return b.wordSamples ? Math.round(b.words / b.wordSamples) : null;
    case "score": return b.scoreSamples ? Math.round(b.scoreSum / b.scoreSamples) : null;
    case "approval": return b.up + b.down ? Math.round((b.up / (b.up + b.down)) * 100) : null;
  }
}

export function formatValue(value: number | null, metric: MetricId): string {
  if (value === null) return "no data";
  const unit = METRICS.find((m) => m.id === metric)?.unit ?? "";
  return `${value.toLocaleString()}${unit}`;
}

// A plain description of the range, built only from the totals.
export function describeSeries(series: Series, rangeLabel: string): string {
  const t = series.totals;
  if (t.prompts === 0 && t.questions === 0 && series.assistantMessages === 0) {
    return `Nothing yet in the last ${rangeLabel}. Once you chat, this fills in.`;
  }
  const parts = [`In the last ${rangeLabel}, Prompt AI built ${t.prompts} prompt${t.prompts === 1 ? "" : "s"}`];
  if (t.scoreSamples) parts[0] += ` at an average completeness of ${Math.round(t.scoreSum / t.scoreSamples)} out of 100`;
  parts[0] += ".";
  if (t.questions) parts.push(`It asked ${t.questions} clarifying question${t.questions === 1 ? "" : "s"} along the way.`);
  if (t.tokenMessages) parts.push(`That used about ${t.tokens.toLocaleString()} tokens across ${t.tokenMessages} replies.`);
  return parts.join(" ");
}
