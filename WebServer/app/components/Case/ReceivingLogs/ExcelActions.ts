"use server";

import * as XLSX from "xlsx";
import ActionResult from "../../ActionResult";

type ExportExcelResult = {
  fileName: string;
  base64: string;
};

export async function uploadReceiveExcel(
  file: File,
): Promise<ActionResult<void>> {
  // We don't have a ReceiveLog Prisma model yet; return a not-implemented error.
  void file;
  return {
    success: false,
    error: "Import not implemented - add ReceiveLog model",
  };
}

export async function exportReceiveLogsExcel(): Promise<
  ActionResult<ExportExcelResult>
> {
  try {
    // Create an empty workbook (no rows) so frontend can still download a valid XLSX file
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "ReceivingLogs");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `receivinglogs-export-${Date.now()}.xlsx`;

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Export receive logs error:", error);
    return { success: false, error: "Export failed" };
  }
}
