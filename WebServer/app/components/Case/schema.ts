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
      z.string().transform((val) => (val ? parseInt(val) : undefined)),
    ])
    .optional(),
  bond: z.union([z.number(), z.string().transform((val) => parseFloat(val))]),
  raffleDate: z
    .union([
      z.date(),
      z.string().transform((val) => (val ? new Date(val) : undefined)),
    ])
    .optional(),
  committe1: z
    .union([
      z.number().int(),
      z.string().transform((val) => (val ? parseInt(val) : undefined)),
    ])
    .optional(),
  committe2: z
    .union([
      z.number().int(),
      z.string().transform((val) => (val ? parseInt(val) : undefined)),
    ])
    .optional(),
});
export type CaseType = z.infer<typeof CaseSchema>;
