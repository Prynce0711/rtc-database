import type { Case, SpecialProceeding } from "@/app/generated/prisma/browser";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";
import { BaseCaseSchema } from "../schema";

export type SpecialProceedingsFilterOptions =
  FilterOptions<SpecialProceedingSchema>;

export type SpecialProceedingFilters =
  SpecialProceedingsFilterOptions["filters"];

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
  petitioner: z.string().nullable().optional(),
  raffledTo: z.string().nullable().optional(),
  date: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date", "DATE", "Date Filed", "Filing Date"])),
  nature: z.string().nullable().optional(),
  respondent: z.string().nullable().optional(),
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
  "date" | "dateFiled" | "createdAt"
> & {
  date: string | Date | null;
  dateFiled: string | Date | null;
  createdAt?: Date;
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
  ...initialSpecialProceedingFormData,
  id: createTempId(),
  createdAt: new Date(),
  errors: {},
  collapsed: false,
  saved: false,
});
