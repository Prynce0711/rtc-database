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
  Is: z.string().nullable().optional(),
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

export const initialCaseFormData: CaseSchema = {
  branch: "",
  assistantBranch: "",
  caseNumber: "",
  dateFiled: new Date(),
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
  Is: undefined,
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
