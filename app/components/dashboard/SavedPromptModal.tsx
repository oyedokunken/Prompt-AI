"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageSquare } from "lucide-react";
import { Modal } from "@/components/Modal";
import { copyText } from "@/lib/clipboard";
import { Markdown } from "@/components/dashboard/Markdown";
import type { SavedPrompt } from "@/lib/types/chat";

interface SavedPromptModalProps {
  prompt: SavedPrompt | null;
  onClose: () => void;
}

// Opens a saved prompt in full. The point of saving a prompt is to get it
// back out, so the whole content, a copy action and a way back to the chat
// it came from are all here.
export function SavedPromptModal({ prompt, onClose }: SavedPromptModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!prompt) return;
    if (!(await copyText(prompt.content))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inferred = prompt?.assumptions ?? [];

  return (
    <Modal
      open={!!prompt}
      onClose={onClose}
      title={prompt?.title ?? ""}
      subtitle={
        prompt
          ? `Saved ${new Date(prompt.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}${prompt.score !== null ? `, completeness ${prompt.score}/100` : ""}`
          : undefined
      }
      wide
      footer={
        <>
          {prompt?.session_id && (
            <Link
              href={`/dashboard/chats/${prompt.session_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-primary hover:border-accent/30 transition-colors"
            >
              <MessageSquare size={12} /> Go to chat
            </Link>
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </>
      }
    >
      {prompt && (
        <div className="space-y-4">
          <div className="rounded-lg border border-accent/25 bg-base px-4 py-3 text-sm text-text-primary">
            <Markdown>{prompt.content}</Markdown>
          </div>
          {inferred.length > 0 && (
            <div>
              <p className="text-[9px] font-mono uppercase tracking-wider text-text-faint mb-1.5">Inferred when this was built</p>
              <ul className="space-y-1">
                {inferred.map((a, i) => (
                  <li key={i} className="text-[11px] text-text-muted flex gap-2">
                    <span className="text-accent shrink-0">&middot;</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
