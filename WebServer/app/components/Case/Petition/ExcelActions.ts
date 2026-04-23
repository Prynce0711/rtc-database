"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { startExcelUpload } from "@/app/lib/workers/Excel/excel.worker";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import {
  ActionResult,
  BaseCaseSchema,
  Case,
  ExportExcelData,
  getExcelHeaderMap,
  getSchemaFieldKeys,
  LogAction,
  Petition,
  PetitionCaseSchema,
  UploadExcelResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

export async function uploadPetitionExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await startExcelUpload({
      type: ExcelTypes.PETITION_CASE,
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

export async function exportPetitionsExcel(): Promise<
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

    const caseFieldKeys = getSchemaFieldKeys(PetitionCaseSchema, {
      all: ["id"],
      stringKeys: [...baseCaseFieldKeys.stringKeys],
      dateKeys: [...baseCaseFieldKeys.dateKeys],
    });

    const dateKeys = [
      caseFieldKeys.dateKeys,
      baseCaseFieldKeys.dateKeys,
    ].flat();

    const cases = await prisma.case.findMany({
      orderBy: { id: "asc" },
      include: { petition: true },
    });

    const petitionCases = cases
      .filter((c): c is Case & { petition: Petition } => !!c.petition)
      .map((c) => ({
        ...c.petition,
        ...c,
      }));

    const headerMap = getExcelHeaderMap(PetitionCaseSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];

    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = petitionCases.map((petitionCase) => {
      const formatDate = (value: Date | null | undefined) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return headerKeys.reduce(
        (acc, key) => {
          const headerName = header(key, key);
          const value = dateKeys.includes(key)
            ? formatDate(petitionCase[key] as Date | null | undefined)
            : (petitionCase[key] ?? "");
          acc[headerName] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Petition Cases");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `petitions-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Petition export error:", error);
    return { success: false, error: "Export failed" };
  }
}
