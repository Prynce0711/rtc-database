import * as XLSX from "xlsx";
import z, { prettifyError } from "zod";
import ActionResult from "../ActionResult";
import { normalizeValueBySchema } from "./utils";

const EXCEL_HEADERS_PREFIX = "excelHeaders:";
export const VALIDATION_ERROR_MARKER = "EXCEL_VALIDATION_ERROR";

export const QUERY_CHUNK_SIZE = 750;

export const excelHeaders = (headers: string[]): string =>
  `${EXCEL_HEADERS_PREFIX}${JSON.stringify(headers)}`;

const parseExcelHeaders = (description?: string): string[] | undefined => {
  if (!description || !description.startsWith(EXCEL_HEADERS_PREFIX)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(
      description.slice(EXCEL_HEADERS_PREFIX.length),
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string")
      : undefined;
  } catch {
    return undefined;
  }
};

export const getExcelHeaderMap = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
): Partial<Record<keyof T, string[]>> => {
  const shape = schema.shape;
  const headers: Partial<Record<keyof T, string[]>> = {};

  for (const key of Object.keys(shape) as Array<keyof T>) {
    const description = (shape[key] as unknown as z.ZodTypeAny).description;
    const parsed = parseExcelHeaders(description);
    if (parsed && parsed.length > 0) {
      headers[key] = parsed;
    }
  }

  return headers;
};

export const getRowValuesBySchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  row: Record<string, unknown>,
): Partial<Record<keyof T, unknown>> => {
  const headers = getExcelHeaderMap(schema);
  const values: Partial<Record<keyof T, unknown>> = {};

  for (const key of Object.keys(headers) as Array<keyof T>) {
    const aliases = headers[key] ?? [];
    values[key] = findColumnValue(row, aliases);
  }

  return values;
};

export const normalizeRowBySchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  row: Record<string, unknown>,
) => {
  const headers = getExcelHeaderMap(schema);
  const values: Partial<Record<keyof T, unknown>> = {};
  const shape = schema.shape;

  for (const key of Object.keys(headers) as Array<keyof T>) {
    const aliases = headers[key] ?? [];
    const rawValue = findColumnValue(row, aliases);
    values[key] = normalizeValueBySchema(rawValue, shape[key] as unknown);
  }

  return values;
};

export type ExportExcelData = {
  fileName: string;
  base64: string;
};

// Helper to convert Excel serial date to JS Date
export const excelDateToJSDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
  );
};

// Helper function to validate that a date is reasonable (between 1900 and 2100)
export function isValidDate(date: Date): boolean {
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
}

export const hasContent = (val: unknown) => {
  if (val === undefined || val === null) return false;
  if (typeof val === "string") return val.trim() !== "";
  return true;
};

export const valuesAreEqual = (left: unknown, right: unknown): boolean => {
  const normalize = (value: unknown) => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") return value.trim();
    return value;
  };

  return normalize(left) === normalize(right);
};

export const isMappedRowEmpty = <
  T extends Record<string, unknown>,
  K extends keyof T = keyof T,
>(
  cells: T,
  ignoreKeys: K[] = [],
): boolean => {
  const values = Object.entries(cells)
    .filter(([key]) => !ignoreKeys.includes(key as K))
    .map(([, value]) => value);
  return !values.some(hasContent);
};

// Helper to generate variations with periods after words
const generatePeriodVariations = (text: string): string[] => {
  const words = text.split(/\s+/);
  if (words.length === 1) {
    // Single word: "atty" → ["atty", "atty."]
    return [text, text + "."];
  }

  // Multiple words: generate all combinations with periods
  const variations: string[] = [text];
  const n = words.length;

  // Generate all combinations using binary representation
  // For 2 words: 00, 01, 10, 11 (4 combinations)
  for (let i = 1; i < 1 << n; i++) {
    const variant = words
      .map((word, index) => {
        // Check if this word should have a period
        const shouldHavePeriod = (i >> index) & 1;
        return shouldHavePeriod ? word + "." : word;
      })
      .join(" ");
    variations.push(variant);
  }

  return variations;
};

// Fuzzy column name matcher
export const findColumnValue = (
  row: Record<string, unknown>,
  possibleNames: string[],
): unknown => {
  // Generate all variations with periods
  const allVariations: string[] = [];
  for (const name of possibleNames) {
    allVariations.push(...generatePeriodVariations(name));
  }

  // First try exact match (case-insensitive)
  for (const name of allVariations) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim() === name.toLowerCase().trim()) {
        return row[key];
      }
    }
  }

  // Then try partial match
  for (const name of allVariations) {
    for (const key of Object.keys(row)) {
      const keyLower = key.toLowerCase().trim();
      const nameLower = name.toLowerCase().trim();
      if (keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
        return row[key];
      }
    }
  }

  return undefined;
};

export async function isExcel(file: File): Promise<boolean> {
  try {
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/x-excel",
    ];

    if (!validMimeTypes.includes(file.type)) {
      return false;
    }

    const validExtensions = [".xlsx", ".xls"];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasValidExtension) {
      return false;
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const isXlsx =
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;
    const isXls =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1;

    return isXlsx || isXls;
  } catch (error) {
    return false;
  }
}

export const normalizeHeader = (val: string) =>
  val.toLowerCase().replace(/[\s.]/g, "").trim();

type HeaderRowInfo = {
  headerRow: string[];
  headerRowIndex: number;
};

const toCellText = (cell: string | number | null | undefined): string => {
  if (cell === null || cell === undefined) return "";
  const asString = typeof cell === "string" ? cell : String(cell);
  return asString.replace(/\s+/g, " ").trim();
};

const buildCompositeHeaderRow = (
  rows: (string | number | null)[][],
  headerRowIndex: number,
): string[] => {
  const rowLengths = [
    rows[headerRowIndex]?.length ?? 0,
    rows[headerRowIndex - 1]?.length ?? 0,
    rows[headerRowIndex - 2]?.length ?? 0,
  ];
  const maxCols = Math.max(...rowLengths);

  const nonEmptyCounts = rows.map(
    (row) => row.filter((cell) => toCellText(cell) !== "").length,
  );

  return Array.from({ length: maxCols }).map((_, colIndex) => {
    const parts: string[] = [];

    for (let offset = 2; offset >= 1; offset -= 1) {
      const rowIndex = headerRowIndex - offset;
      if (rowIndex < 0) continue;
      if (nonEmptyCounts[rowIndex] < 2) continue;
      const value = toCellText(rows[rowIndex]?.[colIndex]);
      if (value) parts.push(value);
    }

    const headerValue = toCellText(rows[headerRowIndex]?.[colIndex]);
    if (headerValue) parts.push(headerValue);

    return parts.join(" ").trim();
  });
};

export const getHeaderRowInfo = (
  worksheet: XLSX.WorkSheet,
  expectedHeaders: string[] = [],
): HeaderRowInfo => {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    range: 0,
    blankrows: false,
  }) as unknown as (string | number | null)[][];

  const normalizedExpected = expectedHeaders
    .map(normalizeHeader)
    .filter((value) => value.length > 0);

  const maxScan = Math.min(rows.length, 75);
  let bestIndex = 0;
  let bestMatchScore = -1;
  let bestNonEmpty = -1;

  for (let i = 0; i < maxScan; i += 1) {
    const row = rows[i] ?? [];
    const normalized = row.map((cell) => toCellText(cell));
    const nonEmptyCount = normalized.filter((cell) => cell !== "").length;
    let matchScore = 0;

    if (normalizedExpected.length > 0) {
      const normalizedRow = normalized.map(normalizeHeader);
      normalizedExpected.forEach((expected) => {
        if (!expected) return;
        const hasMatch = normalizedRow.some(
          (cell) =>
            cell === expected ||
            (cell &&
              expected &&
              (cell.includes(expected) || expected.includes(cell))),
        );
        if (hasMatch) matchScore += 1;
      });
    }

    if (
      matchScore > bestMatchScore ||
      (matchScore === bestMatchScore && nonEmptyCount > bestNonEmpty)
    ) {
      bestMatchScore = matchScore;
      bestNonEmpty = nonEmptyCount;
      bestIndex = i;
    }
  }

  const headerRow = buildCompositeHeaderRow(rows, bestIndex);

  return {
    headerRow,
    headerRowIndex: bestIndex,
  };
};

export const hasRequiredHeaders = (
  requiredHeaders: Record<string, string[]>,
  worksheet: XLSX.WorkSheet,
  headerRow?: string[],
): { success: true } | { success: false; missingHeaders: string[] } => {
  const resolvedHeaderRow = headerRow
    ? headerRow
    : getHeaderRowInfo(worksheet, Object.values(requiredHeaders).flat())
        .headerRow;

  const missingHeaders: string[] = [];

  for (const key in requiredHeaders) {
    const targets = requiredHeaders[key].map(normalizeHeader);
    const found = resolvedHeaderRow.some((cell) => {
      if (typeof cell !== "string") return false;
      const normalized = normalizeHeader(cell);
      return targets.some(
        (target) =>
          normalized === target ||
          normalized.includes(target) ||
          target.includes(normalized),
      );
    });

    if (!found) {
      missingHeaders.push(key);
    }
  }

  return missingHeaders.length === 0
    ? { success: true }
    : { success: false, missingHeaders };
};

export const formatDateCell = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    const parsed = excelDateToJSDate(value);
    if (parsed && isValidDate(parsed)) {
      return parsed.toLocaleDateString("en-PH");
    }
    return undefined;
  }
  if (value instanceof Date) {
    return isValidDate(value) ? value.toLocaleDateString("en-PH") : undefined;
  }
  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime()) && isValidDate(asDate)) {
      return asDate.toLocaleDateString("en-PH");
    }
  }
  return undefined;
};

type ValidationErrorDetail = z.ZodError | { message: string };
type FailedRow = Record<string, unknown>;

const moveErrorColumnLast = (row: FailedRow): FailedRow => {
  if (!Object.prototype.hasOwnProperty.call(row, "__error")) {
    return row;
  }

  const entries = Object.entries(row).filter(([key]) => key !== "__error");
  const reordered: FailedRow = Object.fromEntries(entries);
  reordered.__error = row.__error;
  return reordered;
};

export type ProcessExcelMeta = {
  importedIds: number[];
  importedCount: number;
  errorCount: number;
  sheetSummary: Array<{
    sheet: string;
    rows: number;
    valid: number;
    failed: number;
  }>;
  totalRows: number;
  validRows: number;
};

type ProcessExcelOptions<T, TCells extends Record<string, unknown>> = {
  file: File;
  requiredHeaders: Record<string, string[]>;
  schema: z.ZodType<T>;
  getCells: (row: Record<string, unknown>) => TCells;
  skipRowsWithoutCell?: Array<keyof TCells>;
  mapRow: (
    row: Record<string, unknown>,
    rowNum: number,
  ) => {
    mapped?: T;
    skip?: boolean;
    errorMessage?: string;
    uniqueKey?: string;
  };
  onBatchInsert: (rows: T[]) => Promise<{ ids?: number[]; count?: number }>;
} & (
  | {
      uniqueKeys: Array<keyof TCells>;
      checkExistingUniqueKeys: (keys: string[]) => Promise<Set<string>>;
      checkExactMatch?: never;
    }
  | {
      uniqueKeys?: undefined;
      checkExistingUniqueKeys?: never;
      checkExactMatch: (
        cells: TCells,
        mappedRow: T,
        rowNum: number,
        sheetName: string,
      ) => Promise<{ exists: boolean; fields?: string[] }>;
    }
);

function extractUniqueEntriesFromRow<TCells extends Record<string, unknown>>(
  cells: TCells,
  keys: Array<keyof TCells>,
): Array<{ key: string; value: string }> {
  return keys
    .map((key) => ({ key: String(key), raw: cells[key] }))
    .filter(({ raw }) => hasContent(raw))
    .map(({ key, raw }) => ({ key, value: String(raw).trim() }))
    .filter(({ value }) => value.length > 0);
}

function buildUniqueConflictMessage(
  keys: string[],
  suffix: "already exists" | "duplicated in this file",
): string {
  const uniqueKeys = Array.from(new Set(keys)).filter((key) => key.length > 0);
  if (uniqueKeys.length === 0 || uniqueKeys.includes("uniqueKey")) {
    return `Unique value ${suffix}`;
  }
  return `${uniqueKeys.join(", ")} ${suffix}`;
}

export type UploadExcelResult = {
  failedExcel?: ExportExcelData;
  meta: ProcessExcelMeta;
};

export async function processExcelUpload<
  T,
  TCells extends Record<string, unknown> = Record<string, unknown>,
>(
  options: ProcessExcelOptions<T, TCells>,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  const {
    file,
    requiredHeaders,
    schema,
    getCells,
    skipRowsWithoutCell: skipRows,
    uniqueKeys,
    checkExistingUniqueKeys,
    checkExactMatch,
    mapRow,
    onBatchInsert,
  } = options;

  if ((await isExcel(file)) === false) {
    return { success: false, error: "File is not a valid Excel document" };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const validationResults = {
    total: 0,
    valid: 0,
    imported: 0,
    importedIds: [] as number[],
    errors: [] as Array<{
      row: number;
      sheet: string;
      errors: ValidationErrorDetail;
    }>,
    sheetSummary: [] as Array<{
      sheet: string;
      rows: number;
      valid: number;
      failed: number;
    }>,
  };

  const failedRowsBySheet = new Map<string, FailedRow[]>();
  const globalUniqueKeys = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const schemaHeaderMap =
      schema instanceof z.ZodObject ? getExcelHeaderMap(schema) : {};
    const expectedHeaders = [
      ...Object.values(requiredHeaders).flat(),
      ...Object.values(schemaHeaderMap).flat(),
    ].filter((value): value is string => typeof value === "string");
    const headerInfo = getHeaderRowInfo(worksheet, expectedHeaders);
    const rawSheetData = XLSX.utils.sheet_to_json<FailedRow>(worksheet, {
      header: headerInfo.headerRow,
      range: headerInfo.headerRowIndex + 1,
      blankrows: false,
    });
    const sheetData = skipRows
      ? rawSheetData.filter(
          (row) => !isMappedRowEmpty(getCells(row), skipRows ?? []),
        )
      : rawSheetData;

    console.log(
      `\n📋 Processing sheet "${sheetName}": ${sheetData.length} rows`,
    );

    const headerCheck = hasRequiredHeaders(
      requiredHeaders,
      worksheet,
      headerInfo.headerRow,
    );
    if (headerCheck.success === false) {
      const errorReason = `Sheet "${sheetName}" is missing required column(s): ${headerCheck.missingHeaders.join(", ")}.`;
      const failedRows =
        sheetData.length > 0
          ? sheetData.map((row) => ({ ...row, __error: errorReason }))
          : [{ __error: errorReason }];

      validationResults.total += sheetData.length;
      validationResults.errors.push(
        ...failedRows.map((_, idx) => ({
          row: idx + 2,
          sheet: sheetName,
          errors: { message: errorReason },
        })),
      );
      if (failedRows.length > 0) {
        failedRowsBySheet.set(sheetName, failedRows);
      }
      validationResults.sheetSummary.push({
        sheet: sheetName,
        rows: sheetData.length,
        valid: 0,
        failed: failedRows.length,
      });
      continue;
    }

    console.log(
      `✓ Sheet "${sheetName}": required columns found, processing rows...`,
    );

    let sheetValid = 0;
    let sheetFailed = 0;
    const sheetFailedRows: FailedRow[] = [];
    const sheetValidRows: T[] = [];
    const sheetUniqueKeys = new Set<string>();

    // Pre-check existing unique keys in DB if provided
    let existingUniqueKeys = new Set<string>();
    if (uniqueKeys && checkExistingUniqueKeys) {
      const keys = sheetData.flatMap((row) =>
        extractUniqueEntriesFromRow(getCells(row), uniqueKeys).map(
          ({ value }) => value,
        ),
      );
      if (keys.length > 0) {
        existingUniqueKeys = await checkExistingUniqueKeys(keys);
      }
    }

    for (let index = 0; index < sheetData.length; index++) {
      const row = sheetData[index];
      const rowCells = getCells(row);

      const mapResult = mapRow(row, index + 2);
      if (mapResult.skip) {
        continue;
      }

      const rowUniqueEntries = uniqueKeys
        ? extractUniqueEntriesFromRow(rowCells, uniqueKeys)
        : mapResult.uniqueKey
          ? [{ key: "uniqueKey", value: mapResult.uniqueKey }]
          : [];

      if (rowUniqueEntries.length > 0) {
        const existingConflicts = rowUniqueEntries.filter(
          ({ value }) =>
            existingUniqueKeys.has(value) || globalUniqueKeys.has(value),
        );

        if (existingConflicts.length > 0) {
          const message = buildUniqueConflictMessage(
            existingConflicts.map(({ key }) => key),
            "already exists",
          );
          sheetFailed++;
          sheetFailedRows.push({
            ...row,
            __error: message,
          });
          validationResults.errors.push({
            row: index + 2,
            sheet: sheetName,
            errors: { message },
          });
          continue;
        }

        const sheetConflicts = rowUniqueEntries.filter(({ value }) =>
          sheetUniqueKeys.has(value),
        );

        if (sheetConflicts.length > 0) {
          const message = buildUniqueConflictMessage(
            sheetConflicts.map(({ key }) => key),
            "duplicated in this file",
          );
          sheetFailed++;
          sheetFailedRows.push({
            ...row,
            __error: message,
          });
          validationResults.errors.push({
            row: index + 2,
            sheet: sheetName,
            errors: { message },
          });
          continue;
        }
      }

      if (mapResult.errorMessage) {
        sheetFailed++;
        sheetFailedRows.push({ ...row, __error: mapResult.errorMessage });
        validationResults.errors.push({
          row: index + 2,
          sheet: sheetName,
          errors: { message: mapResult.errorMessage },
        });
        continue;
      }

      const mappedRow = mapResult.mapped;
      const validated = schema.safeParse(mappedRow);
      validationResults.total++;

      if (validated.success) {
        if (!uniqueKeys) {
          const exactMatch = await checkExactMatch(
            rowCells,
            validated.data,
            index + 2,
            sheetName,
          );

          if (exactMatch.exists) {
            const message = "Already exists";

            sheetFailed++;
            sheetFailedRows.push({ ...row, __error: message });
            validationResults.errors.push({
              row: index + 2,
              sheet: sheetName,
              errors: { message },
            });
            continue;
          }
        }

        if (rowUniqueEntries.length > 0) {
          rowUniqueEntries.forEach(({ value }) => {
            sheetUniqueKeys.add(value);
            globalUniqueKeys.add(value);
          });
        }
        sheetValidRows.push(validated.data);
        validationResults.valid++;
        sheetValid++;
      } else {
        const errorReason =
          prettifyError(validated.error) || "Validation failed";
        sheetFailed++;
        sheetFailedRows.push({ ...row, __error: errorReason });
        validationResults.errors.push({
          row: index + 2,
          sheet: sheetName,
          errors: validated.error,
        });
      }
    }

    if (sheetValidRows.length > 0) {
      try {
        console.log(
          `✓ Sheet "${sheetName}": importing ${sheetValidRows.length} valid row(s) to database...`,
        );
        const insertResult = await onBatchInsert(sheetValidRows);
        const ids = insertResult.ids ?? [];
        validationResults.imported += insertResult.count ?? ids.length;
        validationResults.importedIds.push(...ids);
        console.log(
          `✓ Sheet "${sheetName}": imported ${insertResult.count ?? ids.length} row(s)`,
        );
      } catch (error: unknown) {
        return {
          success: false,
          error: `Database import failed: ${(error as Error)?.message || "Unknown error"}`,
        };
      }
    }

    if (sheetFailedRows.length > 0) {
      failedRowsBySheet.set(sheetName, sheetFailedRows);
    }

    validationResults.sheetSummary.push({
      sheet: sheetName,
      rows: sheetData.length,
      valid: sheetValid,
      failed: sheetFailed,
    });

    console.log(
      `  📊 Sheet "${sheetName}": ${sheetValid}/${sheetData.length} valid, ${sheetFailed} failed`,
    );
  }

  let failedExcelData: ExportExcelData | undefined;
  if (failedRowsBySheet.size > 0) {
    const failedWorkbook = XLSX.utils.book_new();
    failedRowsBySheet.forEach((failedRows, sheetName) => {
      const orderedRows = failedRows.map(moveErrorColumnLast);
      const failedWorksheet = XLSX.utils.json_to_sheet(orderedRows);
      XLSX.utils.book_append_sheet(failedWorkbook, failedWorksheet, sheetName);
    });

    const base64 = XLSX.write(failedWorkbook, {
      type: "base64",
      bookType: "xlsx",
    });
    failedExcelData = { fileName: `failed-rows-${Date.now()}.xlsx`, base64 };
  }

  if (validationResults.valid === 0) {
    const existingRowCount = validationResults.errors.filter((error) => {
      if ("message" in error.errors) {
        return error.errors.message.toLowerCase().includes("already exists");
      }
      return false;
    }).length;

    const allFailedRowsAlreadyExist =
      validationResults.errors.length > 0 &&
      existingRowCount === validationResults.errors.length;

    const noValidRowsMessage = allFailedRowsAlreadyExist
      ? "All rows already exists."
      : existingRowCount > 0
        ? `No valid rows to import. ${existingRowCount} row(s) already exist in the database.`
        : "No valid rows to import";

    if (allFailedRowsAlreadyExist) {
      return { success: false, error: noValidRowsMessage };
    }

    return failedExcelData
      ? {
          success: false,
          error: noValidRowsMessage,
          errorResult: {
            failedExcel: failedExcelData,
            meta: {
              importedIds: validationResults.importedIds,
              importedCount: validationResults.imported,
              errorCount: validationResults.errors.length,
              sheetSummary: validationResults.sheetSummary,
              totalRows: validationResults.total,
              validRows: validationResults.valid,
            },
          },
        }
      : { success: false, error: noValidRowsMessage };
  }

  return {
    success: true,
    result: {
      failedExcel: failedExcelData,
      meta: {
        importedIds: validationResults.importedIds,
        importedCount: validationResults.imported,
        errorCount: validationResults.errors.length,
        sheetSummary: validationResults.sheetSummary,
        totalRows: validationResults.total,
        validRows: validationResults.valid,
      },
    },
  };
}
