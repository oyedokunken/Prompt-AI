import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { MODELS } from "@/lib/types/chat";

interface IncomingAttachment {
  name: string;
  type: string;
  path: string;
  dataUrl: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/chat
// Accepts { session_id, content }, saves the user message, generates a
// structured prompt response, saves the AI message, and returns both.
//
// Priority order for AI generation:
//   1. OpenAI (OPENAI_API_KEY set)   → GPT-4o structured output
//   2. DATA_SERVICE_URL set          → proxy to Python /data service
//   3. Fallback                      → local heuristic builder
// ---------------------------------------------------------------------------

// .trim() guards against a trailing newline in the Vercel env var value,
// which OpenAI's SDK rejects outright when building the Bearer header.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() })
  : null;

const SYSTEM_PROMPT = `You are Prompt AI, an expert at transforming vague user requests into detailed, structured prompts optimised for AI tools.

Given any user input, analyse their intent and respond with a JSON object in this exact format:
{
  "title": "A short, specific conversation title, four to six words, no trailing punctuation",
  "content": "The complete structured prompt as ready-to-use markdown",
  "score": 82,
  "assumptions": ["What you inferred that the user did not state"],
  "structured": {
    "role": "The role / persona the target AI should adopt",
    "context": "Background and relevant context",
    "constraints": ["Hard requirement 1", "Hard requirement 2"],
    "format": "Expected output format and structure"
  }
}

Scoring guide (0–100):
- 20–40  Vague, single phrase, no context, many assumptions needed
- 41–60  Some context but key specifics are missing
- 61–80  Good detail with minor gaps filled by reasonable assumptions
- 81–100 Highly specific, little to no inferencing required

Rules:
- "title" must summarise the task itself, not restate that it is a prompt, for example "Rate limiting middleware" rather than "Prompt about rate limiting".
- "content" must be a complete, production-ready prompt the user can paste directly into any AI tool.
- Use markdown headers, bold labels, and bullet lists inside "content" for readability.
- Always list every assumption you made, however small.
- Respond ONLY with valid JSON, no prose outside the object.`;

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
    .select("id, title, model")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    console.error("[api/chat] session lookup failed:", sessionError);
    return NextResponse.json({ error: `Session not found: ${sessionError?.message ?? "no matching row"}` }, { status: 404 });
  }

  // Persist the user message
  const { data: userMsg, error: userMsgError } = await supabase
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
    .single();

  if (userMsgError) {
    console.error("[api/chat] failed to persist user message:", userMsgError);
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  console.log("[api/chat] user message persisted, generating response", { model: session.model, hasOpenAI: !!openai });

  // Generate the structured prompt response. The title comes from the same
  // call rather than a second request, so an automatic title is ready at
  // essentially no extra latency instead of appearing long after the fact.
  const aiResponse = await generateResponse(content.trim(), session.model, attachments ?? []);

  console.log("[api/chat] generation complete", { scoreLen: aiResponse.score, hasTitle: !!aiResponse.title });

  let sessionTitle: string | null = null;
  if (session.title === "New Chat") {
    sessionTitle = (aiResponse.title || content.trim().slice(0, 60)).trim();
    if (!aiResponse.title && content.trim().length > 60) sessionTitle += "…";
    await supabase
      .from("chat_sessions")
      .update({ title: sessionTitle })
      .eq("id", session_id);
  }

  // Persist the AI message
  const { data: aiMsg, error: aiMsgError } = await supabase
    .from("messages")
    .insert({
      session_id,
      role: "assistant",
      content: aiResponse.content,
      metadata: {
        score: aiResponse.score,
        assumptions: aiResponse.assumptions,
        structured: aiResponse.structured,
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

// ---------------------------------------------------------------------------
// Response generator: tries OpenAI, then DATA_SERVICE_URL, then local fallback
// ---------------------------------------------------------------------------
interface GeneratedPrompt {
  title?: string;
  content: string;
  score: number;
  assumptions: string[];
  structured: Record<string, unknown>;
}

async function generateResponse(
  userInput: string,
  model: string,
  attachments: IncomingAttachment[]
): Promise<GeneratedPrompt> {
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

      const completion = await openai.chat.completions.create({
        model: resolvedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const result = JSON.parse(raw) as {
        title?: string;
        content?: string;
        score?: number;
        assumptions?: string[];
        structured?: Record<string, unknown>;
      };

      if (result.content && typeof result.score === "number") {
        return {
          title: result.title,
          content: result.content,
          score: result.score,
          assumptions: result.assumptions ?? [],
          structured: result.structured ?? {},
        };
      }
      console.error("[chat] OpenAI returned an incomplete response, falling back:", result);
    } catch (err) {
      console.error("[chat] OpenAI error, falling back to local generator:", err);
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
      if (res.ok) return (await res.json()) as GeneratedPrompt;
      console.error("[chat] DATA_SERVICE returned an error status:", res.status);
    } catch (err) {
      console.error("[chat] DATA_SERVICE error, falling back to local generator:", err);
    }
  }

  // 3: Local heuristic fallback
  return buildStructuredPrompt(userInput);
}

// ---------------------------------------------------------------------------
// Local structured prompt builder (fallback when no API keys are configured)
// ---------------------------------------------------------------------------
function buildStructuredPrompt(userInput: string): GeneratedPrompt {
  const words = userInput.split(/\s+/).filter(Boolean);
  const hasTarget = /\b(for|using|with|in|to)\b/i.test(userInput);
  const hasFormat = /\b(format|markdown|json|list|table|bullet|step)\b/i.test(userInput);
  const hasRole = /\b(senior|junior|expert|beginner|developer|designer|engineer|manager)\b/i.test(userInput);
  const hasConstraint = /\b(must|should|need|require|only|never|always)\b/i.test(userInput);

  let score = 35;
  if (words.length > 8) score += 10;
  if (words.length > 20) score += 10;
  if (hasTarget) score += 10;
  if (hasFormat) score += 10;
  if (hasRole) score += 10;
  if (hasConstraint) score += 10;
  score = Math.min(score, 95);

  const assumptions: string[] = [];
  if (!hasRole) assumptions.push("Role and expertise level inferred from context");
  if (!hasTarget) assumptions.push("Target tool or platform assumed from common usage patterns");
  if (!hasFormat) assumptions.push("Output format defaulted to structured text");
  if (!hasConstraint) assumptions.push("No explicit constraints detected, sensible defaults applied");

  const structured = {
    role: hasRole ? "Domain expert (as referenced in your input)" : "Expert assistant in the relevant domain",
    context: userInput,
    constraints: hasConstraint
      ? ["Follow explicit requirements stated in the input", "Be precise and production-ready"]
      : ["Be precise and specific", "Provide actionable, production-ready output", "Clearly state any remaining assumptions"],
    format: hasFormat ? "As specified in input" : "Structured text with clear sections",
  };

  const content = `## Structured Prompt

**Role:** ${structured.role}

**Context:** ${userInput}

**Task:** Complete the objective described above with precision and depth. Where the intent is ambiguous, choose the most professional interpretation and state the assumption explicitly.

**Constraints:**
${(structured.constraints as string[]).map((c) => `- ${c}`).join("\n")}

**Output format:** ${structured.format as string}

---

**Completeness score: ${score}/100**

${
  assumptions.length > 0
    ? `**What was inferred:**\n${assumptions.map((a) => `- ${a}`).join("\n")}\n\nRefine your input with more specifics to push this score above 80.`
    : "Your input is well-specified. The prompt above is ready to use."
}`;

  return { content, score, assumptions, structured };
}
