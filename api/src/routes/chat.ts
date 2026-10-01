import { Router, type Request, type Response } from "express";
import { chatStreamSchema } from "../schemas/chat";
import { requireUser } from "../middleware/requireUser";
import { chatLimiter } from "../middleware/rateLimit";
import { supabaseAdmin } from "../lib/supabase";
import {
  DATA_GENERATE_TIMEOUT_MS,
  DataServiceError,
  inferTitle,
  openGenerateStream,
  transcribeAudio,
  type GenerateRequestBody,
} from "../lib/dataClient";
import { isReadable, toDataAttachments } from "../services/attachments";
import { planMemorySaves, type MemoryCandidate, type SavedMemory, type StoredMemory } from "../services/memory";
import {
  TERMINAL_EVENTS,
  errorRecord,
  findOpenClarifyState,
  recordFromTerminalEvent,
  splitSseFrames,
  type AssistantRecord,
  type StoredMessageRow,
} from "../services/chatState";

export const chatRouter = Router();

// How much prior conversation is sent with each call, the smallest amount
// that still gives the model real continuity.
const HISTORY_LIMIT = 20;
// How far back to look for an open clarifying sequence.
const STATE_LOOKBACK = 40;

function metaString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Writes what planMemorySaves decided. A failure here never blocks the reply,
// it only means nothing is reported as saved.
async function saveMemories(userId: string, candidates: MemoryCandidate[], existing: StoredMemory[]): Promise<SavedMemory[]> {
  if (candidates.length === 0) return [];
  const plan = planMemorySaves(candidates, existing);
  const saved: SavedMemory[] = [];
  try {
    if (plan.inserts.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_memories")
        .insert(plan.inserts.map((m) => ({ user_id: userId, ...m, source: "conversation" })));
      if (error) throw error;
      saved.push(...plan.saved.filter((s) => s.action === "added"));
    }
    for (const u of plan.updates) {
      const { error } = await supabaseAdmin
        .from("user_memories")
        .update({ category: u.category, key: u.key, value: u.value, confidence: u.confidence, updated_at: new Date().toISOString() })
        .eq("id", u.id)
        .eq("user_id", userId);
      if (error) throw error;
      saved.push(...plan.saved.filter((s) => s.action === "updated" && s.key === u.key));
    }
  } catch (err) {
    console.error("[chat] automatic memory save failed:", err);
  }
  return saved;
}

// POST /chat/stream
// Loads this user's profile, memory and conversation, sends them to /data,
// relays /data's stage events and result to the browser unchanged, and
// persists the outcome. A final "saved" event, added by /api, carries the
// stored message rows.
chatRouter.post("/stream", chatLimiter, requireUser, async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Sign in to continue." });
    return;
  }

  const parsed = chatStreamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Request body is invalid.", fields: parsed.error.flatten().fieldErrors });
    return;
  }
  const body = parsed.data;
  const content = body.content.trim();

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, title, model, title_is_custom")
    .eq("id", body.session_id)
    .eq("user_id", user.id)
    .single();
  if (sessionError || !session) {
    console.error("[chat] session lookup failed:", sessionError);
    res.status(404).json({ error: "SESSION_NOT_FOUND", message: "That chat could not be found." });
    return;
  }

  // History and memory are read before the new message is stored, so the
  // history never contains the message being answered.
  const [historyResult, memoryResult] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .select("role, content, metadata")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(STATE_LOOKBACK),
    supabaseAdmin
      .from("user_memories")
      .select("id, category, key, value, source")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  if (historyResult.error) {
    console.error("[chat] history load failed:", historyResult.error);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Could not load this conversation." });
    return;
  }
  if (memoryResult.error) {
    // Best effort. A memory failure must never block a turn.
    console.error("[chat] memory load failed, continuing without it:", memoryResult.error);
  }

  // Oldest first.
  const priorRows = ((historyResult.data ?? []) as StoredMessageRow[]).slice().reverse();
  const clarifyState = findOpenClarifyState(priorRows);
  const history = priorRows
    .slice(-HISTORY_LIMIT)
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }));
  const hadReadyResult = priorRows.some((m) => m.role === "assistant" && m.metadata?.mode === "ready");

  const { data: userMsg, error: userMsgError } = await supabaseAdmin
    .from("messages")
    .insert({
      session_id: session.id,
      role: "user",
      content,
      metadata: body.attachments?.length
        ? { attachments: body.attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, usedAsContext: isReadable(a) })) }
        : {},
    })
    .select()
    .single();
  if (userMsgError || !userMsg) {
    console.error("[chat] failed to persist user message:", userMsgError);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Could not save your message." });
    return;
  }

  const meta = user.user_metadata ?? {};
  const generateBody: GenerateRequestBody = {
    message: content || "(attachment only)",
    model: session.model,
    profile: {
      preferred_name: metaString(meta.preferred_name),
      role: metaString(meta.role),
      about: metaString(meta.about),
      working_on: metaString(meta.working_on),
      primary_use: metaString(meta.primary_use),
    },
    // /data only needs the content, ids and sources stay here.
    memories: (memoryResult.data ?? []).map((m) => ({ category: m.category, key: m.key, value: m.value })),
    history,
    attachments: await toDataAttachments(body.attachments ?? [], user.id),
    clarify_state: clarifyState,
    is_clarify_answer: body.is_clarify_answer && clarifyState !== null,
  };

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let record: AssistantRecord | null = null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), DATA_GENERATE_TIMEOUT_MS);

  try {
    const upstream = await openGenerateStream(generateBody, abort.signal);
    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = splitSseFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        res.write(frame.raw);
        if (TERMINAL_EVENTS.has(frame.event)) {
          record = recordFromTerminalEvent(frame.event, frame.data);
        }
      }
    }
  } catch (err) {
    console.error("[chat] data service stream failed:", err instanceof DataServiceError ? { message: err.message, status: err.status } : err);
  } finally {
    clearTimeout(timer);
  }

  // The stream ended without a terminal event, or never opened. Be honest
  // about it instead of storing anything that looks like a real answer.
  if (!record) {
    record = errorRecord();
    res.write(`event: error\ndata: ${JSON.stringify({ type: "error", code: "upstream_unavailable", message: record.content })}\n\n`);
  }

  // Stable facts the exchange revealed are saved on the spot, no approval
  // step. What was saved is recorded on the message so the interface can say so.
  const memorySaved = await saveMemories(user.id, (record.memoryCandidates ?? []) as MemoryCandidate[], (memoryResult.data ?? []) as StoredMemory[]);
  if (memorySaved.length > 0) record.metadata.memorySaved = memorySaved;

  const { data: aiMsg, error: aiMsgError } = await supabaseAdmin
    .from("messages")
    .insert({ session_id: session.id, role: "assistant", content: record.content, metadata: record.metadata })
    .select()
    .single();
  if (aiMsgError || !aiMsg) {
    console.error("[chat] failed to persist assistant message:", aiMsgError);
    res.write(`event: failure\ndata: ${JSON.stringify({ message: "Could not save the response." })}\n\n`);
    res.end();
    return;
  }

  // Title the chat once, from what the conversation is actually about, and
  // again the first time a finished prompt exists. Never overwrites a title
  // the user chose, and an error turn never titles anything.
  let sessionTitle: string | null = null;
  const mode = record.metadata.mode;
  const wantsTitle = !session.title_is_custom && mode !== "error" && (session.title === "New Chat" || (mode === "ready" && !hadReadyResult));
  if (wantsTitle) {
    const opening = [...priorRows.filter((m) => m.role === "user").map((m) => m.content), content].filter((t) => t.trim());
    sessionTitle = await inferTitle(opening);
    if (sessionTitle) {
      await supabaseAdmin.from("chat_sessions").update({ title: sessionTitle }).eq("id", session.id);
    }
  }
  await supabaseAdmin.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", session.id);

  res.write(`event: saved\ndata: ${JSON.stringify({ userMsg, aiMsg, sessionTitle, memorySaved })}\n\n`);
  res.end();
});

// POST /chat/transcribe
// The browser sends the recording as the raw request body. It is forwarded to
// /data, the only service that transcribes audio.
chatRouter.post("/transcribe", chatLimiter, requireUser, async (req: Request, res: Response): Promise<void> => {
  const audio = req.body as unknown;
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    res.status(400).json({ error: "MISSING_AUDIO", message: "Missing audio file." });
    return;
  }
  try {
    const text = await transcribeAudio(audio, req.headers["content-type"] ?? "audio/webm");
    res.json({ text });
  } catch (err) {
    console.error("[chat/transcribe] failed:", err);
    res.status(502).json({ error: "TRANSCRIBE_FAILED", message: "Could not transcribe audio." });
  }
});
