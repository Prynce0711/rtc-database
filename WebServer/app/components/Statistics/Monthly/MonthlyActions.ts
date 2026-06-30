"use server";
import Roles from "@/app/lib/Roles";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { ActionResult } from "@rtc-database/shared";
import { LogAction } from "@rtc-database/shared/prisma/enums";
import { prettifyError, z } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";
import { MonthlyRow, MonthlyRowSchema } from "./Schema";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs/promises";
import { processExcelUpload, findColumnValue, isMappedRowEmpty } from "@rtc-database/shared";

// ─── Get ────────────────────────────────────────────────────────────────────

async function resolveMonthlyReportsDirectory(
  folderPath?: string,
): Promise<string | null> {
  if (folderPath) return path.resolve(folderPath);

  const candidates = [
    path.resolve(process.cwd(), "..", "RTC-DATA", "Analytics"),
    path.resolve(process.cwd(), "..", "RTC-DATA", "Analytics", "Monthly Report RTC Nov 2023"),
    path.resolve(process.cwd(), "..", "RTC-DATA", "Analytics", "Monthly  Report RTC Nov 2023"),
  ];

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (!stats.isDirectory()) continue;

      const directEntries = await fs.readdir(candidate, { withFileTypes: true });
      const matchingDirectory = directEntries.find(
        (entry) => entry.isDirectory() && /monthly/i.test(entry.name),
      );

      if (matchingDirectory) {
        return path.join(candidate, matchingDirectory.name);
      }

      const hasExcelFile = directEntries.some(
        (entry) => entry.isFile() && /\.xls[xm]?$/.test(entry.name),
      );

      if (hasExcelFile || /monthly/i.test(path.basename(candidate))) {
        return candidate;
      }
    } catch {
      // Ignore missing paths and continue searching.
    }
  }

  return null;
}

export async function getMonthlyStatistics(
  month?: string,
): Promise<ActionResult<MonthlyRow[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const orderBy = month
      ? [{ id: "asc" as const }]
      : [{ month: "desc" as const }, { id: "asc" as const }];

    const rows = await prisma.monthlyStatistics.findMany({
      where: month ? { month } : undefined,
      orderBy,
    });

    return {
      success: true,
      result: rows.map((r) => ({
        id: r.id,
        month: r.month,
        category: r.category,
        branch: r.branch,
        criminal: r.criminal,
        civil: r.civil,
        total: r.total,
      })),
    };
  } catch (error) {
    console.error("Error fetching monthly statistics:", error);
    return { success: false, error: "Failed to fetch monthly statistics" };
  }
}

export async function getMonthlyYears(): Promise<ActionResult<string[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const rows = await prisma.monthlyStatistics.findMany({
      select: { month: true },
      orderBy: [{ month: "desc" }],
    });

    const years = Array.from(
      new Set(rows.map((r) => String(r.month).slice(0, 4))),
    ).sort((a, b) => Number(b) - Number(a));

    return { success: true, result: years };
  } catch (error) {
    console.error("Error fetching monthly years:", error);
    return { success: false, error: "Failed to fetch monthly years" };
  }
}

export async function importLocalMonthlyReports(
  folderPath?: string,
): Promise<ActionResult<{ imported: number }>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN, Roles.STATISTICS]);
    if (!sessionValidation.success) return sessionValidation;

    const base = await resolveMonthlyReportsDirectory(folderPath);
    if (!base) {
      return { success: false, error: "Monthly report folder not found" };
    }

    const dirents = await fs.readdir(base, { withFileTypes: true });
    const files = dirents
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((n) => /\.xls[xm]?$/.test(n));

    let totalImported = 0;

    for (const fileName of files) {
      const fullPath = path.join(base, fileName);
      const workbook = XLSX.readFile(fullPath);

      const parseMonthFromFilename = (name: string): string | undefined => {
        const lower = name.toLowerCase();
        const yearMatch = name.match(/(20\d{2})/);
        const year = yearMatch ? yearMatch[1] : undefined;

        const months: Record<string, string> = {
          jan: "01",
          january: "01",
          feb: "02",
          february: "02",
          mar: "03",
          march: "03",
          apr: "04",
          april: "04",
          may: "05",
          jun: "06",
          june: "06",
          jul: "07",
          july: "07",
          aug: "08",
          august: "08",
          sep: "09",
          sept: "09",
          september: "09",
          oct: "10",
          october: "10",
          nov: "11",
          november: "11",
          dec: "12",
          december: "12",
        };

        for (const [key, num] of Object.entries(months)) {
          if (lower.includes(key)) {
            if (year) return `${year}-${num}`;
          }
        }

        const numericMatch = name.match(/(0[1-9]|1[0-2])[-_ ]?(20\d{2})/);
        if (numericMatch) {
          return `${numericMatch[2]}-${numericMatch[1]}`;
        }

        return undefined;
      };

      const fallbackMonth = parseMonthFromFilename(fileName);

      const getMonthlyCells = (row: Record<string, unknown>) => {
        const monthCell = findColumnValue(row, ["Month", "Period", "Report Month"]);
        const categoryCell = findColumnValue(row, ["Category", "Case Category"]);
        const branchCell = findColumnValue(row, ["Branch", "Branch/Station", "Station"]);
        const criminalCell = findColumnValue(row, ["Criminal", "Crim"]);
        const civilCell = findColumnValue(row, ["Civil"]);
        const totalCell = findColumnValue(row, ["Total", "Grand Total"]);

        return { monthCell, categoryCell, branchCell, criminalCell, civilCell, totalCell };
      };

      const toNumber = (value: unknown): number => {
        if (value === undefined || value === null || value === "") return 0;
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const parsed = Number(String(value).replace(/,/g, "").trim());
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const normalizeText = (value: unknown): string =>
        String(value ?? "").trim().replace(/\s+/g, " ");

      const result = await processExcelUpload<
        MonthlyRow,
        ReturnType<typeof getMonthlyCells>
      >({
        file: new File([], fileName),
        workbook,
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
              String((existingRow as Record<string, unknown>)[key]) ===
              String(value),
            ),
          );

          return { exists: hasExactMatch };
        },
        mapRow: (row) => {
          const cells = getMonthlyCells(row);

          if (isMappedRowEmpty(cells)) return { skip: true };

          const month = normalizeText(cells.monthCell || fallbackMonth);
          // Force imported rows to be Pending Cases per UI requirement
          const category = "Pending Cases";
          const branch = normalizeText(cells.branchCell);

          if (!month) {
            return { errorMessage: "Month is required in the file row." };
          }

          const criminal = toNumber(cells.criminalCell);
          const civil = toNumber(cells.civilCell);
          const totalFromFile = toNumber(cells.totalCell);
          const computedTotal = criminal + civil;
          const total = cells.totalCell === undefined ? computedTotal : totalFromFile;

          return {
            mapped: { month, category, branch, criminal, civil, total },
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

      if (result.success && result.result) {
        totalImported += result.result.meta.importedCount ?? 0;
      }
    }

    return { success: true, result: { imported: totalImported } };
  } catch (error) {
    console.error("Error importing local monthly reports:", error);
    return { success: false, error: "Failed to import local monthly reports" };
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createMonthlyStatistic(
  data: MonthlyRow,
): Promise<ActionResult<MonthlyRow>> {
  try {
    const sessionValidation = await validateSession([
      Roles.ADMIN,
      Roles.STATISTICS,
    ]);
    if (!sessionValidation.success) return sessionValidation;

    const validation = MonthlyRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.monthlyStatistics.create({
      data: {
        month: validation.data.month,
        category: validation.data.category,
        branch: validation.data.branch,
        criminal: validation.data.criminal,
        civil: validation.data.civil,
        total: validation.data.total,
      },
    });

    await createLog({
      action: LogAction.CREATE_STATISTICS,
      details: { id: record.id, type: "monthly" },
    });

    return { success: true, result: record };
  } catch (error) {
    console.error("Error creating monthly statistic:", error);
    return { success: false, error: "Failed to create monthly statistic" };
  }
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateMonthlyStatistic(
  id: number,
  data: MonthlyRow,
): Promise<ActionResult<MonthlyRow>> {
  try {
    const sessionValidation = await validateSession([
      Roles.ADMIN,
      Roles.STATISTICS,
    ]);
    if (!sessionValidation.success) return sessionValidation;

    const validation = MonthlyRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const existing = await prisma.monthlyStatistics.findUnique({
      where: { id },
    });

    const record = await prisma.monthlyStatistics.update({
      where: { id },
      data: {
        month: validation.data.month,
        category: validation.data.category,
        branch: validation.data.branch,
        criminal: validation.data.criminal,
        civil: validation.data.civil,
        total: validation.data.total,
      },
    });

    await createLog({
      action: LogAction.UPDATE_STATISTICS,
      details: { id, type: "monthly", from: existing, to: record },
    });

    return { success: true, result: record };
  } catch (error) {
    console.error("Error updating monthly statistic:", error);
    return { success: false, error: "Failed to update monthly statistic" };
  }
}

// ─── Delete (single row by id) ───────────────────────────────────────────────

export async function deleteMonthlyStatistic(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([
      Roles.ADMIN,
      Roles.STATISTICS,
    ]);
    if (!sessionValidation.success) return sessionValidation;

    await prisma.monthlyStatistics.delete({ where: { id } });
    await createLog({
      action: LogAction.DELETE_STATISTICS,
      details: { id, type: "monthly" },
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting monthly statistic:", error);
    return { success: false, error: "Failed to delete monthly statistic" };
  }
}

// ─── Upsert (bulk, used by import / AddReportPage) ──────────────────────────

export async function upsertMonthlyStatistics(
  rows: MonthlyRow[],
): Promise<ActionResult<{ upserted: number }>> {
  try {
    const sessionValidation = await validateSession([
      Roles.ADMIN,
      Roles.STATISTICS,
    ]);
    if (!sessionValidation.success) return sessionValidation;

    const validation = z.array(MonthlyRowSchema).safeParse(rows);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const results: MonthlyRow[] = [];

    // Run upserts sequentially so new records keep the same order as the
    // submitted rows from AddReport preview/import.
    for (const r of validation.data) {
      const saved = await prisma.monthlyStatistics.upsert({
        where: {
          month_category_branch: {
            month: r.month,
            category: r.category,
            branch: r.branch,
          },
        },
        update: { criminal: r.criminal, civil: r.civil, total: r.total },
        create: {
          month: r.month,
          category: r.category,
          branch: r.branch,
          criminal: r.criminal,
          civil: r.civil,
          total: r.total,
        },
      });

      results.push({
        id: saved.id,
        month: saved.month,
        category: saved.category,
        branch: saved.branch,
        criminal: saved.criminal,
        civil: saved.civil,
        total: saved.total,
      });
    }

    await createLog({
      action: LogAction.IMPORT_STATISTICS,
      details: { type: "monthly", count: results.length },
    });

    return { success: true, result: { upserted: results.length } };
  } catch (error) {
    console.error("Error upserting monthly statistics:", error);
    return { success: false, error: "Failed to save monthly statistics" };
  }
}

// ─── Clear (delete by month or all) ─────────────────────────────────────────

export async function clearMonthlyStatistics(
  month?: string,
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const sessionValidation = await validateSession([
      Roles.ADMIN,
      Roles.STATISTICS,
    ]);
    if (!sessionValidation.success) return sessionValidation;

    const { count } = await prisma.monthlyStatistics.deleteMany({
      where: month ? { month } : undefined,
    });

    await createLog({
      action: LogAction.CLEAR_STATISTICS,
      details: { type: "monthly", month: month ?? null, count },
    });

    return { success: true, result: { deleted: count } };
  } catch (error) {
    console.error("Error clearing monthly statistics:", error);
    return { success: false, error: "Failed to clear monthly statistics" };
  }
}
