import {
  CaseType,
  excelHeaders,
  FilterOptions,
  RecievingLog,
} from "@rtc-database/shared";
import { z } from "zod";

const ReceivingLogObjectSchema = z.object({
  bookAndPage: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Book and Pages",
        "Book & Pages",
        "BookAndPages",
        "Book and Page",
      ]),
    ),
  dateRecieved: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Date Recieve",
        "Date Receive",
        "Date Received",
        "DateRecieved",
      ]),
    ),
  caseType: z
    .enum(CaseType)
    .describe(excelHeaders(["Abbreviation", "Case Type", "CaseType", "Type"])),
  caseNumber: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Case no.",
        "Case No.",
        "Case No",
        "Case Number",
        "CaseNumber",
      ]),
    ),
  content: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Content", "CONTENT", "Contents"])),
  branchNumber: z
    .string()
    .nullable()
    .optional()
    .describe(
      excelHeaders([
        "Branch no.",
        "Branch No.",
        "Branch No",
        "Branch Number",
        "BranchNumber",
        "Branch",
      ]),
    ),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Notes", "NOTES", "Note", "Remarks"])),
});

export const ReceivingLogSchema = ReceivingLogObjectSchema;

export type ReceivingLogSchema = z.infer<typeof ReceivingLogSchema>;
export type ReceivingLogFilterOptions = FilterOptions<ReceivingLogSchema> & {
  sortKey?:
    | "bookAndPage"
    | "dateRecieved"
    | "caseType"
    | "caseNumber"
    | "content"
    | "branchNumber"
    | "notes";
};
export type ReceivingLogFilters = ReceivingLogFilterOptions["filters"];

/** Form entry used by the grid UI (RecievingLog + UI metadata). */
export type ReceivingLogEntry = Omit<
  RecievingLog,
  "id" | "dateRecieved" | "createdAt" | "updatedAt"
> & {
  id: number;
  dateRecieved: string | Date | null;
  createdAt?: Date;
  updatedAt?: Date | null;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

/** Convert RecievingLog to ReceivingLogEntry (for editing existing logs). */
export const receivingLogToEntry = (log: RecievingLog): ReceivingLogEntry => ({
  ...log,
  errors: {},
  collapsed: false,
  saved: false,
});

export const initialReceivingLogFormData: Omit<
  RecievingLog,
  "id" | "createdAt" | "updatedAt"
> = {
  bookAndPage: null,
  dateRecieved: null,
  caseType: "UNKNOWN",
  caseNumber: null,
  content: null,
  branchNumber: null,
  notes: null,
};

/** Create an empty entry based on schema defaults. */
export const createEmptyRecievingLogEntry = (): ReceivingLogEntry => ({
  ...initialReceivingLogFormData,
  id: 0,
  createdAt: new Date(),
  updatedAt: null,
  errors: {},
  collapsed: false,
  saved: false,
});
