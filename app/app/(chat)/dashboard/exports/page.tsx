"use client";

import { useState } from "react";
import { FileType, FileDown, FileText, FileJson, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";
import { PreviewModal } from "@/components/dashboard/PreviewModal";
import { previewExportContent } from "@/lib/export";
import type { ExportRecord } from "@/lib/hooks/useExportHistory";
import type { ChatMessage, ChatSession } from "@/lib/types/chat";

const EXPORT_FORMAT_ICON: Record<string, React.ElementType> = {
  pdf: FileType,
  markdown: FileDown,
  txt: FileText,
  json: FileJson,
};

const EXPORT_FILTERS: { id: "all" | "pdf" | "markdown" | "txt"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDF" },
  { id: "markdown", label: "Markdown" },
  { id: "txt", label: "Text" },
];

type Preview = { kind: "text"; content: string } | { kind: "pdf"; url: string };

export default function ExportsPage() {
  const { exportHistory } = useDashboard();
  const [filter, setFilter] = useState<"all" | "pdf" | "markdown" | "txt">("all");
  const [active, setActive] = useState<ExportRecord | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const filtered = exportHistory.filter((e) => filter === "all" || e.format === filter);

  const openPreview = async (record: ExportRecord) => {
    setActive(record);
    setPreview(null);
    setPreviewError(null);

    if (!record.session_id) {
      setPreviewError("The chat this was exported from no longer exists.");
      return;
    }

    setLoadingPreview(true);
    const supabase = createClient();
    const [{ data: sessionData, error: sessionError }, { data: messageData, error: messageError }] = await Promise.all([
      supabase.from("chat_sessions").select("*").eq("id", record.session_id).single(),
      supabase.from("messages").select("*").eq("session_id", record.session_id).order("created_at", { ascending: true }),
    ]);

    if (sessionError || messageError || !sessionData) {
      console.error("[exports] preview load failed:", sessionError ?? messageError);
      setPreviewError("That chat could not be loaded, it may have been deleted since this export.");
      setLoadingPreview(false);
      return;
    }

    const result = await previewExportContent(sessionData as ChatSession, (messageData as ChatMessage[]) ?? [], record.format);
    setPreview(result.kind === "pdf" ? { kind: "pdf", url: URL.createObjectURL(result.blob) } : result);
    setLoadingPreview(false);
  };

  const closePreview = () => {
    if (preview?.kind === "pdf") URL.revokeObjectURL(preview.url);
    setActive(null);
    setPreview(null);
    setPreviewError(null);
  };

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Exports" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Exports</h1>
          <p className="text-sm text-text-muted mb-4">
            Everything you have exported so far. Export a conversation from its chat header.
          </p>

          <div className="flex gap-1.5 mb-4">
            {EXPORT_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-3.5 py-2.5 md:px-2.5 md:py-1 rounded-md text-xs md:text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  filter === id
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-faint border border-transparent hover:text-text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-primary font-medium">No exports yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((record) => {
                const Icon = EXPORT_FORMAT_ICON[record.format] ?? FileText;
                return (
                  <button
                    key={record.id}
                    onClick={() => openPreview(record)}
                    className="flex flex-col items-start gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-accent/30 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <Icon size={15} className="text-accent" />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-xs text-text-primary font-medium truncate">{record.session_title}</p>
                      <p className="text-xs md:text-[10px] text-text-faint font-mono mt-0.5">
                        {record.format}, {new Date(record.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {active && (
        <PreviewModal
          title={active.session_title}
          subtitle={`${active.format}, exported ${new Date(active.created_at).toLocaleDateString()}`}
          onClose={closePreview}
        >
          {loadingPreview && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-muted py-16">
              <Loader2 size={14} className="animate-spin" /> Loading preview...
            </div>
          )}
          {previewError && (
            <p className="text-sm text-text-muted text-center py-16 px-6">{previewError}</p>
          )}
          {preview?.kind === "text" && (
            <pre className="whitespace-pre-wrap break-words text-xs text-text-primary leading-relaxed p-5 font-mono">
              {preview.content}
            </pre>
          )}
          {preview?.kind === "pdf" && (
            <iframe src={preview.url} title="Export preview" className="w-full h-[70vh] border-0" />
          )}
        </PreviewModal>
      )}
    </div>
  );
}
