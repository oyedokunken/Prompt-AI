"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Zap, X, Download, Copy, Check, FileType, FileDown, FileText, FileJson, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useUserProfile, roleLabel } from "@/lib/hooks/useUserProfile";
import { useExportHistory } from "@/lib/hooks/useExportHistory";
import { useSavedPrompts } from "@/lib/hooks/useSavedPrompts";
import { useSharedLinks } from "@/lib/hooks/useSharedLinks";
import { useMemories } from "@/lib/hooks/useMemories";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { ChatInput, type ChatInputHandle } from "@/components/dashboard/ChatInput";
import { GenerationStatus } from "@/components/dashboard/GenerationStatus";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { ShareMenu } from "@/components/dashboard/ShareMenu";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { uploadAttachment, type UploadedAttachment } from "@/lib/attachments";
import { exportSession } from "@/lib/export";
import type {
  ChatSession, ChatMessage, SidebarPanel, ExportFormat,
} from "@/lib/types/chat";
import { MODELS, MAX_FILES_PER_MESSAGE, MAX_ATTACHMENT_BYTES_PER_CONVERSATION } from "@/lib/types/chat";


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
  const { savedPrompts, save: savePrompt, toggleFavorite: toggleSavedFavorite, remove: removeSavedPrompt } = useSavedPrompts();
  const { links: sharedLinks, createLink: createShareLink, revoke: revokeShareLink } = useSharedLinks();
  const { addCandidates: saveMemoryCandidates } = useMemories();

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
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "session"; id: string; label: string }
    | { type: "saved-prompt"; id: string; label: string }
    | { type: "attachment"; path: string; label: string }
    | null
  >(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Command palette (Cmd+K / Ctrl+K) ──────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Reflect the active conversation in the browser tab
  useEffect(() => {
    document.title = activeSession && activeSession.title !== "New Chat"
      ? `${activeSession.title} | Prompt AI`
      : "Prompt AI";
  }, [activeSession]);

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

  // Does not create a row or touch the sidebar at all, a chat with no
  // messages is a draft, not a saved session. The real row is created
  // lazily in handleSend, the moment there is an actual first message to
  // attach it to.
  const handleNewChat = () => {
    setError(null);
    setActiveSession(null);
    setMessages([]);
    setPendingAttachments([]);
  };

  const requestDeleteSession = (id: string) => {
    const target = sessions.find((s) => s.id === id);
    setPendingDelete({ type: "session", id, label: target?.title ?? "this chat" });
  };

  const performDeleteSession = async (id: string) => {
    const { error: deleteError } = await supabase.from("chat_sessions").delete().eq("id", id);
    if (deleteError) {
      console.error("[dashboard] performDeleteSession failed:", deleteError);
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

  const requestRemoveAttachment = (path: string) => {
    const target = pendingAttachments.find((a) => a.path === path);
    setPendingDelete({ type: "attachment", path, label: target?.name ?? "this file" });
  };

  const performRemoveAttachment = (path: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.path !== path));
  };

  const requestDeleteSavedPrompt = (id: string) => {
    const target = savedPrompts.find((p) => p.id === id);
    setPendingDelete({ type: "saved-prompt", id, label: target?.title ?? "this saved prompt" });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "session") {
      await performDeleteSession(pendingDelete.id);
    } else if (pendingDelete.type === "saved-prompt") {
      await removeSavedPrompt(pendingDelete.id);
    } else {
      performRemoveAttachment(pendingDelete.path);
    }
    setPendingDelete(null);
  };

  const DELETE_COPY: Record<"session" | "saved-prompt" | "attachment", { title: string; verb: string }> = {
    session: { title: "Delete chat", verb: "delete this chat" },
    "saved-prompt": { title: "Delete saved prompt", verb: "delete this saved prompt" },
    attachment: { title: "Remove attachment", verb: "remove this attachment" },
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

      // Update the title in both the sidebar list and the active session,
      // the header and tab title read from activeSession specifically, a
      // title that only reached the sidebar never actually reached the
      // user looking at the open conversation.
      if (payload.sessionTitle) {
        const title = payload.sessionTitle;
        setSessions((prev) =>
          prev.map((s) => (s.id === session!.id ? { ...s, title, updated_at: new Date().toISOString() } : s))
        );
        setActiveSession((prev) => (prev && prev.id === session!.id ? { ...prev, title } : prev));
      }
    } catch (err) {
      console.error("[chat] send failed:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Editing a user message branches the conversation from that point
  // forward: the edited message and everything after it (its old self
  // included) is removed, then the new content is sent as a fresh turn.
  const handleEditMessage = async (messageId: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const idsToDelete = messages.slice(idx).map((m) => m.id).filter((id) => !id.startsWith("temp-"));
    setMessages((prev) => prev.slice(0, idx));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from("messages").delete().in("id", idsToDelete);
      if (deleteError) {
        console.error("[dashboard] handleEditMessage: failed to delete superseded messages:", deleteError);
        setError("Could not update that message. Try again.");
        return;
      }
    }

    await handleSend(newContent);
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

  // ── Favorites + saved prompts ──────────────────────────────────────────

  const handleToggleSessionFavorite = async (id: string, next: boolean) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: next } : s)));
    if (activeSession?.id === id) setActiveSession((prev) => (prev ? { ...prev, is_favorite: next } : prev));
    const { error: toggleError } = await supabase.from("chat_sessions").update({ is_favorite: next }).eq("id", id);
    if (toggleError) {
      console.error("[dashboard] handleToggleSessionFavorite failed:", toggleError);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: !next } : s)));
    }
  };

  const handleSaveMessage = (message: ChatMessage) => {
    savePrompt(activeSession?.id ?? null, message);
  };

  // ── Sharing ────────────────────────────────────────────────────────────

  const activeShareLink = activeSession
    ? sharedLinks.find((l) => l.session_id === activeSession.id && !l.revoked) ?? null
    : null;

  const handleCreateShareLink = async () => {
    if (!activeSession) return;
    await createShareLink(activeSession.id, "session");
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
          {/* Mobile menu */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1 text-text-faint hover:text-text-primary transition-colors"
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
          {/* Traffic lights (desktop only) */}
          <div className="hidden md:flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          {/* On mobile, the general dashboard view (no open chat) shows the
              logo here, the limited header space is spent on the chat
              title instead once a conversation is actually open. */}
          {!activeSession && <Logo variant="color" size={16} className="md:hidden" />}
        </div>

        <span
          className={cn(
            "font-mono text-[11px] text-text-faint absolute left-1/2 -translate-x-1/2 max-w-[40%] truncate",
            activeSession ? "block" : "hidden sm:block"
          )}
        >
          {activeSession && activeSession.title !== "New Chat" ? activeSession.title : "Prompt AI"}
        </span>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <ShareMenu
              disabled={!activeSession || messages.length === 0}
              activeLink={activeShareLink}
              onCreate={handleCreateShareLink}
              onRevoke={revokeShareLink}
              siteUrl={typeof window !== "undefined" ? window.location.origin : ""}
            />
            <ExportMenu
              disabled={!activeSession || messages.length === 0}
              onExport={handleExport}
              onCopyMarkdown={handleCopyMarkdown}
              copied={copiedMarkdown}
            />
          </div>
          <ThemeToggle size={13} className="w-7 h-7" />
          <button
            onClick={() => router.push("/settings")}
            className="w-7 h-7 rounded-full overflow-hidden border border-border hover:border-accent/40 transition-colors shrink-0"
            aria-label="Open settings"
          >
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent/15 flex items-center justify-center text-[10px] text-accent font-mono">
                {(profile?.username ?? "U")[0]?.toUpperCase()}
              </div>
            )}
          </button>
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
          onDeleteSession={requestDeleteSession}
          username={profile?.username ?? "User"}
          avatarUrl={profile?.avatarUrl ?? null}
          onSettings={() => router.push("/settings")}
          onSignOut={() => setShowLogoutConfirm(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onAttach={(file) => handleAttach([file])}
          attachments={attachmentLibrary}
          exportHistory={exportHistory}
          preferredName={profile?.preferredName}
          roleDisplay={roleLabel(profile?.role ?? null)}
          onToggleSessionFavorite={handleToggleSessionFavorite}
          savedPrompts={savedPrompts}
          onToggleSavedFavorite={toggleSavedFavorite}
          onDeleteSavedPrompt={requestDeleteSavedPrompt}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
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
                {messages.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onSave={m.role === "assistant" ? handleSaveMessage : undefined}
                    onSaveMemories={m.role === "assistant" ? saveMemoryCandidates : undefined}
                    onRetry={
                      m.role === "assistant" && m.metadata.mode === "error"
                        ? () => {
                            const precedingUser = [...messages.slice(0, i)].reverse().find((p) => p.role === "user");
                            if (precedingUser) handleSend(precedingUser.content);
                          }
                        : undefined
                    }
                    onEdit={m.role === "user" ? handleEditMessage : undefined}
                  />
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
                    onClick={() => requestRemoveAttachment(a.path)}
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
            model={selectedModel}
            onModelChange={handleModelChange}
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

      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete ? DELETE_COPY[pendingDelete.type].title : ""}
        description={pendingDelete ? `Are you sure you want to ${DELETE_COPY[pendingDelete.type].verb}, "${pendingDelete.label}"? This cannot be undone.` : ""}
        confirmLabel={pendingDelete?.type === "attachment" ? "Remove" : "Delete"}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        sessions={sessions}
        onSelectSession={selectSession}
        onNewChat={handleNewChat}
        onSettings={() => router.push("/settings")}
        onSignOut={() => setShowLogoutConfirm(true)}
        onOpenSaved={() => setSidebarPanel("saved")}
        onOpenFavorites={() => setSidebarPanel("favorites")}
      />
    </div>
  );
}
