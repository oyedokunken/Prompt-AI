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
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: PromptMetadata;
  created_at: string;
}

export type ExportFormat = "markdown" | "json" | "txt";
export type SidebarPanel = "history" | "media" | "export";

export const MODELS = [
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { id: "grok-2", label: "Grok 2" },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B" },
  { id: "o1-mini", label: "o1-mini" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
