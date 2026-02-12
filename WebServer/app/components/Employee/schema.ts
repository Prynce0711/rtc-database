import { BloodType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const EmployeeSchema = z.object({
  id: z.number().int().optional(),

  employeeName: z.string().min(1),
  employeeNumber: z.string().nullable().optional(),
  position: z.string().min(1),
  branch: z.string().min(1),

  tinNumber: z.string().nullable().optional(),
  gsisNumber: z.string().nullable().optional(),
  philHealthNumber: z.string().nullable().optional(),
  pagIbigNumber: z.string().nullable().optional(),

  birthDate: z.coerce.date(),

  bloodType: z.enum(BloodType).nullable().optional(),

  allergies: z.string().nullable().optional(),

  height: z.coerce.number().nullable().optional(),
  weight: z.coerce.number().nullable().optional(),

  contactPerson: z.string().min(1),
  contactNumber: z.string().nullable().optional(),

  email: z.email().nullable().optional().or(z.literal("")),
});

export type EmployeeSchema = z.infer<typeof EmployeeSchema>;
