"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import { startExcelUpload } from "@/app/lib/workers/Excel/WorkerActions";
import {
  ActionResult,
  ExportExcelData,
  UploadExcelResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { getCommissionYearLabel } from "./schema";

const NOTARIAL_COMMISSION_ROLES = [Roles.ADMIN, Roles.NOTARIAL] as const;

export async function uploadNotarialCommissionExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    return await startExcelUpload({
      type: ExcelTypes.NOTARIAL_COMMISSION,
      file,
    });
  } catch (error) {
    console.error("Notarial commission upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportNotarialCommissionsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const records = await prisma.notarialCommission.findMany({
      orderBy: [{ termStartYear: "desc" }, { id: "asc" }],
    });

    const headers = [
      "Petition Number",
      "Name",
      "Term of Commission",
      "Address",
    ];
    const yearLabels = Array.from(
      new Set(
        records
          .map((record) =>
            getCommissionYearLabel(record.termStartYear, record.termEndYear),
          )
          .filter((label) => label !== "Unspecified"),
      ),
    );
    const title =
      yearLabels.length === 1
        ? `${yearLabels[0]} NOTARIAL COMMISSION`
        : "NOTARIAL COMMISSION";

    const worksheet = XLSX.utils.aoa_to_sheet([
      [title, "", "", ""],
      headers,
      ...records.map((record, index) => [
        record.petition ? `${index + 1}. ${record.petition}` : "",
        record.name,
        record.termOfCommission,
        record.address,
      ]),
    ]);

    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 3 },
      },
    ];
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 34 },
      { wch: 30 },
      { wch: 90 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notarial Commission");

    const base64 = XLSX.write(workbook, {
      type: "base64",
      bookType: "xlsx",
    });

    return {
      success: true,
      result: {
        fileName: `notarial-commission-export-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Notarial commission export error:", error);
    return { success: false, error: "Export failed" };
  }
}
