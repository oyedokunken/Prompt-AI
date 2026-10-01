import { z } from "zod";

export const chatStreamSchema = z
  .object({
    session_id: z.string().uuid(),
    content: z.string().max(20_000).default(""),
    // True when the text was submitted through the question interface, so it
    // is known to answer the pending clarifying question.
    is_clarify_answer: z.boolean().default(false),
    attachments: z
      .array(
        z.object({
          name: z.string().max(300),
          type: z.string().max(200).default(""),
          path: z.string().max(1000).default(""),
          dataUrl: z.string().nullable().default(null),
        })
      )
      .max(3)
      .optional(),
  })
  .refine((v) => v.content.trim().length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: "Provide a message or an attachment.",
  });

export type ChatStreamBody = z.infer<typeof chatStreamSchema>;
