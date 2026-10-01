"use client";

import { useState } from "react";
import { FileType, FileDown, FileText, FileJson } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/DashboardContext";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";

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

export default function ExportsPage() {
  const { exportHistory } = useDashboard();
  const [filter, setFilter] = useState<"all" | "pdf" | "markdown" | "txt">("all");
  const filtered = exportHistory.filter((e) => filter === "all" || e.format === filter);

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Exports" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Exports</h1>
          <p className="text-sm text-text-muted mb-4">
            Everything you have exported so far. Export a conversation from its chat header.
          </p>

          <div className="flex gap-1.5 mb-4">
            {EXPORT_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wide transition-colors ${
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
            <div className="space-y-1.5">
              {filtered.map((record) => {
                const Icon = EXPORT_FORMAT_ICON[record.format] ?? FileText;
                return (
                  <div key={record.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-surface">
                    <Icon size={14} className="text-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary truncate">{record.session_title}</p>
                      <p className="text-xs text-text-faint font-mono">
                        {record.format}, {new Date(record.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
