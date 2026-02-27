import { RecievingLog } from "@/app/generated/prisma/client";
import { CaseType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const ReceivingLogSchema = z.object({
  bookAndPage: z.string().nullable().optional(),
  dateRecieved: z.coerce.date().nullable().optional(),
  caseType: z.enum(CaseType),
  caseNumber: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  branchNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type ReceivingLogSchema = z.infer<typeof ReceivingLogSchema>;

/** Form entry used by the grid UI (RecievingLog + UI metadata). */
export type ReceivingLogEntry = RecievingLog & {
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert RecievingLog to ReceivingLogEntry (for editing existing logs). */
export const receivingLogToEntry = (log: RecievingLog): ReceivingLogEntry => ({
  ...log,
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialReceivingLogFormData: Omit<
  RecievingLog,
  "id" | "createdAt"
> = {
  bookAndPage: null,
  dateRecieved: null,
  caseType: "UNKNOWN",
  caseNumber: null,
  content: null,
  branchNumber: null,
  notes: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): ReceivingLogEntry => ({
  ...initialReceivingLogFormData,
  id: 0,
  createdAt: new Date(),
  errors: {},
  collapsed: false,
  saved: false,
});
