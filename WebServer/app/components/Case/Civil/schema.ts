import type { Case, CivilCase } from "@/app/generated/prisma/client";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";
import { BaseCaseSchema } from "../BaseCaseSchema";

export type CivilCasesFilterOptions = FilterOptions<CivilCaseSchema>;

export type CivilCaseFilters = CivilCasesFilterOptions["filters"];

export type CivilCaseStats = {
  totalCases: number;
  reRaffledCases: number;
  remandedCases: number;
  recentlyFiled: number;
};

const CivilCaseObjectSchema = z.object({
  petitioners: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Petitioners", "Petitioner", "Plaintiff"])),
  defendants: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Defendants", "Defendant", "Respondent"])),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Notes", "Remarks", "Notes/Appealed"])),
  nature: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Nature", "Nature of Case", "Nature of Petition"])),
  originCaseNumber: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Origin Case Number",
        "Origin Case No",
        "Origin MTC-Case Number",
        "Origin MTC Case Number",
        "Origin MTC Case No",
        "MTC-Case Number",
      ]),
    ),
  reRaffleDate: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Re-Raffle Date", "ReRaffle Date"])),
  reRaffleBranch: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Re-Raffle Branch", "ReRaffle Branch"])),
  consolitationDate: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Consolidation Date", "Consolidation Date"])),
  consolidationBranch: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Consolidation Branch", "Consolidation Court"])),
  dateRemanded: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date Remanded", "Remanded Date"])),
  remandedNote: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Remanded Note",
        "Remand Note",
        "Remanded Notes",
        "Note",
        "Status Note",
      ]),
    ),
  undocketed: z
    .boolean()
    .optional()
    .describe(excelHeaders(["Undocketed", "Un-docketed", "Un docketed"])),
});

export const CivilCaseSchema = BaseCaseSchema.merge(CivilCaseObjectSchema);
export type CivilCaseSchema = z.infer<typeof CivilCaseSchema>;

export type CivilCaseData = Case & CivilCase;

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

/** Form entry used by the grid UI (CaseSchema + UI metadata). */
export type CaseEntry = CivilCaseSchema & {
  id: number;
  isManual: boolean;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert CaseSchema to CaseEntry (for editing existing cases). */
export const caseToEntry = (c: CivilCaseData): CaseEntry => ({
  ...c,
  id: c.id ?? createTempId(),
  isManual: Boolean(c.isManual),
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialCaseFormData: Omit<CivilCaseSchema, "id" | "createdAt"> = {
  branch: null,
  assistantBranch: null,
  caseNumber: "",
  dateFiled: new Date(),
  caseType: "CIVIL",
  petitioners: "",
  defendants: null,
  notes: null,
  nature: null,
  originCaseNumber: null,
  reRaffleDate: null,
  reRaffleBranch: null,
  consolitationDate: null,
  consolidationBranch: null,
  dateRemanded: null,
  remandedNote: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): CaseEntry => ({
  ...initialCaseFormData,
  id: createTempId(),
  isManual: false,
  errors: {},
  collapsed: false,
  saved: false,
});

export const calculateCivilCaseStats = (
  cases: CivilCaseData[],
): CivilCaseStats => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    totalCases: cases.length,
    reRaffledCases: cases.filter((c) => c.reRaffleDate).length,
    remandedCases: cases.filter((c) => c.dateRemanded).length,
    recentlyFiled: cases.filter(
      (c) => c.dateFiled && new Date(c.dateFiled) >= thirtyDaysAgo,
    ).length,
  };
};

export const formatCivilCaseForDisplay = (caseItem: CivilCaseData) => {
  return {
    ...caseItem,
    dateFiled: caseItem.dateFiled
      ? new Date(caseItem.dateFiled).toLocaleDateString()
      : "-",
    reRaffleDate: caseItem.reRaffleDate
      ? new Date(caseItem.reRaffleDate).toLocaleDateString()
      : "Not scheduled",
    consolitationDate: caseItem.consolitationDate
      ? new Date(caseItem.consolitationDate).toLocaleDateString()
      : "-",
  };
};

export const sortCivilCases = (
  cases: CivilCaseData[],
  sortBy: keyof CivilCaseData,
  order: "asc" | "desc",
): CivilCaseData[] => {
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
