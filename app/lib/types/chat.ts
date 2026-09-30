export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface PromptMetadata {
  score?: number;
  assumptions?: string[];
  structured?: {
    role?: string;
    context?: string;
    constraints?: string[];
    format?: string;
  };
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

export type ExportFormat = "markdown" | "json" | "txt" | "pdf";
export type SidebarPanel = "history" | "media" | "exports";

// openaiModel is null for targets we cannot actually call yet (no provider
// key configured) -- the selector disables those rather than silently
// generating with a different model than the one shown.
export const MODELS = [
  { id: "gpt-4o", label: "GPT-4o", openaiModel: "gpt-4o" },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", openaiModel: null },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", openaiModel: null },
  { id: "grok-2", label: "Grok 2", openaiModel: null },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B", openaiModel: null },
  { id: "o1-mini", label: "o1-mini", openaiModel: null },
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
