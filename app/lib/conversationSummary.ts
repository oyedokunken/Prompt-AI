import type { ChatMessage } from "@/lib/types/chat";

export interface FeedbackEntry {
  rating: "up" | "down";
  request: string;
  preview: string;
}

export interface ConversationSummary {
  messageCount: number;
  promptsGenerated: number;
  questionsAsked: number;
  averageScore: number | null;
  // Short factual lines about what Prompt AI gathered, read, found or learned.
  learned: string[];
  // A short plain language summary.
  overview: string;
  feedback: FeedbackEntry[];
}

function clip(text: string, length: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= length ? flat : `${flat.slice(0, length).trimEnd()}...`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Builds the summary from what was stored on the messages themselves. Nothing
// is guessed and no model is called, so the summary only ever states things
// the conversation actually contains.
export function summarizeConversation(messages: ChatMessage[]): ConversationSummary {
  const assistant = messages.filter((m) => m.role === "assistant");
  const ready = assistant.filter((m) => (m.metadata.mode ?? "ready") === "ready");
  const clarify = assistant.filter((m) => m.metadata.mode === "clarify");
  const scores = ready.map((m) => m.metadata.score).filter((s): s is number => typeof s === "number");
  const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const learned: string[] = [];
  const seen = new Set<string>();
  const add = (line: string) => {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      learned.push(line);
    }
  };

  const latestReady = ready[ready.length - 1];
  for (const fact of latestReady?.metadata.diff?.stated ?? []) add(`You said: ${fact}`);
  for (const fact of latestReady?.metadata.diff?.researched ?? []) add(`Found: ${fact}`);
  for (const m of assistant) {
    for (const s of m.metadata.sources ?? []) {
      add(s.kind === "attachment" ? `Read ${s.label}` : `Searched the web for "${s.label}"`);
    }
    for (const saved of m.metadata.memorySaved ?? []) {
      add(`${saved.action === "updated" ? "Updated" : "Saved"} to memory: ${saved.key}, ${saved.value}`);
    }
  }
  const attachments = messages.flatMap((m) => m.metadata.attachments ?? []);
  for (const a of attachments) add(`You attached ${a.name}`);

  const firstUser = messages.find((m) => m.role === "user");
  const parts: string[] = [];
  if (firstUser) parts.push(`It started with a request: "${clip(firstUser.content, 110)}".`);
  if (clarify.length > 0) parts.push(`Prompt AI asked ${plural(clarify.length, "clarifying question")} before building.`);
  if (ready.length > 0) {
    parts.push(
      `It produced ${plural(ready.length, "prompt")}${averageScore !== null ? `, with an average completeness of ${averageScore} out of 100` : ""}.`
    );
  } else {
    parts.push("No finished prompt has been produced in this conversation yet.");
  }

  const feedback: FeedbackEntry[] = [];
  messages.forEach((m, i) => {
    const f = m.metadata.feedback;
    if (m.role !== "assistant" || !f) return;
    const request = [...messages.slice(0, i)].reverse().find((p) => p.role === "user")?.content ?? "";
    feedback.push({ rating: f.rating, request: clip(request, 90), preview: clip(m.content, 120) });
  });

  return {
    messageCount: messages.length,
    promptsGenerated: ready.length,
    questionsAsked: clarify.length,
    averageScore,
    learned,
    overview: parts.join(" "),
    feedback,
  };
}
