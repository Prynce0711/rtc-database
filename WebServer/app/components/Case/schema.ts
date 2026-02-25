import { CaseType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const CaseSchema = z.object({
  id: z.number().int().optional(),
  branch: z.string().min(1, "Branch is required"),
  assistantBranch: z.string().min(1, "Assistant branch is required"),
  caseNumber: z.string().min(1, "Case number is required"),
  dateFiled: z.union([z.date(), z.string().transform((val) => new Date(val))]),
  name: z.string().min(1, "Name is required"),
  charge: z.string().min(1, "Charge is required"),
  infoSheet: z.string().min(1, "Info sheet is required"),
  court: z.string().min(1, "Court is required"),
  caseType: z.enum(CaseType),
  detained: z.union([
    z.boolean(),
    z.string().transform((val) => val === "true" || val === "1"),
  ]),
  consolidation: z.string().min(1, "Consolidation is required"),
  eqcNumber: z
    .union([
      z.number().int(),
      z.string().transform((val) => (val ? parseInt(val) : null)),
    ])
    .nullable()
    .optional(),
  bond: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  raffleDate: z
    .union([
      z.date(),
      z.string().transform((val) => (val ? new Date(val) : null)),
    ])
    .nullable()
    .optional(),
  committe1: z
    .union([
      z.number().int(),
      z.string().transform((val) => (val ? parseInt(val) : null)),
    ])
    .nullable()
    .optional(),
  committe2: z
    .union([
      z.number().int(),
      z.string().transform((val) => (val ? parseInt(val) : null)),
    ])
    .nullable()
    .optional(),
  Judge: z.string().nullable().optional(),
  AO: z.string().nullable().optional(),
  Complainant: z.string().nullable().optional(),
  HouseNo: z.string().nullable().optional(),
  Street: z.string().nullable().optional(),
  Barangay: z.string().nullable().optional(),
  Municipality: z.string().nullable().optional(),
  Province: z.string().nullable().optional(),
  Counts: z.string().nullable().optional(),
  Jdf: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  Sajj: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  Sajj2: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  MF: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  STF: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  LRF: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  VCF: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  Total: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
  AmountInvolved: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : null)),
    ])
    .nullable()
    .optional(),
});
export type CaseSchema = z.infer<typeof CaseSchema>;

/** Form Entry - derived from CaseSchema with all fields as strings for HTML inputs */
export type FormEntry = {
  id: string;
  branch: string;
  assistantBranch: string;
  caseNumber: string;
  dateFiled: string;
  name: string;
  charge: string;
  infoSheet: string;
  court: string;
  caseType: string;
  detained: boolean;
  consolidation: string;
  eqcNumber: string;
  bond: string;
  raffleDate: string;
  committe1: string;
  committe2: string;
  Judge: string;
  AO: string;
  Complainant: string;
  HouseNo: string;
  Street: string;
  Barangay: string;
  Municipality: string;
  Province: string;
  Counts: string;
  Jdf: string;
  Sajj: string;
  Sajj2: string;
  MF: string;
  STF: string;
  LRF: string;
  VCF: string;
  Total: string;
  AmountInvolved: string;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert CaseSchema to FormEntry (for editing existing cases) */
export const caseToFormEntry = (id: string, c: CaseSchema): FormEntry => ({
  id,
  branch: c.branch ?? "",
  assistantBranch: c.assistantBranch ?? "",
  caseNumber: c.caseNumber ?? "",
  dateFiled: c.dateFiled
    ? new Date(c.dateFiled).toISOString().slice(0, 10)
    : "",
  name: c.name ?? "",
  charge: c.charge ?? "",
  infoSheet: c.infoSheet ?? "",
  court: c.court ?? "",
  caseType: c.caseType ?? "UNKNOWN",
  detained: c.detained ?? false,
  consolidation: c.consolidation ?? "",
  eqcNumber: c.eqcNumber?.toString() ?? "",
  bond: c.bond?.toString() ?? "",
  raffleDate: c.raffleDate
    ? new Date(c.raffleDate).toISOString().slice(0, 10)
    : "",
  committe1: c.committe1?.toString() ?? "",
  committe2: c.committe2?.toString() ?? "",
  Judge: c.Judge ?? "",
  AO: c.AO ?? "",
  Complainant: c.Complainant ?? "",
  HouseNo: c.HouseNo ?? "",
  Street: c.Street ?? "",
  Barangay: c.Barangay ?? "",
  Municipality: c.Municipality ?? "",
  Province: c.Province ?? "",
  Counts: c.Counts?.toString() ?? "",
  Jdf: c.Jdf?.toString() ?? "",
  Sajj: c.Sajj?.toString() ?? "",
  Sajj2: c.Sajj2?.toString() ?? "",
  MF: c.MF?.toString() ?? "",
  STF: c.STF?.toString() ?? "",
  LRF: c.LRF?.toString() ?? "",
  VCF: c.VCF?.toString() ?? "",
  Total: c.Total?.toString() ?? "",
  AmountInvolved: c.AmountInvolved?.toString() ?? "",
  errors: {},
  collapsed: false,
  saved: false,
});

/** Create empty form entry from schema defaults */
export const createEmptyFormEntry = (id: string): FormEntry => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    branch: initialCaseFormData.branch,
    assistantBranch: initialCaseFormData.assistantBranch,
    caseNumber: initialCaseFormData.caseNumber,
    dateFiled: today,
    name: initialCaseFormData.name,
    charge: initialCaseFormData.charge,
    infoSheet: initialCaseFormData.infoSheet,
    court: initialCaseFormData.court,
    caseType: initialCaseFormData.caseType,
    detained: initialCaseFormData.detained,
    consolidation: initialCaseFormData.consolidation,
    eqcNumber: initialCaseFormData.eqcNumber?.toString() ?? "",
    bond: initialCaseFormData.bond?.toString() ?? "",
    raffleDate: "",
    committe1: "",
    committe2: "",
    Judge: "",
    AO: "",
    Complainant: "",
    HouseNo: "",
    Street: "",
    Barangay: "",
    Municipality: "",
    Province: "",
    Counts: "",
    Jdf: "",
    Sajj: "",
    Sajj2: "",
    MF: "",
    STF: "",
    LRF: "",
    VCF: "",
    Total: "",
    AmountInvolved: "",
    errors: {},
    collapsed: false,
    saved: false,
  };
};

export const initialCaseFormData: CaseSchema = {
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
  eqcNumber: undefined,
  bond: 0,
  raffleDate: undefined,
  committe1: undefined,
  committe2: undefined,
  Judge: undefined,
  AO: undefined,
  Complainant: undefined,
  HouseNo: undefined,
  Street: undefined,
  Barangay: undefined,
  Municipality: undefined,
  Province: undefined,
  Counts: undefined,
  Jdf: undefined,
  Sajj: undefined,
  Sajj2: undefined,
  MF: undefined,
  STF: undefined,
  LRF: undefined,
  VCF: undefined,
  Total: undefined,
  AmountInvolved: undefined,
};

/** Create an empty entry based on schema, converting to string format for form display */
export const createEmptyEntry = (id: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    branch: initialCaseFormData.branch,
    assistantBranch: initialCaseFormData.assistantBranch,
    caseNumber: initialCaseFormData.caseNumber,
    dateFiled: today,
    caseType: initialCaseFormData.caseType,
    name: initialCaseFormData.name,
    charge: initialCaseFormData.charge,
    infoSheet: initialCaseFormData.infoSheet,
    court: initialCaseFormData.court,
    detained: initialCaseFormData.detained,
    consolidation: initialCaseFormData.consolidation,
    eqcNumber: initialCaseFormData.eqcNumber?.toString() ?? "",
    bond: initialCaseFormData.bond?.toString() ?? "",
    raffleDate: initialCaseFormData.raffleDate
      ? new Date(initialCaseFormData.raffleDate).toISOString().slice(0, 10)
      : "",
    committe1: initialCaseFormData.committe1?.toString() ?? "",
    committe2: initialCaseFormData.committe2?.toString() ?? "",
    Judge: initialCaseFormData.Judge ?? "",
    AO: initialCaseFormData.AO ?? "",
    Complainant: initialCaseFormData.Complainant ?? "",
    HouseNo: initialCaseFormData.HouseNo ?? "",
    Street: initialCaseFormData.Street ?? "",
    Barangay: initialCaseFormData.Barangay ?? "",
    Municipality: initialCaseFormData.Municipality ?? "",
    Province: initialCaseFormData.Province ?? "",
    Counts: initialCaseFormData.Counts?.toString() ?? "",
    Jdf: initialCaseFormData.Jdf?.toString() ?? "",
    Sajj: initialCaseFormData.Sajj?.toString() ?? "",
    Sajj2: initialCaseFormData.Sajj2?.toString() ?? "",
    MF: initialCaseFormData.MF?.toString() ?? "",
    STF: initialCaseFormData.STF?.toString() ?? "",
    LRF: initialCaseFormData.LRF?.toString() ?? "",
    VCF: initialCaseFormData.VCF?.toString() ?? "",
    Total: initialCaseFormData.Total?.toString() ?? "",
    AmountInvolved: initialCaseFormData.AmountInvolved?.toString() ?? "",
    errors: {},
    collapsed: false,
    saved: false,
  };
};
