import z from "zod";

export const joinChatSchema = z.object({
  chatId: z.number().int(),
});

export const messageSchema = z
  .object({
    chatId: z.number().int(),
    content: z.string().trim().max(1000).default(""),
    file: z
      .object({
        name: z.string().min(1).max(255),
        type: z.string().max(255),
        size: z.number().int().positive(),
        data: z.string().min(1),
      })
      .optional(),
  })
  .refine((value) => value.content.length > 0 || Boolean(value.file), {
    message: "Message content or file is required",
    path: ["content"],
  });
