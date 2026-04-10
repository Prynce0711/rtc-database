import * as XLSX from "xlsx";
import type { SummaryRow } from "./Schema";
import {
  SUMMARY_NUMERIC_FIELDS,
  TITLE_ALIAS_LOOKUP,
  type SummaryCourtType,
} from "./SummaryConstants";

type SheetCell = string | number | boolean | Date | null | undefined;

type HeaderMapping = {
  branch: number;
  raffleDate: number;
  civilFamily: number;
  civilOrdinary: number;
  civilReceivedViaReraffled: number;
  civilUnloaded: number;
  lrcPetition: number;
  lrcSpProc: number;
  lrcReceivedViaReraffled: number;
  lrcUnloaded: number;
  criminalFamily: number;
  criminalDrugs: number;
  criminalOrdinary: number;
  criminalReceivedViaReraffled: number;
  criminalUnloaded: number;
  total: number;
};

export type ParsedSummaryWorkbookResult = {
  rows: SummaryRow[];
  skippedRows: number;
  detectedCourtTypes: SummaryCourtType[];
};

const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const toCellText = (cell: SheetCell): string => {
  if (cell === null || cell === undefined) return "";
  return String(cell).replace(/\s+/g, " ").trim();
};

const hasContent = (value: SheetCell): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const toNumber = (value: SheetCell): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.trunc(value));
  }
  const parsed = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

const toIsoDate = (year: number, month: number, day: number): string => {
  const safeMonth = Math.max(1, Math.min(12, month));
  const safeDay = Math.max(1, Math.min(31, day));
  return `${year}-${pad2(safeMonth)}-${pad2(safeDay)}`;
};

const toIsoDateStrict = (
  year: number,
  month: number,
  day: number,
): string | null => {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  const isExactMatch =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() + 1 === month &&
    candidate.getUTCDate() === day;

  if (!isExactMatch) return null;
  return toIsoDate(year, month, day);
};

const resolveAmbiguousMonthDayYear = (
  first: number,
  second: number,
  year: number,
  fallbackMonth: string,
): string | null => {
  const fallbackMonthNumber = Number(fallbackMonth);
  const asMonthDay = toIsoDateStrict(year, first, second);
  const asDayMonth = toIsoDateStrict(year, second, first);

  if (asMonthDay && !asDayMonth) return asMonthDay;
  if (!asMonthDay && asDayMonth) return asDayMonth;
  if (!asMonthDay && !asDayMonth) return null;

  // If both parses are valid (for values <= 12), prefer the one that matches the selected month filter.
  if (first === fallbackMonthNumber && second !== fallbackMonthNumber) {
    return asMonthDay;
  }

  if (second === fallbackMonthNumber && first !== fallbackMonthNumber) {
    return asDayMonth;
  }

  // Default to month/day for ambiguous values to preserve existing behavior.
  return asMonthDay;
};

const excelDateToIso = (serial: number): string | null => {
  if (!Number.isFinite(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return toIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
};

export const parseRaffleDateToIso = (
  value: SheetCell,
  fallbackYear: number,
  fallbackMonth: string,
): string => {
  const fallback = `${fallbackYear}-${fallbackMonth}-01`;

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return toIsoDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
  }

  if (typeof value === "number") {
    return excelDateToIso(value) ?? fallback;
  }

  const text = toCellText(value);
  if (!text) return fallback;

  const monthDayYear = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (monthDayYear) {
    const first = Number(monthDayYear[1]);
    const second = Number(monthDayYear[2]);
    let year = Number(monthDayYear[3]);
    if (year < 100) year += 2000;

    const resolved = resolveAmbiguousMonthDayYear(
      first,
      second,
      year,
      fallbackMonth,
    );

    return resolved ?? fallback;
  }

  const monthDay = text.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (monthDay) {
    const resolved = resolveAmbiguousMonthDayYear(
      Number(monthDay[1]),
      Number(monthDay[2]),
      fallbackYear,
      fallbackMonth,
    );

    return resolved ?? fallback;
  }

  const isoDay = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) {
    return toIsoDate(Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]));
  }

  const isoMonth = text.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    return toIsoDate(Number(isoMonth[1]), Number(isoMonth[2]), 1);
  }

  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) {
    return toIsoDate(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth() + 1,
      parsed.getUTCDate(),
    );
  }

  return fallback;
};

const detectCourtTypeFromRow = (
  normalizedValues: string[],
): SummaryCourtType | null => {
  if (normalizedValues.length === 0) return null;
  const joined = normalizedValues.join("").toUpperCase();

  const matched = TITLE_ALIAS_LOOKUP.find((alias) =>
    joined.includes(alias.key),
  );
  return matched?.courtType ?? null;
};

const isHeaderRow = (normalizedValues: string[]): boolean => {
  if (normalizedValues.length === 0) return false;
  const joined = normalizedValues.join("");
  const hasBranch = normalizedValues.some(
    (value) => value === "branch" || value.startsWith("branch"),
  );
  const hasRaffleDate =
    joined.includes("raffledate") ||
    (joined.includes("raffle") && joined.includes("date"));

  return hasBranch && hasRaffleDate;
};

const isFooterRow = (normalizedValues: string[]): boolean => {
  const footerTokens = ["preparedby", "notedby", "submittedby", "certifiedby"];
  return normalizedValues.some((value) =>
    footerTokens.some((token) => value.includes(token)),
  );
};

const buildCompositeHeaderRow = (
  rows: SheetCell[][],
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

    const currentValue = toCellText(rows[headerRowIndex]?.[colIndex]);
    if (currentValue) parts.push(currentValue);

    return parts.join(" ").trim();
  });
};

const resolveHeaderMapping = (headers: string[]): HeaderMapping => {
  const normalized = headers.map((header) => normalizeToken(header));

  const findFirst = (predicate: (value: string) => boolean): number =>
    normalized.findIndex((value) => predicate(value));

  const findAll = (predicate: (value: string) => boolean): number[] =>
    normalized
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => predicate(value))
      .map(({ index }) => index);

  const branch = findFirst(
    (value) => value === "branch" || value.startsWith("branch"),
  );
  const raffleDate = findFirst(
    (value) =>
      value.includes("raffledate") ||
      (value.includes("raffle") && value.includes("date")),
  );

  const families = findAll((value) => value.includes("family"));
  const ordinaries = findAll((value) => value.includes("ordinary"));
  const reRaffleds = findAll((value) => value.includes("reraffled"));
  const unloadeds = findAll((value) => value.includes("unloaded"));

  const petition = findFirst((value) => value.includes("petition"));
  const spProc = findFirst(
    (value) =>
      value.includes("spproc") ||
      (value.includes("sp") && value.includes("proc")),
  );
  const drugs = findFirst((value) => value.includes("drugs"));
  const total = findFirst(
    (value) => value === "total" || value.includes("total"),
  );

  const baseIndex = branch >= 0 ? branch : 0;
  const fallback = (index: number, offset: number): number =>
    index >= 0 ? index : baseIndex + offset;

  return {
    branch,
    raffleDate,
    civilFamily: fallback(families[0] ?? -1, 2),
    civilOrdinary: fallback(ordinaries[0] ?? -1, 3),
    civilReceivedViaReraffled: fallback(reRaffleds[0] ?? -1, 4),
    civilUnloaded: fallback(unloadeds[0] ?? -1, 5),
    lrcPetition: fallback(petition, 6),
    lrcSpProc: fallback(spProc, 7),
    lrcReceivedViaReraffled: fallback(reRaffleds[1] ?? -1, 8),
    lrcUnloaded: fallback(unloadeds[1] ?? -1, 9),
    criminalFamily: fallback(families[1] ?? -1, 10),
    criminalDrugs: fallback(drugs, 11),
    criminalOrdinary: fallback(ordinaries[1] ?? -1, 12),
    criminalReceivedViaReraffled: fallback(reRaffleds[2] ?? -1, 13),
    criminalUnloaded: fallback(unloadeds[2] ?? -1, 14),
    total: fallback(total, 15),
  };
};

const readMappedNumber = (row: SheetCell[], index: number): number =>
  index >= 0 && index < row.length ? toNumber(row[index]) : 0;

export const computeSummaryTotal = (
  row: Pick<
    SummaryRow,
    | "civilFamily"
    | "civilOrdinary"
    | "civilReceivedViaReraffled"
    | "civilUnloaded"
    | "lrcPetition"
    | "lrcSpProc"
    | "lrcReceivedViaReraffled"
    | "lrcUnloaded"
    | "criminalFamily"
    | "criminalDrugs"
    | "criminalOrdinary"
    | "criminalReceivedViaReraffled"
    | "criminalUnloaded"
  >,
): number =>
  row.civilFamily +
  row.civilOrdinary +
  row.civilReceivedViaReraffled +
  row.civilUnloaded +
  row.lrcPetition +
  row.lrcSpProc +
  row.lrcReceivedViaReraffled +
  row.lrcUnloaded +
  row.criminalFamily +
  row.criminalDrugs +
  row.criminalOrdinary +
  row.criminalReceivedViaReraffled +
  row.criminalUnloaded;

export const toMonthKey = (isoDate: string): string => isoDate.slice(0, 7);

const mapSummaryDataRow = (
  row: SheetCell[],
  mapping: HeaderMapping,
  courtType: SummaryCourtType,
  fallbackYear: number,
  fallbackMonth: string,
  normalizedValues: string[],
  fallbackBranch: string | null,
): SummaryRow | null => {
  const branchRaw = mapping.branch >= 0 ? row[mapping.branch] : "";
  const branchText = toCellText(branchRaw);
  const branchToken = normalizeToken(branchText);

  if (branchToken === "total" || branchToken === "grandtotal") return null;

  const isHeaderLikeBranch =
    branchToken === "branch" || branchToken === "branchno";

  const raffleDateCell =
    mapping.raffleDate >= 0 ? row[mapping.raffleDate] : undefined;
  const hasRaffleDate = hasContent(raffleDateCell);
  const hasBranchInRow = branchText.length > 0;

  // Import all data rows under each title block, while still skipping blank spacer lines.
  if (!hasBranchInRow && !hasRaffleDate) return null;

  const branch = branchText || fallbackBranch || "";
  if (!branch) return null;

  const numericCells = {
    civilFamily: readMappedNumber(row, mapping.civilFamily),
    civilOrdinary: readMappedNumber(row, mapping.civilOrdinary),
    civilReceivedViaReraffled: readMappedNumber(
      row,
      mapping.civilReceivedViaReraffled,
    ),
    civilUnloaded: readMappedNumber(row, mapping.civilUnloaded),
    lrcPetition: readMappedNumber(row, mapping.lrcPetition),
    lrcSpProc: readMappedNumber(row, mapping.lrcSpProc),
    lrcReceivedViaReraffled: readMappedNumber(
      row,
      mapping.lrcReceivedViaReraffled,
    ),
    lrcUnloaded: readMappedNumber(row, mapping.lrcUnloaded),
    criminalFamily: readMappedNumber(row, mapping.criminalFamily),
    criminalDrugs: readMappedNumber(row, mapping.criminalDrugs),
    criminalOrdinary: readMappedNumber(row, mapping.criminalOrdinary),
    criminalReceivedViaReraffled: readMappedNumber(
      row,
      mapping.criminalReceivedViaReraffled,
    ),
    criminalUnloaded: readMappedNumber(row, mapping.criminalUnloaded),
  };

  const computedTotal = computeSummaryTotal(numericCells);

  if (isHeaderLikeBranch) return null;

  const hasOnlyHeaderTokens = normalizedValues.every(
    (value) =>
      value.includes("branch") ||
      value.includes("raffle") ||
      value.includes("family") ||
      value.includes("ordinary") ||
      value.includes("reraffled") ||
      value.includes("unloaded") ||
      value.includes("petition") ||
      value.includes("proc") ||
      value.includes("drugs") ||
      value === "total",
  );

  if (hasOnlyHeaderTokens && computedTotal === 0) return null;

  const raffleDate = parseRaffleDateToIso(
    raffleDateCell,
    fallbackYear,
    fallbackMonth,
  );

  const totalCell = mapping.total >= 0 ? row[mapping.total] : undefined;
  const totalFromCell = toNumber(totalCell);
  const total = hasContent(totalCell)
    ? totalFromCell || computedTotal
    : computedTotal;

  return {
    courtType,
    reportYear: Number(raffleDate.slice(0, 4)),
    raffleDate,
    branch,
    ...numericCells,
    total,
  };
};

export const parseSummaryWorkbook = (
  buffer: ArrayBuffer,
  fallbackYear: number,
  fallbackMonth: string,
): ParsedSummaryWorkbookResult => {
  const workbook = XLSX.read(buffer, { type: "array" });

  const importedRows: SummaryRow[] = [];
  let skippedRows = 0;
  const detectedCourtTypes = new Set<SummaryCourtType>();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json<SheetCell[]>(worksheet, {
      header: 1,
      range: 0,
      blankrows: false,
    }) as SheetCell[][];

    let currentCourtType: SummaryCourtType | null = null;

    for (let i = 0; i < rows.length; i += 1) {
      const rawRow = rows[i] ?? [];
      const normalizedValues = rawRow
        .map((cell) => normalizeToken(toCellText(cell)))
        .filter((value) => value.length > 0);

      if (normalizedValues.length === 0) continue;

      const titleCourtType = detectCourtTypeFromRow(normalizedValues);
      if (titleCourtType) {
        currentCourtType = titleCourtType;
        detectedCourtTypes.add(titleCourtType);
        continue;
      }

      if (!currentCourtType) continue;
      if (!isHeaderRow(normalizedValues)) continue;

      const compositeHeader = buildCompositeHeaderRow(rows, i);
      const mapping = resolveHeaderMapping(compositeHeader);

      if (mapping.branch < 0 || mapping.raffleDate < 0) {
        skippedRows += 1;
        continue;
      }

      let j = i + 1;
      let currentBranch: string | null = null;
      for (; j < rows.length; j += 1) {
        const dataRow = rows[j] ?? [];
        const normalizedDataValues = dataRow
          .map((cell) => normalizeToken(toCellText(cell)))
          .filter((value) => value.length > 0);

        if (normalizedDataValues.length === 0) {
          skippedRows += 1;
          continue;
        }

        const nextTitleCourtType = detectCourtTypeFromRow(normalizedDataValues);
        if (nextTitleCourtType) {
          currentCourtType = nextTitleCourtType;
          detectedCourtTypes.add(nextTitleCourtType);
          break;
        }

        if (isHeaderRow(normalizedDataValues)) {
          break;
        }

        if (isFooterRow(normalizedDataValues)) {
          skippedRows += 1;
          break;
        }

        const mapped = mapSummaryDataRow(
          dataRow,
          mapping,
          currentCourtType,
          fallbackYear,
          fallbackMonth,
          normalizedDataValues,
          currentBranch,
        );

        if (!mapped) {
          skippedRows += 1;
          continue;
        }

        currentBranch = mapped.branch;
        importedRows.push(mapped);
      }

      i = j - 1;
    }
  }

  const unique = new Map<string, SummaryRow>();

  importedRows.forEach((row) => {
    const key = `${row.courtType}|${row.branch.toLowerCase()}|${row.raffleDate}`;
    unique.set(key, row);
  });

  return {
    rows: Array.from(unique.values()),
    skippedRows,
    detectedCourtTypes: Array.from(detectedCourtTypes),
  };
};

export const sumNumericField = (
  rows: SummaryRow[],
  field: (typeof SUMMARY_NUMERIC_FIELDS)[number],
): number => rows.reduce((total, row) => total + row[field], 0);
