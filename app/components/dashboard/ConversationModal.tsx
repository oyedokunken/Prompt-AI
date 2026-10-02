"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { summarizeConversation, type ConversationSummary } from "@/lib/conversationSummary";
import type { ChatMessage, ChatSession } from "@/lib/types/chat";

interface ConversationModalProps {
  session: ChatSession | null;
  onClose: () => void;
}

// A summary of a conversation, opened from the history list so a chat can be
// reviewed without being dropped into it. "Go to chat" is the deliberate way
// to open the full conversation.
export function ConversationModal({ session, onClose }: ConversationModalProps) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setSummary(null);
    setFailed(false);
    setLoading(true);
    createClient()
      .from("messages")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[conversation modal] load failed:", error);
          setFailed(true);
        } else {
          setSummary(summarizeConversation((data as ChatMessage[]) ?? []));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <Modal
      open={!!session}
      onClose={onClose}
      title={session?.title ?? ""}
      subtitle={
        session
          ? `Last active ${new Date(session.updated_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
          : undefined
      }
      footer={
        session && (
          <Link
            href={`/dashboard/chats/${session.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
          >
            <MessageSquare size={12} /> Go to chat
          </Link>
        )
      }
    >
      {loading && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={13} className="animate-spin" /> Reading the conversation
        </div>
      )}
      {failed && <p className="text-xs text-red-400">Could not load this conversation. You can still open it.</p>}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Messages", value: summary.messageCount },
              { label: "Prompts", value: summary.promptsGenerated },
              { label: "Avg score", value: summary.averageScore ?? "none" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-base px-3 py-2">
                <p className="text-base font-semibold text-text-primary">{s.value}</p>
                <p className="text-[11px] md:text-xs font-mono uppercase tracking-wider text-text-faint">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-text-muted leading-relaxed">{summary.overview}</p>

          <div>
            <p className="text-[11px] md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1.5">What Prompt AI gathered</p>
            {summary.learned.length === 0 ? (
              <p className="text-xs text-text-faint">Nothing beyond the conversation itself.</p>
            ) : (
              <ul className="space-y-1">
                {summary.learned.map((line, i) => (
                  <li key={i} className="text-xs text-text-muted flex gap-2">
                    <span className="text-accent shrink-0">&middot;</span> {line}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-[11px] md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1.5">Feedback you gave</p>
            {summary.feedback.length === 0 ? (
              <p className="text-xs text-text-faint">No feedback recorded on this conversation.</p>
            ) : (
              <ul className="space-y-2">
                {summary.feedback.map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs text-text-muted">
                    {f.rating === "up" ? (
                      <ThumbsUp size={12} className="text-green-400 shrink-0 mt-0.5" />
                    ) : (
                      <ThumbsDown size={12} className="text-red-400 shrink-0 mt-0.5" />
                    )}
                    <span>
                      <span className="text-text-primary">{f.request || "A response"}</span>
                      <span className="block text-text-faint">{f.preview}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
