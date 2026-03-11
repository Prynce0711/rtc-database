import z from "zod";

export const joinChatSchema = z.object({
  chatId: z.number().int(),
});

export const messageSchema = z.object({
  chatId: z.number().int(),
  content: z.string().trim().min(1).max(1000), // Increased for encrypted content
});
