import { z } from "zod";

export const MAX_MESSAGE_CHARS = 12_000;
export const MAX_INLINE_FILE_CHARS = 5_500_000;

export const chatStreamSchema = z
  .object({
    session_id: z.string().uuid(),
    // Matches the limit /data enforces, so a long paste fails here with a clear
    // message instead of reaching the model.
    content: z.string().max(MAX_MESSAGE_CHARS, `Messages can be up to ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters.`).default(""),
    // True when the text was submitted through the question interface, so it
    // is known to answer the pending clarifying question.
    is_clarify_answer: z.boolean().default(false),
    attachments: z
      .array(
        z.object({
          name: z.string().max(300),
          type: z.string().max(200).default(""),
          path: z.string().max(1000).default(""),
          size: z.number().int().nonnegative().optional(),
          // Images and Word documents travel inline. The request body is also capped at 4MB.
          dataUrl: z.string().max(MAX_INLINE_FILE_CHARS, "That file is too large to send.").nullable().default(null),
        })
      )
      .max(3)
      .optional(),
  })
  .refine((v) => v.content.trim().length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: "Provide a message or an attachment.",
  });

export type ChatStreamBody = z.infer<typeof chatStreamSchema>;
