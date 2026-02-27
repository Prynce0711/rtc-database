import { SpecialProceeding } from "@/app/generated/prisma/client";
import { z } from "zod";

export const SpecialProceedingSchema = z.object({
  caseNumber: z.string().min(1, "Case number is required"),
  petitioner: z.string().nullable().optional(),
  raffledTo: z.string().nullable().optional(),
  date: z.coerce.date().nullable().optional(),
  nature: z.string().nullable().optional(),
  respondent: z.string().nullable().optional(),
});

export type SpecialProceedingSchema = z.infer<typeof SpecialProceedingSchema>;

/** Form entry used by the grid UI (SpecialProceeding + UI metadata). */
export type SpecialProceedingEntry = SpecialProceeding & {
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert SpecialProceeding to SpecialProceedingEntry (for editing existing special proceedings). */
export const specialProceedingToEntry = (
  sp: SpecialProceeding,
): SpecialProceedingEntry => ({
  ...sp,
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialSpecialProceedingFormData: Omit<
  SpecialProceeding,
  "id" | "createdAt"
> = {
  caseNumber: "",
  petitioner: null,
  raffledTo: null,
  date: null,
  nature: null,
  respondent: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): SpecialProceedingEntry => ({
  ...initialSpecialProceedingFormData,
  id: 0,
  createdAt: new Date(),
  errors: {},
  collapsed: false,
  saved: false,
});
