import { excelHeaders } from "@rtc-database/shared";
import type { NotarialCommission } from "@rtc-database/shared/prisma/browser";
import { z } from "zod";

const YEAR_PATTERN = /(?:19|20)\d{2}/g;

export type CommissionYears = {
  termStartYear?: number;
  termEndYear?: number;
};

export type NotarialCommissionKeyFields = {
  petition?: string | null;
  name?: string | null;
  termOfCommission?: string | null;
  address?: string | null;
};

const toYear = (value: string): number | undefined => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100
    ? year
    : undefined;
};

export const extractCommissionYears = (
  ...values: Array<string | null | undefined>
): CommissionYears => {
  for (const value of values) {
    if (!value) continue;

    const matches = value.match(YEAR_PATTERN);
    if (!matches || matches.length === 0) continue;

    const years = matches
      .map(toYear)
      .filter((year): year is number => typeof year === "number");

    if (years.length === 0) continue;

    const termStartYear = years[0];
    const termEndYear = years.length > 1 ? years[years.length - 1] : years[0];

    return termStartYear <= termEndYear
      ? { termStartYear, termEndYear }
      : { termStartYear: termEndYear, termEndYear: termStartYear };
  }

  return {};
};

export const normalizePetitionNumber = (
  value: string | null | undefined,
): string => {
  if (!value) return "";
  return value.replace(/^\s*\d+\s*[\).\-\s]\s*/, "").trim();
};

export const normalizeCommissionText = (
  value: string | null | undefined,
): string => (value ?? "").replace(/\s+/g, " ").trim();

export const getCommissionYearLabel = (
  termStartYear?: number | null,
  termEndYear?: number | null,
): string => {
  if (!termStartYear && !termEndYear) return "Unspecified";
  if (!termEndYear || termStartYear === termEndYear) {
    return String(termStartYear ?? termEndYear);
  }
  return `${termStartYear}-${termEndYear}`;
};

export const yearMatchesCommission = (
  value: string,
  termStartYear?: number | null,
  termEndYear?: number | null,
  termOfCommission?: string | null,
  exact = false,
): boolean => {
  const filterText = value.trim();
  if (!filterText) return true;

  const filterYears = extractCommissionYears(filterText);
  const start = termStartYear ?? termEndYear ?? undefined;
  const end = termEndYear ?? termStartYear ?? undefined;

  if (filterYears.termStartYear && start) {
    const filterStart = filterYears.termStartYear;
    const filterEnd = filterYears.termEndYear ?? filterStart;

    if (exact) {
      return start === filterStart && (end ?? start) === filterEnd;
    }

    return start <= filterEnd && (end ?? start) >= filterStart;
  }

  const label = getCommissionYearLabel(termStartYear, termEndYear);
  const haystack = `${label} ${termOfCommission ?? ""}`.toLowerCase();
  return exact
    ? haystack === filterText.toLowerCase()
    : haystack.includes(filterText.toLowerCase());
};

export const buildNotarialCommissionKey = (
  record: NotarialCommissionKeyFields,
): string =>
  [
    normalizePetitionNumber(record.petition).toLowerCase(),
    normalizeCommissionText(record.name).toLowerCase(),
    normalizeCommissionText(record.termOfCommission).toLowerCase(),
    normalizeCommissionText(record.address).toLowerCase(),
  ].join("|");

export const NotarialCommissionSchema = z.object({
  id: z.number().int().optional(),
  petition: z
    .string()
    .trim()
    .default("")
    .describe(
      excelHeaders([
        "Petition",
        "PETITION",
        "Petition No",
        "Petition No.",
        "Petition Number",
      ]),
    ),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .describe(excelHeaders(["Name", "NAME", "Full Name", "Notary Name"])),
  termOfCommission: z
    .string()
    .trim()
    .min(1, "Term of Commission is required")
    .describe(
      excelHeaders([
        "Term of Commission",
        "TERM OF COMMISSION",
        "Term of Commision",
        "TERM OF COMMISION",
        "Commission Term",
        "Commision Term",
        "Term",
        "Year",
        "Years",
      ]),
    ),
  address: z
    .string()
    .trim()
    .min(1, "Address is required")
    .describe(
      excelHeaders(["Address", "ADDRESS", "Office Address", "Residence"]),
    ),
  termStartYear: z.number().int().min(1900).max(2100).nullable().optional(),
  termEndYear: z.number().int().min(1900).max(2100).nullable().optional(),
  imageFile: z.file().nullable().optional(),
});

export type NotarialCommissionSchema = z.infer<typeof NotarialCommissionSchema>;

export type NotarialCommissionImageFile = {
  id: number;
  key: string;
  fileHash: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date | null;
};

export type NotarialCommissionRecord = NotarialCommission & {
  imageFileId?: number | null;
  imageFile?: NotarialCommissionImageFile | null;
};
