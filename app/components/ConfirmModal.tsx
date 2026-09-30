"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
              danger ? "bg-red-400/10 border-red-400/30 text-red-400" : "bg-accent/10 border-accent/30 text-accent"
            }`}
          >
            <AlertTriangle size={15} />
          </div>
          <div>
            <h2 id="confirm-modal-title" className="text-sm font-semibold text-text-primary">
              {title}
            </h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:bg-raised transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              danger
                ? "bg-red-500 text-white hover:bg-red-500/90"
                : "bg-accent-fill text-accent-fill-foreground hover:bg-accent-fill/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
