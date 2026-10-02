"use client";

import { X } from "lucide-react";
import { KIND_STYLES, fileKind, fileTypeLabel, formatBytes } from "@/lib/fileTypes";
import { cn } from "@/lib/utils";

interface AttachmentCardProps {
  name: string;
  // The mime type, as reported when the file was attached.
  type: string;
  // A URL the browser can show for an image, a public storage URL or a data URL.
  url?: string | null;
  size?: number;
  // When given, a remove control is shown. Used while composing, never in a sent message.
  onRemove?: () => void;
  // Opens the file, shown as a link when a URL exists.
  href?: string | null;
  className?: string;
}

// An attachment as it appears with a message: a thumbnail or a type tile, a
// type badge that says plainly what the format is, and the file name. The same
// card is used in the composer, inside a sent message bubble, and in the media
// library, so a file looks the same wherever it shows up.
export function AttachmentCard({ name, type, url, size, onRemove, href, className }: AttachmentCardProps) {
  const kind = fileKind(type, name);
  const label = fileTypeLabel(name, type);
  const styles = KIND_STYLES[kind];
  const meta = [label, formatBytes(size)].filter(Boolean).join("  ");

  const body = (
    <>
      <div className="relative h-24 bg-raised flex items-center justify-center overflow-hidden">
        {kind === "image" && url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className={cn("w-14 h-14 rounded-xl border flex items-center justify-center font-mono text-sm font-bold tracking-tight", styles.tile)}>
            {label.length > 4 ? label.slice(0, 4) : label}
          </div>
        )}
        <span className={cn("absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[11px] md:text-xs font-mono font-bold tracking-wide shadow", styles.badge)}>
          {label}
        </span>
      </div>
      <div className="px-2.5 py-2 min-w-0">
        <p className="text-[13px] md:text-[13px] text-text-primary font-medium truncate" title={name}>{name}</p>
        <p className="text-[11px] md:text-xs text-text-faint font-mono mt-0.5 whitespace-pre">{meta}</p>
      </div>
    </>
  );

  return (
    <div className={cn("relative w-36 shrink-0 rounded-xl border border-border bg-base overflow-hidden", className)}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity" aria-label={`Open ${name}, ${label} file`}>
          {body}
        </a>
      ) : (
        body
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
          aria-label={`Remove ${name}`}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
