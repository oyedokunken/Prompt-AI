"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pin, PinOff, Download, Copy, Check, FileType, FileDown, FileText, FileJson, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { ClarifyInterview } from "@/components/dashboard/ClarifyInterview";
import { ChatInput, type ChatInputHandle } from "@/components/dashboard/ChatInput";
import { GenerationStatus } from "@/components/dashboard/GenerationStatus";
import { MemoryToast } from "@/components/dashboard/MemoryToast";
import { AttachmentCard } from "@/components/dashboard/AttachmentCard";
import { ShareMenu } from "@/components/dashboard/ShareMenu";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { uploadAttachment, type UploadedAttachment } from "@/lib/attachments";
import { streamChat } from "@/lib/api/chatApi";
import { exportSession } from "@/lib/export";
import type { ChatSession, ChatMessage, ExportFormat } from "@/lib/types/chat";
import { MODELS, MAX_FILES_PER_MESSAGE, MAX_ATTACHMENT_BYTES_PER_CONVERSATION, MAX_MESSAGE_CHARS } from "@/lib/types/chat";

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
        className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-raised text-text-muted hover:text-text-primary hover:border-border/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Export conversation"
      >
        <Download size={11} />
        <span className="font-mono text-xs">Export</span>
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
    savePrompt, refreshMemories,
    sharedLinks, createShareLink, revokeShareLink,
    refreshExportHistory,
    pendingFirstMessage, setPendingFirstMessage,
    error, setError,
    pinnedIds, togglePin,
  } = useDashboard();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [memoryToast, setMemoryToast] = useState<{ key: string; action: "added" | "updated" }[] | null>(null);
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

  const handleSend = useCallback(async (override?: string, overrideAttachments?: UploadedAttachment[], isClarifyAnswer = false) => {
    const content = (override ?? inputValue).trim();
    const attachments = overrideAttachments ?? pendingAttachments;
    if ((!content && attachments.length === 0) || isLoading || !session) return;
    if (content.length > MAX_MESSAGE_CHARS) {
      setError(`That message is ${content.length.toLocaleString()} characters. Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString()}. Shorten it or attach it as a file.`);
      return;
    }

    setInputValue("");
    setPendingAttachments([]);
    setIsLoading(true);
    setStageMessage(null);
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
          ? { attachments: attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, usedAsContext: !!a.dataUrl || a.type === "application/pdf", size: a.size })) }
          : {},
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const payload = await streamChat({
        sessionId: session.id,
        content,
        isClarifyAnswer,
        attachments: attachments.length
          ? attachments.map((a) => ({ name: a.name, type: a.type, path: a.path, dataUrl: a.dataUrl, size: a.size }))
          : undefined,
        onStage: (stage) => setStageMessage(stage.message),
      });

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        payload.userMsg,
        payload.aiMsg,
      ]);

      // Memory was saved on its own while answering. Say so quietly and
      // refresh the stored list, nothing here waits for the user.
      if (payload.memorySaved.length > 0) {
        setMemoryToast(payload.memorySaved.map((m) => ({ key: m.key, action: m.action })));
        refreshMemories();
      }

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
      setStageMessage(null);
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

  // Stores the rating on the response itself, with the request it answered, its
  // score and the template version, so a person reviewing feedback later has the
  // full context and does not have to rebuild it from the chat.
  const handleFeedback = async (message: ChatMessage, rating: "up" | "down" | null) => {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1 || message.id.startsWith("temp-")) return;
    const request = [...messages.slice(0, index)].reverse().find((m) => m.role === "user")?.content ?? "";
    const metadata = { ...message.metadata };
    if (rating) {
      metadata.feedback = {
        rating,
        at: new Date().toISOString(),
        request: request.slice(0, 2000),
        score: message.metadata.score ?? null,
        templateVersion: message.metadata.templateVersion ?? null,
      };
    } else {
      delete metadata.feedback;
    }
    const previous = messages;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, metadata } : m)));
    const { error: updateError } = await supabase.from("messages").update({ metadata }).eq("id", message.id);
    if (updateError) {
      console.error("[chat page] feedback failed:", updateError);
      setMessages(previous);
      setError("Could not save your feedback. Try again.");
    }
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
      <DashboardHeader
        actions={
          <>
          <button
            onClick={() => togglePin(session.id)}
            className={`w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-raised ${
              pinnedIds.includes(session.id) ? "text-accent" : "text-text-muted hover:text-text-primary"
            }`}
            aria-label={pinnedIds.includes(session.id) ? "Unpin this chat" : "Pin this chat"}
            aria-pressed={pinnedIds.includes(session.id)}
          >
            {pinnedIds.includes(session.id) ? <PinOff size={18} className="md:w-[16px] md:h-[16px]" /> : <Pin size={18} className="md:w-[16px] md:h-[16px]" />}
          </button>
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
          </>
        }
      />

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
            const pendingQuestion =
              m.role === "assistant" &&
              (m.metadata.mode === "clarify" || m.metadata.mode === "answer") &&
              isLastMessage &&
              !isLoading
                ? m.metadata.interviewQuestions?.[0]
                : undefined;

            // A clarify turn renders as the interactive card alone. A direct
            // answer renders as a normal reply, with the question that is
            // still waiting shown beneath it.
            if (pendingQuestion && m.metadata.mode === "clarify") {
              return (
                <ClarifyInterview
                  key={m.id}
                  intro={m.metadata.intro}
                  question={pendingQuestion}
                  position={m.metadata.clarifyPosition ?? 1}
                  total={m.metadata.clarifyTotal ?? 1}
                  onAnswer={(answer) => handleSend(answer, undefined, true)}
                />
              );
            }

            return (
              <div key={m.id} className="flex flex-col gap-5">
                <MessageBubble
                  message={m}
                  onSave={m.role === "assistant" && m.metadata.mode === "ready" ? handleSaveMessage : undefined}
                  onRetry={
                    m.role === "assistant" && m.metadata.mode === "error"
                      ? () => {
                          const precedingUser = [...messages.slice(0, i)].reverse().find((p) => p.role === "user");
                          if (precedingUser) handleSend(precedingUser.content);
                        }
                      : undefined
                  }
                  onEdit={m.role === "user" ? handleEditMessage : undefined}
                  onFeedback={m.role === "assistant" && m.metadata.mode !== "error" && m.metadata.mode !== "clarify" ? handleFeedback : undefined}
                />
                {pendingQuestion && (
                  <ClarifyInterview
                    question={pendingQuestion}
                    position={m.metadata.clarifyPosition ?? 1}
                    total={m.metadata.clarifyTotal ?? 1}
                    onAnswer={(answer) => handleSend(answer, undefined, true)}
                  />
                )}
              </div>
            );
          })}
          {isLoading && <GenerationStatus message={stageMessage} />}
          <div ref={bottomRef} />
        </div>

        {pendingAttachments.length > 0 && (
          <div className="mx-4 sm:mx-6 mb-2 flex flex-wrap gap-2">
            {pendingAttachments.map((a) => (
              <AttachmentCard
                key={a.path || a.name}
                name={a.name}
                type={a.type}
                url={a.dataUrl ?? a.publicUrl}
                size={a.size}
                onRemove={() => setPendingAttachments((prev) => prev.filter((p) => p !== a))}
              />
            ))}
          </div>
        )}

        <MemoryToast items={memoryToast} onDismiss={() => setMemoryToast(null)} onManage={() => router.push("/settings?tab=memory")} />

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
