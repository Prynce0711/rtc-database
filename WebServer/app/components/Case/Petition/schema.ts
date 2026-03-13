import type { Case, Petition } from "@/app/generated/prisma/browser";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";
import { BaseCaseSchema } from "../schema";

export type PetitionCasesFilterOptions = FilterOptions<PetitionSchema>;

export type PetitionCaseFilters = PetitionCasesFilterOptions["filters"];

const PetitionObjectSchema = z.object({
  petitioner: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Petitioner", "Petitioner/s", "Petitioners"])),
  raffledTo: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Raffled To", "Raffled to", "Branch"])),
  date: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date", "Date Filed", "Filing Date"])),
  nature: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Nature", "Nature of Petition"])),
});

export const PetitionSchema = BaseCaseSchema.merge(PetitionObjectSchema);

export type PetitionSchema = z.infer<typeof PetitionSchema>;
export type PetitionCaseData = Case & Petition;

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

/** Form entry used by the grid UI (Petition schema + UI metadata). */
export type PetitionEntry = PetitionSchema & {
  id: number;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert combined petition case row to PetitionEntry. */
export const petitionToEntry = (p: PetitionCaseData): PetitionEntry => ({
  ...p,
  id: p.id ?? createTempId(),
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialPetitionFormData: Omit<PetitionSchema, "id" | "createdAt"> =
  {
    branch: null,
    assistantBranch: null,
    caseNumber: "",
    dateFiled: new Date(),
    caseType: "PETITION",
    petitioner: null,
    raffledTo: null,
    date: null,
    nature: null,
  };

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): PetitionEntry => ({
  ...initialPetitionFormData,
  id: createTempId(),
  errors: {},
  collapsed: false,
  saved: false,
});
