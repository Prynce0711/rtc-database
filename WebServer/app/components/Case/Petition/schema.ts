import { z } from "zod";

export const PetitionSchema = z.object({
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
});

export type PetitionSchema = z.infer<typeof PetitionSchema>;

/** Form Entry - derived from PetitionSchema with all fields as strings for HTML inputs */
export type PetitionFormEntry = {
  id: string;
  caseNumber: string;
  petitioner: string;
  raffledTo: string;
  date: string;
  nature: string;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert PetitionSchema to PetitionFormEntry (for editing existing petitions) */
export const petitionToFormEntry = (
  id: string,
  p: PetitionSchema,
): PetitionFormEntry => ({
  id,
  caseNumber: p.caseNumber ?? "",
  petitioner: p.petitioner ?? "",
  raffledTo: p.raffledTo ?? "",
  date: p.date ? new Date(p.date).toISOString().slice(0, 10) : "",
  nature: p.nature ?? "",
  errors: {},
  collapsed: false,
  saved: false,
});

/** Create empty petition form entry */
export const createEmptyPetitionFormEntry = (id: string): PetitionFormEntry => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    caseNumber: "",
    petitioner: "",
    raffledTo: "",
    date: today,
    nature: "",
    errors: {},
    collapsed: false,
    saved: false,
  };
};

export const initialPetitionFormData: PetitionSchema = {
  caseNumber: "",
  petitioner: undefined,
  raffledTo: undefined,
  date: undefined,
  nature: undefined,
};
