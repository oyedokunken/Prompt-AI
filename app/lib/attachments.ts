import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_BUCKETS, MAX_DOCX_BYTES, attachmentKind } from "@/lib/types/chat";

export interface UploadedAttachment {
  name: string;
  type: string;
  path: string;
  publicUrl: string;
  dataUrl: string | null;
  size: number;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Uploads a chat attachment to the bucket matching its type and returns
// enough to persist alongside the message and, for images, to send to the
// model as real visual context.
export async function uploadAttachment(userId: string, file: File): Promise<UploadedAttachment> {
  const kind = attachmentKind(file.type);
  if (!kind) throw new Error("Unsupported file type. Attach an image, video, PDF, or Word document.");

  if (kind === "docx") {
    if (file.size > MAX_DOCX_BYTES) {
      throw new Error(`Word documents can be up to ${Math.round(MAX_DOCX_BYTES / (1024 * 1024))}MB.`);
    }
    // Not stored anywhere, so there is no path. The bytes travel with the message.
    return { name: file.name, type: file.type, path: "", publicUrl: "", dataUrl: await fileToDataUrl(file), size: file.size };
  }

  const { bucket, maxBytes } = ATTACHMENT_BUCKETS[kind];
  if (file.size > maxBytes) {
    throw new Error(`File is too large. Max size for this type is ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  // Images travel as a data URL for the vision step. PDFs are read from
  // storage by the server, so they need no copy here.
  const dataUrl = kind === "image" ? await fileToDataUrl(file) : null;

  return { name: file.name, type: file.type, path: `${bucket}/${path}`, publicUrl: data.publicUrl, dataUrl, size: file.size };
}
