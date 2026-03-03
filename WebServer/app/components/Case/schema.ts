import { Case } from "@/app/generated/prisma/browser";
import { CaseType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const CaseSchema = z.object({
  id: z.coerce.number().int().optional(), // Optional for new cases that haven't been saved yet
  branch: z.string().nullable().optional(),
  assistantBranch: z.string().nullable().optional(),
  caseNumber: z.string().min(1, "Case number is required"),
  dateFiled: z.coerce.date().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  charge: z.string().nullable().optional(),
  infoSheet: z.string().nullable().optional(),
  court: z.string().nullable().optional(),
  caseType: z.enum(CaseType),
  detained: z.string().nullable().optional(),
  consolidation: z.string().nullable().optional(),
  eqcNumber: z.coerce.number().int().nullable().optional(),
  bond: z.string().nullable().optional(),
  raffleDate: z.coerce.date().nullable().optional(),
  committee1: z.string().nullable().optional(),
  committee2: z.string().nullable().optional(),
  judge: z.string().nullable().optional(),
  ao: z.string().nullable().optional(),
  complainant: z.string().nullable().optional(),
  houseNo: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  barangay: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  counts: z.string().nullable().optional(),
  jdf: z.string().nullable().optional(),
  sajj: z.string().nullable().optional(),
  sajj2: z.string().nullable().optional(),
  mf: z.string().nullable().optional(),
  stf: z.string().nullable().optional(),
  lrf: z.string().nullable().optional(),
  vcf: z.string().nullable().optional(),
  total: z.string().nullable().optional(),
  amountInvolved: z.string().nullable().optional(),
});
export type CaseSchema = z.infer<typeof CaseSchema>;

/** Form entry used by the grid UI (CaseSchema + UI metadata). */
export type CaseEntry = Case & {
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert CaseSchema to CaseEntry (for editing existing cases). */
export const caseToEntry = (c: Case): CaseEntry => ({
  ...c,
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialCaseFormData: Omit<Case, "id" | "createdAt"> = {
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
  counts: null,
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

let tempIdCounter = 0;

export const createTempId = (): number => {
  tempIdCounter += 1;
  return -tempIdCounter;
};

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): CaseEntry => ({
  ...initialCaseFormData,
  id: createTempId(),
  createdAt: new Date(),
  errors: {},
  collapsed: false,
  saved: false,
});
