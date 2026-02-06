import { BloodType } from "@/app/generated/prisma/enums";
import { z } from "zod";

export const EmployeeSchema = z.object({
  id: z.number().int().optional(),
  employeeName: z.string().min(1, "Employee name is required"),
  employeeNumber: z.string().min(1, "Employee number is required"),
  position: z.string().min(1, "Position is required"),
  branch: z.string().min(1, "Branch is required"),
  tinNumber: z.string().optional(),
  gsisNumber: z.string().optional(),
  philHealthNumber: z.string().optional(),
  pagIbigNumber: z.string().optional(),
  birthDate: z.union([z.date(), z.string().transform((val) => new Date(val))]),
  bloodType: z.enum(BloodType).optional(),
  allergies: z.string().optional(),
  height: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : undefined)),
    ])
    .optional(),
  weight: z
    .union([
      z.number(),
      z.string().transform((val) => (val ? parseFloat(val) : undefined)),
    ])
    .optional(),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().optional(),
  email: z.email("Invalid email format").optional().or(z.literal("")),
});

export type EmployeeSchema = z.infer<typeof EmployeeSchema>;

export const initialEmployeeFormData: EmployeeSchema = {
  employeeName: "",
  employeeNumber: "",
  position: "",
  branch: "",
  tinNumber: "",
  gsisNumber: "",
  philHealthNumber: "",
  pagIbigNumber: "",
  birthDate: new Date(),
  bloodType: undefined,
  allergies: "",
  height: undefined,
  weight: undefined,
  contactPerson: "",
  contactNumber: "",
  email: "",
};
