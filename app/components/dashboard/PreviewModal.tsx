"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface PreviewModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

// Shared lightbox-style modal for the Media and Exports library grids, a
// click on any card opens its content here instead of leaving the page.
export function PreviewModal({ title, subtitle, onClose, children }: PreviewModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-full flex flex-col rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 h-11 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{title}</p>
            {subtitle && <p className="text-[10px] font-mono text-text-faint truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-faint hover:text-text-primary transition-colors shrink-0"
            aria-label="Close preview"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
