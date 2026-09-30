import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_BUCKETS, attachmentKind } from "@/lib/types/chat";

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
  if (!kind) throw new Error("Unsupported file type. Attach an image, video, or PDF.");

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

  // Only images are sent as real model context (GPT-4o vision input).
  const dataUrl = kind === "image" ? await fileToDataUrl(file) : null;

  return { name: file.name, type: file.type, path: `${bucket}/${path}`, publicUrl: data.publicUrl, dataUrl, size: file.size };
}
