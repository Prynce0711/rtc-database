import { z } from "zod";

export const BaseLogData = z.object({
  id: z.number().int().optional(),
  action: z.string(), // prisma enum will be validated elsewhere
  timestamp: z.date().optional(),
  userId: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.date().optional(),
});
export type BaseLogData = z.infer<typeof BaseLogData>;

export const CreateLogData = z.object({
  action: z.string(),
  details: z.any().optional(),
});
export type CreateLogData = z.infer<typeof CreateLogData>;

export const CompleteLogData = BaseLogData.merge(CreateLogData);
export type CompleteLogData = z.infer<typeof CompleteLogData>;

export const CaseSchema = z.object({
  id: z.number().int().optional(),
  branch: z.string().min(1, "Branch is required"),
  pendingLastYear: z.union([z.string(), z.number()]).optional(),
  RaffledOrAdded: z.union([z.string(), z.number()]).optional(),
  Disposed: z.union([z.string(), z.number()]).optional(),
  pendingThisYear: z.union([z.string(), z.number()]).optional(),
  percentageOfDisposition: z.union([z.string(), z.number()]).optional(),
});
export type CaseSchema = z.infer<typeof CaseSchema>;

export const InventoryDocumentSchema = z.object({
  id: z.number().int().optional(),
  region: z.string().min(1, "Region is required"),
  province: z.string().min(1, "Province is required"),
  court: z.string().min(1, "Court is required"),
  cityMunicipality: z.string().min(1, "City/Municipality is required"),
  branch: z.string().min(1, "Branch is required"),
  civilSmallClaimsFiled: z.union([z.string(), z.number()]).optional(),
  criminalCasesFiled: z.union([z.string(), z.number()]).optional(),
  civilSmallClaimsDisposed: z.union([z.string(), z.number()]).optional(),
  criminalCasesDisposed: z.union([z.string(), z.number()]).optional(),
  dateRecorded: z.union([z.string(), z.date()]).optional(),
});
export type InventoryDocumentSchema = z.infer<typeof InventoryDocumentSchema>;
