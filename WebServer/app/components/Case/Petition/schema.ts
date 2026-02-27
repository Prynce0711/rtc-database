import { Petition } from "@/app/generated/prisma/client";
import { z } from "zod";

export const PetitionSchema = z.object({
  caseNumber: z.string().min(1, "Case number is required"),
  petitioner: z.string().nullable().optional(),
  raffledTo: z.string().nullable().optional(),
  date: z.coerce.date().nullable().optional(),
  nature: z.string().nullable().optional(),
});

export type PetitionSchema = z.infer<typeof PetitionSchema>;

/** Form entry used by the grid UI (Petition + UI metadata). */
export type PetitionEntry = Petition & {
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert Petition to PetitionEntry (for editing existing petitions). */
export const petitionToEntry = (p: Petition): PetitionEntry => ({
  ...p,
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialPetitionFormData: Omit<Petition, "id" | "createdAt"> = {
  caseNumber: "",
  petitioner: null,
  raffledTo: null,
  date: null,
  nature: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): PetitionEntry => ({
  ...initialPetitionFormData,
  id: 0,
  createdAt: new Date(),
  errors: {},
  collapsed: false,
  saved: false,
});
