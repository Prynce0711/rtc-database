import z from "zod";
import { Case, CaseType } from "../generated/prisma/browser";
import { excelHeaders } from "../lib/excel";

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

export type UnifiedCaseData = Case & {
  displayParty: string;
  displayDetail: string;
  isDetained: boolean;
  statusText: string;
  raffleDate: Date | null;
};

export type UnifiedCaseStats = {
  totalCases: number;
  detainedCases: number;
  pendingCases: number;
  recentlyFiled: number;
};

export type UnifiedCasesOptions = {
  page?: number;
  pageSize?: number;
  sortKey?: "id" | "caseNumber" | "dateFiled" | "caseType" | "branch";
  sortOrder?: "asc" | "desc";
  caseType?: CaseType;
};
