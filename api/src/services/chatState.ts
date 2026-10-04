/**
 * Pure helpers for the chat route: persisting and recovering clarifying
 * question state, turning /data's terminal events into stored messages, and
 * splitting a server-sent event stream into frames. No I/O in this file.
 */

export interface StoredMessageRow {
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface SseFrame {
  /** The frame exactly as /data sent it, ready to relay untouched. */
  raw: string;
  event: string;
  data: unknown;
}

/**
 * The clarifying sequence is carried by the most recent assistant message
 * that holds a state, and stays open until a finished prompt follows it.
 * /data is stateless, so this is how an in-progress sequence survives
 * between a user's individual answers.
 */
export function findOpenClarifyState(rows: StoredMessageRow[]): unknown | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row || row.role !== "assistant") continue;
    const meta = row.metadata ?? {};
    if (meta.mode === "ready") return null;
    if (meta.clarifyState) return meta.clarifyState;
  }
  return null;
}

/** Splits a buffer of SSE text into complete frames, returning the unfinished tail. */
export function splitSseFrames(buffer: string): { frames: SseFrame[]; rest: string } {
  const frames: SseFrame[] = [];
  let rest = buffer;
  for (;;) {
    const end = rest.indexOf("\n\n");
    if (end === -1) break;
    const raw = rest.slice(0, end + 2);
    rest = rest.slice(end + 2);

    let event = "message";
    let dataText = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataText += line.slice(6);
    }
    try {
      frames.push({ raw, event, data: JSON.parse(dataText) });
    } catch {
      console.error("[chat] dropped an unparseable event frame from the data service");
    }
  }
  return { frames, rest };
}

interface StoredQuestion {
  id: string;
  text: string;
  options?: string[];
  multiple?: boolean;
}

interface TerminalData {
  content?: string;
  score?: number;
  diff?: { stated?: string[]; inferred?: string[]; researched?: string[] };
  sources?: unknown;
  format_style?: string;
  structured?: unknown;
  readiness?: unknown;
  explanation?: string;
  memory_candidates?: unknown[];
  memory_used?: unknown[];
  patterns_used?: string[];
  usage?: { calls?: number; prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number; est_cost_usd?: number };
  template_version?: string;
  question?: StoredQuestion;
  position?: number;
  total?: number;
  intro?: string;
  clarify_state?: { intro?: string } | null;
  pending_question?: StoredQuestion | null;
  message?: string;
}

export interface AssistantRecord {
  content: string;
  metadata: Record<string, unknown>;
  // Facts /data noticed in this exchange. Saved by the route, never stored in the message.
  memoryCandidates?: unknown[];
}

const GENERATION_FAILED = "Generation failed. Please try again.";

export function errorRecord(): AssistantRecord {
  return { content: GENERATION_FAILED, metadata: { mode: "error" } };
}

/**
 * Builds the stored assistant message for a terminal event. Returns null for
 * an event that is not terminal.
 */
export function recordFromTerminalEvent(event: string, data: unknown): AssistantRecord | null {
  const d = (data ?? {}) as TerminalData;

  if (event === "error") {
    return { content: d.message?.trim() || GENERATION_FAILED, metadata: { mode: "error" } };
  }

  if (event === "clarifying_question" && d.question) {
    const intro = d.position === 1 ? (d.intro ?? "").trim() : "";
    return {
      content: intro ? `${intro}\n\n${d.question.text}` : d.question.text,
      metadata: {
        mode: "clarify",
        usage: usageFrom(d),
        intro,
        interviewQuestions: [d.question],
        clarifyPosition: d.position,
        clarifyTotal: d.total,
        clarifyState: d.clarify_state,
      },
    };
  }

  if (event === "answer") {
    const pending = d.pending_question ?? null;
    return {
      content: d.content ?? "",
      memoryCandidates: d.memory_candidates ?? [],
      metadata: {
        mode: "answer",
        usage: usageFrom(d),
        memoryUsed: d.memory_used ?? [],
        // What a web search found, for an answer to a question about the outside world.
        ...(Array.isArray(d.sources) && d.sources.length > 0 ? { sources: d.sources } : {}),
        ...(pending
          ? {
              interviewQuestions: [pending],
              clarifyPosition: d.position,
              clarifyTotal: d.total,
              clarifyState: d.clarify_state,
            }
          : {}),
      },
    };
  }

  if (event === "result") {
    return {
      content: d.content ?? "",
      memoryCandidates: d.memory_candidates ?? [],
      metadata: {
        mode: "ready",
        usage: usageFrom(d),
        // The conversational wrapper, kept apart so the prompt copies on its own.
        preamble: d.message ?? null,
        memoryUsed: d.memory_used ?? [],
        patternsUsed: d.patterns_used ?? [],
        score: d.score,
        // Kept under the names the interface already reads.
        assumptions: d.diff?.inferred ?? [],
        diff: d.diff,
        structured: d.structured,
        readiness: d.readiness,
        explanation: d.explanation,
        sources: d.sources ?? [],
        formatStyle: d.format_style,
        templateVersion: d.template_version,
      },
    };
  }

  return null;
}

/** What a turn cost, in the shape stored on the message. */
export function usageFrom(d: { usage?: { calls?: number; prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number; est_cost_usd?: number } }) {
  const u = d.usage;
  if (!u) return undefined;
  return {
    calls: u.calls ?? 0,
    promptTokens: u.prompt_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    cachedTokens: u.cached_tokens ?? 0,
    estCostUsd: u.est_cost_usd ?? 0,
  };
}

export const TERMINAL_EVENTS = new Set(["clarifying_question", "answer", "result", "error"]);
