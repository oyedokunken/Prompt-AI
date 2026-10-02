import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types/chat";

// Every chat, transcription and title call goes to the /api service, which
// owns the database and is the only caller of the /data service. The
// frontend never talks to a model provider.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type StreamEvent =
  | { type: "stage"; stage: string; message: string }
  | { type: "saved"; userMsg: ChatMessage; aiMsg: ChatMessage; sessionTitle: string | null; memorySaved?: SavedMemory[] }
  | { type: "failure"; message: string };

export interface StreamChatInput {
  sessionId: string;
  content: string;
  isClarifyAnswer: boolean;
  attachments?: { name: string; type: string; path: string; dataUrl: string | null; size?: number }[];
  onStage: (stage: { stage: string; message: string }) => void;
  signal?: AbortSignal;
}

export interface SavedMemory {
  category: string;
  key: string;
  value: string;
  action: "added" | "updated";
}

export interface StreamChatResult {
  userMsg: ChatMessage;
  aiMsg: ChatMessage;
  sessionTitle: string | null;
  // Facts saved to memory automatically while producing this reply.
  memorySaved: SavedMemory[];
}

async function accessToken(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  return token;
}

async function errorMessageFrom(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function parseFrame(frame: string): { event: string; data: unknown } | null {
  let event = "message";
  let dataText = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataText += line.slice(6);
  }
  if (!dataText) return null;
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return null;
  }
}

// Sends one message and reports each stage event as it genuinely arrives.
// Resolves once the server has stored the turn.
export async function streamChat(input: StreamChatInput): Promise<StreamChatResult> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      session_id: input.sessionId,
      content: input.content,
      is_clarify_answer: input.isClarifyAnswer,
      attachments: input.attachments,
    }),
    signal: input.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(await errorMessageFrom(res, `Request failed with status ${res.status}`));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let saved: StreamChatResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const parsed = parseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === "stage") {
        const stage = parsed.data as { stage: string; message: string };
        input.onStage({ stage: stage.stage, message: stage.message });
      } else if (parsed.event === "saved") {
        saved = parsed.data as StreamChatResult;
      } else if (parsed.event === "failure") {
        throw new Error((parsed.data as { message?: string }).message ?? "Could not save the response.");
      }
    }
  }

  if (!saved) throw new Error("The server did not return a complete response.");
  const result: StreamChatResult = saved;
  return { ...result, memorySaved: result.memorySaved ?? [] };
}

export async function fetchMemorySummary(): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}/chat/memory-summary`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await errorMessageFrom(res, "Could not write the summary"));
  const payload = (await res.json()) as { summary?: string };
  return payload.summary ?? "";
}

export async function transcribeVoice(blob: Blob): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}/chat/transcribe`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm", Authorization: `Bearer ${token}` },
    body: blob,
  });
  if (!res.ok) throw new Error(await errorMessageFrom(res, "Transcription failed"));
  const payload = (await res.json()) as { text?: string };
  return payload.text ?? "";
}

// A short lived ticket and the address of the live transcription socket on
// the /data service. The audio goes there directly, not through /api.
export async function fetchTranscribeTicket(): Promise<{ ticket: string; url: string }> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}/chat/transcribe/ticket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await errorMessageFrom(res, "Live transcription is unavailable"));
  return (await res.json()) as { ticket: string; url: string };
}

// Wakes the data service ahead of a voice message. The free host it runs on
// sleeps when idle and takes many seconds to come back, which would otherwise
// land in the middle of the first sentence.
let lastWarm = 0;
export async function warmTranscription(): Promise<void> {
  if (Date.now() - lastWarm < 4 * 60_000) return;
  lastWarm = Date.now();
  try {
    const token = await accessToken();
    await fetch(`${API_URL}/chat/warm`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // best effort
  }
}
