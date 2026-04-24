"use server";

import { parseSummaryWorkbook } from "@/app/components/Statistics/Summary/SummaryImportUtils";
import { prisma } from "@/app/lib/prisma";
import { ActionResult, UploadExcelResult } from "@rtc-database/shared";
import { IS_WORKER } from "../ExcelWorkerUtils";

const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export async function uploadSummaryStatisticsExcel(
  file: File,
  fallbackMonth?: string,
  fallbackYear?: number,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

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

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

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
