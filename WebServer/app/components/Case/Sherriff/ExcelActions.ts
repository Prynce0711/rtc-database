"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import { startExcelUpload } from "@/app/lib/workers/Excel/WorkerActions";
import {
  ActionResult,
  BaseCaseSchema,
  Case,
  CaseType,
  ExportExcelData,
  getExcelHeaderMap,
  getSchemaFieldKeys,
  LogAction,
  SheriffCase,
  SheriffCaseData,
  SheriffCaseSchema,
  UploadExcelResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

export async function uploadSheriffExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await startExcelUpload({
      type: ExcelTypes.SHERIFF_CASE,
      file,
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

export async function exportSheriffExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const baseCaseFieldKeys = getSchemaFieldKeys(BaseCaseSchema, {
      all: ["id"],
    });

    const caseFieldKeys = getSchemaFieldKeys(SheriffCaseSchema, {
      all: ["id"],
      stringKeys: [...baseCaseFieldKeys.stringKeys],
      dateKeys: [...baseCaseFieldKeys.dateKeys],
    });

    const dateKeys = [
      caseFieldKeys.dateKeys,
      baseCaseFieldKeys.dateKeys,
    ].flat();

    const cases = await prisma.case.findMany({
      where: { caseType: CaseType.SHERRIFF },
      orderBy: { id: "asc" },
      include: { sheriffCase: true },
    });

    const caseCombined: SheriffCaseData[] = cases
      .filter((c): c is Case & { sheriffCase: SheriffCase } => !!c.sheriffCase)
      .map((c) => ({
        ...c,
        ...c.sheriffCase,
      }));

    const headerMap = getExcelHeaderMap(SheriffCaseSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];

    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = caseCombined.map((c) => {
      const formatDate = (value: Date | null | undefined) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return headerKeys.reduce(
        (acc, key) => {
          const headerName = header(key, key);
          const value = dateKeys.includes(key)
            ? formatDate(c[key] as Date | null | undefined)
            : (c[key] ?? "");
          acc[headerName] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheriff Cases");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `sheriff-cases-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Sheriff export error:", error);
    return { success: false, error: "Export failed" };
  }
}
