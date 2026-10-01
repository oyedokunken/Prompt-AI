export type FileKind = "image" | "video" | "pdf" | "document" | "file";

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
  "image/svg+xml": "SVG",
  "video/mp4": "MP4",
  "video/webm": "WEBM",
  "video/quicktime": "MOV",
};

// The format a file actually is, as a short upper case label such as PDF or
// PNG. The file name's extension wins, then the mime type, so the label stays
// honest even when the browser reports a generic type.
export function fileTypeLabel(name: string, mime: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (ext && ext.length <= 5) return ext === "jpeg" ? "JPG" : ext.toUpperCase();
  if (MIME_LABELS[mime]) return MIME_LABELS[mime];
  const sub = mime.split("/")[1];
  return sub ? sub.replace(/^x-/, "").slice(0, 5).toUpperCase() : "FILE";
}

export function fileKind(mime: string, name = ""): FileKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || mime === "application/msword" || /\.docx?$/i.test(name)) return "document";
  return "file";
}

// Colors for the type badge and tile, one per kind so a file can be told apart
// at a glance.
export const KIND_STYLES: Record<FileKind, { badge: string; tile: string }> = {
  image: { badge: "bg-sky-500 text-white", tile: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  video: { badge: "bg-violet-500 text-white", tile: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  pdf: { badge: "bg-red-500 text-white", tile: "bg-red-500/15 text-red-400 border-red-500/30" },
  document: { badge: "bg-blue-600 text-white", tile: "bg-blue-600/15 text-blue-400 border-blue-600/30" },
  file: { badge: "bg-zinc-500 text-white", tile: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
