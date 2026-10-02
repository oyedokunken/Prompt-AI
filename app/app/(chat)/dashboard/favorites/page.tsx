"use client";

import Link from "next/link";
import { MessageSquare, BookOpen, Star } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";

export default function FavoritesPage() {
  const { sessions, savedPrompts, toggleSavedFavorite } = useDashboard();
  const favSessions = sessions.filter((s) => s.is_favorite);
  const favPrompts = savedPrompts.filter((p) => p.is_favorite);

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Favorites" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Favorites</h1>
          <p className="text-sm text-text-muted mb-6">Chats and saved prompts you starred.</p>

          {favSessions.length === 0 && favPrompts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <Star size={18} className="text-text-faint mx-auto mb-2" />
              <p className="text-sm text-text-primary font-medium">Nothing starred yet</p>
              <p className="text-xs text-text-muted mt-1">Star a chat or a saved prompt to see it here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {favSessions.length > 0 && (
                <div>
                  <p className="font-mono text-xs md:text-xs uppercase tracking-widest text-text-faint mb-2">Chats</p>
                  <div className="space-y-2">
                    {favSessions.map((s) => (
                      <Link
                        key={s.id}
                        href={`/dashboard/chats/${s.id}`}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:border-accent/30 transition-colors"
                      >
                        <MessageSquare size={14} className="text-text-faint shrink-0" />
                        <span className="text-sm text-text-primary truncate flex-1">{s.title}</span>
                        <Star size={13} className="text-accent shrink-0" fill="currentColor" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {favPrompts.length > 0 && (
                <div>
                  <p className="font-mono text-xs md:text-xs uppercase tracking-widest text-text-faint mb-2">Saved prompts</p>
                  <div className="space-y-2">
                    {favPrompts.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface">
                        <BookOpen size={14} className="text-text-faint shrink-0" />
                        <span className="text-sm text-text-primary truncate flex-1">{p.title}</span>
                        <button
                          onClick={() => toggleSavedFavorite(p.id, false)}
                          className="text-accent shrink-0"
                          aria-label="Remove from favorites"
                        >
                          <Star size={13} fill="currentColor" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
