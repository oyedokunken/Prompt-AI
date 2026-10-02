"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { ChatInput, type ChatInputHandle } from "@/components/dashboard/ChatInput";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { uploadAttachment, type UploadedAttachment } from "@/lib/attachments";
import { MODELS, MAX_FILES_PER_MESSAGE, MAX_ATTACHMENT_BYTES_PER_CONVERSATION } from "@/lib/types/chat";

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onStarter(s)}
            className="text-left px-4 py-3.5 md:px-4 md:py-3 rounded-lg border border-border bg-raised hover:border-accent/30 hover:bg-raised/80 transition-colors text-[13px] md:text-[13px] text-text-muted"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// The default chat welcome view. Sending the first message here creates
// the real session, hands it and the message off to the new per-chat
// route via context, and navigates there immediately, the chat page
// itself is what actually sends it and shows the response.
export default function DashboardWelcomePage() {
  const router = useRouter();
  const { profile, createSession, setPendingFirstMessage, error, setError } = useDashboard();
  const chatInputRef = useRef<ChatInputHandle>(null);

  const [inputValue, setInputValue] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedModel, setSelectedModel] = useState<(typeof MODELS)[number]>(MODELS[0]);
  const [isStarting, setIsStarting] = useState(false);

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

  const handleSend = async (override?: string) => {
    const content = (override ?? inputValue).trim();
    if ((!content && pendingAttachments.length === 0) || isStarting) return;

    setIsStarting(true);
    setError(null);
    const session = await createSession(selectedModel.id);
    if (!session) {
      setIsStarting(false);
      return;
    }

    setPendingFirstMessage({ sessionId: session.id, content, attachments: pendingAttachments });
    router.push(`/dashboard/chats/${session.id}`);
  };

  const handleStarterClick = (text: string) => {
    setInputValue(text);
    requestAnimationFrame(() => chatInputRef.current?.focus());
  };

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <DashboardHeader />

      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-red-400/30 bg-red-400/10 text-xs text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-5 flex flex-col">
          <EmptyState onStarter={handleStarterClick} name={profile?.preferredName ?? undefined} />
        </div>

        <ChatInput
          ref={chatInputRef}
          value={inputValue}
          onChange={setInputValue}
          onSend={() => handleSend()}
          onAttach={handleAttach}
          disabled={isStarting}
          model={selectedModel}
          onModelChange={setSelectedModel}
        />
      </main>
    </div>
  );
}
