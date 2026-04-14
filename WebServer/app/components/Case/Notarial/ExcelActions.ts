"use server";

import { NotarialSchema } from "@/app/components/Case/Notarial/schema";
import { validateSession } from "@/app/lib/authActions";
import { ExportExcelData, getExcelHeaderMap } from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import { LogAction } from "@rtc-database/shared/prisma/client";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

export async function exportNotarialExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarials = await prisma.notarial.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(NotarialSchema);
    const headerKeys = ["title", "name", "attorney", "date"] as const;
    type HeaderKey = (typeof headerKeys)[number];
    const header = (key: HeaderKey, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = notarials.map((notarial) => {
      const formatDate = (value: Date | null | undefined) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return headerKeys.reduce(
        (acc, key) => {
          const headerName = header(key, key);
          const value =
            key === "date" ? formatDate(notarial.date) : (notarial[key] ?? "");
          acc[headerName] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notarial");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `notarial-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Notarial export error:", error);
    return { success: false, error: "Export failed" };
  }
}
