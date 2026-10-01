"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, ChevronUp, BookmarkPlus, BookmarkCheck, Brain, X, CircleHelp, CircleCheck, AlertTriangle, RefreshCw, Pencil, FileText, Globe } from "lucide-react";
import type { ChatMessage, MemoryCandidate } from "@/lib/types/chat";
import { formatMessageTimestamp } from "@/lib/utils";
import { Markdown } from "@/components/dashboard/Markdown";

interface MessageBubbleProps {
  message: ChatMessage;
  onSave?: (message: ChatMessage) => void;
  onSaveMemories?: (candidates: MemoryCandidate[]) => void;
  onRetry?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
}

// Re-renders every minute so a timestamp actually flips from "Today at..."
// to a full date if a chat stays open across midnight, instead of freezing
// whatever was true when the message first rendered.
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
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

export function MessageBubble({ message, onSave, onSaveMemories, onRetry, onEdit }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [saved, setSaved] = useState(false);
  const [memoryHandled, setMemoryHandled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const isUser = message.role === "user";
  const meta = message.metadata;
  const isClarify = meta.mode === "clarify";
  const isError = meta.mode === "error";
  const statedItems = meta.diff?.stated ?? [];
  const inferredItems = meta.diff?.inferred ?? meta.assumptions ?? [];
  const researchedItems = meta.diff?.researched ?? [];
  const sources = meta.sources ?? [];
  const hasBreakdown = statedItems.length > 0 || inferredItems.length > 0 || researchedItems.length > 0;
  const now = useNow();

  const handleCopy = async (text: string = message.content) => {
    await navigator.clipboard.writeText(text);
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

  const handleEditSave = () => {
    const trimmed = draft.trim();
    if (!trimmed || !onEdit) return;
    onEdit(message.id, trimmed);
    setEditing(false);
  };

  if (isUser) {
    if (editing) {
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] sm:max-w-[70%] w-full flex flex-col gap-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              className="w-full px-4 py-2.5 rounded-2xl rounded-br-md bg-raised border border-accent/40 text-sm text-text-primary leading-relaxed resize-none outline-none focus:border-accent/60"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setEditing(false); setDraft(message.content); }}
                className="px-2.5 py-1 rounded-md text-xs text-text-faint hover:text-text-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!draft.trim()}
                className="px-2.5 py-1 rounded-md bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors disabled:opacity-50"
              >
                Save and resend
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] sm:max-w-[60%] group">
          <div className="rounded-2xl rounded-br-md bg-raised border border-border px-4 py-2.5">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  onClick={() => { setDraft(message.content); setEditing(true); }}
                  className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
                  aria-label="Edit message"
                >
                  <Pencil size={10} />
                </button>
              )}
              <button
                onClick={() => handleCopy()}
                className="p-0.5 text-text-faint hover:text-text-muted transition-colors"
                aria-label="Copy message"
              >
                {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              </button>
            </div>
            <p className="text-[10px] text-text-faint font-mono">{formatMessageTimestamp(message.created_at, now)}</p>
          </div>
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
          <div className="text-sm text-text-primary">
            <Markdown>{message.content}</Markdown>
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
          <p className="font-mono text-[9px] text-text-faint">{formatMessageTimestamp(message.created_at, now)}</p>

          {!isClarify && meta.readiness?.status && <ReadinessBadge status={meta.readiness.status} />}
          {!isClarify && meta.score !== undefined && <ScoreBadge score={meta.score} />}

          {/* Copy */}
          <button
            onClick={() => handleCopy()}
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

          {/* Toggle the stated versus inferred breakdown */}
          {hasBreakdown && (
            <button
              onClick={() => setShowMeta((v) => !v)}
              className="flex items-center gap-1 text-[9px] font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showMeta ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {statedItems.length} stated, {researchedItems.length > 0 ? `${researchedItems.length} found, ` : ""}{inferredItems.length} inferred
            </button>
          )}

          {/* What was read from attached files or searched for */}
          {sources.length > 0 && (
            <button
              onClick={() => setShowSources((v) => !v)}
              className="flex items-center gap-1 text-[9px] font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showSources ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {sources.length} source{sources.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* What the user said, against what was filled in for them */}
        {showMeta && hasBreakdown && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-2">
            {statedItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-mono uppercase tracking-wider text-text-faint mb-1">Stated</p>
                {statedItems.map((a, i) => (
                  <p key={i} className="text-[10px] text-text-muted flex gap-2">
                    <span className="text-green-400 shrink-0">·</span> {a}
                  </p>
                ))}
              </div>
            )}
            {researchedItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-mono uppercase tracking-wider text-text-faint mb-1">Found</p>
                {researchedItems.map((a, i) => (
                  <p key={i} className="text-[10px] text-text-muted flex gap-2">
                    <span className="text-signal shrink-0">&middot;</span> {a}
                  </p>
                ))}
              </div>
            )}
            {inferredItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-mono uppercase tracking-wider text-text-faint mb-1">Inferred</p>
                {inferredItems.map((a, i) => (
                  <p key={i} className="text-[10px] text-text-muted flex gap-2">
                    <span className="text-accent shrink-0">·</span> {a}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Where the researched parts of this prompt came from */}
        {showSources && sources.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-2.5">
            {sources.map((src, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-[10px] text-text-primary font-medium flex items-center gap-1.5">
                  {src.kind === "attachment" ? <FileText size={10} className="text-text-faint shrink-0" /> : <Globe size={10} className="text-text-faint shrink-0" />}
                  <span className="truncate">{src.kind === "attachment" ? `Read ${src.label}` : `Searched: ${src.label}`}</span>
                </p>
                {src.summary && <p className="text-[10px] text-text-muted leading-relaxed pl-4">{src.summary}</p>}
                {src.links && src.links.length > 0 && (
                  <div className="pl-4 flex flex-wrap gap-x-3 gap-y-0.5">
                    {src.links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent underline underline-offset-2 truncate max-w-[220px]">
                        {l.title || l.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
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
