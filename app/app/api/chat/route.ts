import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { openai } from "@/lib/ai/openaiClient";
import { MODELS, type ClarifyQuestion } from "@/lib/types/chat";
import { buildSystemPrompt, buildErrorTurn, type GeneratedTurn } from "@/lib/ai/systemPrompt";
import { selectRelevantMemories } from "@/lib/ai/memoryRelevance";

interface IncomingAttachment {
  name: string;
  type: string;
  path: string;
  dataUrl: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/chat
// Accepts { session_id, content }, saves the user message, retrieves the
// user's profile and relevant memory, runs the prompt-engineering turn
// (which may ask clarifying questions instead of generating a final prompt),
// saves the AI message, and returns both.
//
// Priority order for AI generation:
//   1. OpenAI (OPENAI_API_KEY set)   -> GPT-4o structured output
//   2. DATA_SERVICE_URL set          -> proxy to Python /data service
//   3. Fallback                      -> local heuristic builder
// ---------------------------------------------------------------------------

// Bounds how much prior conversation gets replayed into each call, the
// smallest amount that still gives the model real continuity.
const MAX_HISTORY_MESSAGES = 20;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[api/chat] no authenticated user:", userError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { session_id, content, attachments } = (await req.json()) as {
    session_id: string;
    content: string;
    attachments?: IncomingAttachment[];
  };

  console.log("[api/chat] request", { userId: user.id, session_id, contentLength: content?.trim().length ?? 0 });

  if (!session_id || !(content?.trim() || attachments?.length)) {
    return NextResponse.json({ error: "Missing session_id or content" }, { status: 400 });
  }

  // Verify the session belongs to this user
  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, title, model, title_is_custom")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    console.error("[api/chat] session lookup failed:", sessionError);
    return NextResponse.json({ error: `Session not found: ${sessionError?.message ?? "no matching row"}` }, { status: 404 });
  }

  // Prior conversation, the new user message, and this user's memory are
  // three independent reads/writes, run them concurrently rather than
  // paying for their latency sequentially.
  const [historyResult, userMsgResult, memoryResult] = await Promise.all([
    supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY_MESSAGES),
    supabase
      .from("messages")
      .insert({
        session_id,
        role: "user",
        content: content.trim(),
        metadata: attachments?.length
          ? { attachments: attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, usedAsContext: !!a.dataUrl })) }
          : {},
      })
      .select()
      .single(),
    supabase
      .from("user_memories")
      .select("category, key, value")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const historyRows = historyResult.data;
  const { data: userMsg, error: userMsgError } = userMsgResult;

  if (userMsgError) {
    console.error("[api/chat] failed to persist user message:", userMsgError);
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  // Best-effort context retrieval. A failure here must never block
  // generation, it just means the turn proceeds without that context.
  const profileContext = {
    preferredName: (user.user_metadata?.preferred_name as string) ?? null,
    role: (user.user_metadata?.role as string) ?? null,
    about: (user.user_metadata?.about as string) ?? null,
    workingOn: (user.user_metadata?.working_on as string) ?? null,
    primaryUse: (user.user_metadata?.primary_use as string) ?? null,
  };
  let relevantMemories: { category: string; key: string; value: string }[] = [];
  try {
    if (memoryResult.error) throw memoryResult.error;
    relevantMemories = selectRelevantMemories(memoryResult.data ?? [], content.trim());
  } catch (err) {
    console.error("[api/chat] memory retrieval failed (continuing without it):", err);
  }

  console.log("[api/chat] user message persisted, generating response", {
    model: session.model,
    hasOpenAI: !!openai,
    historyLength: historyRows?.length ?? 0,
    memoriesUsed: relevantMemories.length,
  });

  const turn = await generateTurn(
    content.trim(),
    session.model,
    attachments ?? [],
    historyRows ?? [],
    profileContext,
    relevantMemories
  );

  console.log("[api/chat] generation complete", { mode: turn.mode, hasTitle: !!turn.title });

  // Title the session on its first turn, then retitle once more the first
  // time a turn actually resolves to "ready", since that is the first
  // point the model has the full picture rather than a first guess made
  // while it was still asking questions. Never overwrites a title the
  // user set themselves. If title generation didn't produce anything this
  // turn (including every error turn, which never sets one), the session
  // stays "New Chat" rather than settling for a worse fallback, so the
  // next successful turn can still retitle it properly.
  let sessionTitle: string | null = null;
  const shouldRetitle = !session.title_is_custom && (session.title === "New Chat" || turn.mode === "ready");
  if (shouldRetitle && turn.title?.trim()) {
    sessionTitle = turn.title.trim();
    await supabase
      .from("chat_sessions")
      .update({ title: sessionTitle })
      .eq("id", session_id);
  }

  const assistantContent =
    turn.mode === "clarify" ? formatClarifyMessage(turn.message, turn.questions) :
    turn.mode === "error" ? (turn.message ?? "Generation failed. Please try again.") :
    turn.content ?? "";

  // An error turn never carries a score, assumptions, or structured
  // output, none of that would reflect anything the model actually
  // produced.
  const score = turn.mode === "ready" ? deriveReadinessScore(turn) : undefined;

  // Persist the AI message
  const { data: aiMsg, error: aiMsgError } = await supabase
    .from("messages")
    .insert({
      session_id,
      role: "assistant",
      content: assistantContent,
      metadata: turn.mode === "error"
        ? { mode: "error" }
        : turn.mode === "clarify"
        ? { mode: "clarify", interviewQuestions: turn.questions ?? [] }
        : {
            mode: turn.mode,
            score,
            assumptions: turn.assumptions,
            structured: turn.structured,
            readiness: turn.readiness,
            explanation: turn.explanation,
            memoryCandidates: turn.memoryCandidates,
          },
    })
    .select()
    .single();

  if (aiMsgError) {
    console.error("[api/chat] failed to persist AI message:", aiMsgError);
    return NextResponse.json({ error: aiMsgError.message }, { status: 500 });
  }

  // Bump the session's updated_at
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", session_id);

  console.log("[api/chat] done", { session_id });
  return NextResponse.json({ userMsg, aiMsg, sessionTitle });
}

// Plain-text fallback representation of a clarify turn, used as the
// message's stored content for copy/export purposes, the interactive
// interview itself renders from metadata.interviewQuestions instead.
function formatClarifyMessage(message: string | undefined, questions: ClarifyQuestion[] | undefined): string {
  const intro = message?.trim() || "I can build this for you. A little more context would help:";
  if (!questions || questions.length === 0) return intro;
  const list = questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
  return `${intro}\n\n${list}`;
}

// A heuristic estimate, not the model's own number, computed the same way
// every time so it stays internally consistent turn to turn.
function deriveReadinessScore(turn: GeneratedTurn): number {
  let score = 90;
  score -= Math.min((turn.assumptions?.length ?? 0) * 6, 40);
  score -= (turn.readiness?.missing?.length ?? 0) * 10;
  if (turn.readiness?.status === "needs_context") score -= 15;
  return Math.max(30, Math.min(97, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Turn generator: tries OpenAI, then DATA_SERVICE_URL, then local fallback
// ---------------------------------------------------------------------------

async function generateTurn(
  userInput: string,
  model: string,
  attachments: IncomingAttachment[],
  history: { role: string; content: string }[],
  profile: { preferredName: string | null; role: string | null; about: string | null; workingOn: string | null; primaryUse: string | null },
  memories: { category: string; key: string; value: string }[]
): Promise<GeneratedTurn> {
  // 1: OpenAI (real structured output)
  if (openai) {
    try {
      // Fall back to gpt-4o for any target model we don't have a real
      // provider key for yet -- the model selector disables those, but
      // older sessions may still carry one as their stored value.
      const resolvedModel = MODELS.find((m) => m.id === model)?.openaiModel ?? "gpt-4o";

      const imageAttachments = attachments.filter((a) => a.dataUrl);
      const otherAttachments = attachments.filter((a) => !a.dataUrl);
      const otherNote = otherAttachments.length
        ? `\n\n[Attached: ${otherAttachments.map((a) => a.name).join(", ")}, these file types cannot be read as context yet, only their names are known.]`
        : "";

      const userContent =
        imageAttachments.length > 0
          ? [
              { type: "text" as const, text: userInput + otherNote },
              ...imageAttachments.map((a) => ({ type: "image_url" as const, image_url: { url: a.dataUrl as string } })),
            ]
          : userInput + otherNote;

      const historyMessages = history.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

      const completion = await openai.chat.completions.create({
        model: resolvedModel,
        messages: [
          { role: "system", content: buildSystemPrompt(profile, memories) },
          ...historyMessages,
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        // A comprehensive, production-ready prompt (many sections, real
        // operating rules, edge cases) can legitimately run long. 2000 was
        // tight enough that detailed requests got cut off mid-JSON and
        // silently fell back to the heuristic generator below, 6000 gives
        // real headroom before that happens again.
        max_tokens: 6000,
      });

      const choice = completion.choices[0];
      const raw = choice?.message?.content ?? "{}";

      if (choice?.finish_reason === "length") {
        console.error("[chat] OpenAI response was truncated by the token limit before falling back:", {
          rawLength: raw.length,
          rawTail: raw.slice(-200),
        });
      }

      let result: GeneratedTurn;
      try {
        result = JSON.parse(raw) as GeneratedTurn;
      } catch (parseErr) {
        console.error("[chat] OpenAI response was not valid JSON, falling back:", {
          parseErr,
          finishReason: choice?.finish_reason,
          rawLength: raw.length,
          rawHead: raw.slice(0, 200),
          rawTail: raw.slice(-200),
        });
        throw parseErr;
      }

      if (result.mode === "clarify" && (result.message || (result.questions && result.questions.length))) {
        return result;
      }
      if (result.mode === "ready" && result.content) {
        return result;
      }
      console.error("[chat] OpenAI returned an incomplete turn, falling back:", result);
    } catch (err) {
      // OpenAI SDK errors carry a status code and error type that a plain
      // `console.error(err)` tends to bury, surface them explicitly so a
      // future fallback is diagnosable from logs alone, not a guess.
      if (err instanceof OpenAI.APIError) {
        console.error("[chat] OpenAI API error:", {
          status: err.status,
          code: err.code,
          type: err.type,
          message: err.message,
        });
      } else {
        console.error("[chat] OpenAI error:", err);
      }
    }
  }

  // 2: Proxy to /data service
  const dataServiceUrl = process.env.DATA_SERVICE_URL;
  if (dataServiceUrl) {
    try {
      const res = await fetch(`${dataServiceUrl}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DATA_SERVICE_API_KEY ?? ""}`,
        },
        body: JSON.stringify({ input: userInput, model }),
      });
      if (res.ok) {
        const data = (await res.json()) as Partial<GeneratedTurn>;
        if (data.content) return { mode: "ready", ...data } as GeneratedTurn;
      }
      console.error("[chat] DATA_SERVICE returned an error status:", res.status);
    } catch (err) {
      console.error("[chat] DATA_SERVICE error:", err);
    }
  }

  // 3: Every generation path failed. Never fabricate a prompt, a score, or
  // an assumptions list to paper over that, an honest error is the only
  // acceptable outcome here.
  return buildErrorTurn();
}
