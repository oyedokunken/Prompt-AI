import { supabaseAdmin } from "../lib/supabase";

/**
 * Prepares the files a user attached for the /data service, which reads them.
 * Images arrive from the browser as data URLs. PDFs are fetched from storage
 * here, since /data never touches storage. Word documents are small enough
 * that the browser sends their bytes directly.
 */

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_BUCKET = "PDF-attachments";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export interface IncomingAttachment {
  name: string;
  type: string;
  path: string;
  dataUrl: string | null;
}

export interface DataAttachment {
  name: string;
  type: string;
  data_url: string | null;
  content_base64: string | null;
}

/** True for the file types /data can actually read. */
export function isReadable(a: { type: string; name: string }): boolean {
  return a.type.startsWith("image/") || a.type === "application/pdf" || a.type === DOCX_TYPE || a.name.toLowerCase().endsWith(".docx");
}

function base64FromDataUrl(dataUrl: string): string | null {
  const comma = dataUrl.indexOf(",");
  return dataUrl.startsWith("data:") && comma !== -1 ? dataUrl.slice(comma + 1) : null;
}

async function downloadPdf(path: string, userId: string): Promise<string | null> {
  // Stored as "<bucket>/<userId>/<file>". Only ever read from the PDF bucket,
  // and only a file inside the requesting user's own folder.
  const [bucket, owner, ...rest] = path.split("/");
  if (bucket !== PDF_BUCKET || owner !== userId || rest.length === 0) {
    console.error("[attachments] refused a PDF path outside the user's folder");
    return null;
  }
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(`${owner}/${rest.join("/")}`);
  if (error || !data) {
    console.error("[attachments] PDF download failed:", error);
    return null;
  }
  if (data.size > MAX_PDF_BYTES) return null;
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

export async function toDataAttachments(attachments: IncomingAttachment[], userId: string): Promise<DataAttachment[]> {
  return Promise.all(
    attachments.map(async (a): Promise<DataAttachment> => {
      const base = { name: a.name, type: a.type, data_url: null, content_base64: null };
      if (a.type.startsWith("image/")) return { ...base, data_url: a.dataUrl };
      if (a.type === "application/pdf") return { ...base, content_base64: await downloadPdf(a.path, userId) };
      if (a.type === DOCX_TYPE || a.name.toLowerCase().endsWith(".docx")) {
        return { ...base, content_base64: a.dataUrl ? base64FromDataUrl(a.dataUrl) : null };
      }
      return base;
    })
  );
}
