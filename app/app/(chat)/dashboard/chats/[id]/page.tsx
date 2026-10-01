"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Menu, X, Download, Copy, Check, FileType, FileDown, FileText, FileJson, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { ClarifyInterview } from "@/components/dashboard/ClarifyInterview";
import { ChatInput, type ChatInputHandle } from "@/components/dashboard/ChatInput";
import { GenerationStatus } from "@/components/dashboard/GenerationStatus";
import { ShareMenu } from "@/components/dashboard/ShareMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { uploadAttachment, type UploadedAttachment } from "@/lib/attachments";
import { exportSession } from "@/lib/export";
import type { ChatSession, ChatMessage, ExportFormat } from "@/lib/types/chat";
import { MODELS, MAX_FILES_PER_MESSAGE, MAX_ATTACHMENT_BYTES_PER_CONVERSATION } from "@/lib/types/chat";

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
            <button onClick={() => { onCopyMarkdown(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
              {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy as Markdown"}
            </button>
            <button onClick={() => { onExport("pdf"); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
              <FileType size={11} /> Download PDF
            </button>
            <button onClick={() => { onExport("markdown"); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
              <FileDown size={11} /> Download Markdown
            </button>
            <button onClick={() => { onExport("txt"); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
              <FileText size={11} /> Download plain text
            </button>
            <button onClick={() => { onExport("json"); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
              <FileJson size={11} /> Download JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const sessionId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  const {
    profile, sessions, setSessions,
    savePrompt, saveMemoryCandidates,
    sharedLinks, createShareLink, revokeShareLink,
    refreshExportHistory,
    pendingFirstMessage, setPendingFirstMessage,
    setMobileSidebarOpen,
    error, setError,
  } = useDashboard();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const selectedModel = MODELS.find((m) => m.id === session?.model) ?? MODELS[0];

  // Load this specific session and its messages whenever the route's id
  // changes, independent of whatever the sidebar's session list happens to
  // have loaded, so a hard refresh or a direct link to this URL works.
  const loadChat = useCallback(async (id: string) => {
    setLoadingSession(true);
    const { data: sessionData, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .single();
    if (sessionError || !sessionData) {
      console.error("[chat page] session lookup failed:", sessionError);
      setError("That chat could not be found.");
      router.push("/dashboard");
      return;
    }
    setSession(sessionData as ChatSession);

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });
    if (messageError) {
      console.error("[chat page] message load failed:", messageError);
      setError(`Could not load this conversation: ${messageError.message}`);
      setMessages([]);
    } else {
      setMessages((messageData as ChatMessage[]) ?? []);
    }
    setLoadingSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId) loadChat(sessionId);
  }, [sessionId, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    document.title = session && session.title !== "New Chat" ? `${session.title} | Prompt AI` : "Prompt AI";
  }, [session]);

  const handleSend = useCallback(async (override?: string, overrideAttachments?: UploadedAttachment[]) => {
    const content = (override ?? inputValue).trim();
    const attachments = overrideAttachments ?? pendingAttachments;
    if ((!content && attachments.length === 0) || isLoading || !session) return;

    setInputValue("");
    setPendingAttachments([]);
    setIsLoading(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        session_id: session.id,
        role: "user",
        content,
        metadata: attachments.length
          ? { attachments: attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, usedAsContext: !!a.dataUrl })) }
          : {},
        created_at: new Date().toISOString(),
      },
    ]);

    try {
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

      let payload: { error?: string; userMsg?: ChatMessage; aiMsg?: ChatMessage; sessionTitle?: string };
      try {
        payload = await res.json();
      } catch (parseErr) {
        console.error("[chat page] response was not valid JSON:", parseErr);
        throw new Error(`Server returned an unreadable response (status ${res.status}).`);
      }

      if (!res.ok) throw new Error(payload.error ?? `Request failed with status ${res.status}`);
      if (!payload.userMsg || !payload.aiMsg) throw new Error("The server did not return a complete response.");

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        payload.userMsg as ChatMessage,
        payload.aiMsg as ChatMessage,
      ]);

      if (payload.sessionTitle) {
        const title = payload.sessionTitle;
        setSession((prev) => (prev ? { ...prev, title } : prev));
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, title, updated_at: new Date().toISOString() } : s))
        );
      }
    } catch (err) {
      console.error("[chat page] send failed:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, pendingAttachments, isLoading, session]);

  // If the welcome page just created this session and handed off a first
  // message, send it now, exactly once.
  useEffect(() => {
    if (!session || loadingSession) return;
    if (pendingFirstMessage && pendingFirstMessage.sessionId === session.id) {
      const { content, attachments } = pendingFirstMessage;
      setPendingFirstMessage(null);
      handleSend(content, attachments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loadingSession]);

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const idsToDelete = messages.slice(idx).map((m) => m.id).filter((id) => !id.startsWith("temp-"));
    setMessages((prev) => prev.slice(0, idx));
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from("messages").delete().in("id", idsToDelete);
      if (deleteError) {
        console.error("[chat page] handleEditMessage: failed to delete superseded messages:", deleteError);
        setError("Could not update that message. Try again.");
        return;
      }
    }
    await handleSend(newContent);
  };

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
        setError(`This conversation's attachments would exceed the ${Math.round(MAX_ATTACHMENT_BYTES_PER_CONVERSATION / (1024 * 1024))}MB limit.`);
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

  const handleExport = async (format: ExportFormat) => {
    if (!session || messages.length === 0) return;
    await exportSession(session, messages, format);
    refreshExportHistory();
  };

  const handleCopyMarkdown = async () => {
    if (!session || messages.length === 0) return;
    await exportSession(session, messages, "markdown", { copyOnly: true });
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
    refreshExportHistory();
  };

  const handleModelChange = async (m: (typeof MODELS)[number]) => {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, model: m.id } : prev));
    await supabase.from("chat_sessions").update({ model: m.id }).eq("id", session.id);
  };

  const handleSaveMessage = (message: ChatMessage) => {
    if (session) savePrompt(session.id, message);
  };

  const activeShareLink = session
    ? sharedLinks.find((l) => l.session_id === session.id && !l.revoked) ?? null
    : null;

  const handleCreateShareLink = async () => {
    if (session) await createShareLink(session.id, "session");
  };

  if (loadingSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-base">
        <Loader2 size={18} className="animate-spin text-text-faint" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <header className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1 text-text-faint hover:text-text-primary transition-colors"
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
          <div className="hidden md:flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
        </div>

        <span className={cn("font-mono text-[11px] text-text-faint absolute left-1/2 -translate-x-1/2 max-w-[50%] truncate")}>
          {session.title !== "New Chat" ? session.title : "Prompt AI"}
        </span>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <ShareMenu
              disabled={messages.length === 0}
              activeLink={activeShareLink}
              onCreate={handleCreateShareLink}
              onRevoke={revokeShareLink}
              siteUrl={typeof window !== "undefined" ? window.location.origin : ""}
            />
            <ExportMenu
              disabled={messages.length === 0}
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

      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-xs text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-5 flex flex-col gap-5">
          {messages.map((m, i) => {
            const isLastMessage = i === messages.length - 1;
            const isPendingInterview =
              m.role === "assistant" &&
              m.metadata.mode === "clarify" &&
              !!m.metadata.interviewQuestions?.length &&
              isLastMessage &&
              !isLoading;

            if (isPendingInterview) {
              // m.content is "intro\n\nnumbered question list", built server
              // side for clients that don't render the interactive UI (e.g.
              // the shared read-only view); only the intro sentence belongs
              // here since the questions render one at a time below it.
              const intro = m.content.split("\n\n")[0] ?? m.content;
              return (
                <ClarifyInterview
                  key={m.id}
                  intro={intro}
                  questions={m.metadata.interviewQuestions!}
                  onComplete={(answerText) => handleSend(answerText)}
                />
              );
            }

            return (
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
            );
          })}
          {isLoading && <GenerationStatus />}
          <div ref={bottomRef} />
        </div>

        {pendingAttachments.length > 0 && (
          <div className="mx-4 sm:mx-6 mb-2 flex flex-wrap gap-2">
            {pendingAttachments.map((a) => (
              <div key={a.path} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-raised w-fit text-[11px] text-text-muted">
                <span className="truncate max-w-[160px]">{a.name}</span>
                <button
                  onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.path !== a.path))}
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
  );
}
