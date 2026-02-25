import { z } from "zod";

export const SpecialProceedingSchema = z.object({
  id: z.number().int().optional(),
  caseNumber: z.string().min(1, "Case number is required"),
  petitioner: z.string().nullable().optional(),
  raffledTo: z.string().nullable().optional(),
  date: z
    .union([
      z.date(),
      z.string().transform((val) => (val ? new Date(val) : null)),
    ])
    .nullable()
    .optional(),
  nature: z.string().nullable().optional(),
  respondent: z.string().nullable().optional(),
});

export type SpecialProceedingSchema = z.infer<typeof SpecialProceedingSchema>;

/** Form Entry - derived from SpecialProceedingSchema with all fields as strings for HTML inputs */
export type SpecialProceedingFormEntry = {
  id: string;
  caseNumber: string;
  petitioner: string;
  raffledTo: string;
  date: string;
  nature: string;
  respondent: string;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert SpecialProceedingSchema to SpecialProceedingFormEntry (for editing existing special proceedings) */
export const specialProceedingToFormEntry = (
  id: string,
  sp: SpecialProceedingSchema,
): SpecialProceedingFormEntry => ({
  id,
  caseNumber: sp.caseNumber ?? "",
  petitioner: sp.petitioner ?? "",
  raffledTo: sp.raffledTo ?? "",
  date: sp.date ? new Date(sp.date).toISOString().slice(0, 10) : "",
  nature: sp.nature ?? "",
  respondent: sp.respondent ?? "",
  errors: {},
  collapsed: false,
  saved: false,
});

/** Create empty special proceeding form entry */
export const createEmptySpecialProceedingFormEntry = (
  id: string,
): SpecialProceedingFormEntry => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    caseNumber: "",
    petitioner: "",
    raffledTo: "",
    date: today,
    nature: "",
    respondent: "",
    errors: {},
    collapsed: false,
    saved: false,
  };
};

export const initialSpecialProceedingFormData: SpecialProceedingSchema = {
  caseNumber: "",
  petitioner: undefined,
  raffledTo: undefined,
  date: undefined,
  nature: undefined,
  respondent: undefined,
};
