"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, BookmarkPlus, BookmarkCheck, Brain, X, CircleHelp, CircleCheck, AlertTriangle, RefreshCw } from "lucide-react";
import type { ChatMessage, MemoryCandidate } from "@/lib/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  onSave?: (message: ChatMessage) => void;
  onSaveMemories?: (candidates: MemoryCandidate[]) => void;
  onRetry?: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-400 border-green-400/30 bg-green-400/10"
    : score >= 55 ? "text-accent border-accent/30 bg-accent/10"
    : "text-red-400 border-red-400/30 bg-red-400/10";

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium ${color}`}>
      ~{score}/100 estimate
    </span>
  );
}

function ReadinessBadge({ status }: { status: "ready" | "needs_context" }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-green-400/30 bg-green-400/10 text-green-400 text-[9px] font-mono font-medium">
        <CircleCheck size={9} /> Ready to build
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent text-[9px] font-mono font-medium">
      <CircleHelp size={9} /> Needs context
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
      <p key={i} className={`${line.startsWith("-") || /^\d+\./.test(line.trim()) ? "ml-1" : ""} leading-relaxed`}>
        {rendered}
      </p>
    );
  });
}

export function MessageBubble({ message, onSave, onSaveMemories, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [saved, setSaved] = useState(false);
  const [memoryHandled, setMemoryHandled] = useState(false);
  const isUser = message.role === "user";
  const meta = message.metadata;
  const isClarify = meta.mode === "clarify";
  const isError = meta.mode === "error";

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

  const handleSaveMemories = () => {
    if (!meta.memoryCandidates?.length || !onSaveMemories) return;
    onSaveMemories(meta.memoryCandidates);
    setMemoryHandled(true);
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

  // Generation genuinely failed: a distinct, honest error state, never a
  // chat bubble dressed up to look like a real answer.
  if (isError) {
    return (
      <div className="flex gap-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-red-400/30 bg-red-400/10">
          <AlertTriangle size={12} className="text-red-400" />
        </div>
        <div className="max-w-[85%] sm:max-w-[72%] min-w-0">
          <div className="rounded-2xl rounded-tl-md border border-red-400/30 bg-red-400/5 px-4 py-3">
            <p className="text-sm text-red-400 leading-relaxed">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="font-mono text-[10px] text-text-faint">Prompt AI, generation failed</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent/80 transition-colors"
              >
                <RefreshCw size={10} /> Try again
              </button>
            )}
          </div>
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

        {/* Explanation, ready mode only */}
        {!isClarify && meta.explanation && (
          <p className="text-[11px] text-text-muted italic mt-1.5 px-0.5 leading-relaxed">
            {meta.explanation}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <p className="font-mono text-[10px] text-text-faint">Prompt AI</p>

          {!isClarify && meta.readiness?.status && <ReadinessBadge status={meta.readiness.status} />}
          {!isClarify && meta.score !== undefined && <ScoreBadge score={meta.score} />}

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Copy response"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          </button>

          {/* Save to library, ready mode only */}
          {!isClarify && onSave && (
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

        {/* Memory candidates, offered for explicit user approval, never saved silently */}
        {!memoryHandled && meta.memoryCandidates && meta.memoryCandidates.length > 0 && (
          <div className="mt-2 px-3 py-2.5 rounded-lg border border-accent/20 bg-accent/5 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-accent flex items-center gap-1.5">
              <Brain size={10} /> Worth remembering?
            </p>
            <div className="space-y-1">
              {meta.memoryCandidates.map((c, i) => (
                <p key={i} className="text-[11px] text-text-muted">
                  <span className="text-text-primary font-medium">{c.key}:</span> {c.value}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={handleSaveMemories}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-fill text-accent-fill-foreground text-[10px] font-semibold hover:bg-accent-fill/90 transition-colors"
              >
                <BookmarkPlus size={10} /> Save to memory
              </button>
              <button
                onClick={() => setMemoryHandled(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-text-faint hover:text-text-muted transition-colors"
              >
                <X size={10} /> Not now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
