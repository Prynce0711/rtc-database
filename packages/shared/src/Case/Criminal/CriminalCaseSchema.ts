import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";
import type { Case, CriminalCase } from "../../generated/prisma/browser";
import { excelHeaders } from "../../lib/excel";
import { createTempId } from "../../utils";
import { BaseCaseSchema } from "../BaseCaseSchema";

export type CriminalCasesFilterOptions = FilterOptions<CriminalCaseSchema>;

export type CriminalCaseFilters = CriminalCasesFilterOptions["filters"];

export type CriminalCaseStats = {
  totalCases: number;
  detainedCases: number;
  pendingCases: number;
  recentlyFiled: number;
};

const CriminalCaseObjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .describe(excelHeaders(["Name", "Accused", "Accused Name"])),
  charge: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Charge", "Offense"])),
  infoSheet: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Info Sheet", "Information Sheet", "IS", "I.S"])),
  court: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Court"])),
  detained: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Detained", "Detention", "Status"])),
  consolidation: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Consolidation"])),
  eqcNumber: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["EQC No", "EQ Number"])),
  bond: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Bond", "BOND"])),
  raffleDate: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Raffle Date", "Raffled Date"])),
  committee1: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Committee 1", "Commitee 1"])),
  committee2: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Committee 2", "Commitee 2"])),
  judge: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Judge", "JUDGE"])),
  ao: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["AO", "A.O.", "A.O"])),
  complainant: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Complainant", "COMPLAINANT"])),
  houseNo: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["House No", "HOUSE NO", "House Number"])),
  street: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Street"])),
  barangay: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Barangay"])),
  municipality: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Municipality"])),
  province: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Province"])),
  counts: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Counts"])),
  jdf: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["JDF"])),
  sajj: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["SAJJ", "sajj"])),
  sajj2: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["SAJJ2", "sajj2", "SAJJ 2"])),
  mf: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["MF", "mf"])),
  stf: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["STF", "stf"])),
  lrf: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["LRF", "lrf"])),
  vcf: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["VCF", "vcf"])),
  total: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Total", "TOTAL"])),
  amountInvolved: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Amount Involved", "AMOUNT INVOLVED"])),
});

export const CriminalCaseSchema = BaseCaseSchema.merge(
  CriminalCaseObjectSchema,
);
export type CriminalCaseSchema = z.infer<typeof CriminalCaseSchema>;

export type CriminalCaseData = Case & CriminalCase;

/** Form entry used by the grid UI (CaseSchema + UI metadata). */
export type CriminalCaseEntry = CriminalCaseSchema & {
  id: number;
  isManual: boolean;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert CaseSchema to CriminalCaseEntry (for editing existing cases). */
export const criminalCaseToEntry = (
  c: CriminalCaseData,
): CriminalCaseEntry => ({
  ...c,
  id: c.id ?? createTempId(),
  isManual: Boolean(c.isManual),
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialCaseFormData: Omit<CriminalCaseSchema, "id" | "createdAt"> =
  {
    branch: null,
    assistantBranch: null,
    caseNumber: "",
    dateFiled: new Date(),
    caseType: "CRIMINAL",
    name: "",
    charge: null,
    infoSheet: null,
    court: null,
    detained: null,
    consolidation: null,
    eqcNumber: null,
    bond: null,
    raffleDate: null,
    committee1: null,
    committee2: null,
    judge: null,
    ao: null,
    complainant: null,
    houseNo: null,
    street: null,
    barangay: null,
    municipality: null,
    province: null,
    jdf: null,
    sajj: null,
    sajj2: null,
    mf: null,
    stf: null,
    lrf: null,
    vcf: null,
    total: null,
    amountInvolved: null,
  };

/** Create an empty entry based on schema defaults. */
export const createEmptyCriminalEntry = (): CriminalCaseEntry => ({
  ...initialCaseFormData,
  id: createTempId(),
  isManual: false,
  errors: {},
  collapsed: false,
  saved: false,
});

export const calculateCriminalCaseStats = (
  cases: CriminalCaseData[],
): CriminalCaseStats => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    totalCases: cases.length,
    detainedCases: cases.filter((c) => c.detained).length,
    pendingCases: cases.filter((c) => !c.raffleDate).length,
    recentlyFiled: cases.filter(
      (c) => c.dateFiled && new Date(c.dateFiled) >= thirtyDaysAgo,
    ).length,
  };
};

export const formatCriminalCaseForDisplay = (caseItem: CriminalCaseData) => {
  return {
    ...caseItem,
    dateFiled: caseItem.dateFiled
      ? new Date(caseItem.dateFiled).toLocaleDateString()
      : "—",
    raffleDate: caseItem.raffleDate
      ? new Date(caseItem.raffleDate).toLocaleDateString()
      : "Not scheduled",
    bond: caseItem.bond || "—",
    detained: caseItem.detained ? "Yes" : "No",
  };
};

export const sortCriminalCases = (
  cases: CriminalCaseData[],
  sortBy: keyof CriminalCaseData,
  order: "asc" | "desc",
): CriminalCaseData[] => {
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
