"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { fetchMemorySummary } from "@/lib/api/chatApi";
import type { UserMemory } from "@/lib/types/chat";

const CACHE_KEY = "promptai.memorySummary";

// Cheap, stable fingerprint of what is stored, so the summary is only written
// again when the stored details actually change.
function fingerprint(memories: UserMemory[]): string {
  const text = memories
    .map((m) => `${m.category}|${m.key}|${m.value}`)
    .sort()
    .join("\n");
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${memories.length}:${hash}`;
}

function readCache(): { hash: string; text: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as { hash: string; text: string }) : null;
  } catch {
    return null;
  }
}

function writeCache(hash: string, text: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ hash, text }));
  } catch {
    // Storage can be blocked. The summary still shows, it is just written again next time.
  }
}

// A short, natural description of what is stored, written from the same
// stored details the rest of the product uses. It reads as a few sentences
// about the person, not as a list.
export function MemorySummary({ memories }: { memories: UserMemory[] }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const hash = fingerprint(memories);

  const write = useCallback(
    async (force: boolean) => {
      if (!force) {
        const cached = readCache();
        if (cached && cached.hash === hash) {
          setText(cached.text);
          return;
        }
      }
      setLoading(true);
      setFailed(false);
      try {
        const summary = await fetchMemorySummary();
        if (!summary) throw new Error("empty summary");
        setText(summary);
        writeCache(hash, summary);
      } catch (err) {
        console.error("[memory summary] failed:", err);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [hash]
  );

  useEffect(() => {
    write(false);
  }, [write]);

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-accent flex items-center gap-1.5">
          <Brain size={11} /> What Prompt AI knows about you
        </p>
        <button
          onClick={() => write(true)}
          disabled={loading}
          className="p-1 rounded-md text-text-faint hover:text-text-muted transition-colors disabled:opacity-40"
          aria-label="Write this again"
          title="Write this again"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && !text && (
        <p className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" /> Putting it into words
        </p>
      )}
      {text && <p className="text-sm text-text-primary leading-relaxed">{text}</p>}
      {failed && (
        <p className="text-xs text-red-400">
          Could not write the summary just now. Your details are listed below, and you can try again with the refresh icon.
        </p>
      )}
    </div>
  );
}
