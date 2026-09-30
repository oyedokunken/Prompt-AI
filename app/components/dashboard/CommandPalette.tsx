"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, Settings, LogOut, Search, Star, BookOpen } from "lucide-react";
import type { ChatSession } from "@/lib/types/chat";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  onSelectSession: (s: ChatSession) => void;
  onNewChat: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  onOpenSaved: () => void;
  onOpenFavorites: () => void;
}

interface Action {
  id: string;
  icon: React.ElementType;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({
  open, onClose, sessions, onSelectSession, onNewChat, onSettings, onSignOut, onOpenSaved, onOpenFavorites,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const staticActions: Action[] = useMemo(
    () => [
      { id: "new-chat", icon: Plus, label: "New chat", run: onNewChat },
      { id: "saved", icon: BookOpen, label: "Saved prompts", run: onOpenSaved },
      { id: "favorites", icon: Star, label: "Favorites", run: onOpenFavorites },
      { id: "settings", icon: Settings, label: "Settings", run: onSettings },
      { id: "sign-out", icon: LogOut, label: "Sign out", run: onSignOut },
    ],
    [onNewChat, onOpenSaved, onOpenFavorites, onSettings, onSignOut]
  );

  const sessionActions: Action[] = useMemo(
    () =>
      sessions.map((s) => ({
        id: `session-${s.id}`,
        icon: MessageSquare,
        label: s.title,
        hint: "Chat",
        run: () => onSelectSession(s),
      })),
    [sessions, onSelectSession]
  );

  const allActions = [...staticActions, ...sessionActions];
  const filtered = query.trim()
    ? allActions.filter((a) => a.label.toLowerCase().includes(query.trim().toLowerCase()))
    : allActions;

  const runAndClose = (action: Action) => {
    action.run();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) runAndClose(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg mx-4"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border">
                <Search size={14} className="text-text-faint shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search chats or jump to an action..."
                  className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
                />
                <kbd className="hidden sm:inline text-[10px] font-mono text-text-faint border border-border rounded px-1.5 py-0.5">
                  Esc
                </kbd>
              </div>

              <div className="max-h-80 overflow-y-auto scrollbar-hide py-1.5">
                {filtered.length === 0 ? (
                  <p className="text-xs text-text-faint text-center py-6">No matches</p>
                ) : (
                  filtered.map((action, i) => (
                    <button
                      key={action.id}
                      onClick={() => runAndClose(action)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                        i === activeIndex ? "bg-raised text-text-primary" : "text-text-muted"
                      }`}
                    >
                      <action.icon size={13} className="shrink-0 text-text-faint" />
                      <span className="text-[13px] truncate flex-1">{action.label}</span>
                      {action.hint && (
                        <span className="text-[10px] font-mono text-text-faint shrink-0">{action.hint}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
