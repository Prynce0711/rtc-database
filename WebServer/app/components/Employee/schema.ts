import { EmploymentType } from "@/app/generated/prisma/enums";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";

export const EmployeeSchema = z.object({
  id: z.number().int().optional(),

  employeeName: z
    .string()
    .min(1)
    .describe(excelHeaders(["Employee Name", "EMPLOYEE NAME", "Name"])),
  employeeNumber: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Employee Number",
        "EMPLOYEE NUMBER",
        "Employee No",
        "Emp No",
      ]),
    ),
  position: z
    .string()
    .min(1)
    .describe(excelHeaders(["Position", "POSITION"])),
  branch: z
    .string()
    .min(1)
    .describe(
      excelHeaders([
        "Branch/Station",
        "BRANCH/STATION",
        "Branch",
        "BRANCH",
        "Station",
      ]),
    ),
  birthDate: z.coerce
    .date()
    .describe(
      excelHeaders([
        "Birthday",
        "Birthdate",
        "BIRTHDAY",
        "Birth Date",
        "Date of Birth",
      ]),
    ),
  dateHired: z.coerce
    .date()
    .describe(excelHeaders(["Date Hired", "DATE HIRED", "Hire Date"])),
  employmentType: z
    .enum(EmploymentType)
    .describe(
      excelHeaders([
        "Employment Type",
        "EMPLOYMENT TYPE",
        "Employment Status",
        "EMPLOYMENT STATUS",
      ]),
    ),
  contactNumber: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders(["Contact Number", "CONTACT NUMBER", "Contact No", "Phone"]),
    ),
  email: z
    .email()
    .nullable()
    .optional()
    .or(z.literal(""))
    .describe(excelHeaders(["Email", "EMAIL"])),
});

export type EmployeeSchema = z.infer<typeof EmployeeSchema>;
