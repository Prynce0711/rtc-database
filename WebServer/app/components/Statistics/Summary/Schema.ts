import { z } from "zod";
import { SUMMARY_COURT_TYPES } from "./SummaryConstants";

const courtTypeValues = SUMMARY_COURT_TYPES.map((item) => item.value);

export const SummaryRowSchema = z.object({
  id: z.number().int().optional(),
  courtType: z.enum(courtTypeValues as [string, ...string[]]),
  reportYear: z.number().int().min(1900).max(2100),
  raffleDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Raffle date must be YYYY-MM-DD"),
  branch: z.string().min(1, "Branch is required"),
  civilFamily: z.number().int().nonnegative(),
  civilOrdinary: z.number().int().nonnegative(),
  civilReceivedViaReraffled: z.number().int().nonnegative(),
  civilUnloaded: z.number().int().nonnegative(),
  lrcPetition: z.number().int().nonnegative(),
  lrcSpProc: z.number().int().nonnegative(),
  lrcReceivedViaReraffled: z.number().int().nonnegative(),
  lrcUnloaded: z.number().int().nonnegative(),
  criminalFamily: z.number().int().nonnegative(),
  criminalDrugs: z.number().int().nonnegative(),
  criminalOrdinary: z.number().int().nonnegative(),
  criminalReceivedViaReraffled: z.number().int().nonnegative(),
  criminalUnloaded: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type SummaryRow = z.infer<typeof SummaryRowSchema>;

export const SummaryRowArraySchema = z.array(SummaryRowSchema);
