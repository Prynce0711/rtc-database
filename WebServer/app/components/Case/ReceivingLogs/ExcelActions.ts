"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import { startExcelUpload } from "@/app/lib/workers/Excel/WorkerActions";
import {
  ActionResult,
  ExportExcelData,
  getExcelHeaderMap,
  ReceivingLogSchema,
  UploadExcelResult,
} from "@rtc-database/shared";
import { LogAction } from "@rtc-database/shared/prisma/client";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

export async function uploadReceiveExcel(
  file: File,
  overrideTemplateValidation = false,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await startExcelUpload({
      type: ExcelTypes.RECEIVING_LOG,
      file,
      overrideTemplateValidation,
    });

    if (!result.success) {
      return result;
    }

    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: result.result?.meta.importedIds ?? [],
      },
    });

    return result;
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportReceiveLogsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const receivingLogs = await prisma.recievingLog.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(ReceivingLogSchema);
    const headerKeys = [
      "bookAndPage",
      "dateRecieved",
      "caseType",
      "caseNumber",
      "content",
      "branchNumber",
      "notes",
    ] as const;
    type HeaderKey = (typeof headerKeys)[number];
    const header = (key: HeaderKey, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = receivingLogs.map((log) => {
      let dateStr = "";
      let timeStr = "";

      if (log.dateRecieved) {
        const date = new Date(log.dateRecieved);
        // Format date as MM/DD/YYYY
        dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
        // Format time as HH:MM:SS
        timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
      }

      return {
        [header("bookAndPage", "Book and Pages")]: log.bookAndPage ?? "",
        [header("dateRecieved", "Date Recieve")]: dateStr,
        Time: timeStr,
        [header("caseType", "Abbreviation")]: log.caseType,
        [header("caseNumber", "Case no.")]: log.caseNumber ?? "",
        [header("content", "Content")]: log.content ?? "",
        [header("branchNumber", "Branch no.")]: log.branchNumber ?? "",
        [header("notes", "Notes")]: log.notes ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receiving Logs");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `receiving-logs-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Receiving Log export error:", error);
    return { success: false, error: "Export failed" };
  }
}

