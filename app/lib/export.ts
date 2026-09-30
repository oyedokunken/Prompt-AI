import type { ChatMessage, ChatSession, ExportFormat } from "@/lib/types/chat";
import { createClient } from "@/lib/supabase/client";

function buildMarkdown(session: ChatSession, messages: ChatMessage[]): string {
  return `# ${session.title}\n\n` +
    messages
      .map((m) =>
        m.role === "user"
          ? `**You:** ${m.content}`
          : `**Prompt AI:**\n\n${m.content}${
              m.metadata.score !== undefined ? `\n\n_Completeness score: ${m.metadata.score}/100_` : ""
            }`
      )
      .join("\n\n---\n\n");
}

function buildText(messages: ChatMessage[]): string {
  return messages
    .map((m) => `[${m.role === "user" ? "You" : "Prompt AI"}]\n${m.content}`)
    .join("\n\n---\n\n");
}

function download(content: string | Blob, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Loads the same Geist font family the app uses everywhere else, so the
// exported document is never rendered in a PDF library default font.
async function loadGeistFonts(doc: import("jspdf").jsPDF): Promise<void> {
  const [regular, bold] = await Promise.all([
    fetch("/fonts/Geist-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/Geist-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);
  doc.addFileToVFS("Geist-Regular.ttf", arrayBufferToBase64(regular));
  doc.addFont("Geist-Regular.ttf", "Geist", "normal");
  doc.addFileToVFS("Geist-Bold.ttf", arrayBufferToBase64(bold));
  doc.addFont("Geist-Bold.ttf", "Geist", "bold");
}

const INK = "#18181B";
const ACCENT = "#D97706";
const CHIP_BG = "#111113";
const MUTED = "#71717A";

// Draws the Prompt AI mark (icon chip + wordmark) using the color variant,
// since this sits on a white page rather than the app's dark theme.
function drawBrandHeader(doc: import("jspdf").jsPDF, marginX: number, pageWidth: number): number {
  const chipSize = 22;
  const y = 40;

  doc.setFillColor(CHIP_BG);
  doc.roundedRect(marginX, y, chipSize, chipSize, 5, 5, "F");

  doc.setFont("Geist", "bold");
  doc.setFontSize(11);
  doc.setTextColor(ACCENT);
  doc.text(">", marginX + 5, y + 15);
  doc.setFont("Geist", "normal");
  doc.setTextColor("#EDEDEF");
  doc.text("_", marginX + 11, y + 15);

  doc.setFont("Geist", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK);
  const wordmarkX = marginX + chipSize + 10;
  doc.text("Prompt", wordmarkX, y + 15);
  const promptWidth = doc.getTextWidth("Prompt");
  doc.setTextColor(ACCENT);
  doc.text("AI", wordmarkX + promptWidth, y + 15);

  const dividerY = y + chipSize + 12;
  doc.setDrawColor("#E4E4E7");
  doc.setLineWidth(0.75);
  doc.line(marginX, dividerY, pageWidth - marginX, dividerY);

  return dividerY + 20;
}

async function buildPdf(session: ChatSession, messages: ChatMessage[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;

  await loadGeistFonts(doc);

  let y = drawBrandHeader(doc, marginX, pageWidth);

  const ensureRoom = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - 48) {
      doc.addPage();
      doc.setFillColor("#FFFFFF");
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      y = 56;
    }
  };

  doc.setFont("Geist", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text(session.title, marginX, y);
  y += 20;
  doc.setFont("Geist", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(`Exported from Prompt AI on ${new Date(session.updated_at).toLocaleString()}`, marginX, y);
  y += 24;

  for (const m of messages) {
    ensureRoom(16);
    doc.setFont("Geist", "bold");
    doc.setFontSize(10);
    doc.setTextColor(m.role === "user" ? INK : ACCENT);
    doc.text(m.role === "user" ? "You" : "Prompt AI", marginX, y);
    y += 14;

    doc.setFont("Geist", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    const lines: string[] = doc.splitTextToSize(m.content, maxWidth);
    for (const line of lines) {
      ensureRoom(14);
      doc.text(line, marginX, y);
      y += 14;
    }

    if (m.metadata.score !== undefined) {
      ensureRoom(14);
      doc.setTextColor(MUTED);
      doc.setFontSize(9);
      doc.text(`Completeness score: ${m.metadata.score}/100`, marginX, y);
      y += 16;
    }
    y += 12;
  }

  return doc.output("blob");
}

// Fire and forget log of a completed export, used to power the sidebar's
// export history view and the settings usage tab. Never blocks or fails
// the actual export if it cannot write (for example before the
// export_history table exists).
async function logExport(session: ChatSession, format: ExportFormat): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("export_history").insert({
      user_id: user.id,
      session_id: session.id,
      session_title: session.title,
      format,
    });
  } catch {
    // Best effort only, the export itself already succeeded.
  }
}

// Builds the requested export format from a real session + its messages,
// and either downloads it or (markdown-from-sidebar-copy) returns the text.
export async function exportSession(
  session: ChatSession,
  messages: ChatMessage[],
  format: ExportFormat,
  { copyOnly = false }: { copyOnly?: boolean } = {}
): Promise<string | void> {
  const slug = session.title.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "chat";

  if (format === "pdf") {
    const blob = await buildPdf(session, messages);
    download(blob, `${slug}.pdf`, "application/pdf");
    logExport(session, format);
    return;
  }

  const content =
    format === "json"
      ? JSON.stringify({ session, messages }, null, 2)
      : format === "txt"
      ? buildText(messages)
      : buildMarkdown(session, messages);

  if (copyOnly) {
    await navigator.clipboard.writeText(content);
    return content;
  }

  const ext = format === "json" ? "json" : format === "txt" ? "txt" : "md";
  download(content, `${slug}.${ext}`, "text/plain");
  logExport(session, format);
}
