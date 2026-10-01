"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Film, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SimplePageHeader } from "@/components/dashboard/SimplePageHeader";

interface MediaItem {
  name: string;
  type: string;
  publicUrl: string;
}

// A global library across every chat, not just the one that happens to be
// open, uploading to attach to a message happens from within a chat's own
// compose bar, this page is read-only.
export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const images = items.filter((a) => a.type.startsWith("image/"));
  const videos = items.filter((a) => a.type.startsWith("video/"));
  const pdfs = items.filter((a) => a.type === "application/pdf");

  const groups = [
    { label: "Images", icon: ImageIcon, files: images },
    { label: "Videos", icon: Film, files: videos },
    { label: "PDFs", icon: FileText, files: pdfs },
  ];

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <SimplePageHeader title="Media" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Media</h1>
          <p className="text-sm text-text-muted mb-6">
            Every file attached across all your chats. Attach a new file from within a chat's compose bar.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              Loading your media...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-primary font-medium">No files yet</p>
              <p className="text-xs text-text-muted mt-1">Attach a file to any chat message to see it here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(({ label, icon: Icon, files }) => (
                <div key={label}>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-faint mb-2">
                    <Icon size={11} /> {label}
                  </p>
                  {files.length === 0 ? (
                    <p className="text-xs text-text-faint">None yet</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {files.map((f, i) => (
                        <a
                          key={`${f.publicUrl}-${i}`}
                          href={f.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:border-accent/30 transition-colors"
                        >
                          <span className="text-xs text-text-muted truncate">{f.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
