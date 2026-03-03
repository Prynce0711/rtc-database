import { z } from "zod";

export const MonthlyRowSchema = z.object({
  id: z.number().int().optional(),
  month: z.string().min(1, "Month is required"), // YYYY-MM
  category: z.string().min(1, "Category is required"),
  branch: z.string().min(1, "Branch is required"),
  criminal: z.number().int().nonnegative(),
  civil: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type MonthlyRow = z.infer<typeof MonthlyRowSchema>;

export default MonthlyRowSchema;
