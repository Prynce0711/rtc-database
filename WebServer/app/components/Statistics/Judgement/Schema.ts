import { z } from "zod";

// Base for judgement rows used in the UI
export const JudgementBase = z.object({
  id: z.number().int().optional(),
  branchNo: z.string().nullable().optional(),
  dateRecorded: z.union([z.string(), z.date()]).optional(),
});
export type JudgementBase = z.infer<typeof JudgementBase>;

// MTC (Municipal) judgement row schema
export const MTCJudgementRowSchema = JudgementBase.extend({
  civilV: z.union([z.string(), z.number()]).optional(),
  civilInC: z.union([z.string(), z.number()]).optional(),
  criminalV: z.union([z.string(), z.number()]).optional(),
  criminalInC: z.union([z.string(), z.number()]).optional(),
  totalHeard: z.union([z.string(), z.number()]).optional(),
  disposedCivil: z.union([z.string(), z.number()]).optional(),
  disposedCrim: z.union([z.string(), z.number()]).optional(),
  totalDisposed: z.union([z.string(), z.number()]).optional(),
  pdlM: z.union([z.string(), z.number()]).optional(),
  pdlF: z.union([z.string(), z.number()]).optional(),
  pdlTotal: z.union([z.string(), z.number()]).optional(),
  pdlV: z.union([z.string(), z.number()]).optional(),
  pdlI: z.union([z.string(), z.number()]).optional(),
  pdlBail: z.union([z.string(), z.number()]).optional(),
  pdlRecognizance: z.union([z.string(), z.number()]).optional(),
  pdlMinRor: z.union([z.string(), z.number()]).optional(),
  pdlMaxSentence: z.union([z.string(), z.number()]).optional(),
  pdlDismissal: z.union([z.string(), z.number()]).optional(),
  pdlAcquittal: z.union([z.string(), z.number()]).optional(),
  pdlMinSentence: z.union([z.string(), z.number()]).optional(),
  pdlOthers: z.union([z.string(), z.number()]).optional(),
  total: z.union([z.string(), z.number()]).optional(),
});
export type MTCJudgementRow = z.infer<typeof MTCJudgementRowSchema>;

// RTC (Regional) judgement row schema
export const RTCJudgementRowSchema = JudgementBase.extend({
  civilV: z.union([z.string(), z.number()]).optional(),
  civilInC: z.union([z.string(), z.number()]).optional(),
  criminalV: z.union([z.string(), z.number()]).optional(),
  criminalInC: z.union([z.string(), z.number()]).optional(),
  totalHeard: z.union([z.string(), z.number()]).optional(),
  disposedCivil: z.union([z.string(), z.number()]).optional(),
  disposedCrim: z.union([z.string(), z.number()]).optional(),
  summaryProc: z.union([z.string(), z.number()]).optional(),
  casesDisposed: z.union([z.string(), z.number()]).optional(),
  pdlM: z.union([z.string(), z.number()]).optional(),
  pdlF: z.union([z.string(), z.number()]).optional(),
  pdlCICL: z.union([z.string(), z.number()]).optional(),
  pdlTotal: z.union([z.string(), z.number()]).optional(),
  pdlV: z.union([z.string(), z.number()]).optional(),
  pdlInC: z.union([z.string(), z.number()]).optional(),
  pdlBail: z.union([z.string(), z.number()]).optional(),
  pdlRecognizance: z.union([z.string(), z.number()]).optional(),
  pdlMinRor: z.union([z.string(), z.number()]).optional(),
  pdlMaxSentence: z.union([z.string(), z.number()]).optional(),
  pdlDismissal: z.union([z.string(), z.number()]).optional(),
  pdlAcquittal: z.union([z.string(), z.number()]).optional(),
  pdlMinSentence: z.union([z.string(), z.number()]).optional(),
  pdlProbation: z.union([z.string(), z.number()]).optional(),
  ciclM: z.union([z.string(), z.number()]).optional(),
  ciclF: z.union([z.string(), z.number()]).optional(),
  ciclV: z.union([z.string(), z.number()]).optional(),
  ciclInC: z.union([z.string(), z.number()]).optional(),
  fine: z.union([z.string(), z.number()]).optional(),
  total: z.union([z.string(), z.number()]).optional(),
});
export type RTCJudgementRow = z.infer<typeof RTCJudgementRowSchema>;

export {
    MTCJudgementRowSchema as MTCJudgementSchema,
    RTCJudgementRowSchema as RTCJudgementSchema
};

