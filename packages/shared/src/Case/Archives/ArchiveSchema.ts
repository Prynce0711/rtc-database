import { z } from "zod";
import type { FilterOptions } from "../../Filter/FilterUtils";
import type { Prisma } from "../../generated/prisma/browser";
import { ArchiveEntryType } from "../../generated/prisma/enums";
import { createTempId } from "../../utils";

const archiveEntryWithFileArgs = {
  include: {
    file: true,
  },
} satisfies Prisma.ArchiveEntryDefaultArgs;

export type ArchiveEntryData = Prisma.ArchiveEntryGetPayload<
  typeof archiveEntryWithFileArgs
>;

export type ArchiveFilterShape = {
  search?: string | null;
  parentPath?: string | null;
  entryType?: ArchiveEntryType | null;
};

export type ArchiveFilterOptions = Omit<
  FilterOptions<ArchiveFilterShape>,
  "sortKey"
> & {
  sortKey?: "name" | "entryType" | "createdAt" | "updatedAt";
};

export type ArchiveFilters = ArchiveFilterOptions["filters"];

export type ArchiveStats = {
  totalItems: number;
  folders: number;
  editableItems: number;
  uploadedFiles: number;
  storageUsedBytes: number;
};

export type ArchiveSpreadsheetData = string[][];

export type ArchiveEntryForm = {
  id: number;
  name: string;
  parentPath: string;
  entryType: ArchiveEntryType;
  description: string;
  extension: string;
  textContent: string;
  sheetData: ArchiveSpreadsheetData;
  file: File | null;
  removeFile: boolean;
  errors: Record<string, string>;
};

export const ArchiveEntryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  parentPath: z.string().optional().default(""),
  entryType: z.enum(ArchiveEntryType),
  description: z.string().nullable().optional(),
  extension: z.string().nullable().optional(),
  textContent: z.string().nullable().optional(),
  sheetData: z.array(z.array(z.string())).nullable().optional(),
  file: z.file().nullable().optional(),
  removeFile: z.boolean().optional(),
});

export type ArchiveEntryInput = z.infer<typeof ArchiveEntryInputSchema>;

export const DEFAULT_ARCHIVE_SHEET_ROWS = 8;
export const DEFAULT_ARCHIVE_SHEET_COLS = 6;

export const createEmptyArchiveSheet = (
  rows = DEFAULT_ARCHIVE_SHEET_ROWS,
  cols = DEFAULT_ARCHIVE_SHEET_COLS,
): ArchiveSpreadsheetData =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

export const normalizeArchivePath = (value?: string | null): string =>
  (value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");

export const normalizeArchiveName = (value?: string | null): string =>
  (value ?? "")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const joinArchivePath = (parentPath: string, name: string): string => {
  const normalizedParent = normalizeArchivePath(parentPath);
  const normalizedName = normalizeArchiveName(name);
  return normalizedParent
    ? `${normalizedParent}/${normalizedName}`
    : normalizedName;
};

export const getArchiveParentPath = (fullPath: string): string => {
  const normalized = normalizeArchivePath(fullPath);
  if (!normalized.includes("/")) return "";
  return normalized.slice(0, normalized.lastIndexOf("/"));
};

export const getArchiveBaseName = (fullPath: string): string => {
  const normalized = normalizeArchivePath(fullPath);
  if (!normalized) return "";
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
};

export const getArchiveExtension = (name?: string | null): string => {
  const normalized = normalizeArchiveName(name);
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) return "";
  return normalized.slice(dotIndex + 1).toLowerCase();
};

export const isArchiveEntryEditable = (
  entryType?: ArchiveEntryType | null,
): boolean =>
  entryType === ArchiveEntryType.DOCUMENT ||
  entryType === ArchiveEntryType.SPREADSHEET;

export const archiveEntryToForm = (
  entry?: ArchiveEntryData | null,
): ArchiveEntryForm => ({
  id: entry?.id ?? createTempId(),
  name: entry?.name ?? "",
  parentPath: entry?.parentPath ?? "",
  entryType: entry?.entryType ?? ArchiveEntryType.DOCUMENT,
  description: entry?.description ?? "",
  extension: entry?.extension ?? "",
  textContent: entry?.textContent ?? "",
  sheetData:
    Array.isArray(entry?.sheetData) &&
    entry.sheetData.every((row) => Array.isArray(row))
      ? (entry.sheetData as ArchiveSpreadsheetData).map((row) =>
          row.map((cell) => (cell == null ? "" : String(cell))),
        )
      : createEmptyArchiveSheet(),
  file: null,
  removeFile: false,
  errors: {},
});
