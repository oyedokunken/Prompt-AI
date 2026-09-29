import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// POST /api/chat
// Accepts { session_id, content } — saves the user message, generates a
// structured prompt response, saves the AI message, and returns both.
//
// When DATA_SERVICE_URL is configured the request is proxied there.
// Until then a local structured-prompt generator is used so the UI stays
// fully functional from day one.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { session_id, content } = (await req.json()) as {
    session_id: string;
    content: string;
  };

  if (!session_id || !content?.trim()) {
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
    .insert({ session_id, role: "user", content: content.trim(), metadata: {} })
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
  const aiResponse = await generateResponse(content.trim(), session.model);

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
// Response generator
// Proxies to DATA_SERVICE_URL when configured, otherwise uses local logic.
// ---------------------------------------------------------------------------
async function generateResponse(
  userInput: string,
  model: string
): Promise<{ content: string; score: number; assumptions: string[]; structured: Record<string, unknown> }> {
  const dataServiceUrl = process.env.DATA_SERVICE_URL;

  if (dataServiceUrl) {
    const res = await fetch(`${dataServiceUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DATA_SERVICE_API_KEY ?? ""}`,
      },
      body: JSON.stringify({ input: userInput, model }),
    });
    if (res.ok) return res.json() as Promise<ReturnType<typeof generateResponse>>;
  }

  return buildStructuredPrompt(userInput);
}

// ---------------------------------------------------------------------------
// Local structured prompt builder (used until /data service is live)
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
    role: hasRole
      ? "Domain expert (as referenced in your input)"
      : "Expert assistant in the relevant domain",
    context: userInput,
    constraints: hasConstraint
      ? ["Follow explicit requirements stated in the input", "Be precise and production-ready"]
      : ["Be precise and specific", "Provide actionable, production-ready output", "Clearly state any remaining assumptions"],
    format: hasFormat ? "As specified in input" : "Structured text with clear sections",
  };

  const content = `Here is your structured prompt:

---

**Role:** ${structured.role}

**Context:** ${userInput}

**Task:** Complete the objective described above with precision and depth. Where the intent is ambiguous, choose the most professional interpretation and state the assumption explicitly.

**Constraints:**
${structured.constraints.map((c) => `- ${c}`).join("\n")}

**Output format:** ${structured.format}

---

**Completeness score: ${score}/100**

${
  assumptions.length > 0
    ? `**What was inferred:**\n${assumptions.map((a) => `- ${a}`).join("\n")}\n\nRefine your input with more specifics to push this score above 80.`
    : "Your input is well-specified. The prompt above should be ready to use."
}`;

  return { content, score, assumptions, structured };
}
