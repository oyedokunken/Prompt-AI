"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  // A line under the title, such as a date or a count.
  subtitle?: string;
  children: ReactNode;
  // Actions pinned to the bottom of the modal.
  footer?: ReactNode;
  wide?: boolean;
}

// A general purpose dialog. Closes on Escape, on a click outside it, and on
// the close button. The page behind it does not scroll while it is open.
export function Modal({ open, onClose, title, subtitle, children, footer, wide = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-full flex flex-col rounded-xl border border-border bg-surface shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base md:text-sm font-semibold text-text-primary truncate">
              {title}
            </h2>
            {subtitle && <p className="text-[13px] md:text-[11px] text-text-faint font-mono mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-3 -m-2 md:p-1 md:-m-0 md:-mr-1 rounded-md text-text-faint hover:text-text-muted hover:bg-raised transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={20} className="md:!w-[15px] md:!h-[15px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
