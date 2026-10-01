"use client";

import { useState } from "react";
import { BookOpen, Check, Copy, Star, Trash2 } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";
import { SavedPromptModal } from "@/components/dashboard/SavedPromptModal";
import type { SavedPrompt } from "@/lib/types/chat";

export default function SavedPromptsPage() {
  const { savedPrompts, toggleSavedFavorite, requestDeleteSavedPrompt } = useDashboard();
  const [selected, setSelected] = useState<SavedPrompt | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyQuick = async (p: SavedPrompt) => {
    await navigator.clipboard.writeText(p.content);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Saved prompts" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Saved prompts</h1>
          <p className="text-sm text-text-muted mb-4">
            Responses you saved from a chat. Save one from any response's bookmark icon.
          </p>

          {savedPrompts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <BookOpen size={18} className="text-text-faint mx-auto mb-2" />
              <p className="text-sm text-text-primary font-medium">No saved prompts yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedPrompts.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(p);
                    }
                  }}
                  className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-surface cursor-pointer hover:border-accent/30 transition-colors"
                >
                  <BookOpen size={14} className="shrink-0 mt-0.5 text-text-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{p.title}</p>
                    <p className="text-xs text-text-faint font-mono mt-0.5">
                      {new Date(p.created_at).toLocaleDateString()}
                      {p.score !== null ? `, ${p.score}/100` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyQuick(p); }}
                      className="p-1.5 text-text-faint hover:text-text-muted transition-colors"
                      aria-label="Copy prompt"
                    >
                      {copiedId === p.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSavedFavorite(p.id, !p.is_favorite); }}
                      className={`p-1.5 transition-colors ${p.is_favorite ? "text-accent" : "text-text-faint hover:text-accent"}`}
                      aria-label={p.is_favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star size={13} fill={p.is_favorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDeleteSavedPrompt(p.id); }}
                      className="p-1.5 text-text-faint hover:text-red-400 transition-colors"
                      aria-label="Delete saved prompt"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <SavedPromptModal prompt={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
