"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import { startExcelUpload } from "@/app/lib/workers/Excel/WorkerActions";
import {
  ActionResult,
  ExportExcelData,
  findColumnValue,
  UploadExcelResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";

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

export async function uploadMonthlyExcel(
  file: File,
  fallbackMonth?: string,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    return startExcelUpload({
      type: ExcelTypes.MONTHLY_STATISTICS,
      file,
      fallbackMonth,
    });
  } catch (error) {
    console.error("Monthly Excel upload failed:", error);
    return { success: false, error: "Monthly Excel upload failed" };
  }
}

export async function exportMonthlyExcel(
  month?: string,
): Promise<ActionResult<ExportExcelData>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.monthlyStatistics.findMany({
      where: month ? { month } : undefined,
      orderBy: [{ month: "desc" }, { category: "asc" }, { branch: "asc" }],
    });

    const rows = records.map((record) => ({
      Month: record.month,
      Category: record.category,
      Branch: record.branch,
      Criminal: record.criminal,
      Civil: record.civil,
      Total: record.total,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Statistics");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const suffix = month ? `-${month}` : "";

    return {
      success: true,
      result: {
        fileName: `monthly-statistics${suffix}-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Monthly Excel export failed:", error);
    return { success: false, error: "Monthly Excel export failed" };
  }
}
