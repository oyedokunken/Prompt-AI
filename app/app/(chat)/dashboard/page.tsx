"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, PanelLeft, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { ChatInput } from "@/components/dashboard/ChatInput";
import type {
  ChatSession, ChatMessage, SidebarPanel, ExportFormat,
} from "@/lib/types/chat";
import { MODELS } from "@/lib/types/chat";

// ─── Model selector ────────────────────────────────────────────────────────

function ModelSelector({
  model, onSelect,
}: {
  model: (typeof MODELS)[number];
  onSelect: (m: (typeof MODELS)[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-raised cursor-pointer hover:border-border/60 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
        <span className="font-mono text-[10px] text-text-muted">{model.label}</span>
        <ChevronDown size={10} className="text-text-faint" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-surface shadow-xl z-20 overflow-hidden">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onSelect(m); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                  m.id === model.id
                    ? "text-accent bg-accent/10"
                    : "text-text-muted hover:bg-raised"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  const starters = [
    "Write a system prompt for a customer support agent",
    "Create a prompt that extracts structured data from receipts",
    "Build a coding assistant prompt for TypeScript",
    "Design a prompt for generating marketing copy",
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-base border border-border flex items-center justify-center mb-4">
        <Zap size={18} className="text-accent" />
      </div>
      <h2 className="text-base font-semibold text-text-primary mb-1">Start a conversation</h2>
      <p className="text-sm text-text-muted max-w-xs mb-6">
        Describe what you need in plain language. Prompt AI will turn it into a
        structured, high-quality prompt.
      </p>

      {/* Starter suggestions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {starters.map((s) => (
          <button
            key={s}
            onClick={onNew}
            className="text-left px-3 py-2.5 rounded-lg border border-border bg-raised hover:border-accent/30 hover:bg-raised/80 transition-colors text-[11px] text-text-muted"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Typing indicator ──────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30 bg-signal/10">
        <span className="font-mono text-[10px] text-signal">P</span>
      </div>
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-tl-md bg-base border border-border">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-text-faint animate-[blink_1.2s_step-end_infinite]"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auth
  const [username, setUsername] = useState("User");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Sessions + messages
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("history");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<(typeof MODELS)[number]>(MODELS[0]);
  const [error, setError] = useState<string | null>(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setAvatarUrl(user.user_metadata?.avatar_url ?? null);
      setUsername(user.email?.split("@")[0] ?? "User");
      await loadSessions();
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Session helpers ────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    const rows = (data as ChatSession[]) ?? [];
    setSessions(rows);
    // Open most-recent session by default
    if (rows.length > 0 && !activeSession) {
      await selectSession(rows[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSession = async (session: ChatSession) => {
    setActiveSession(session);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    setMessages((data as ChatMessage[]) ?? []);
  };

  const handleNewChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: "New Chat", model: selectedModel.id })
      .select()
      .single();
    if (data) {
      const session = data as ChatSession;
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
    }
  };

  const handleDeleteSession = async (id: string) => {
    await supabase.from("chat_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setMessages([]);
    }
  };

  // ── Message send ───────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // If no session exists yet, create one
    let session = activeSession;
    if (!session) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title: "New Chat", model: selectedModel.id })
        .select()
        .single();
      if (!data) return;
      session = data as ChatSession;
      setSessions((prev) => [session!, ...prev]);
      setActiveSession(session);
    }

    const content = inputValue.trim();
    setInputValue("");
    setIsLoading(true);
    setError(null);

    // Optimistic user bubble
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, session_id: session!.id, role: "user", content, metadata: {}, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session!.id, content }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Something went wrong");

      // Replace optimistic bubble + add AI response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        payload.userMsg as ChatMessage,
        payload.aiMsg as ChatMessage,
      ]);

      // Update session title in sidebar
      if (payload.sessionTitle) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === session!.id
              ? { ...s, title: payload.sessionTitle, updated_at: new Date().toISOString() }
              : s
          )
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = (format: ExportFormat) => {
    if (!activeSession || messages.length === 0) return;

    let content = "";
    const title = activeSession.title;

    if (format === "json") {
      content = JSON.stringify({ session: activeSession, messages }, null, 2);
    } else if (format === "txt") {
      content = messages
        .map((m) => `[${m.role === "user" ? "You" : "Prompt AI"}]\n${m.content}`)
        .join("\n\n---\n\n");
    } else {
      // markdown
      content = `# ${title}\n\n` +
        messages
          .map((m) =>
            m.role === "user"
              ? `**You:** ${m.content}`
              : `**Prompt AI:**\n\n${m.content}`
          )
          .join("\n\n---\n\n");
    }

    // Copy if format was triggered from the copy button
    if (format === "markdown" && sidebarPanel === "export") {
      navigator.clipboard.writeText(content);
      return;
    }

    const ext = format === "json" ? "json" : format === "txt" ? "txt" : "md";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Model change ───────────────────────────────────────────────────────

  const handleModelChange = async (m: (typeof MODELS)[number]) => {
    setSelectedModel(m);
    if (activeSession) {
      await supabase
        .from("chat_sessions")
        .update({ model: m.id })
        .eq("id", activeSession.id);
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* ── Title bar ── */}
      <header className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          {/* Sidebar toggle (mobile / collapsed) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 text-text-faint hover:text-text-muted transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeft size={13} />
            </button>
          )}
        </div>

        <span className="font-mono text-[11px] text-text-faint absolute left-1/2 -translate-x-1/2">
          Prompt AI
        </span>

        <ModelSelector model={selectedModel} onSelect={handleModelChange} />
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSession?.id}
            panel={sidebarPanel}
            onPanelChange={setSidebarPanel}
            onNewChat={handleNewChat}
            onSelectSession={selectSession}
            onDeleteSession={handleDeleteSession}
            onExport={handleExport}
            onClose={() => setSidebarOpen(false)}
            username={username}
            avatarUrl={avatarUrl}
            onSettings={() => router.push("/settings")}
            onSignOut={handleSignOut}
          />
        )}

        {/* ── Main area ── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-xs text-red-400">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-5 flex flex-col gap-5">
            {messages.length === 0 && !isLoading ? (
              <EmptyState onNew={handleNewChat} />
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isLoading && <TypingIndicator />}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={isLoading}
          />
        </main>
      </div>
    </div>
  );
}
