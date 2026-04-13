import { Case, SheriffCase } from "@/app/generated/prisma/client";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "@rtc-database/shared";
import { BaseCaseSchema } from "../BaseCaseSchema";

export type SheriffCasesFilterOptions = FilterOptions<SheriffCaseSchema>;

export type SheriffCaseFilters = SheriffCasesFilterOptions["filters"];

export type SheriffCaseStats = {
  totalCases: number;
  thisMonthCases: number;
  todayCases: number;
  recentlyFiled: number;
};

const SheriffCaseObjectSchema = z.object({
  mortgagee: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Mortgagee"])),
  mortgagor: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Mortgagor"])),
  sheriffName: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Name", "Sheriff Name", "Sheriff"])),
  remarks: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Remarks", "Notes"])),
});

export const SheriffCaseSchema = BaseCaseSchema.merge(SheriffCaseObjectSchema);
export type SheriffCaseSchema = z.infer<typeof SheriffCaseSchema>;

export type SheriffCaseData = Case & SheriffCase;

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

/** Form entry used by the grid UI (CaseSchema + UI metadata). */
export type CaseEntry = SheriffCaseSchema & {
  id: number;
  isManual: boolean;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert CaseSchema to CaseEntry (for editing existing cases). */
export const caseToEntry = (c: SheriffCaseData): CaseEntry => ({
  ...c,
  id: c.id ?? createTempId(),
  isManual: Boolean(c.isManual),
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialSheriffCaseFormData: Omit<
  SheriffCaseSchema,
  "id" | "createdAt"
> = {
  caseNumber: "",
  dateFiled: new Date(),
  caseType: "SHERRIFF",
  mortgagee: null,
  mortgagor: null,
  sheriffName: null,
  remarks: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): CaseEntry => ({
  ...initialSheriffCaseFormData,
  id: createTempId(),
  isManual: false,
  errors: {},
  collapsed: false,
  saved: false,
});

export const calculateSheriffCaseStats = (
  cases: SheriffCaseData[],
): SheriffCaseStats => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    totalCases: cases.length,
    thisMonthCases: cases.filter(
      (c) => c.dateFiled && new Date(c.dateFiled) >= monthStart,
    ).length,
    todayCases: cases.filter(
      (c) => c.dateFiled && new Date(c.dateFiled) >= todayStart,
    ).length,
    recentlyFiled: cases.filter(
      (c) => c.dateFiled && new Date(c.dateFiled) >= thirtyDaysAgo,
    ).length,
  };
};

export const formatSheriffCaseForDisplay = (caseItem: SheriffCaseData) => {
  return {
    ...caseItem,
    dateFiled: caseItem.dateFiled
      ? new Date(caseItem.dateFiled).toLocaleDateString()
      : "-",
  };
};

export const sortSheriffCases = (
  cases: SheriffCaseData[],
  sortBy: keyof SheriffCaseData,
  order: "asc" | "desc",
): SheriffCaseData[] => {
  return [...cases].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
};
