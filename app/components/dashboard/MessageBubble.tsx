"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ChevronDown, ChevronUp, BookmarkPlus, BookmarkCheck, Brain, X, CircleHelp, CircleCheck, AlertTriangle, RefreshCw, Pencil, FileText, Globe, ThumbsUp, ThumbsDown } from "lucide-react";
import type { ChatMessage } from "@/lib/types/chat";
import { formatMessageTimestamp } from "@/lib/utils";
import { Markdown } from "@/components/dashboard/Markdown";
import { copyText } from "@/lib/clipboard";
import { AttachmentCard } from "@/components/dashboard/AttachmentCard";
import { createClient } from "@/lib/supabase/client";

interface MessageBubbleProps {
  message: ChatMessage;
  onSave?: (message: ChatMessage) => void;
  onRetry?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  // Records a thumbs up or down on this response, or clears it with null.
  onFeedback?: (message: ChatMessage, rating: "up" | "down" | null) => void;
  // Opens the stated and inferred, pattern and memory details at first render. Used where the whole reply is on show, such as the marketing page.
  defaultExpanded?: boolean;
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

// Attachments are stored as "<bucket>/<object path>". Word documents are read
// but never stored, so they have no path and no link.
function attachmentUrl(path: string): string | null {
  if (!path) return null;
  const bucket = path.split("/")[0];
  const objectPath = path.slice(bucket.length + 1);
  if (!bucket || !objectPath) return null;
  return createClient().storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-400 border-green-400/30 bg-green-400/10"
    : score >= 55 ? "text-accent border-accent/30 bg-accent/10"
    : "text-red-400 border-red-400/30 bg-red-400/10";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 md:px-1.5 md:py-0.5 rounded border text-xs md:text-xs font-mono font-medium ${color}`}>
      ~{score}/100 estimate
    </span>
  );
}

export function ReadinessBadge({ status }: { status: "ready" | "needs_context" }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 md:px-1.5 md:py-0.5 rounded border border-green-400/30 bg-green-400/10 text-green-400 text-xs md:text-xs font-mono font-medium">
        <CircleCheck size={9} /> Ready to build
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 md:px-1.5 md:py-0.5 rounded border border-accent/30 bg-accent/10 text-accent text-xs md:text-xs font-mono font-medium">
      <CircleHelp size={9} /> Needs context
    </span>
  );
}

// What the user said, against what was found and what was filled in for them.
export function BreakdownPanel({ stated, researched, inferred }: { stated: string[]; researched: string[]; inferred: string[] }) {
  return (
    <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-2">
      {stated.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1">Stated</p>
          {stated.map((a, i) => (
            <p key={i} className="text-xs md:text-xs text-text-muted flex gap-2">
              <span className="text-green-400 shrink-0">·</span> {a}
            </p>
          ))}
        </div>
      )}
      {researched.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1">Found</p>
          {researched.map((a, i) => (
            <p key={i} className="text-xs md:text-xs text-text-muted flex gap-2">
              <span className="text-signal shrink-0">&middot;</span> {a}
            </p>
          ))}
        </div>
      )}
      {inferred.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1">Inferred</p>
          {inferred.map((a, i) => (
            <p key={i} className="text-xs md:text-xs text-text-muted flex gap-2">
              <span className="text-accent shrink-0">·</span> {a}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}


export function MessageBubble({ message, onSave, onRetry, onEdit, onFeedback, defaultExpanded = false }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showMeta, setShowMeta] = useState(defaultExpanded);
  const [showSources, setShowSources] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMemory, setShowMemory] = useState(defaultExpanded);
  const [showPatterns, setShowPatterns] = useState(defaultExpanded);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
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
  const memoryUsed = meta.memoryUsed ?? [];
  const patternsUsed = meta.patternsUsed ?? [];
  const memorySaved = meta.memorySaved ?? [];
  // A finished prompt is a deliverable, shown apart from the chat text around it.
  const isDeliverable = !isClarify && meta.mode !== "answer";
  const styleLabel = meta.formatStyle === "markdown" ? "markdown" : meta.formatStyle === "xml" ? "tagged sections" : "plain text";
  const hasBreakdown = statedItems.length > 0 || inferredItems.length > 0 || researchedItems.length > 0;
  const now = useNow();

  const handleCopy = async (text: string = message.content) => {
    if (!(await copyText(text))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (saved || !onSave) return;
    onSave(message);
    setSaved(true);
  };

  // Copies only the deliverable, never the conversational wrapper around it.
  const handleCopyPrompt = async () => {
    if (!(await copyText(message.content))) return;
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
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
                className="px-3 py-2.5 md:px-2.5 md:py-1 rounded-md text-xs text-text-faint hover:text-text-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={!draft.trim()}
                className="px-3 py-2.5 md:px-2.5 md:py-1 rounded-md bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors disabled:opacity-50"
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
        <div className="max-w-[88%] sm:max-w-[60%] group">
          <div className="rounded-2xl rounded-br-md bg-raised border border-border px-3 py-3">
            {/* Attachments belong to the bubble, so they sit inside it, above the text */}
            {(meta.attachments?.length ?? 0) > 0 && (
              <div className={`flex flex-wrap justify-end gap-2 ${message.content.trim() ? "mb-2.5" : ""}`}>
                {meta.attachments!.map((a, i) => {
                  const url = attachmentUrl(a.path);
                  return <AttachmentCard key={`${a.path || a.name}-${i}`} name={a.name} type={a.type} size={a.size} url={url} href={url} />;
                })}
              </div>
            )}
            {message.content.trim() && (
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap px-1">
                {message.content}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <div className="flex items-center gap-3 md:gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  onClick={() => { setDraft(message.content); setEditing(true); }}
                  className="p-3 -m-2.5 md:p-1.5 md:m-0 text-text-faint hover:text-text-muted transition-colors"
                  aria-label="Edit message"
                >
                  <Pencil size={16} className="md:!w-[14px] md:!h-[14px]" />
                </button>
              )}
              <button
                onClick={() => handleCopy()}
                className="p-3 -m-2.5 md:p-1.5 md:m-0 text-text-faint hover:text-text-muted transition-colors"
                aria-label="Copy message"
              >
                {copied ? <Check size={16} className="text-green-400 md:!w-[14px] md:!h-[14px]" /> : <Copy size={16} className="md:!w-[14px] md:!h-[14px]" />}
              </button>
            </div>
            <p className="text-xs md:text-xs text-text-faint font-mono">{formatMessageTimestamp(message.created_at, now)}</p>
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
        <div className="max-w-[92%] sm:max-w-[72%] min-w-0">
          <div className="rounded-2xl rounded-tl-md border border-red-400/30 bg-red-400/5 px-4 py-3">
            <p className="text-sm text-red-400 leading-relaxed">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="font-mono text-xs md:text-xs text-text-faint">Prompt AI, generation failed</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-xs md:text-xs font-medium text-accent hover:text-accent/80 transition-colors"
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
        <span className="font-mono text-xs md:text-xs text-signal">P</span>
      </div>

      <div className="max-w-[92%] sm:max-w-[72%] min-w-0">
        {/* The conversational wrapper, a normal chat bubble */}
        {isDeliverable && meta.preamble && (
          <div className="rounded-2xl rounded-tl-md bg-base border border-border px-4 py-3 mb-2">
            <div className="text-sm text-text-primary">
              <Markdown>{meta.preamble}</Markdown>
            </div>
          </div>
        )}

        {isDeliverable ? (
          /* The deliverable, visually distinct and independently copyable */
          <div className="rounded-xl border border-accent/25 bg-surface overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-accent/15 bg-accent/5">
              <p className="font-mono text-xs md:text-xs uppercase tracking-widest text-accent">
                Your prompt <span className="text-text-faint normal-case tracking-normal">, {styleLabel}</span>
              </p>
              <button
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 md:px-2 md:py-1 rounded-md border border-border bg-raised text-xs md:text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
                aria-label="Copy prompt"
              >
                {copiedPrompt ? <Check size={16} className="text-green-400 md:!w-[14px] md:!h-[14px]" /> : <Copy size={16} className="md:!w-[14px] md:!h-[14px]" />}
                {copiedPrompt ? "Copied" : "Copy prompt"}
              </button>
            </div>
            <div className="px-4 py-3 text-sm text-text-primary">
              <Markdown>{message.content}</Markdown>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-md bg-base border border-border px-4 py-3">
            <div className="text-sm text-text-primary">
              <Markdown>{message.content}</Markdown>
            </div>
          </div>
        )}

        {/* Explanation, ready mode only */}
        {!isClarify && meta.explanation && (
          <p className="text-[13px] md:text-[13px] text-text-muted italic mt-1.5 px-0.5 leading-relaxed">
            {meta.explanation}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <p className="font-mono text-xs md:text-xs text-text-faint">Prompt AI</p>
          <p className="font-mono text-xs md:text-xs text-text-faint">{formatMessageTimestamp(message.created_at, now)}</p>

          {!isClarify && meta.readiness?.status && <ReadinessBadge status={meta.readiness.status} />}
          {!isClarify && meta.score !== undefined && <ScoreBadge score={meta.score} />}

          {/* Copy */}
          <button
            onClick={() => handleCopy()}
            className="p-3 -m-2.5 md:p-1.5 md:m-0 text-text-faint hover:text-text-muted transition-colors"
            aria-label="Copy response"
          >
            {copied ? <Check size={16} className="text-green-400 md:!w-[14px] md:!h-[14px]" /> : <Copy size={16} className="md:!w-[14px] md:!h-[14px]" />}
          </button>

          {/* Save to library, ready mode only */}
          {!isClarify && onSave && (
            <button
              onClick={handleSave}
              disabled={saved}
              className={`p-3 -m-2.5 md:p-1.5 md:m-0 transition-colors ${saved ? "text-accent" : "text-text-faint hover:text-text-muted"}`}
              aria-label={saved ? "Saved to library" : "Save to library"}
            >
              {saved ? <BookmarkCheck size={16} className="md:!w-[14px] md:!h-[14px]" /> : <BookmarkPlus size={16} className="md:!w-[14px] md:!h-[14px]" />}
            </button>
          )}

          {/* Feedback on this response, stored with the request and score it was given on */}
          {onFeedback && !isClarify && (
            <span className="inline-flex items-center gap-0.5" role="group" aria-label="Rate this response">
              <button
                onClick={() => onFeedback(message, meta.feedback?.rating === "up" ? null : "up")}
                aria-pressed={meta.feedback?.rating === "up"}
                aria-label="Helpful"
                title="Helpful"
                className={`p-3 -m-2.5 md:p-1.5 md:m-0 transition-colors ${meta.feedback?.rating === "up" ? "text-green-400" : "text-text-faint hover:text-green-400"}`}
              >
                <ThumbsUp size={16} className="md:!w-[14px] md:!h-[14px]" fill={meta.feedback?.rating === "up" ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => onFeedback(message, meta.feedback?.rating === "down" ? null : "down")}
                aria-pressed={meta.feedback?.rating === "down"}
                aria-label="Not helpful"
                title="Not helpful"
                className={`p-3 -m-2.5 md:p-1.5 md:m-0 transition-colors ${meta.feedback?.rating === "down" ? "text-red-400" : "text-text-faint hover:text-red-400"}`}
              >
                <ThumbsDown size={16} className="md:!w-[14px] md:!h-[14px]" fill={meta.feedback?.rating === "down" ? "currentColor" : "none"} />
              </button>
            </span>
          )}

          {/* Toggle the stated versus inferred breakdown */}
          {hasBreakdown && (
            <button
              onClick={() => setShowMeta((v) => !v)}
              className="flex items-center gap-1 py-3 -my-2.5 md:py-0 md:my-0 text-xs md:text-xs font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showMeta ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {statedItems.length} stated, {researchedItems.length > 0 ? `${researchedItems.length} found, ` : ""}{inferredItems.length} inferred
            </button>
          )}

          {/* What was read from attached files or searched for */}
          {sources.length > 0 && (
            <button
              onClick={() => setShowSources((v) => !v)}
              className="flex items-center gap-1 py-3 -my-2.5 md:py-0 md:my-0 text-xs md:text-xs font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showSources ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {sources.length} source{sources.length > 1 ? "s" : ""}
            </button>
          )}

          {/* Which known effective patterns informed how this prompt was built */}
          {patternsUsed.length > 0 && (
            <button
              onClick={() => setShowPatterns((v) => !v)}
              className="flex items-center gap-1 py-3 -my-2.5 md:py-0 md:my-0 text-xs md:text-xs font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showPatterns ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {patternsUsed.length} pattern{patternsUsed.length > 1 ? "s" : ""}
            </button>
          )}

          {/* Which stored details informed this reply */}
          {memoryUsed.length > 0 && (
            <button
              onClick={() => setShowMemory((v) => !v)}
              className="flex items-center gap-1 py-3 -my-2.5 md:py-0 md:my-0 text-xs md:text-xs font-mono text-text-faint hover:text-text-muted transition-colors"
            >
              {showMemory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              <Brain size={9} /> used {memoryUsed.length} from memory
            </button>
          )}
        </div>

        {/* What the user said, against what was filled in for them */}
        {showMeta && hasBreakdown && (
          <BreakdownPanel stated={statedItems} researched={researchedItems} inferred={inferredItems} />
        )}

        {/* Where the researched parts of this prompt came from */}
        {showSources && sources.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-2.5">
            {sources.map((src, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-xs md:text-xs text-text-primary font-medium flex items-center gap-1.5">
                  {src.kind === "attachment" ? <FileText size={10} className="text-text-faint shrink-0" /> : <Globe size={10} className="text-text-faint shrink-0" />}
                  <span className="truncate">{src.kind === "attachment" ? `Read ${src.label}` : `Searched: ${src.label}`}</span>
                </p>
                {src.summary && <p className="text-xs md:text-xs text-text-muted leading-relaxed pl-4">{src.summary}</p>}
                {src.links && src.links.length > 0 && (
                  <div className="pl-4 flex flex-wrap gap-x-3 gap-y-0.5">
                    {src.links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs md:text-xs text-accent underline underline-offset-2 truncate max-w-[220px]">
                        {l.title || l.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showPatterns && patternsUsed.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-1">
            <p className="text-xs md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1">Known effective patterns used</p>
            {patternsUsed.map((name) => (
              <p key={name} className="text-xs md:text-xs text-text-muted flex gap-2">
                <span className="text-accent shrink-0">&middot;</span> {name}
              </p>
            ))}
            <p className="text-xs md:text-xs text-text-faint pt-1">Guidance for this kind of task, adapted to your request.</p>
          </div>
        )}

        {/* The stored details this reply drew on */}
        {showMemory && memoryUsed.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-lg border border-border bg-raised/50 space-y-1">
            <p className="text-xs md:text-xs font-mono uppercase tracking-wider text-text-faint mb-1">From your memory</p>
            {memoryUsed.map((m, i) => (
              <p key={i} className="text-xs md:text-xs text-text-muted">
                <span className="text-text-primary font-medium">{m.key}:</span> {m.value}
              </p>
            ))}
          </div>
        )}

        {/* Saved automatically, reported quietly, nothing to approve */}
        {memorySaved.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs md:text-xs text-text-faint">
            <Brain size={10} className="text-accent shrink-0" />
            <span>
              {memorySaved.some((m) => m.action === "updated") && memorySaved.every((m) => m.action === "updated") ? "Updated in memory" : "Saved to memory"}: {memorySaved.map((m) => m.key).join(", ")}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
