import { CaseType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const ReceivingLogSchema = z.object({
  id: z.number().int().optional(),
  bookAndPage: z.string().nullable().optional(),
  dateRecieved: z.coerce.date().nullable().optional(),
  caseType: z.enum(CaseType),
  caseNumber: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  branchNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type ReceivingLogSchema = z.infer<typeof ReceivingLogSchema>;
