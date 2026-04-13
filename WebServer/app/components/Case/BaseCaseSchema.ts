import { CaseType } from "@/app/generated/prisma/enums";
import { excelHeaders } from "@/app/lib/excel";
import z from "zod";

export const BaseCaseSchema = z.object({
  branch: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders(["Branch", "Branch/Station", "Branch Station", "BR"]),
    ),
  assistantBranch: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Assistant Branch", "Asst Branch"])),
  caseNumber: z
    .string()
    .min(1, "Case number is required")
    .describe(
      excelHeaders([
        "Case No",
        "Case Number",
        "Criminal Case No",
        "Criminal Case Number",
      ]),
    ),
  dateFiled: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date Filed", "Filing Date"])),
  caseType: z.enum(CaseType),
});
export type BaseCaseSchema = z.infer<typeof BaseCaseSchema>;
