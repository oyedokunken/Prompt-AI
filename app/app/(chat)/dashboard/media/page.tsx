"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Film, FileText, Loader2, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";
import { PreviewModal } from "@/components/dashboard/PreviewModal";

interface MediaItem {
  name: string;
  type: string;
  publicUrl: string;
}

type MediaFilter = "all" | "image" | "video" | "pdf";

function kindOf(type: string): "image" | "video" | "pdf" {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "pdf";
}

// A global library across every chat, not just the one that happens to be
// open, uploading to attach to a message happens from within a chat's own
// compose bar, this page is read-only.
export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [active, setActive] = useState<MediaItem | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .select("metadata")
        .not("metadata->attachments", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("[media] load failed:", error);
        setLoading(false);
        return;
      }
      const attachments = (data ?? []).flatMap(
        (row) => (row.metadata?.attachments ?? []) as { name: string; type: string; path: string }[]
      );
      const resolved = attachments.map((att) => {
        const bucket = att.path.split("/")[0];
        const objectPath = att.path.slice(bucket.length + 1);
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        return { name: att.name, type: att.type, publicUrl: urlData.publicUrl };
      });
      setItems(resolved);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = items.filter((item) => filter === "all" || kindOf(item.type) === filter);

  const filters: { id: MediaFilter; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: ImageIcon },
    { id: "image", label: "Images", icon: ImageIcon },
    { id: "video", label: "Videos", icon: Film },
    { id: "pdf", label: "PDFs", icon: FileText },
  ];

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Media" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Media</h1>
          <p className="text-sm text-text-muted mb-4">
            Every file attached across all your chats. Attach a new file from within a chat's compose bar.
          </p>

          <div className="flex gap-1.5 mb-4">
            {filters.map(({ id, label }) => (
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

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              Loading your media...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-primary font-medium">No files yet</p>
              <p className="text-xs text-text-muted mt-1">Attach a file to any chat message to see it here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((item, i) => {
                const kind = kindOf(item.type);
                return (
                  <button
                    key={`${item.publicUrl}-${i}`}
                    onClick={() => setActive(item)}
                    className="group flex flex-col rounded-xl border border-border bg-surface hover:border-accent/30 transition-colors overflow-hidden text-left"
                  >
                    <div className="aspect-square bg-raised flex items-center justify-center overflow-hidden relative">
                      {kind === "image" ? (
                        <img src={item.publicUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : kind === "video" ? (
                        <>
                          <video src={item.publicUrl} className="w-full h-full object-cover" muted preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                            <Play size={20} className="text-white drop-shadow" fill="white" />
                          </div>
                        </>
                      ) : (
                        <FileText size={28} className="text-text-faint" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate px-2.5 py-2">{item.name}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {active && (
        <PreviewModal title={active.name} subtitle={active.type} onClose={() => setActive(null)}>
          <div className="flex items-center justify-center p-4 bg-raised min-h-[40vh]">
            {kindOf(active.type) === "image" && (
              <img src={active.publicUrl} alt={active.name} className="max-w-full max-h-[70vh] object-contain" />
            )}
            {kindOf(active.type) === "video" && (
              <video src={active.publicUrl} controls autoPlay className="max-w-full max-h-[70vh]" />
            )}
            {kindOf(active.type) === "pdf" && (
              <iframe src={active.publicUrl} title={active.name} className="w-full h-[70vh] border-0 bg-white" />
            )}
          </div>
        </PreviewModal>
      )}
    </div>
  );
}
