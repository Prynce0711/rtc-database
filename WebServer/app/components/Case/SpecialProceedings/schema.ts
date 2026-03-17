import type { Case, SpecialProceeding } from "@/app/generated/prisma/browser";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";
import { BaseCaseSchema } from "../schema";

export type SpecialProceedingsFilterOptions =
  FilterOptions<SpecialProceedingSchema>;

export type SpecialProceedingFilters =
  SpecialProceedingsFilterOptions["filters"];

export type SpecialProceedingStats = {
  totalCases: number;
  thisMonth: number;
  caseTypes: number;
  branches: number;
};

const SpecialProceedingObjectSchema = z.object({
  caseNumber: z
    .string()
    .min(1, "Case number is required")
    .describe(
      excelHeaders([
        "Case Number",
        "Case no.",
        "Case No.",
        "Case No",
        "CaseNumber",
        "SPC. Case Number",
        "SPC Case No.",
        "SPC. Number",
        "SPC Number",
        "SPC. No.",
        "SPC No.",
      ]),
    ),
  petitioner: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Petitioner", "Petitioner Name", "Petitioner/s"])),
  raffledTo: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Raffled To", "Raffled Judge", "Raffled"])),
  date: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date", "DATE", "Date Filed", "Filing Date"])),
  nature: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Nature", "Nature of Case"])),
  respondent: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Respondent", "Respondent Name", "Respondent/s"])),
});

export const SpecialProceedingSchema = BaseCaseSchema.merge(
  SpecialProceedingObjectSchema,
);

export type SpecialProceedingSchema = z.infer<typeof SpecialProceedingSchema>;
export type SpecialProceedingData = Case & SpecialProceeding;

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

/** Form entry used by the grid UI (SpecialProceedingData + UI metadata). */
export type SpecialProceedingEntry = Omit<
  SpecialProceedingData,
  "date" | "dateFiled" | "createdAt" | "updatedAt"
> & {
  date: string | Date | null;
  dateFiled: string | Date | null;
  createdAt?: Date;
  updatedAt?: Date | null;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert SpecialProceedingData to SpecialProceedingEntry for editing. */
export const specialProceedingToEntry = (
  sp: SpecialProceedingData,
): SpecialProceedingEntry => ({
  ...sp,
  date: sp.date,
  dateFiled: sp.dateFiled,
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialSpecialProceedingFormData: Omit<
  SpecialProceedingSchema,
  "id" | "createdAt"
> = {
  branch: null,
  assistantBranch: null,
  caseNumber: "",
  dateFiled: null,
  caseType: "SCA",
  petitioner: null,
  raffledTo: null,
  date: null,
  nature: null,
  respondent: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): SpecialProceedingEntry => ({
  branch: initialSpecialProceedingFormData.branch ?? null,
  assistantBranch: initialSpecialProceedingFormData.assistantBranch ?? null,
  caseNumber: initialSpecialProceedingFormData.caseNumber,
  caseType: initialSpecialProceedingFormData.caseType,
  petitioner: initialSpecialProceedingFormData.petitioner ?? null,
  raffledTo: initialSpecialProceedingFormData.raffledTo ?? null,
  date: initialSpecialProceedingFormData.date ?? null,
  nature: initialSpecialProceedingFormData.nature ?? null,
  respondent: initialSpecialProceedingFormData.respondent ?? null,
  dateFiled: initialSpecialProceedingFormData.dateFiled ?? null,
  id: createTempId(),
  createdAt: new Date(),
  updatedAt: null,
  errors: {},
  collapsed: false,
  saved: false,
});

export const calculateSpecialProceedingStats = (
  cases: SpecialProceedingData[],
): SpecialProceedingStats => {
  const now = new Date();

  const thisMonth = cases.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  return {
    totalCases: cases.length,
    thisMonth,
    caseTypes: new Set(cases.map((c) => c.nature)).size,
    branches: new Set(cases.map((c) => c.raffledTo)).size,
  };
};
