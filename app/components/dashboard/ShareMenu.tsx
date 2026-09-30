"use client";

import { useState } from "react";
import { Share2, Copy, Check, Ban } from "lucide-react";
import type { SharedLink } from "@/lib/types/chat";

interface ShareMenuProps {
  disabled: boolean;
  activeLink: SharedLink | null;
  onCreate: () => void;
  onRevoke: (id: string) => void;
  siteUrl: string;
}

export function ShareMenu({ disabled, activeLink, onCreate, onRevoke, siteUrl }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = activeLink ? `${siteUrl}/share/${activeLink.token}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-raised text-text-muted hover:text-text-primary hover:border-border/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Share conversation"
      >
        <Share2 size={11} />
        <span className="font-mono text-[10px]">Share</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-border bg-surface shadow-xl z-20 overflow-hidden p-3">
            {activeLink ? (
              <div className="space-y-2.5">
                <p className="text-[11px] text-text-muted">
                  Anyone with this link can view a read-only copy of this conversation. No account needed.
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-border bg-raised text-[10px] font-mono text-text-primary outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-md border border-border text-text-muted hover:text-text-primary transition-colors shrink-0"
                    aria-label="Copy share link"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
                <button
                  onClick={() => { onRevoke(activeLink.id); setOpen(false); }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-red-400/30 text-[11px] text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Ban size={11} />
                  Revoke link
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[11px] text-text-muted">
                  Create a read-only link to this conversation. Anyone with the link can view it without an account, and you can revoke it any time.
                </p>
                <button
                  onClick={() => { onCreate(); }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-accent-fill text-accent-fill-foreground text-[11px] font-semibold hover:bg-accent-fill/90 transition-colors"
                >
                  Create share link
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
