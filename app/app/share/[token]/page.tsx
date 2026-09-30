"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Download, FileType, FileDown, FileText, FileJson } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { MessageBubble } from "@/components/dashboard/MessageBubble";
import { exportSession } from "@/lib/export";
import type { ChatMessage, ChatSession, ExportFormat } from "@/lib/types/chat";

interface SharedSessionPayload {
  target_type: "session" | "export";
  export_format: ExportFormat | null;
  session: { id: string; title: string; model: string; created_at: string; updated_at: string };
  messages: ChatMessage[];
}

export default function SharedSessionPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [payload, setPayload] = useState<SharedSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_shared_session", { p_token: token });
      if (error || !data) {
        console.error("[share] failed to resolve token:", error);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPayload(data as SharedSessionPayload);
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  const handleExport = async (format: ExportFormat) => {
    if (!payload) return;
    const session: ChatSession = { ...payload.session, user_id: "", is_favorite: false };
    await exportSession(session, payload.messages, format);
    setExportOpen(false);
  };

  return (
    <div className="min-h-screen bg-base flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border shrink-0">
        <Link href="/" aria-label="Prompt AI home">
          <Logo variant="color" size={22} />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-text-faint hidden sm:inline">Shared conversation, read only</span>
          <Link
            href="/signup"
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
          >
            Try Prompt AI free
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin text-text-faint" />
          </div>
        )}

        {!loading && notFound && (
          <div className="flex flex-col items-center justify-center text-center px-4 py-24 gap-3">
            <h1 className="text-lg font-semibold text-text-primary">This link is no longer available</h1>
            <p className="text-sm text-text-muted max-w-sm">
              The share link may have been revoked, or it never existed. Ask whoever sent it for a new one.
            </p>
            <Link
              href="/"
              className="mt-2 inline-flex items-center px-4 py-2 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors"
            >
              Go to Prompt AI
            </Link>
          </div>
        )}

        {!loading && payload && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-text-primary">{payload.session.title}</h1>
                <p className="text-xs text-text-faint mt-1">
                  Shared from Prompt AI
                  {payload.target_type === "export" && payload.export_format
                    ? `, originally exported as ${payload.export_format}`
                    : ""}
                </p>
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-raised text-text-muted hover:text-text-primary transition-colors"
                >
                  <Download size={12} />
                  <span className="text-[11px] font-mono">Export</span>
                </button>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-surface shadow-xl z-20 overflow-hidden py-1">
                      <button onClick={() => handleExport("pdf")} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
                        <FileType size={11} /> Download PDF
                      </button>
                      <button onClick={() => handleExport("markdown")} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
                        <FileDown size={11} /> Download Markdown
                      </button>
                      <button onClick={() => handleExport("txt")} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
                        <FileText size={11} /> Download plain text
                      </button>
                      <button onClick={() => handleExport("json")} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:bg-raised transition-colors">
                        <FileJson size={11} /> Download JSON
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {payload.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>

            <div className="mt-10 rounded-xl border border-accent/20 bg-accent/5 p-6 text-center">
              <p className="text-sm font-medium text-text-primary mb-1">Like what you see?</p>
              <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
                Prompt AI turns vague requests into production-ready prompts like this one, free to start.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-sm font-semibold hover:bg-accent-fill/90 transition-colors"
              >
                Create your own prompts free
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
