import { Sherriff as SherriffModel } from "@/app/generated/prisma/client";
import { excelHeaders } from "@/app/lib/excel";
import { z } from "zod";
import { FilterOptions } from "../../Filter/FilterUtils";

const SherriffObjectSchema = z.object({
  ejfCaseNumber: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "EJF Case Number",
        "EJF Case No.",
        "EJF No.",
        "Case Number",
        "Case No.",
      ]),
    ),
  mortgagee: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Mortgagee"])),
  mortgagor: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Mortgagor"])),
  name: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Name", "Sheriff Name"])),
  date: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date"])),
  remarks: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Remarks", "Notes"])),
});

export const SherriffSchema = SherriffObjectSchema;

export type SherriffSchema = z.infer<typeof SherriffSchema>;
export type SherriffFilterOptions = FilterOptions<SherriffSchema> & {
  sortKey?:
    | "ejfCaseNumber"
    | "mortgagee"
    | "mortgagor"
    | "name"
    | "date"
    | "remarks";
};

export type SherriffEntry = Omit<
  SherriffModel,
  "id" | "date" | "createdAt" | "updatedAt"
> & {
  id: number;
  date: string | Date | null;
  createdAt?: Date;
  updatedAt?: Date | null;
  errors: Record<string, string>;
};

export const initialSherriffFormData: Omit<
  SherriffModel,
  "id" | "createdAt" | "updatedAt"
> = {
  ejfCaseNumber: null,
  mortgagee: null,
  mortgagor: null,
  name: null,
  date: null,
  remarks: null,
};
