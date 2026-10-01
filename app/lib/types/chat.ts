export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  model: string;
  is_favorite: boolean;
  title_is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedPrompt {
  id: string;
  user_id: string;
  session_id: string | null;
  message_id: string | null;
  title: string;
  content: string;
  score: number | null;
  assumptions: string[];
  structured: Record<string, unknown>;
  is_favorite: boolean;
  created_at: string;
}

export interface SharedLink {
  id: string;
  token: string;
  user_id: string;
  target_type: "session" | "export";
  session_id: string;
  export_format: ExportFormat | null;
  revoked: boolean;
  created_at: string;
}

export interface MemoryCandidate {
  category: string;
  key: string;
  value: string;
  confidence?: number;
}

export interface PromptReadiness {
  status: "ready" | "needs_context";
  missing?: string[];
  notes?: string;
}

export interface ClarifyQuestion {
  id?: string;
  text: string;
  // A short list of common answers, when the question has a reasonably
  // enumerable answer set, for example a tech stack. Omitted entirely for
  // genuinely open-ended questions, which fall back to a text input.
  options?: string[];
  // Whether more than one option can apply at once, meaningless without options.
  multiple?: boolean;
}

// "clarify": the AI needs a little more context before it can produce a
// real prompt, content is a short conversational question. "ready" (or
// absent, for messages generated before this field existed): content is
// the finished, production-ready prompt. "error": generation genuinely
// failed, content is an honest failure message, never a fabricated prompt.
export interface PromptDiff {
  stated: string[];
  inferred: string[];
}

// "answer": a direct conversational reply, for example to a question about
// what is stored about the user. It may carry a still-pending clarifying
// question, which keeps waiting for its answer.
export interface PromptMetadata {
  mode?: "clarify" | "ready" | "error" | "answer";
  // clarify mode: the single question currently being asked, and the
  // sequence state /data needs back with the next message. The state is
  // opaque to the interface, only /api and /data read it.
  interviewQuestions?: ClarifyQuestion[];
  intro?: string;
  clarifyPosition?: number;
  clarifyTotal?: number;
  clarifyState?: unknown;
  // ready mode: what the user stated against what was inferred for them.
  diff?: PromptDiff;
  score?: number;
  assumptions?: string[];
  structured?: {
    role?: string;
    context?: string;
    constraints?: string[];
    format?: string;
  };
  readiness?: PromptReadiness;
  explanation?: string;
  memoryCandidates?: MemoryCandidate[];
  attachments?: {
    name: string;
    type: string;
    path: string;
    usedAsContext: boolean;
  }[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: PromptMetadata;
  created_at: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  category: string;
  key: string;
  value: string;
  source: "onboarding" | "conversation" | "manual";
  confidence: number;
  created_at: string;
  updated_at: string;
}

export const MEMORY_CATEGORIES = [
  { id: "about", label: "About you" },
  { id: "preferences", label: "Preferences" },
  { id: "projects", label: "Projects & context" },
  { id: "skills", label: "Skills & tools" },
  { id: "other", label: "Other" },
] as const;

export type ExportFormat = "markdown" | "json" | "txt" | "pdf";
export type SidebarPanel = "history" | "media" | "exports" | "saved" | "favorites";

// available is false for targets the data service has no provider for yet --
// the selector disables those rather than silently generating with a
// different model than the one shown.
export const MODELS = [
  { id: "gpt-4o", label: "GPT-4o", available: true },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", available: false },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", available: false },
  { id: "grok-2", label: "Grok 2", available: false },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B", available: false },
  { id: "o1-mini", label: "o1-mini", available: false },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const ATTACHMENT_BUCKETS: Record<string, { bucket: string; maxBytes: number }> = {
  image: { bucket: "image-attachments", maxBytes: 10 * 1024 * 1024 },
  video: { bucket: "video-attachments", maxBytes: 20 * 1024 * 1024 },
  pdf: { bucket: "PDF-attachments", maxBytes: 10 * 1024 * 1024 },
};

export function attachmentKind(mimeType: string): keyof typeof ATTACHMENT_BUCKETS | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return null;
}

// Keeps a single user or a single conversation from exhausting API token
// budget through attachments.
export const MAX_FILES_PER_MESSAGE = 3;
export const MAX_ATTACHMENT_BYTES_PER_CONVERSATION = 50 * 1024 * 1024;
