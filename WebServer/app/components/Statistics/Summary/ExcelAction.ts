"use server";

import { validateSession } from "@/app/lib/authActions";
import { ExportExcelData, UploadExcelResult } from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import { ActionResult } from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { SUMMARY_COURT_TYPES, type SummaryCourtType } from "./SummaryConstants";
import { parseSummaryWorkbook } from "./SummaryImportUtils";

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const toISODate = (value: Date): string => value.toISOString().slice(0, 10);

const toMonthRange = (year: number, month: string) => {
  const monthIndex = Number(month) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return { start, end };
};

export async function uploadSummaryExcel(
  file: File,
  fallbackMonth?: string,
  fallbackYear?: number,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const now = new Date();
    const selectedYear =
      typeof fallbackYear === "number" && Number.isFinite(fallbackYear)
        ? fallbackYear
        : now.getFullYear();
    const selectedMonth =
      fallbackMonth && /^\d{2}$/.test(fallbackMonth)
        ? fallbackMonth
        : String(now.getMonth() + 1).padStart(2, "0");

    const buffer = await file.arrayBuffer();
    const parsed = parseSummaryWorkbook(buffer, selectedYear, selectedMonth);

    if (parsed.rows.length === 0) {
      return {
        success: false,
        error: "No summary rows found in Excel file",
        errorResult: {
          meta: {
            importedIds: [],
            importedCount: 0,
            errorCount: parsed.skippedRows,
            sheetSummary: [],
            totalRows: 0,
            validRows: 0,
          },
        },
      };
    }

    const importedIds: number[] = [];

    for (const row of parsed.rows) {
      const saved = await prisma.summaryStatistic.upsert({
        where: {
          courtType_branch_raffleDate: {
            courtType: row.courtType,
            branch: row.branch,
            raffleDate: toDate(row.raffleDate),
          },
        },
        update: {
          reportYear: row.reportYear,
          civilFamily: row.civilFamily,
          civilOrdinary: row.civilOrdinary,
          civilReceivedViaReraffled: row.civilReceivedViaReraffled,
          civilUnloaded: row.civilUnloaded,
          lrcPetition: row.lrcPetition,
          lrcSpProc: row.lrcSpProc,
          lrcReceivedViaReraffled: row.lrcReceivedViaReraffled,
          lrcUnloaded: row.lrcUnloaded,
          criminalFamily: row.criminalFamily,
          criminalDrugs: row.criminalDrugs,
          criminalOrdinary: row.criminalOrdinary,
          criminalReceivedViaReraffled: row.criminalReceivedViaReraffled,
          criminalUnloaded: row.criminalUnloaded,
          total: row.total,
        },
        create: {
          courtType: row.courtType,
          reportYear: row.reportYear,
          branch: row.branch,
          raffleDate: toDate(row.raffleDate),
          civilFamily: row.civilFamily,
          civilOrdinary: row.civilOrdinary,
          civilReceivedViaReraffled: row.civilReceivedViaReraffled,
          civilUnloaded: row.civilUnloaded,
          lrcPetition: row.lrcPetition,
          lrcSpProc: row.lrcSpProc,
          lrcReceivedViaReraffled: row.lrcReceivedViaReraffled,
          lrcUnloaded: row.lrcUnloaded,
          criminalFamily: row.criminalFamily,
          criminalDrugs: row.criminalDrugs,
          criminalOrdinary: row.criminalOrdinary,
          criminalReceivedViaReraffled: row.criminalReceivedViaReraffled,
          criminalUnloaded: row.criminalUnloaded,
          total: row.total,
        },
      });

      importedIds.push(saved.id);
    }

    return {
      success: true,
      result: {
        meta: {
          importedIds,
          importedCount: importedIds.length,
          errorCount: parsed.skippedRows,
          sheetSummary: [
            {
              sheet: "Summary",
              rows: parsed.rows.length + parsed.skippedRows,
              valid: parsed.rows.length,
              failed: parsed.skippedRows,
            },
          ],
          totalRows: parsed.rows.length + parsed.skippedRows,
          validRows: parsed.rows.length,
        },
      },
    };
  } catch (error) {
    console.error("Summary Excel upload failed:", error);
    return { success: false, error: "Summary Excel upload failed" };
  }
}

export async function exportSummaryExcel(
  month?: string,
  year?: number,
  courtType?: SummaryCourtType,
): Promise<ActionResult<ExportExcelData>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const where: {
      courtType?: string;
      reportYear?: number;
      raffleDate?: { gte: Date; lt: Date };
    } = {};

    if (courtType) {
      where.courtType = courtType;
    }

    if (typeof year === "number" && Number.isFinite(year)) {
      where.reportYear = year;
      if (month && /^\d{2}$/.test(month)) {
        const { start, end } = toMonthRange(year, month);
        where.raffleDate = { gte: start, lt: end };
      }
    }

    const records = await prisma.summaryStatistic.findMany({
      where,
      orderBy: [{ courtType: "asc" }, { raffleDate: "asc" }, { id: "asc" }],
    });

    const workbook = XLSX.utils.book_new();

    const courtTypeGroups = SUMMARY_COURT_TYPES.map((type) => ({
      courtType: type.value,
      rows: records.filter((record) => record.courtType === type.value),
    })).filter((group) => group.rows.length > 0);

    if (courtTypeGroups.length === 0) {
      return { success: false, error: "No summary data found to export" };
    }

    for (const group of courtTypeGroups) {
      const rows = group.rows.map((record) => ({
        "Court Type": record.courtType,
        "Report Year": record.reportYear,
        Branch: record.branch,
        "Raffle Date": toISODate(record.raffleDate),
        "Civil Family": record.civilFamily,
        "Civil Ordinary": record.civilOrdinary,
        "Civil Rec'd Via Re-Raffled": record.civilReceivedViaReraffled,
        "Civil UN Loaded": record.civilUnloaded,
        "LRC Petition": record.lrcPetition,
        "LRC SP. PROC.": record.lrcSpProc,
        "LRC Rec'd Via Re-Raffled": record.lrcReceivedViaReraffled,
        "LRC UN Loaded": record.lrcUnloaded,
        "Criminal Family": record.criminalFamily,
        "Criminal Drugs": record.criminalDrugs,
        "Criminal Ordinary": record.criminalOrdinary,
        "Criminal Rec'd Via Re-Raffled": record.criminalReceivedViaReraffled,
        "Criminal UN Loaded": record.criminalUnloaded,
        Total: record.total,
      }));

      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        group.courtType.slice(0, 31),
      );
    }

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const periodSuffix =
      typeof year === "number" && month ? `-${year}-${month}` : "";

    return {
      success: true,
      result: {
        fileName: `summary-statistics${periodSuffix}-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Summary Excel export failed:", error);
    return { success: false, error: "Summary Excel export failed" };
  }
}
