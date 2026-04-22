"use server";

import {
  MonthlyRow,
  MonthlyRowSchema,
} from "@/app/components/Statistics/Monthly/Schema";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  UploadExcelResult,
  findColumnValue,
  isMappedRowEmpty,
  processExcelUpload,
  valuesAreEqual,
} from "@rtc-database/shared";

const toNumber = (value: unknown): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const getMonthlyCells = (row: Record<string, unknown>) => {
  const monthCell = findColumnValue(row, ["Month", "Period", "Report Month"]);
  const categoryCell = findColumnValue(row, ["Category", "Case Category"]);
  const branchCell = findColumnValue(row, [
    "Branch",
    "Branch/Station",
    "Station",
  ]);
  const criminalCell = findColumnValue(row, ["Criminal", "Crim"]);
  const civilCell = findColumnValue(row, ["Civil"]);
  const totalCell = findColumnValue(row, ["Total", "Grand Total"]);

  return {
    monthCell,
    categoryCell,
    branchCell,
    criminalCell,
    civilCell,
    totalCell,
  };
};

export async function uploadMonthlyStatisticsExcel(
  file: File,
  fallbackMonth?: string,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const result = await processExcelUpload<
      MonthlyRow,
      ReturnType<typeof getMonthlyCells>
    >({
      file,
      requiredHeaders: {
        Category: ["Category", "Case Category"],
        Branch: ["Branch", "Branch/Station", "Station"],
      },
      getCells: getMonthlyCells,
      schema: MonthlyRowSchema,
      skipRowsWithoutCell: ["categoryCell", "branchCell"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingRows = await prisma.monthlyStatistics.findMany({
          where: {
            month: mappedRow.month,
            category: mappedRow.category,
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
        const cells = getMonthlyCells(row);

        if (isMappedRowEmpty(cells)) {
          return { skip: true };
        }

        const month = normalizeText(cells.monthCell || fallbackMonth);
        const category = normalizeText(cells.categoryCell);
        const branch = normalizeText(cells.branchCell);

        if (!month) {
          return {
            errorMessage:
              "Month is required. Provide a Month column or pass fallbackMonth.",
          };
        }

        const criminal = toNumber(cells.criminalCell);
        const civil = toNumber(cells.civilCell);
        const totalFromFile = toNumber(cells.totalCell);
        const computedTotal = criminal + civil;
        const total =
          cells.totalCell === undefined ? computedTotal : totalFromFile;

        return {
          mapped: {
            month,
            category,
            branch,
            criminal,
            civil,
            total,
          },
          uniqueKey: `${month}|${category}|${branch}`,
        };
      },
      onBatchInsert: async (rows) => {
        const inserted = await prisma.monthlyStatistics.createManyAndReturn({
          data: rows,
        });

        return { ids: inserted.map((item) => item.id), count: inserted.length };
      },
    });

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Monthly Excel upload failed:", error);
    return { success: false, error: "Monthly Excel upload failed" };
  }
}
