"use server";

import { CaseSchema } from "@/app/components/Statistics/Annual/Schema";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  UploadExcelResult,
  findColumnValue,
  isMappedRowEmpty,
  processExcelUpload,
  valuesAreEqual,
} from "@rtc-database/shared";

const toText = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
};

const normalizeHeaderToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const extractYearFromHeader = (value: string): number | undefined => {
  const match = value.match(/(?:19|20)\d{2}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : undefined;
};

const findPendingValueByYear = (
  row: Record<string, unknown>,
  targetYear: number,
): unknown => {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeaderToken(key);
    if (!normalized.includes("pending")) continue;

    const year =
      extractYearFromHeader(key) ?? extractYearFromHeader(normalized);
    if (year === targetYear) {
      return value;
    }
  }

  return undefined;
};

const resolveCourtReportYear = (
  row: Record<string, unknown>,
  explicitYearValue: unknown,
): number => {
  const explicitYear = Number(String(explicitYearValue ?? "").trim());
  if (
    Number.isInteger(explicitYear) &&
    explicitYear >= 1900 &&
    explicitYear <= 2100
  ) {
    return explicitYear;
  }

  const pendingYears = Object.keys(row)
    .map((key) => {
      const normalized = normalizeHeaderToken(key);
      if (!normalized.includes("pending")) return undefined;
      return extractYearFromHeader(key) ?? extractYearFromHeader(normalized);
    })
    .filter((year): year is number => year !== undefined);

  if (pendingYears.length > 0) {
    return Math.max(...pendingYears);
  }

  return new Date().getFullYear();
};

const toReportYear = (value: unknown): number => {
  const parsed = Number(String(value ?? "").trim());
  if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) {
    return parsed;
  }
  return new Date().getFullYear();
};

const getCourtCells = (row: Record<string, unknown>) => {
  const explicitReportYearCell = findColumnValue(row, [
    "Report Year",
    "Year",
    "reportYear",
  ]);
  const reportYearCell = resolveCourtReportYear(row, explicitReportYearCell);
  const branchCell = findColumnValue(row, ["Branch", "Branches", "Branch No"]);
  const pendingLastYearCell =
    findColumnValue(row, ["Pending Last Year", "pendingLastYear"]) ??
    findPendingValueByYear(row, reportYearCell - 1);
  const raffledOrAddedCell = findColumnValue(row, [
    "Raffled Or Added",
    "Raffled/Added",
    "RaffledOrAdded",
  ]);
  const disposedCell = findColumnValue(row, ["Disposed"]);
  const pendingThisYearCell =
    findColumnValue(row, ["Pending This Year", "pendingThisYear"]) ??
    findPendingValueByYear(row, reportYearCell);
  const percentageOfDispositionCell = findColumnValue(row, [
    "Percentage Of Disposition",
    "% Disposition",
    "percentageOfDisposition",
  ]);

  return {
    reportYearCell,
    branchCell,
    pendingLastYearCell,
    raffledOrAddedCell,
    disposedCell,
    pendingThisYearCell,
    percentageOfDispositionCell,
  };
};

export async function uploadRegionalTrialCourtExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const result = await processExcelUpload<
      CaseSchema,
      ReturnType<typeof getCourtCells>
    >({
      file,
      requiredHeaders: {
        Branch: ["Branch", "Branches", "Branch No"],
      },
      getCells: getCourtCells,
      schema: CaseSchema,
      skipRowsWithoutCell: ["branchCell"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingRows = await prisma.regionalTrialCourt.findMany({
          where: {
            branch: mappedRow.branch,
          },
        });

        const mappedEntries = Object.entries(mappedRow);
        const hasExactMatch = existingRows.some((existingRow) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(
              value,
              (existingRow as Record<string, unknown>)[key],
            ),
          ),
        );

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getCourtCells(row);
        if (isMappedRowEmpty(cells)) {
          return { skip: true };
        }

        return {
          mapped: {
            reportYear: toReportYear(cells.reportYearCell),
            branch: toText(cells.branchCell) ?? "",
            pendingLastYear: toText(cells.pendingLastYearCell),
            RaffledOrAdded: toText(cells.raffledOrAddedCell),
            Disposed: toText(cells.disposedCell),
            pendingThisYear: toText(cells.pendingThisYearCell),
            percentageOfDisposition: toText(cells.percentageOfDispositionCell),
          },
        };
      },
      onBatchInsert: async (rows) => {
        const inserted = await prisma.regionalTrialCourt.createManyAndReturn({
          data: rows.map((row) => ({
            reportYear: row.reportYear,
            branch: row.branch,
            pendingLastYear: row.pendingLastYear?.toString(),
            RaffledOrAdded: row.RaffledOrAdded?.toString(),
            Disposed: row.Disposed?.toString(),
            pendingThisYear: row.pendingThisYear?.toString(),
            percentageOfDisposition: row.percentageOfDisposition?.toString(),
          })),
        });

        return { ids: inserted.map((item) => item.id), count: inserted.length };
      },
    });

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Regional Trial Court Excel upload failed:", error);
    return {
      success: false,
      error: "Regional Trial Court Excel upload failed",
    };
  }
}
