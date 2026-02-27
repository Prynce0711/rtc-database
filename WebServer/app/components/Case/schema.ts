import { Case } from "@/app/generated/prisma/browser";
import { CaseType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const CaseSchema = z.object({
  branch: z.string().min(1, "Branch is required"),
  assistantBranch: z.string().min(1, "Assistant branch is required"),
  caseNumber: z.string().min(1, "Case number is required"),
  dateFiled: z.coerce.date(),
  name: z.string().min(1, "Name is required"),
  charge: z.string().min(1, "Charge is required"),
  infoSheet: z.string().min(1, "Info sheet is required"),
  court: z.string().min(1, "Court is required"),
  caseType: z.enum(CaseType),
  detained: z.coerce.boolean(),
  consolidation: z.string().min(1, "Consolidation is required"),
  eqcNumber: z.coerce.number().int().nullable().optional(),
  bond: z.coerce.number().nullable().optional(),
  raffleDate: z.coerce.date().nullable().optional(),
  committee1: z.coerce.number().int().nullable().optional(),
  committee2: z.coerce.number().int().nullable().optional(),
  judge: z.string().nullable().optional(),
  ao: z.string().nullable().optional(),
  complainant: z.string().nullable().optional(),
  houseNo: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  barangay: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  counts: z.string().nullable().optional(),
  jdf: z.coerce.number().nullable().optional(),
  sajj: z.coerce.number().nullable().optional(),
  sajj2: z.coerce.number().nullable().optional(),
  mf: z.coerce.number().nullable().optional(),
  stf: z.coerce.number().nullable().optional(),
  lrf: z.coerce.number().nullable().optional(),
  vcf: z.coerce.number().nullable().optional(),
  total: z.coerce.number().nullable().optional(),
  amountInvolved: z.coerce.number().nullable().optional(),
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
  branch: "",
  assistantBranch: "",
  caseNumber: "",
  dateFiled: new Date(),
  caseType: "UNKNOWN",
  name: "",
  charge: "",
  infoSheet: "",
  court: "",
  detained: false,
  consolidation: "",
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

/** Create an empty entry based on schema defaults. */
export const createEmptyEntry = (): CaseEntry => ({
  ...initialCaseFormData,
  id: 0,
  createdAt: new Date(),
  errors: {},
  collapsed: false,
  saved: false,
});
