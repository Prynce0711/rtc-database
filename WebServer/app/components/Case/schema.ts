import type { Case, CriminalCase } from "@/app/generated/prisma/client";
import { CaseType } from "@/app/generated/prisma/enums";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "../Filter/FilterUtils";

export type CriminalCasesFilterOptions = FilterOptions<CriminalCaseSchema>;

export type CriminalCaseFilters = CriminalCasesFilterOptions["filters"];

export type CriminalCaseStats = {
  totalCases: number;
  detainedCases: number;
  pendingCases: number;
  recentlyFiled: number;
};

export const BaseCaseSchema = z.object({
  id: z.coerce.number().int().optional(), // Optional for new cases that haven't been saved yet
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
  eqcNumber: z.coerce
    .number()
    .int()
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

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

/** Form entry used by the grid UI (CaseSchema + UI metadata). */
export type CaseEntry = CriminalCaseSchema & {
  id: number;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert CaseSchema to CaseEntry (for editing existing cases). */
export const caseToEntry = (c: CriminalCaseData): CaseEntry => ({
  ...c,
  id: c.id ?? createTempId(),
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
    caseType: "UNKNOWN",
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
export const createEmptyEntry = (): CaseEntry => ({
  ...initialCaseFormData,
  id: createTempId(),
  errors: {},
  collapsed: false,
  saved: false,
});
