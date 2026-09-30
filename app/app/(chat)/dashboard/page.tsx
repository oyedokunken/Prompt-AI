"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Zap, X, Download, Copy, Check, FileType, FileDown, FileText, FileJson } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useExportHistory } from "@/lib/hooks/useExportHistory";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { ChatInput, type ChatInputHandle } from "@/components/dashboard/ChatInput";
import { GenerationStatus } from "@/components/dashboard/GenerationStatus";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { uploadAttachment, type UploadedAttachment } from "@/lib/attachments";
import { exportSession } from "@/lib/export";
import type {
  ChatSession, ChatMessage, SidebarPanel, ExportFormat,
} from "@/lib/types/chat";
import { MODELS, MAX_FILES_PER_MESSAGE, MAX_ATTACHMENT_BYTES_PER_CONVERSATION } from "@/lib/types/chat";

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
          <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-border bg-surface shadow-xl z-20 overflow-hidden">
            {MODELS.map((m) => (
              <button
                key={m.id}
                disabled={!m.openaiModel}
                onClick={() => { onSelect(m); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-colors ${
                  !m.openaiModel
                    ? "text-text-faint cursor-not-allowed"
                    : m.id === model.id
                    ? "text-accent bg-accent/10"
                    : "text-text-muted hover:bg-raised"
                }`}
              >
                <span>{m.label}</span>
                {!m.openaiModel && (
                  <span className="text-[8px] font-mono uppercase tracking-wide border border-border rounded px-1 py-0.5">
                    Coming soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Export menu (per conversation, lives in the chat header) ──────────────

function ExportMenu({
  disabled, onExport, onCopyMarkdown, copied,
}: {
  disabled: boolean;
  onExport: (format: ExportFormat) => void;
  onCopyMarkdown: () => void;
  copied: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-raised text-text-muted hover:text-text-primary hover:border-border/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Export conversation"
      >
        <Download size={11} />
        <span className="font-mono text-[10px]">Export</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-surface shadow-xl z-20 overflow-hidden py-1">
            <button
              onClick={() => { onCopyMarkdown(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors"
            >
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy as Markdown"}
            </button>
            <button
              onClick={() => { onExport("pdf"); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors"
            >
              <FileType size={11} /> Download PDF
            </button>
            <button
              onClick={() => { onExport("markdown"); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors"
            >
              <FileDown size={11} /> Download Markdown
            </button>
            <button
              onClick={() => { onExport("txt"); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors"
            >
              <FileText size={11} /> Download plain text
            </button>
            <button
              onClick={() => { onExport("json"); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors"
            >
              <FileJson size={11} /> Download JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ onStarter, name }: { onStarter: (text: string) => void; name?: string | null }) {
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
      <h2 className="text-base font-semibold text-text-primary mb-1">
        {name ? `Hi ${name}, let's build a prompt` : "Start a conversation"}
      </h2>
      <p className="text-sm text-text-muted max-w-xs mb-6">
        Describe what you need in plain language. Prompt AI will turn it into a
        structured, high-quality prompt.
      </p>

      {/* Starter suggestions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onStarter(s)}
            className="text-left px-3 py-2.5 rounded-lg border border-border bg-raised hover:border-accent/30 hover:bg-raised/80 transition-colors text-[11px] text-text-muted"
          >
            {s}
          </button>
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
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Auth
  const { profile } = useUserProfile();
  const { records: exportHistory, refresh: refreshExportHistory } = useExportHistory();

  // Sessions + messages
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("history");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<(typeof MODELS)[number]>(MODELS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
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
    const { data, error: loadError } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (loadError) {
      console.error("[dashboard] loadSessions failed:", loadError);
      setError(`Could not load your chats: ${loadError.message}`);
      return;
    }
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
    setPendingAttachments([]);
    const { data, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    if (msgError) {
      console.error("[dashboard] selectSession failed:", msgError);
      setError(`Could not load this conversation: ${msgError.message}`);
      return;
    }
    setMessages((data as ChatMessage[]) ?? []);
  };

  // Creates a session row and returns it, or null with setError already
  // called. Every caller must check for null rather than assuming success,
  // a silent failure here is what makes "nothing happens when I chat" look
  // like the whole product is broken instead of one failed insert.
  const createSession = async (): Promise<ChatSession | null> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[dashboard] createSession: no authenticated user", userError);
      setError("Your session has expired. Refresh the page and log in again.");
      return null;
    }
    const { data, error: insertError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: "New Chat", model: selectedModel.id })
      .select()
      .single();
    if (insertError || !data) {
      console.error("[dashboard] createSession failed:", insertError);
      setError(`Could not start a new chat: ${insertError?.message ?? "unknown error"}`);
      return null;
    }
    return data as ChatSession;
  };

  const handleNewChat = async () => {
    setError(null);
    const session = await createSession();
    if (!session) return;
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setMessages([]);
    setPendingAttachments([]);
  };

  const handleDeleteSession = async (id: string) => {
    const { error: deleteError } = await supabase.from("chat_sessions").delete().eq("id", id);
    if (deleteError) {
      console.error("[dashboard] handleDeleteSession failed:", deleteError);
      setError(`Could not delete that chat: ${deleteError.message}`);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setMessages([]);
    }
  };

  // ── Attachments ────────────────────────────────────────────────────────

  const handleAttach = async (files: File[]) => {
    if (!profile) return;
    setError(null);

    if (pendingAttachments.length + files.length > MAX_FILES_PER_MESSAGE) {
      setError(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
      return;
    }

    let runningTotal = pendingAttachments.reduce((sum, a) => sum + a.size, 0);

    for (const file of files) {
      if (runningTotal + file.size > MAX_ATTACHMENT_BYTES_PER_CONVERSATION) {
        setError(
          `This conversation's attachments would exceed the ${Math.round(MAX_ATTACHMENT_BYTES_PER_CONVERSATION / (1024 * 1024))}MB limit. Remove a file or start a new chat.`
        );
        break;
      }
      try {
        const uploaded = await uploadAttachment(profile.id, file);
        runningTotal += file.size;
        setPendingAttachments((prev) => [...prev, uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        break;
      }
    }
  };

  const removePendingAttachment = (path: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.path !== path));
  };

  // ── Message send ───────────────────────────────────────────────────────

  const handleSend = async (override?: string) => {
    const content = (override ?? inputValue).trim();
    if ((!content && pendingAttachments.length === 0) || isLoading) return;
    const attachments = pendingAttachments;

    console.log("[chat] send starting", { hasSession: !!activeSession, contentLength: content.length });

    // If no session exists yet, create one
    let session = activeSession;
    if (!session) {
      session = await createSession();
      if (!session) {
        console.error("[chat] send aborted, could not create a session");
        return;
      }
      setSessions((prev) => [session!, ...prev]);
      setActiveSession(session);
    }

    setInputValue("");
    setPendingAttachments([]);
    setIsLoading(true);
    setError(null);

    // Optimistic user bubble
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        session_id: session!.id,
        role: "user",
        content,
        metadata: attachments.length
          ? { attachments: attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, usedAsContext: !!a.dataUrl })) }
          : {},
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      console.log("[chat] POST /api/chat", { session_id: session.id });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          content,
          attachments: attachments.length
            ? attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, dataUrl: a.dataUrl }))
            : undefined,
        }),
      });

      console.log("[chat] /api/chat responded", { status: res.status, ok: res.ok });

      let payload: { error?: string; userMsg?: ChatMessage; aiMsg?: ChatMessage; sessionTitle?: string };
      try {
        payload = await res.json();
      } catch (parseErr) {
        console.error("[chat] response was not valid JSON:", parseErr);
        throw new Error(`Server returned an unreadable response (status ${res.status}).`);
      }

      if (!res.ok) {
        console.error("[chat] /api/chat returned an error:", payload);
        throw new Error(payload.error ?? `Request failed with status ${res.status}`);
      }

      if (!payload.userMsg || !payload.aiMsg) {
        console.error("[chat] /api/chat succeeded but response is missing messages:", payload);
        throw new Error("The server did not return a complete response.");
      }

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
              ? { ...s, title: payload.sessionTitle as string, updated_at: new Date().toISOString() }
              : s
          )
        );
      }
    } catch (err) {
      console.error("[chat] send failed:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStarterClick = (text: string) => {
    setInputValue(text);
    // Wait a tick so the textarea has the new value before we move the
    // cursor to the end of it.
    requestAnimationFrame(() => chatInputRef.current?.focus());
  };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = async (format: ExportFormat) => {
    if (!activeSession || messages.length === 0) return;
    await exportSession(activeSession, messages, format);
    refreshExportHistory();
  };

  const handleCopyMarkdown = async () => {
    if (!activeSession || messages.length === 0) return;
    await exportSession(activeSession, messages, "markdown", { copyOnly: true });
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
    refreshExportHistory();
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

  const attachmentLibrary = messages
    .flatMap((m) => m.metadata.attachments ?? [])
    .map((att) => {
      const bucket = att.path.split("/")[0];
      const objectPath = att.path.slice(bucket.length + 1);
      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return { name: att.name, type: att.type, publicUrl: data.publicUrl };
    });

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
        </div>

        <span className="font-mono text-[11px] text-text-faint absolute left-1/2 -translate-x-1/2">
          Prompt AI
        </span>

        <div className="flex items-center gap-2">
          <ExportMenu
            disabled={!activeSession || messages.length === 0}
            onExport={handleExport}
            onCopyMarkdown={handleCopyMarkdown}
            copied={copiedMarkdown}
          />
          <ModelSelector model={selectedModel} onSelect={handleModelChange} />
          <ThemeToggle size={13} className="w-7 h-7" />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSession?.id}
          panel={sidebarPanel}
          onPanelChange={setSidebarPanel}
          onNewChat={handleNewChat}
          onSelectSession={selectSession}
          onDeleteSession={handleDeleteSession}
          username={profile?.username ?? "User"}
          avatarUrl={profile?.avatarUrl ?? null}
          onSettings={() => router.push("/settings")}
          onSignOut={() => setShowLogoutConfirm(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onAttach={(file) => handleAttach([file])}
          attachments={attachmentLibrary}
          exportHistory={exportHistory}
        />

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
              <EmptyState onStarter={handleStarterClick} name={profile?.preferredName ?? undefined} />
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isLoading && <GenerationStatus />}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="mx-4 sm:mx-6 mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((a) => (
                <div
                  key={a.path}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-raised w-fit text-[11px] text-text-muted"
                >
                  <span className="truncate max-w-[160px]">{a.name}</span>
                  <button
                    onClick={() => removePendingAttachment(a.path)}
                    className="text-text-faint hover:text-red-400 transition-colors"
                    aria-label="Remove attachment"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <ChatInput
            ref={chatInputRef}
            value={inputValue}
            onChange={setInputValue}
            onSend={() => handleSend()}
            onAttach={handleAttach}
            disabled={isLoading}
          />
        </main>
      </div>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out"
        description="You will need to log in again to access your chats."
        confirmLabel="Sign out"
        danger
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
