import type { ChatMessage, ChatSession, ExportFormat } from "@/lib/types/chat";

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

async function buildPdf(session: ChatSession, messages: ChatMessage[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  const ensureRoom = (lineHeight: number) => {
    if (y + lineHeight > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(session.title, marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported from Prompt AI - ${new Date(session.updated_at).toLocaleString()}`, marginX, y);
  doc.setTextColor(0);
  y += 24;

  for (const m of messages) {
    ensureRoom(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(m.role === "user" ? "You" : "Prompt AI", marginX, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines: string[] = doc.splitTextToSize(m.content, maxWidth);
    for (const line of lines) {
      ensureRoom(14);
      doc.text(line, marginX, y);
      y += 14;
    }

    if (m.metadata.score !== undefined) {
      ensureRoom(14);
      doc.setTextColor(90);
      doc.setFontSize(9);
      doc.text(`Completeness score: ${m.metadata.score}/100`, marginX, y);
      doc.setTextColor(0);
      y += 16;
    }
    y += 12;
  }

  return doc.output("blob");
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
}
