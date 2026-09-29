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
// Accepts { session_id, content } — saves the user message, generates a
// structured prompt response, saves the AI message, and returns both.
//
// Priority order for AI generation:
//   1. OpenAI (OPENAI_API_KEY set)   → GPT-4o structured output
//   2. DATA_SERVICE_URL set          → proxy to Python /data service
//   3. Fallback                      → local heuristic builder
// ---------------------------------------------------------------------------

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are Prompt AI — an expert at transforming vague user requests into detailed, structured prompts optimised for AI tools.

Given any user input, analyse their intent and respond with a JSON object in this exact format:
{
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
- 20–40  Vague, single phrase, no context — many assumptions needed
- 41–60  Some context but key specifics are missing
- 61–80  Good detail with minor gaps filled by reasonable assumptions
- 81–100 Highly specific — little to no inferencing required

Rules:
- "content" must be a complete, production-ready prompt the user can paste directly into any AI tool.
- Use markdown headers, bold labels, and bullet lists inside "content" for readability.
- Always list every assumption you made, however small.
- Respond ONLY with valid JSON — no prose outside the object.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { session_id, content, attachment } = (await req.json()) as {
    session_id: string;
    content: string;
    attachment?: IncomingAttachment;
  };

  if (!session_id || !(content?.trim() || attachment)) {
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
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Persist the user message
  const { data: userMsg, error: userMsgError } = await supabase
    .from("messages")
    .insert({
      session_id,
      role: "user",
      content: content.trim(),
      metadata: attachment
        ? { attachment: { name: attachment.name, type: attachment.type, path: attachment.path, usedAsContext: !!attachment.dataUrl } }
        : {},
    })
    .select()
    .single();

  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  // Auto-title the session from the first user message
  let sessionTitle: string | null = null;
  if (session.title === "New Chat") {
    sessionTitle = content.trim().slice(0, 60) + (content.trim().length > 60 ? "…" : "");
    await supabase
      .from("chat_sessions")
      .update({ title: sessionTitle })
      .eq("id", session_id);
  }

  // Generate the structured prompt response
  const aiResponse = await generateResponse(content.trim(), session.model, attachment ?? null);

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
    return NextResponse.json({ error: aiMsgError.message }, { status: 500 });
  }

  // Bump the session's updated_at
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", session_id);

  return NextResponse.json({ userMsg, aiMsg, sessionTitle });
}

// ---------------------------------------------------------------------------
// Response generator — tries OpenAI → DATA_SERVICE_URL → local fallback
// ---------------------------------------------------------------------------
async function generateResponse(
  userInput: string,
  model: string,
  attachment: IncomingAttachment | null
): Promise<{ content: string; score: number; assumptions: string[]; structured: Record<string, unknown> }> {
  // 1 — OpenAI (real structured output)
  if (openai) {
    try {
      // Fall back to gpt-4o for any target model we don't have a real
      // provider key for yet -- the model selector disables those, but
      // older sessions may still carry one as their stored value.
      const resolvedModel = MODELS.find((m) => m.id === model)?.openaiModel ?? "gpt-4o";

      const userContent =
        attachment?.dataUrl
          ? [
              { type: "text" as const, text: userInput },
              { type: "image_url" as const, image_url: { url: attachment.dataUrl } },
            ]
          : attachment
          ? `${userInput}\n\n[Attached file: ${attachment.name} — this file type cannot be read as context yet, only its name is known.]`
          : userInput;

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
        content?: string;
        score?: number;
        assumptions?: string[];
        structured?: Record<string, unknown>;
      };

      if (result.content && typeof result.score === "number") {
        return {
          content: result.content,
          score: result.score,
          assumptions: result.assumptions ?? [],
          structured: result.structured ?? {},
        };
      }
    } catch (err) {
      console.error("[chat] OpenAI error — falling back to local generator:", err);
    }
  }

  // 2 — Proxy to /data service
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
      if (res.ok) return res.json() as Promise<ReturnType<typeof generateResponse>>;
    } catch {
      console.error("[chat] DATA_SERVICE error — falling back to local generator");
    }
  }

  // 3 — Local heuristic fallback
  return buildStructuredPrompt(userInput);
}

// ---------------------------------------------------------------------------
// Local structured prompt builder (fallback when no API keys are configured)
// ---------------------------------------------------------------------------
function buildStructuredPrompt(userInput: string): {
  content: string;
  score: number;
  assumptions: string[];
  structured: Record<string, unknown>;
} {
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
  if (!hasConstraint) assumptions.push("No explicit constraints detected — sensible defaults applied");

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
