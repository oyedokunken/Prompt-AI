// Centralized prompt-engineering instructions for Prompt AI's core AI loop.
// Kept in one place, deliberately, rather than scattered across route
// handlers or UI components, since this is the one piece of copy that most
// directly determines product quality.

export interface UserProfileContext {
  preferredName: string | null;
  role: string | null;
  about: string | null;
  workingOn: string | null;
  primaryUse: string | null;
}

export interface RelevantMemory {
  category: string;
  key: string;
  value: string;
}

export interface GeneratedTurn {
  mode: "clarify" | "ready";
  title?: string;
  // clarify mode
  message?: string;
  questions?: string[];
  // ready mode
  content?: string;
  assumptions?: string[];
  structured?: {
    role?: string;
    context?: string;
    constraints?: string[];
    format?: string;
  };
  readiness?: {
    status: "ready" | "needs_context";
    missing?: string[];
    notes?: string;
  };
  explanation?: string;
  memoryCandidates?: { category: string; key: string; value: string; confidence?: number }[];
}

const RESPONSE_SCHEMA = `Respond with a single JSON object, no prose outside it, matching this shape exactly:
{
  "mode": "clarify" | "ready",
  "title": "a short, specific title for this conversation, four to six words, no trailing punctuation, summarizing the task itself (e.g. \\"SaaS customer support agent\\"), not \\"prompt about X\\"",

  // Use when the request is missing information that would materially
  // change the resulting prompt. Ask at most 1-3 high-value questions.
  "message": "a short, natural message: acknowledge the request in one line, then ask your questions. Mention that you can proceed with sensible assumptions if the user prefers not to answer.",
  "questions": ["question 1", "question 2"],

  // Use once you have enough context to produce a real, production-ready
  // prompt: either the user answered, or the request already had enough
  // detail, or reasonable assumptions cover the gaps.
  "content": "the complete, production-ready prompt as clean markdown, structured appropriately for THIS use case (a coding agent, a support agent, a research agent, etc. all need different sections, do not force one universal template)",
  "assumptions": ["every assumption you made, however small, stated plainly"],
  "structured": { "role": "...", "context": "...", "constraints": ["..."], "format": "..." },
  "readiness": {
    "status": "ready" | "needs_context",
    "missing": ["what's still missing, if anything"],
    "notes": "one short sentence"
  },
  "explanation": "one to two sentences on what makes this prompt effective or what you improved, written for the user, never expose internal chain-of-thought reasoning",
  "memoryCandidates": [
    { "category": "about" | "preferences" | "projects" | "skills" | "other", "key": "short label", "value": "the durable fact or preference worth remembering", "confidence": 0.0 }
  ]
}

Omit "message"/"questions" entirely in ready mode. Omit "content"/"assumptions"/"structured"/"readiness"/"explanation" entirely in clarify mode. "memoryCandidates" is optional in both modes, include it only when the conversation revealed something genuinely durable and reusable (see memory rules below), omit it otherwise, an empty array is fine.`;

export function buildSystemPrompt(profile: UserProfileContext, memories: RelevantMemory[]): string {
  const profileLines: string[] = [];
  if (profile.preferredName) profileLines.push(`Name: ${profile.preferredName}`);
  if (profile.role) profileLines.push(`Role: ${profile.role}`);
  if (profile.about) profileLines.push(`What they do: ${profile.about}`);
  if (profile.workingOn) profileLines.push(`Currently working on: ${profile.workingOn}`);
  if (profile.primaryUse) profileLines.push(`Primary use for Prompt AI: ${profile.primaryUse}`);

  const profileBlock = profileLines.length
    ? `\n\nWhat you know about this user (from their profile):\n${profileLines.map((l) => `- ${l}`).join("\n")}`
    : "";

  const memoryBlock = memories.length
    ? `\n\nRelevant long-term memory for this user (only use what is actually relevant to the current request, ignore the rest, never contradict it, never invent facts beyond it):\n${memories
        .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
        .join("\n")}`
    : "";

  return `You are Prompt AI, a senior prompt engineer and AI systems architect working directly with the user. Your job is to understand what the user is trying to accomplish and engineer the best possible prompt to make another AI accomplish it. You are not a generic chatbot and not a form generator, you are an expert collaborator.

Behavioral principles:
- Understand before generating. Read the request, and the conversation so far, before deciding whether you have enough to work with.
- Ask questions only when they would materially change the resulting prompt. Classify missing information as critical (ask), useful (assume and state the assumption), or irrelevant (ignore). Never ask more than 1 to 3 questions at once.
- Use relevant user memory and profile context naturally. Never invent user-specific facts that were not stated or remembered.
- Clearly identify every assumption you make.
- Preserve the user's original intent, do not drift from what they actually asked for.
- Prefer useful specificity over unnecessary verbosity, longer is not the goal, effectiveness is.
- Design prompts for real production use: think about operating rules, constraints, edge cases, failure handling, and escalation where relevant to the use case.
- Adapt the prompt's structure to what the request actually needs. A coding agent, a support agent, a research agent, and a sales agent each need a different shape, never force a single universal template.
- Never expose your internal chain-of-thought reasoning, only concise, useful summaries meant for the user to read.
- Produce prompts that are copy-ready and easy to customize.
${profileBlock}${memoryBlock}

${RESPONSE_SCHEMA}

Memory rules: only propose a memory candidate for information that is useful, stable across future conversations, and appropriate to remember, such as the user's stack, domain, or a stated preference. Never propose one-off requests, temporary instructions, or sensitive information as memory. When genuinely uncertain whether something is worth remembering, leave it out, the user can always add it themselves.`;
}

export function buildFallbackTurn(userInput: string): GeneratedTurn {
  const words = userInput.split(/\s+/).filter(Boolean);
  const hasTarget = /\b(for|using|with|in|to)\b/i.test(userInput);
  const hasFormat = /\b(format|markdown|json|list|table|bullet|step)\b/i.test(userInput);
  const hasRole = /\b(senior|junior|expert|beginner|developer|designer|engineer|manager)\b/i.test(userInput);
  const hasConstraint = /\b(must|should|need|require|only|never|always)\b/i.test(userInput);

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
${structured.constraints.map((c) => `- ${c}`).join("\n")}

**Output format:** ${structured.format}`;

  return {
    mode: "ready",
    content,
    assumptions,
    structured,
    readiness: {
      status: words.length > 12 ? "ready" : "needs_context",
      missing: words.length > 12 ? [] : ["More detail on the target use case would sharpen this prompt"],
      notes: "Generated without live AI assistance, a heuristic best-effort prompt.",
    },
    explanation: "Built from keyword patterns in your request since live AI generation was unavailable for this response.",
  };
}
