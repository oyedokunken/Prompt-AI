"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, BookmarkPlus, BookmarkCheck } from "lucide-react";
import type { ChatMessage } from "@/lib/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  onSave?: (message: ChatMessage) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-400 border-green-400/30 bg-green-400/10"
    : score >= 55 ? "text-accent border-accent/30 bg-accent/10"
    : "text-red-400 border-red-400/30 bg-red-400/10";

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium ${color}`}>
      {score}/100
    </span>
  );
}

function formatContent(raw: string) {
  // Very lightweight markdown-ish rendering for the structured prompt output
  return raw.split("\n").map((line, i) => {
    const isSeparator = line.trim() === "---";
    if (isSeparator) return <hr key={i} className="border-border my-2" />;

    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={j} className="text-text-primary font-semibold">
          {p.slice(2, -2)}
        </strong>
      ) : (
        p
      )
    );

    return (
      <p key={i} className={`${line.startsWith("-") ? "ml-3" : ""} leading-relaxed`}>
        {rendered}
      </p>
    );
  });
}

export function MessageBubble({ message, onSave }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [saved, setSaved] = useState(false);
  const isUser = message.role === "user";
  const meta = message.metadata;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (saved || !onSave) return;
    onSave(message);
    setSaved(true);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] sm:max-w-[60%]">
          <div className="rounded-2xl rounded-br-md bg-raised border border-border px-4 py-2.5">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
          <p className="text-[10px] text-text-faint mt-1 font-mono text-right">You</p>
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-signal/30 bg-signal/10">
        <span className="font-mono text-[10px] text-signal">P</span>
      </div>

      <div className="max-w-[85%] sm:max-w-[72%] min-w-0">
        {/* Bubble */}
        <div className="rounded-2xl rounded-tl-md bg-base border border-border px-4 py-3">
          <div className="text-sm text-text-primary space-y-1">
            {formatContent(message.content)}
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <p className="font-mono text-[10px] text-text-faint">Prompt AI</p>

          {meta.score !== undefined && <ScoreBadge score={meta.score} />}

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Copy response"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          </button>

          {/* Save to library */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saved}
              className={`p-0.5 transition-colors ${saved ? "text-accent" : "text-text-faint hover:text-text-muted"}`}
              aria-label={saved ? "Saved to library" : "Save to library"}
            >
              {saved ? <BookmarkCheck size={11} /> : <BookmarkPlus size={11} />}
            </button>
          )}

          {/* Toggle assumptions */}
          {meta.assumptions && meta.assumptions.length > 0 && (
            <button
              onClick={() => setShowMeta((v) => !v)}
              className="flex items-center gap-1 text-[9px] font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showMeta ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {meta.assumptions.length} assumption{meta.assumptions.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Expanded assumptions */}
        {showMeta && meta.assumptions && meta.assumptions.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-text-faint mb-1">
              Inferred
            </p>
            {meta.assumptions.map((a, i) => (
              <p key={i} className="text-[10px] text-text-muted flex gap-2">
                <span className="text-accent shrink-0">·</span> {a}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
