import { createHmac } from "node:crypto";
import { env } from "../config/env";

/**
 * The only door to the /data service. Everything model related, prompt
 * construction, the clarifying question flow, titles and transcription,
 * happens on the other side of it. /api sends context and relays results,
 * it never talks to a model provider itself.
 */

export const DATA_GENERATE_TIMEOUT_MS = 55_000;
const DATA_TITLE_TIMEOUT_MS = 20_000;
const DATA_TRANSCRIBE_TIMEOUT_MS = 55_000;

export class DataServiceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function url(path: string): string {
  return `${env.DATA_SERVICE_URL.replace(/\/+$/, "")}${path}`;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${env.API_SHARED_SECRET}` };
}

/** What /api sends with every /generate call. Mirrors /data's request schema. */
export interface GenerateRequestBody {
  message: string;
  model: string;
  profile: {
    preferred_name: string | null;
    role: string | null;
    about: string | null;
    working_on: string | null;
    primary_use: string | null;
  };
  memories: { category: string; key: string; value: string }[];
  history: { role: "user" | "assistant"; content: string }[];
  attachments: { name: string; type: string; data_url: string | null; content_base64: string | null }[];
  clarify_state: unknown | null;
  is_clarify_answer: boolean;
}

/** Opens the streaming /generate call. The caller reads the body. */
export async function openGenerateStream(body: GenerateRequestBody, signal: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url("/generate"), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new DataServiceError(err instanceof Error ? err.message : "Could not reach the data service");
  }
  if (!res.ok || !res.body) {
    throw new DataServiceError(`The data service returned status ${res.status}`, res.status);
  }
  return res;
}

export async function summarizeMemory(
  profile: GenerateRequestBody["profile"],
  memories: { category: string; key: string; value: string }[]
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url("/memory-summary"), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ profile, memories }),
      signal: AbortSignal.timeout(DATA_TITLE_TIMEOUT_MS),
    });
  } catch (err) {
    throw new DataServiceError(err instanceof Error ? err.message : "Could not reach the data service");
  }
  if (!res.ok) throw new DataServiceError("Memory summary failed", res.status);
  const payload = (await res.json()) as { summary?: string };
  return payload.summary ?? "";
}

export async function inferTitle(messages: string[]): Promise<string | null> {
  try {
    const res = await fetch(url("/title"), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(0, 4) }),
      signal: AbortSignal.timeout(DATA_TITLE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[dataClient] title inference failed with status", res.status);
      return null;
    }
    const payload = (await res.json()) as { title?: string };
    return payload.title?.trim() || null;
  } catch (err) {
    console.error("[dataClient] title inference error:", err);
    return null;
  }
}

export async function transcribeAudio(audio: Buffer, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: contentType }), "voice-message.webm");
  let res: Response;
  try {
    res = await fetch(url("/transcribe"), {
      method: "POST",
      headers: authHeaders(),
      body: form,
      signal: AbortSignal.timeout(DATA_TRANSCRIBE_TIMEOUT_MS),
    });
  } catch (err) {
    throw new DataServiceError(err instanceof Error ? err.message : "Could not reach the data service");
  }
  if (!res.ok) throw new DataServiceError("Transcription failed", res.status);
  const payload = (await res.json()) as { text?: string };
  return payload.text ?? "";
}

const TICKET_TTL_SECONDS = 60;

/**
 * A short lived ticket for the live transcription socket. A browser cannot send
 * an Authorization header on a WebSocket and the serverless /api cannot hold
 * one open, so the browser connects to /data directly and presents this. It is
 * signed with the shared secret, names the user, and /data accepts it once.
 * The signing format matches data/core/ticket.py.
 */
export function mintTranscribeTicket(userId: string, nowMs: number = Date.now()): { ticket: string; url: string } {
  const expires = Math.floor(nowMs / 1000) + TICKET_TTL_SECONDS;
  const payload = `${userId}.${expires}`;
  const signature = createHmac("sha256", env.API_SHARED_SECRET).update(`transcribe-stream:${payload}`).digest("hex");
  const base = env.DATA_SERVICE_URL.replace(/\/+$/, "").replace(/^http/, "ws");
  return { ticket: `${payload}.${signature}`, url: `${base}/transcribe/stream` };
}

/** Sends /data a health check so a sleeping instance starts waking. Never throws. */
export async function warmData(): Promise<void> {
  try {
    await fetch(url("/health"), { signal: AbortSignal.timeout(4000) });
  } catch {
    // waking up takes longer than this, the request has still been sent
  }
}
