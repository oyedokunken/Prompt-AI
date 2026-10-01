"use client";

import { useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";
import { ConversationModal } from "@/components/dashboard/ConversationModal";
import type { ChatSession } from "@/lib/types/chat";

export default function HistoryPage() {
  const { sessions } = useDashboard();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ChatSession | null>(null);

  const filtered = sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="All history" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">All history</h1>
          <p className="text-sm text-text-muted mb-4">Every conversation, most recent first.</p>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface mb-4">
            <Search size={13} className="text-text-faint shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your chats..."
              className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
            />
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-primary font-medium">No chats yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sorted.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:border-accent/30 transition-colors"
                >
                  <MessageSquare size={14} className="text-text-faint shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{s.title}</p>
                    <p className="text-xs text-text-faint font-mono mt-0.5">
                      {new Date(s.updated_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
      <ConversationModal session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
