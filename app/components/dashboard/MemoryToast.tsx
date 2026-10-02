"use client";

import { useEffect } from "react";
import { Brain, X } from "lucide-react";

interface MemoryToastProps {
  // What was just saved. Null hides the toast.
  items: { key: string; action: "added" | "updated" }[] | null;
  onDismiss: () => void;
  onManage: () => void;
}

// A passive confirmation, never a dialog. It reports that something was saved
// to memory on its own and gets out of the way, the conversation never waits
// on it.
export function MemoryToast({ items, onDismiss, onManage }: MemoryToastProps) {
  useEffect(() => {
    if (!items) return;
    const id = setTimeout(onDismiss, 6000);
    return () => clearTimeout(id);
  }, [items, onDismiss]);

  if (!items || items.length === 0) return null;

  const allUpdated = items.every((i) => i.action === "updated");
  const label = items.map((i) => i.key).join(", ");

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 right-4 sm:right-6 z-30 max-w-[300px] flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-accent/25 bg-surface shadow-lg"
    >
      <Brain size={13} className="text-accent shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[13px] md:text-[11px] text-text-primary leading-snug">
          {allUpdated ? "Updated in memory" : "Saved to memory"}
        </p>
        <p className="text-xs md:text-[10px] text-text-muted truncate">{label}</p>
        <button onClick={onManage} className="mt-1 text-xs md:text-[10px] text-accent underline underline-offset-2 hover:text-accent/80">
          Manage memory
        </button>
      </div>
      <button onClick={onDismiss} className="p-0.5 text-text-faint hover:text-text-muted transition-colors" aria-label="Dismiss">
        <X size={11} />
      </button>
    </div>
  );
}
