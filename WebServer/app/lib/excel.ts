import * as XLSX from "xlsx";
import z, { prettifyError } from "zod";
import ActionResult from "../components/ActionResult";

const EXCEL_HEADERS_PREFIX = "excelHeaders:";

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

const unwrapSchema = (schema: unknown): unknown => {
  let current: unknown = schema;

  while (true) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = (current as unknown as { unwrap: () => unknown }).unwrap();
      continue;
    }
    const removeDefault = (
      current as unknown as { removeDefault?: () => unknown }
    ).removeDefault;
    if (removeDefault) {
      current = removeDefault();
      continue;
    }
    const innerType = (current as unknown as { innerType?: () => unknown })
      .innerType;
    if (innerType) {
      current = innerType();
      continue;
    }
    return current;
  }
};

const normalizeEnumValue = (
  value: unknown,
  allowedValues: Array<string | number>,
): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (raw === "") return undefined;
  const normalized = raw.replace(/\s+/g, "_").toUpperCase();
  const normalizedAllowed = allowedValues.map((option) =>
    String(option).trim(),
  );
  if (normalizedAllowed.includes(normalized)) {
    return normalized;
  }
  const match = normalizedAllowed.find(
    (option) => option.toLowerCase() === raw.toLowerCase(),
  );
  return match;
};

const normalizeBooleanValue = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const raw = String(value).trim().toLowerCase();
  if (raw === "") return undefined;
  if (["yes", "true", "1", "y"].includes(raw)) return true;
  if (["no", "false", "0", "n"].includes(raw)) return false;
  return undefined;
};

const normalizeDateValue = (value: unknown): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    return isValidDate(value) ? value : undefined;
  }
  if (typeof value === "number") {
    const parsed = excelDateToJSDate(value);
    return parsed && isValidDate(parsed) ? parsed : undefined;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && isValidDate(parsed)
      ? parsed
      : undefined;
  }
  return undefined;
};

const normalizeValueBySchema = (value: unknown, schema: unknown): unknown => {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodDate) {
    return normalizeDateValue(value);
  }

  if (unwrapped instanceof z.ZodEnum) {
    return normalizeEnumValue(value, unwrapped.options);
  }

  const nativeEnum = (unwrapped as { enum?: unknown }).enum;
  if (
    nativeEnum &&
    typeof nativeEnum === "object" &&
    !Array.isArray(nativeEnum)
  ) {
    const allowed = Object.values(nativeEnum).filter(
      (option): option is string => typeof option === "string",
    );
    return normalizeEnumValue(value, allowed);
  }

  if (unwrapped instanceof z.ZodBoolean) {
    return normalizeBooleanValue(value);
  }

  if (unwrapped instanceof z.ZodString) {
    if (value === undefined || value === null) return value;
    return typeof value === "string" ? value : String(value);
  }

  return value;
};

export const normalizeRowBySchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  row: Record<string, unknown>,
): Partial<Record<keyof T, unknown>> => {
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

export const getHeaderRow = (worksheet: XLSX.WorkSheet): string[] =>
  (
    (XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      range: 0,
      blankrows: false,
    })[0] as string[] | undefined) || []
  ).map((cell) => cell ?? "");

export const hasRequiredHeaders = (
  requiredHeaders: Record<string, string[]>,
  worksheet: XLSX.WorkSheet,
): { success: true } | { success: false; missingHeaders: string[] } => {
  const headerRow = getHeaderRow(worksheet);

  const missingHeaders: string[] = [];

  for (const key in requiredHeaders) {
    const targets = requiredHeaders[key].map(normalizeHeader);
    const found = headerRow.some((cell) => {
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

type CellsConfig<TCells extends Record<string, unknown>> = {
  getCells: (row: Record<string, unknown>) => TCells;
  keys?: Array<keyof TCells>;
};

type ProcessExcelOptions<T, TCells extends Record<string, unknown>> = {
  file: File;
  requiredHeaders: Record<string, string[]>;
  schema: z.ZodType<T>;
  skipRowsWithoutCell?: CellsConfig<TCells>;
  uniqueKeys?: CellsConfig<TCells>;
  extractUniqueKey?: (row: Record<string, unknown>) => string | undefined;
  checkExistingUniqueKeys?: (keys: string[]) => Promise<Set<string>>;
  uniqueKeyLabel?: string;
  mapRow: (row: Record<string, unknown>) => {
    mapped?: T;
    skip?: boolean;
    errorMessage?: string;
    uniqueKey?: string;
  };
  onBatchInsert: (rows: T[]) => Promise<{ ids?: number[]; count?: number }>;
};

function extractUniqueKeyFromRow<TCells extends Record<string, unknown>>(
  row: Record<string, unknown>,
  config: CellsConfig<TCells>,
): string | undefined {
  const cells = config.getCells(row);
  const keys = config.keys ?? [];
  const values = keys
    .map((key) => cells[key])
    .filter((value) => hasContent(value));

  if (values.length === 0) {
    return undefined;
  }

  return values.map((value) => String(value).trim()).join(" ");
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
): Promise<ActionResult<UploadExcelResult>> {
  const {
    file,
    requiredHeaders,
    schema,
    skipRowsWithoutCell: skipRows,
    uniqueKeys,
    extractUniqueKey,
    checkExistingUniqueKeys,
    uniqueKeyLabel = "Unique value",
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
    const rawSheetData = XLSX.utils.sheet_to_json<FailedRow>(worksheet);
    const sheetData = skipRows
      ? rawSheetData.filter(
          (row) =>
            !isMappedRowEmpty(skipRows.getCells(row), skipRows.keys ?? []),
        )
      : rawSheetData;

    console.log(
      `\n📋 Processing sheet "${sheetName}": ${sheetData.length} rows`,
    );

    const headerCheck = hasRequiredHeaders(requiredHeaders, worksheet);
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
    if ((uniqueKeys || extractUniqueKey) && checkExistingUniqueKeys) {
      const keys = sheetData
        .map((row) =>
          extractUniqueKey
            ? extractUniqueKey(row)
            : uniqueKeys
              ? extractUniqueKeyFromRow(row, uniqueKeys)
              : undefined,
        )
        .filter((val): val is string => !!val);
      if (keys.length > 0) {
        existingUniqueKeys = await checkExistingUniqueKeys(keys);
      }
    }

    for (let index = 0; index < sheetData.length; index++) {
      const row = sheetData[index];

      const mapResult = mapRow(row);
      if (mapResult.skip) {
        continue;
      }

      const uniqueKey =
        mapResult.uniqueKey ??
        (extractUniqueKey
          ? extractUniqueKey(row)
          : uniqueKeys
            ? extractUniqueKeyFromRow(row, uniqueKeys)
            : undefined);
      if (uniqueKey) {
        if (
          existingUniqueKeys.has(uniqueKey) ||
          globalUniqueKeys.has(uniqueKey)
        ) {
          sheetFailed++;
          sheetFailedRows.push({
            ...row,
            __error: `${uniqueKeyLabel} already exists`,
          });
          validationResults.errors.push({
            row: index + 2,
            sheet: sheetName,
            errors: { message: `${uniqueKeyLabel} already exists` },
          });
          continue;
        }

        if (sheetUniqueKeys.has(uniqueKey)) {
          sheetFailed++;
          sheetFailedRows.push({
            ...row,
            __error: `${uniqueKeyLabel} duplicated in this file`,
          });
          validationResults.errors.push({
            row: index + 2,
            sheet: sheetName,
            errors: { message: `${uniqueKeyLabel} duplicated in this file` },
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
        if (uniqueKey) {
          sheetUniqueKeys.add(uniqueKey);
          globalUniqueKeys.add(uniqueKey);
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
    return failedExcelData
      ? {
          success: false,
          error:
            "No valid rows to import. Download failed rows file to review errors.",
        }
      : { success: false, error: "No valid rows to import" };
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
