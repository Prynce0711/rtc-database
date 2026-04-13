import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";
import type { Case, Petition } from "../../generated/prisma/browser";
import { excelHeaders } from "../../lib/excel";
import { BaseCaseSchema } from "../BaseCaseSchema";

export type PetitionCasesFilterOptions = FilterOptions<PetitionCaseSchema>;

export type PetitionCaseFilters = PetitionCasesFilterOptions["filters"];

export type PetitionCaseStats = {
  totalEntries: number;
  todayEntries: number;
  thisMonthEntries: number;
  distinctBranches: number;
};

const PetitionCaseObjectSchema = z.object({
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

export const PetitionCaseSchema = BaseCaseSchema.merge(
  PetitionCaseObjectSchema,
);

export type PetitionCaseSchema = z.infer<typeof PetitionCaseSchema>;
export type PetitionCaseData = Case & Petition;

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

export type PetitionCaseEntry = PetitionCaseSchema & {
  id: number;
  isManual: boolean;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

export const caseToEntry = (item: PetitionCaseData): PetitionCaseEntry => ({
  ...item,
  id: item.id ?? createTempId(),
  isManual: Boolean(item.isManual),
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialPetitionFormData: Omit<
  PetitionCaseSchema,
  "id" | "createdAt"
> = {
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

export const createEmptyEntry = (): PetitionCaseEntry => ({
  ...initialPetitionFormData,
  id: createTempId(),
  isManual: false,
  errors: {},
  collapsed: false,
  saved: false,
});

export const calculatePetitionCaseStats = (
  petitions: PetitionCaseData[],
): PetitionCaseStats => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const toDateStr = (value: Date | string | null | undefined): string => {
    if (!value) return "";
    return typeof value === "string" ? value : value.toISOString();
  };

  return {
    totalEntries: petitions.length,
    todayEntries: petitions.filter((petition) => {
      const dateStr = toDateStr(petition.date);
      return dateStr.slice(0, 10) === today;
    }).length,
    thisMonthEntries: petitions.filter((petition) => {
      const dateStr = toDateStr(petition.date);
      return dateStr.startsWith(thisMonth);
    }).length,
    distinctBranches: new Set(
      petitions
        .map((petition) => petition.raffledTo)
        .filter((branch) => branch),
    ).size,
  };
};
