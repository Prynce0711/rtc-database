import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";
import { CaseType } from "../generated/prisma/enums";
import {
  ExportExcelData,
  findColumnValue,
  getExcelHeaderMap,
  getHeaderRowInfo,
  hasRequiredHeaders,
  isMappedRowEmpty,
  normalizeRowBySchema,
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
  let errorCount = 0;
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const schemaHeaderMap =
      schema instanceof z.ZodObject ? getExcelHeaderMap(schema) : {};
    const expectedHeaders = [
      ...Object.values(requiredHeaders).flat(),
      ...Object.values(schemaHeaderMap).flat(),
    ].filter((value): value is string => typeof value === "string");

    const headerInfo = getHeaderRowInfo(worksheet, expectedHeaders);
    const rawSheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      {
        header: headerInfo.headerRow,
        range: headerInfo.headerRowIndex + 1,
        blankrows: false,
      },
    );

    const sheetData = skipRowsWithoutCell
      ? rawSheetData.filter(
          (row) => !isMappedRowEmpty(getCells(row), skipRowsWithoutCell),
        )
      : rawSheetData;

    const headerCheck = hasRequiredHeaders(
      requiredHeaders,
      worksheet,
      headerInfo.headerRow,
    );

    if (headerCheck.success === false) {
      const errorMessage = `Sheet "${sheetName}" is missing required column(s): ${headerCheck.missingHeaders.join(", ")}.`;
      const failedRows =
        sheetData.length > 0
          ? sheetData.map((row) => ({ ...row, __error: errorMessage }))
          : [{ __error: errorMessage }];

      failedRowsBySheet.set(sheetName, failedRows);
      errorCount += failedRows.length;
      totalRows += sheetData.length;
      sheetSummary.push({
        sheet: sheetName,
        rows: sheetData.length,
        valid: 0,
        failed: failedRows.length,
      });
      continue;
    }

    let sheetValid = 0;
    let sheetFailed = 0;
    const failedRows: FailedRow[] = [];

    for (const row of sheetData) {
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
      rows: sheetData.length,
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
      const caseNumber = caseNumberRaw;

      return {
        mapped: {
          ...cells,
          caseNumber,
          assistantBranch: cells.assistantBranch ?? cells.branch ?? null,
          caseType: CaseType.CIVIL,
          undocketed: caseNumberRaw.toLowerCase().includes("undocketed"),
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
  const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];
  const getMappedCells = (row: Record<string, unknown>) =>
    normalizeRowBySchema(PetitionCaseSchema, row);

  return processExcelPreview({
    file,
    schema: PetitionCaseSchema,
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
  const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];
  const getMappedCells = (row: Record<string, unknown>) =>
    normalizeRowBySchema(SpecialProceedingSchema, row);

  return processExcelPreview({
    file,
    schema: SpecialProceedingSchema,
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
