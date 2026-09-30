"use client";

import { MailWarning } from "lucide-react";

interface DisposableEmailModalProps {
  open: boolean;
  onClose: () => void;
}

export function DisposableEmailModal({ open, onClose }: DisposableEmailModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="disposable-email-title"
        className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-red-400/10 border-red-400/30 text-red-400">
            <MailWarning size={15} />
          </div>
          <div>
            <h2 id="disposable-email-title" className="text-sm font-semibold text-text-primary">
              That email address will not work here
            </h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              This looks like a disposable or temporary email address. Prompt AI sends a one time code
              to verify your account and to recover access later, so it needs an address you can
              actually receive mail at. Use a regular email address, or sign in with Google or GitHub
              instead.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
