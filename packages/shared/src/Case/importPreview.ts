import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";
import { CaseType } from "../generated/prisma/enums";
import {
  type CaseImportConflictMode,
  ExportExcelData,
  findColumnValue,
  getExcelHeaderMap,
  getHeaderRowInfo,
  hasRequiredHeaders,
  isMappedRowEmpty,
  normalizeRowBySchema,
  type ProcessExcelMeta,
} from "../lib/excel";
import { createTempId } from "../utils";
import {
  type CivilCaseSchema as CivilCasePreviewRow,
  CivilCaseSchema,
} from "./Civil/CivilCaseSchema";
import {
  type CriminalCaseSchema as CriminalCasePreviewRow,
  CriminalCaseSchema,
} from "./Criminal/CriminalCaseSchema";
import {
  type PetitionCaseSchema as PetitionCasePreviewRow,
  PetitionCaseSchema,
} from "./Petition/PetitionCaseSchema";
import {
  type ReceivingLogSchema as ReceivingLogPreviewRow,
  ReceivingLogSchema,
} from "./RecievingLogs/RecievingLogsSchema";
import {
  type SheriffCaseSchema as SheriffCasePreviewRow,
  SheriffCaseSchema,
} from "./Sherriff/SherriffSchema";
import {
  type SpecialProceedingSchema as SpecialProceedingPreviewRow,
  SpecialProceedingSchema,
} from "./SpecialProceeding/SpecialProceedingsSchema";

type FailedRow = Record<string, unknown>;

type PreviewSheetSummary = {
  sheet: string;
  rows: number;
  valid: number;
  failed: number;
};

type PreviewMeta = {
  errorCount: number;
  sheetSummary: PreviewSheetSummary[];
  totalRows: number;
  validRows: number;
};

export type CaseImportPreviewResult<T> = {
  success: boolean;
  rows: T[];
  meta: PreviewMeta;
  failedExcel?: ExportExcelData;
  error?: string;
};

type PreviewProcessOptions<
  TValidated,
  TCells extends Record<string, unknown>,
> = {
  file: File;
  schema: z.ZodType<TValidated>;
  requiredHeaders: Record<string, string[]>;
  getCells: (row: Record<string, unknown>) => TCells;
  skipRowsWithoutCell?: Array<keyof TCells>;
  mapRow: (row: Record<string, unknown>) => {
    mapped?: unknown;
    skip?: boolean;
    errorMessage?: string;
  };
};

export const CASE_IMPORT_DRAFT_KEYS = {
  civil: "rtc.case-import-draft.civil",
  criminal: "rtc.case-import-draft.criminal",
  petition: "rtc.case-import-draft.petition",
  receiving: "rtc.case-import-draft.receiving",
  sheriff: "rtc.case-import-draft.sheriff",
  specialProceeding: "rtc.case-import-draft.specialProceeding",
} as const;

export const DIRECT_CASE_IMPORT_FILE_SIZE_THRESHOLD_BYTES = 3 * 1024 * 1024;
export const DIRECT_CASE_IMPORT_ROW_THRESHOLD = 5000;

export const shouldPreferDirectCaseImport = (file: File): boolean =>
  file.size >= DIRECT_CASE_IMPORT_FILE_SIZE_THRESHOLD_BYTES;

export const shouldPreferDirectCaseImportByRowCount = (
  rowCount: number,
): boolean => rowCount >= DIRECT_CASE_IMPORT_ROW_THRESHOLD;

export const formatImportFileSize = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;

export const getCaseImportConflictModeLabel = (
  mode: CaseImportConflictMode,
): string => (mode === "create" ? "Create duplicate" : "Update existing");

const formatCaseCountLabel = (count: number): string =>
  `${count} ${count === 1 ? "case" : "cases"}`;

export const buildDirectCaseImportSuccessMessage = (
  meta: Pick<
    ProcessExcelMeta,
    "createdCount" | "updatedCount" | "importedCount" | "errorCount"
  >,
): string => {
  const createdCount = meta.createdCount ?? 0;
  const updatedCount = meta.updatedCount ?? 0;
  const importedCount = meta.importedCount;
  const failedCount = meta.errorCount;

  if (updatedCount > 0 && createdCount > 0) {
    return failedCount > 0
      ? `Updated ${formatCaseCountLabel(updatedCount)} and created ${formatCaseCountLabel(createdCount)}. ${failedCount} row${failedCount === 1 ? "" : "s"} failed and were downloaded for review.`
      : `Updated ${formatCaseCountLabel(updatedCount)} and created ${formatCaseCountLabel(createdCount)} successfully.`;
  }

  if (updatedCount > 0) {
    return failedCount > 0
      ? `Updated ${formatCaseCountLabel(updatedCount)}. ${failedCount} row${failedCount === 1 ? "" : "s"} failed and were downloaded for review.`
      : `Updated ${formatCaseCountLabel(updatedCount)} successfully.`;
  }

  if (createdCount > 0) {
    return failedCount > 0
      ? `Created ${formatCaseCountLabel(createdCount)}. ${failedCount} row${failedCount === 1 ? "" : "s"} failed and were downloaded for review.`
      : `Created ${formatCaseCountLabel(createdCount)} successfully.`;
  }

  if (failedCount > 0) {
    return `Imported ${formatCaseCountLabel(importedCount)}. ${failedCount} row${failedCount === 1 ? "" : "s"} failed and were downloaded for review.`;
  }

  return `Imported ${formatCaseCountLabel(importedCount)} successfully.`;
};

const moveErrorColumnLast = (row: FailedRow): FailedRow => {
  if (!Object.prototype.hasOwnProperty.call(row, "__error")) {
    return row;
  }

  const entries = Object.entries(row).filter(([key]) => key !== "__error");
  return {
    ...Object.fromEntries(entries),
    __error: row.__error,
  };
};

const buildRowObjectFromHeaders = (
  headerRow: string[],
  row: unknown[],
): Record<string, unknown> => {
  const mapped: Record<string, unknown> = {};
  const maxCols = Math.max(headerRow.length, row.length);

  for (let index = 0; index < maxCols; index += 1) {
    const header =
      typeof headerRow[index] === "string" ? headerRow[index].trim() : "";
    const baseKey = header || `__EMPTY_${index}`;
    const key = Object.prototype.hasOwnProperty.call(mapped, baseKey)
      ? `${baseKey}_${index}`
      : baseKey;
    mapped[key] = row[index];
  }

  return mapped;
};

const buildFailedExcelData = (
  failedRowsBySheet: Map<string, FailedRow[]>,
): ExportExcelData | undefined => {
  if (failedRowsBySheet.size === 0) {
    return undefined;
  }

  const failedWorkbook = XLSX.utils.book_new();

  failedRowsBySheet.forEach((failedRows, sheetName) => {
    const worksheet = XLSX.utils.json_to_sheet(
      failedRows.map(moveErrorColumnLast),
    );
    XLSX.utils.book_append_sheet(failedWorkbook, worksheet, sheetName);
  });

  const base64 = XLSX.write(failedWorkbook, {
    type: "base64",
    bookType: "xlsx",
  });

  return {
    fileName: `failed-rows-${Date.now()}.xlsx`,
    base64,
  };
};

const processExcelPreview = async <
  TValidated,
  TCells extends Record<string, unknown>,
>({
  file,
  schema,
  requiredHeaders,
  getCells,
  skipRowsWithoutCell,
  mapRow,
}: PreviewProcessOptions<TValidated, TCells>): Promise<
  CaseImportPreviewResult<TValidated>
> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const failedRowsBySheet = new Map<string, FailedRow[]>();
  const rows: TValidated[] = [];
  const sheetSummary: PreviewSheetSummary[] = [];
  const schemaHeaderMap =
    schema instanceof z.ZodObject ? getExcelHeaderMap(schema) : {};
  const expectedHeaders = [
    ...Object.values(requiredHeaders).flat(),
    ...Object.values(schemaHeaderMap).flat(),
  ].filter((value): value is string => typeof value === "string");
  let errorCount = 0;
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const headerInfo = getHeaderRowInfo(worksheet, expectedHeaders);
    const rawSheetRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      range: headerInfo.headerRowIndex + 1,
      blankrows: false,
      defval: null,
    }) as unknown[][];

    const headerCheck = hasRequiredHeaders(
      requiredHeaders,
      worksheet,
      headerInfo.headerRow,
    );

    if (headerCheck.success === false) {
      const errorMessage = `Sheet "${sheetName}" is missing required column(s): ${headerCheck.missingHeaders.join(", ")}.`;
      const failedRows: FailedRow[] = [];
      let sheetRows = 0;

      for (const rawRow of rawSheetRows) {
        const row = buildRowObjectFromHeaders(headerInfo.headerRow, rawRow);

        if (
          skipRowsWithoutCell &&
          isMappedRowEmpty(getCells(row), skipRowsWithoutCell)
        ) {
          continue;
        }

        sheetRows += 1;
        failedRows.push({ ...row, __error: errorMessage });
      }

      const failedRowsToStore =
        failedRows.length > 0 ? failedRows : [{ __error: errorMessage }];

      failedRowsBySheet.set(sheetName, failedRowsToStore);
      errorCount += failedRowsToStore.length;
      totalRows += sheetRows;
      sheetSummary.push({
        sheet: sheetName,
        rows: sheetRows,
        valid: 0,
        failed: failedRowsToStore.length,
      });
      continue;
    }

    let sheetValid = 0;
    let sheetFailed = 0;
    let sheetRows = 0;
    const failedRows: FailedRow[] = [];

    for (const rawRow of rawSheetRows) {
      const row = buildRowObjectFromHeaders(headerInfo.headerRow, rawRow);

      if (
        skipRowsWithoutCell &&
        isMappedRowEmpty(getCells(row), skipRowsWithoutCell)
      ) {
        continue;
      }

      sheetRows += 1;
      const mapResult = mapRow(row);

      if (mapResult.skip) {
        continue;
      }

      totalRows += 1;

      if (mapResult.errorMessage) {
        sheetFailed += 1;
        failedRows.push({ ...row, __error: mapResult.errorMessage });
        continue;
      }

      const validated = schema.safeParse(mapResult.mapped);

      if (!validated.success) {
        const errorMessage =
          prettifyError(validated.error) || "Validation failed";
        sheetFailed += 1;
        failedRows.push({ ...row, __error: errorMessage });
        continue;
      }

      rows.push(validated.data);
      sheetValid += 1;
    }

    if (failedRows.length > 0) {
      failedRowsBySheet.set(sheetName, failedRows);
    }

    errorCount += sheetFailed;
    sheetSummary.push({
      sheet: sheetName,
      rows: sheetRows,
      valid: sheetValid,
      failed: sheetFailed,
    });
  }

  const failedExcel = buildFailedExcelData(failedRowsBySheet);

  return {
    success: rows.length > 0,
    rows,
    meta: {
      errorCount,
      sheetSummary,
      totalRows,
      validRows: rows.length,
    },
    failedExcel,
    error: rows.length > 0 ? undefined : "No valid rows to import",
  };
};

const parseDateCell = (value: unknown): Date | null => {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const parseTime = (
  value: string,
): { hours: number; minutes: number; seconds: number } | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[AaPp][Mm])?/);
  if (!match) {
    return null;
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  const ampm = match[4]?.trim().toUpperCase();

  if (ampm === "PM" && hours !== 12) {
    hours += 12;
  } else if (ampm === "AM" && hours === 12) {
    hours = 0;
  }

  return { hours, minutes, seconds };
};

const convertReceivingCaseType = (value: string | undefined): CaseType => {
  if (!value) {
    return CaseType.UNKNOWN;
  }

  const normalized = value.trim().toUpperCase();
  const caseTypeMap: Record<string, CaseType> = {
    CC: CaseType.CRIMINAL,
    CVC: CaseType.CIVIL,
    LRC: CaseType.LAND_REGISTRATION_CASE,
    P: CaseType.PETITION,
  };

  const directMatch = Object.values(CaseType).find(
    (caseType) => caseType === normalized,
  );

  return caseTypeMap[normalized] ?? directMatch ?? CaseType.UNKNOWN;
};

const PETITION_CASE_NUMBER_HEADERS = [
  "Case Number",
  "Case No",
  "Petition No",
  "Petition No.",
  "Petition Number",
];

const PETITION_YEAR_HEADERS = ["Year", "Case Year"];
const SPECIAL_PROCEEDING_CASE_NUMBER_HEADERS = [
  "Case Number",
  "Case no.",
  "Case No.",
  "Case No",
  "CaseNumber",
  "SPC. Case Number",
  "SPC Case No.",
  "SPC. Number",
  "SPC Number",
  "SPC. No.",
  "SPC No.",
];

const toTrimmedString = (value: unknown): string => {
  if (value == null) {
    return "";
  }

  return String(value).trim();
};

const getOrderedRowValues = (row: Record<string, unknown>): string[] =>
  Object.values(row)
    .map(toTrimmedString)
    .filter((value) => value.length > 0);

const normalizeComparableCellText = (value: unknown): string =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const parseCaseYear = (value: unknown): number | null => {
  const text = toTrimmedString(value);
  if (!text) {
    return null;
  }

  const match = text.match(/(\d{4})/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? null : year;
};

const normalizeAreaFragment = (value: unknown): string => {
  const cleaned = toTrimmedString(value)
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return cleaned;
};

const formatPetitionCaseNumber = (number: number, year: number): string =>
  `P-${String(number).padStart(2, "0")}-${year}`;

const formatSpecialProceedingCaseNumber = (
  number: number,
  area: string,
  year: number,
): string => `${String(number).padStart(2, "0")}-${area.toUpperCase()}-${year}`;

const buildPetitionCaseNumberFromRowFragments = (
  row: Record<string, unknown>,
): string | null => {
  const values = getOrderedRowValues(row);

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    const next = values[index + 1] ?? "";
    const third = values[index + 2] ?? "";

    const combined = [current, next, third].join(" ").trim();
    const combinedMatch = combined.match(/^P\s*-\s*(\d+)\s*-\s*(\d{4})$/i);
    if (combinedMatch) {
      const number = Number.parseInt(combinedMatch[1], 10);
      const year = Number.parseInt(combinedMatch[2], 10);
      if (!Number.isNaN(number) && !Number.isNaN(year)) {
        return formatPetitionCaseNumber(number, year);
      }
    }

    if (
      /^P-?$/i.test(current) &&
      /^\d+$/.test(next) &&
      /^-?\d{4}$/.test(third)
    ) {
      const number = Number.parseInt(next, 10);
      const year = Number.parseInt(third.replace(/^-/, ""), 10);
      if (!Number.isNaN(number) && !Number.isNaN(year)) {
        return formatPetitionCaseNumber(number, year);
      }
    }

    const currentAndNext = `${current} ${next}`.trim();
    const prefixPlusNumberMatch = currentAndNext.match(/^P\s*-\s*(\d+)$/i);
    if (prefixPlusNumberMatch && /^-?\d{4}$/.test(third)) {
      const number = Number.parseInt(prefixPlusNumberMatch[1], 10);
      const year = Number.parseInt(third.replace(/^-/, ""), 10);
      if (!Number.isNaN(number) && !Number.isNaN(year)) {
        return formatPetitionCaseNumber(number, year);
      }
    }
  }

  return null;
};

const isLikelyPetitionHeaderRow = (row: Record<string, unknown>): boolean => {
  const values = getOrderedRowValues(row).map(normalizeComparableCellText);
  const headerTokens = [
    "petitionno",
    "petitionnumber",
    "branch",
    "petitioner",
    "petitioners",
    "petitionerss",
    "nature",
    "year",
  ];

  const matchCount = values.filter((value) =>
    headerTokens.some(
      (token) =>
        value === token || value.includes(token) || token.includes(value),
    ),
  ).length;

  return matchCount >= 2;
};

const buildSpecialProceedingCaseNumberFromRowFragments = (
  row: Record<string, unknown>,
): string | null => {
  const values = getOrderedRowValues(row);

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    const next = values[index + 1] ?? "";
    const third = values[index + 2] ?? "";

    const combined = [current, next, third].join(" ").trim();
    const numberFirstMatch = combined.match(
      /^(\d+)\s*-\s*([A-Za-z]+)\s*-\s*(\d{4})$/i,
    );
    if (numberFirstMatch) {
      const number = Number.parseInt(numberFirstMatch[1], 10);
      const year = Number.parseInt(numberFirstMatch[3], 10);
      const area = normalizeAreaFragment(numberFirstMatch[2]);
      if (!Number.isNaN(number) && !Number.isNaN(year) && area) {
        return formatSpecialProceedingCaseNumber(number, area, year);
      }
    }

    if (
      /^\d+$/.test(current) &&
      normalizeAreaFragment(next) &&
      /^\d{4}$/.test(third)
    ) {
      const number = Number.parseInt(current, 10);
      const year = Number.parseInt(third, 10);
      const area = normalizeAreaFragment(next);
      if (!Number.isNaN(number) && !Number.isNaN(year) && area) {
        return formatSpecialProceedingCaseNumber(number, area, year);
      }
    }

    if (
      /^\d+$/.test(current) &&
      normalizeAreaFragment(next) &&
      /^-?\d{4}$/.test(third)
    ) {
      const number = Number.parseInt(current, 10);
      const year = Number.parseInt(third.replace(/^-/, ""), 10);
      const area = normalizeAreaFragment(next);
      if (!Number.isNaN(number) && !Number.isNaN(year) && area) {
        return formatSpecialProceedingCaseNumber(number, area, year);
      }
    }
  }

  return null;
};

const isLikelySpecialProceedingHeaderRow = (
  row: Record<string, unknown>,
): boolean => {
  const values = getOrderedRowValues(row).map(normalizeComparableCellText);
  const headerTokens = [
    "spcno",
    "spccasenumber",
    "raffledto",
    "raffledtobranch",
    "raffled",
    "branch",
    "petitioner",
    "petitioners",
    "nature",
    "respondent",
    "date",
  ];

  const matchCount = values.filter((value) =>
    headerTokens.some(
      (token) =>
        value === token || value.includes(token) || token.includes(value),
    ),
  ).length;

  return matchCount >= 2;
};

const normalizePetitionImportedCaseNumber = (
  row: Record<string, unknown>,
  fallbackValue: unknown,
): string => {
  const reconstructedFromFragments =
    buildPetitionCaseNumberFromRowFragments(row);
  if (reconstructedFromFragments) {
    return reconstructedFromFragments;
  }

  const rawCaseNumber =
    findColumnValue(row, PETITION_CASE_NUMBER_HEADERS) ?? fallbackValue;
  const caseNumberText = toTrimmedString(rawCaseNumber);
  const yearFromColumn = parseCaseYear(
    findColumnValue(row, PETITION_YEAR_HEADERS),
  );

  if (!caseNumberText) {
    return "";
  }

  const prefixedMatch = caseNumberText.match(
    /^([A-Za-z]+)\s*-\s*(\d+)\s*-\s*(\d{4})$/,
  );
  if (prefixedMatch) {
    const number = Number.parseInt(prefixedMatch[2], 10);
    const year = Number.parseInt(prefixedMatch[3], 10);
    if (!Number.isNaN(number) && !Number.isNaN(year)) {
      return formatPetitionCaseNumber(number, year);
    }
  }

  const numberYearMatch = caseNumberText.match(/^(\d+)\s*-\s*(\d{4})$/);
  if (numberYearMatch) {
    const number = Number.parseInt(numberYearMatch[1], 10);
    const year = Number.parseInt(numberYearMatch[2], 10);
    if (!Number.isNaN(number) && !Number.isNaN(year)) {
      return formatPetitionCaseNumber(number, year);
    }
  }

  const numberOnlyMatch = caseNumberText.match(/^\d+$/);
  if (numberOnlyMatch && yearFromColumn != null) {
    const number = Number.parseInt(caseNumberText, 10);
    if (!Number.isNaN(number)) {
      return formatPetitionCaseNumber(number, yearFromColumn);
    }
  }

  return caseNumberText
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSpecialProceedingImportedCaseNumber = (
  row: Record<string, unknown>,
  fallbackValue: unknown,
): string => {
  const reconstructedFromFragments =
    buildSpecialProceedingCaseNumberFromRowFragments(row);
  if (reconstructedFromFragments) {
    return reconstructedFromFragments;
  }

  const rawCaseNumber =
    findColumnValue(row, SPECIAL_PROCEEDING_CASE_NUMBER_HEADERS) ??
    fallbackValue;
  const caseNumberText = toTrimmedString(rawCaseNumber);

  if (!caseNumberText) {
    return "";
  }

  const numberFirstMatch = caseNumberText.match(
    /^(\d+)\s*-\s*([A-Za-z]+)\s*-\s*(\d{4})$/,
  );
  if (numberFirstMatch) {
    const number = Number.parseInt(numberFirstMatch[1], 10);
    const year = Number.parseInt(numberFirstMatch[3], 10);
    const area = normalizeAreaFragment(numberFirstMatch[2]);
    if (!Number.isNaN(number) && !Number.isNaN(year) && area) {
      return formatSpecialProceedingCaseNumber(number, area, year);
    }
  }

  const areaFirstMatch = caseNumberText.match(
    /^([A-Za-z]+)\s*-\s*(\d+)\s*-\s*(\d{4})$/,
  );
  if (areaFirstMatch) {
    const number = Number.parseInt(areaFirstMatch[2], 10);
    const year = Number.parseInt(areaFirstMatch[3], 10);
    const area = normalizeAreaFragment(areaFirstMatch[1]);
    if (!Number.isNaN(number) && !Number.isNaN(year) && area) {
      return formatSpecialProceedingCaseNumber(number, area, year);
    }
  }

  return caseNumberText
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

const isValidWorkbookFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
};

const buildInvalidWorkbookResult = <T>(): CaseImportPreviewResult<T> => ({
  success: false,
  rows: [],
  meta: {
    errorCount: 0,
    sheetSummary: [],
    totalRows: 0,
    validRows: 0,
  },
  error: "Only Excel files (.xlsx/.xls) are allowed.",
});

export const previewCivilCaseImport = async (
  file: File,
): Promise<CaseImportPreviewResult<CivilCasePreviewRow>> => {
  if (!isValidWorkbookFile(file)) {
    return buildInvalidWorkbookResult();
  }

  const headerMap = getExcelHeaderMap(CivilCaseSchema);
  const branchHeaders = headerMap.branch ?? ["Branch"];
  const getMappedCells = (row: Record<string, unknown>) =>
    normalizeRowBySchema(CivilCaseSchema, row);

  return processExcelPreview({
    file,
    schema: CivilCaseSchema,
    requiredHeaders: { Branch: branchHeaders },
    getCells: getMappedCells,
    skipRowsWithoutCell: ["caseNumber"],
    mapRow: (row) => {
      const cells = getMappedCells(row);

      if (isMappedRowEmpty(cells, ["caseNumber"])) {
        return { skip: true };
      }

      const caseNumberRaw =
        typeof cells.caseNumber === "string" ? cells.caseNumber.trim() : "";
      const petitioner =
        typeof cells.petitioners === "string"
          ? cells.petitioners.trim().replace(/\s+/g, "-")
          : "";
      const respondent =
        typeof cells.defendants === "string"
          ? cells.defendants.trim().replace(/\s+/g, "-")
          : "";
      const dateFiled = parseDateCell(cells.dateFiled);

      const caseNumber = caseNumberRaw.toLowerCase().includes("undocketed")
        ? `${caseNumberRaw}${petitioner ? `-${petitioner}` : ""}${respondent ? `-${respondent}` : ""}-${dateFiled?.getTime() ?? "nofiledate"}`
        : caseNumberRaw;

      return {
        mapped: {
          ...cells,
          caseNumber,
          assistantBranch: cells.assistantBranch ?? cells.branch ?? null,
          caseType: CaseType.CIVIL,
          undocketed: caseNumber.toLowerCase().includes("undocketed"),
        },
      };
    },
  });
};

export const previewCriminalCaseImport = async (
  file: File,
): Promise<CaseImportPreviewResult<CriminalCasePreviewRow>> => {
  if (!isValidWorkbookFile(file)) {
    return buildInvalidWorkbookResult();
  }

  const headerMap = getExcelHeaderMap(CriminalCaseSchema);
  const branchHeaders = headerMap.branch ?? ["Branch"];
  const nameHeaders = headerMap.name ?? ["Name"];
  const getMappedCells = (row: Record<string, unknown>) =>
    normalizeRowBySchema(CriminalCaseSchema, row);

  return processExcelPreview({
    file,
    schema: CriminalCaseSchema,
    requiredHeaders: {
      Branch: branchHeaders,
      Name: nameHeaders,
    },
    getCells: getMappedCells,
    skipRowsWithoutCell: ["caseNumber", "name"],
    mapRow: (row) => {
      const cells = getMappedCells(row);

      if (isMappedRowEmpty(cells, ["caseNumber"])) {
        return { skip: true };
      }

      return {
        mapped: {
          ...cells,
          assistantBranch: cells.assistantBranch ?? cells.branch ?? null,
          caseType: CaseType.CRIMINAL,
        },
      };
    },
  });
};

export const previewPetitionCaseImport = async (
  file: File,
): Promise<CaseImportPreviewResult<PetitionCasePreviewRow>> => {
  if (!isValidWorkbookFile(file)) {
    return buildInvalidWorkbookResult();
  }

  const headerMap = getExcelHeaderMap(PetitionCaseSchema);
  const caseNumberHeaders = Array.from(
    new Set([
      ...(headerMap.caseNumber ?? ["Case Number"]),
      ...PETITION_CASE_NUMBER_HEADERS,
    ]),
  );
  const getMappedCells = (row: Record<string, unknown>) => {
    const cells = normalizeRowBySchema(PetitionCaseSchema, row);
    return {
      ...cells,
      caseNumber: normalizePetitionImportedCaseNumber(row, cells.caseNumber),
    };
  };

  return processExcelPreview({
    file,
    schema: PetitionCaseSchema,
    requiredHeaders: { "Case Number": caseNumberHeaders },
    getCells: getMappedCells,
    skipRowsWithoutCell: ["caseNumber"],
    mapRow: (row) => {
      if (isLikelyPetitionHeaderRow(row)) {
        return { skip: true };
      }

      const cells = getMappedCells(row);

      if (isMappedRowEmpty(cells, ["caseNumber"])) {
        return { skip: true };
      }

      return {
        mapped: {
          ...cells,
          caseNumber: normalizePetitionImportedCaseNumber(
            row,
            cells.caseNumber,
          ),
          caseType: CaseType.PETITION,
          dateFiled: cells.dateFiled ?? cells.date ?? null,
          branch: cells.branch ?? cells.raffledTo ?? null,
          assistantBranch:
            cells.assistantBranch ?? cells.raffledTo ?? cells.branch ?? null,
        },
      };
    },
  });
};

export const previewReceivingLogImport = async (
  file: File,
): Promise<CaseImportPreviewResult<ReceivingLogPreviewRow>> => {
  if (!isValidWorkbookFile(file)) {
    return buildInvalidWorkbookResult();
  }

  const headerMap = getExcelHeaderMap(ReceivingLogSchema);
  const caseNumberHeaders = headerMap.caseNumber ?? ["Case no."];
  const getMappedCells = (row: Record<string, unknown>) =>
    normalizeRowBySchema(ReceivingLogSchema, row);

  return processExcelPreview({
    file,
    schema: ReceivingLogSchema,
    requiredHeaders: { "Case no.": caseNumberHeaders },
    getCells: getMappedCells,
    skipRowsWithoutCell: [
      "bookAndPage",
      "caseNumber",
      "content",
      "branchNumber",
      "notes",
    ],
    mapRow: (row) => {
      const cells = getMappedCells(row);

      if (isMappedRowEmpty(cells, ["caseType", "dateRecieved"])) {
        return { skip: true };
      }

      const rawCaseType = findColumnValue(
        row,
        headerMap.caseType ?? ["Abbreviation", "Case Type"],
      );
      const rawTime = findColumnValue(row, ["Time", "TIME"]);
      const dateRecieved = parseDateCell(cells.dateRecieved);

      if (dateRecieved && typeof rawTime === "string") {
        const parsedTime = parseTime(rawTime);
        if (parsedTime) {
          dateRecieved.setHours(
            parsedTime.hours,
            parsedTime.minutes,
            parsedTime.seconds,
            0,
          );
        }
      }

      return {
        mapped: {
          bookAndPage: cells.bookAndPage
            ? String(cells.bookAndPage)
            : undefined,
          dateRecieved,
          caseType: convertReceivingCaseType(
            typeof rawCaseType === "string"
              ? rawCaseType
              : typeof cells.caseType === "string"
                ? cells.caseType
                : undefined,
          ),
          caseNumber: cells.caseNumber ? String(cells.caseNumber) : undefined,
          content: cells.content ? String(cells.content) : undefined,
          branchNumber: cells.branchNumber
            ? String(cells.branchNumber)
            : undefined,
          notes: cells.notes ? String(cells.notes) : undefined,
        },
      };
    },
  });
};

export const previewSheriffCaseImport = async (
  file: File,
): Promise<CaseImportPreviewResult<SheriffCasePreviewRow>> => {
  if (!isValidWorkbookFile(file)) {
    return buildInvalidWorkbookResult();
  }

  const headerMap = getExcelHeaderMap(SheriffCaseSchema);
  const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];
  const getMappedCells = (row: Record<string, unknown>) =>
    normalizeRowBySchema(SheriffCaseSchema, row);

  return processExcelPreview({
    file,
    schema: SheriffCaseSchema,
    requiredHeaders: { "Case Number": caseNumberHeaders },
    getCells: getMappedCells,
    skipRowsWithoutCell: ["caseNumber"],
    mapRow: (row) => {
      const cells = getMappedCells(row);

      if (isMappedRowEmpty(cells, ["caseNumber"])) {
        return { skip: true };
      }

      return {
        mapped: {
          ...cells,
          caseType: CaseType.SHERRIFF,
        },
      };
    },
  });
};

export const previewSpecialProceedingImport = async (
  file: File,
): Promise<CaseImportPreviewResult<SpecialProceedingPreviewRow>> => {
  if (!isValidWorkbookFile(file)) {
    return buildInvalidWorkbookResult();
  }

  const headerMap = getExcelHeaderMap(SpecialProceedingSchema);
  const caseNumberHeaders = Array.from(
    new Set([
      ...(headerMap.caseNumber ?? ["Case Number"]),
      ...SPECIAL_PROCEEDING_CASE_NUMBER_HEADERS,
    ]),
  );
  const getMappedCells = (row: Record<string, unknown>) => {
    const cells = normalizeRowBySchema(SpecialProceedingSchema, row);
    return {
      ...cells,
      caseNumber: normalizeSpecialProceedingImportedCaseNumber(
        row,
        cells.caseNumber,
      ),
    };
  };

  return processExcelPreview({
    file,
    schema: SpecialProceedingSchema,
    requiredHeaders: { "Case Number": caseNumberHeaders },
    getCells: getMappedCells,
    skipRowsWithoutCell: ["caseNumber"],
    mapRow: (row) => {
      if (isLikelySpecialProceedingHeaderRow(row)) {
        return { skip: true };
      }

      const cells = getMappedCells(row);

      if (isMappedRowEmpty(cells, ["caseNumber"])) {
        return { skip: true };
      }

      return {
        mapped: {
          ...cells,
          caseNumber: normalizeSpecialProceedingImportedCaseNumber(
            row,
            cells.caseNumber,
          ),
          caseType: CaseType.SCA,
          dateFiled: cells.dateFiled ?? cells.date ?? null,
          branch: cells.branch ?? cells.raffledTo ?? null,
          assistantBranch:
            cells.assistantBranch ?? cells.raffledTo ?? cells.branch ?? null,
        },
      };
    },
  });
};

export const downloadImportFailedExcel = (
  failedExcel?: ExportExcelData,
): void => {
  if (!failedExcel || typeof document === "undefined") {
    return;
  }

  const byteCharacters = atob(failedExcel.base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = failedExcel.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const saveCaseImportDraft = <T>(
  storageKey: string,
  rows: T[],
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
};

export const shouldLoadCaseImportDraft = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).has("importDraft");
};

export const consumeCaseImportDraft = <T>(storageKey: string): T[] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
};

export const createImportedRowId = (): number => createTempId();
