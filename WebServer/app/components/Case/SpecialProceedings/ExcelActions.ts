"use server";

import ActionResult from "@/app/components/ActionResult";
import {
  SpecialProceedingData,
  SpecialProceedingSchema,
} from "@/app/components/Case/SpecialProceedings/schema";
import {
  Case,
  CaseType,
  LogAction,
  Prisma,
  SpecialProceeding,
} from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  ExportExcelData,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  ProcessExcelMeta,
  processExcelUpload,
  UploadExcelResult,
  valuesAreEqual,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import { splitCaseDataBySchema } from "@/app/lib/PrismaHelper";
import Roles from "@/app/lib/Roles";
import { getSchemaFieldKeys } from "@/app/lib/utils";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";
import { BaseCaseSchema } from "../schema";

export async function uploadSpecialProceedingExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    console.log(
      `✓ Special proceeding Excel file received: ${file.name} (${file.size} bytes)`,
    );

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `✓ Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );
    } catch (peekError) {
      console.warn("⚠ Unable to preview workbook for logging:", peekError);
    }

    const headerMap = getExcelHeaderMap(SpecialProceedingSchema);
    const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(SpecialProceedingSchema, row);
      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      SpecialProceedingSchema,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { "Case Number": caseNumberHeaders },
      schema: SpecialProceedingSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingCases = await prisma.case.findMany({
          where: {
            caseNumber: mappedRow.caseNumber,
            caseType: mappedRow.caseType,
          },
          include: {
            specialProceeding: true,
          },
        });

        const mappedEntries = Object.entries(mappedRow);
        const hasExactMatch = existingCases.some((existingCase) => {
          if (!existingCase.specialProceeding) return false;

          const mergedCase = {
            ...existingCase,
            ...existingCase.specialProceeding,
          } as Record<string, unknown>;

          return mappedEntries.every(([key, value]) =>
            valuesAreEqual(value, mergedCase[key]),
          );
        });

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);

        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const hydrated = {
          ...cells,
          caseType: CaseType.SCA,
          dateFiled: cells.dateFiled ?? cells.date ?? null,
          branch: cells.branch ?? cells.raffledTo ?? null,
          assistantBranch:
            cells.assistantBranch ?? cells.raffledTo ?? cells.branch ?? null,
        };

        const validation = SpecialProceedingSchema.safeParse(hydrated);
        if (!validation.success) {
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped: validation.data,
        };
      },
      onBatchInsert: async (rows) => {
        const caseRows: Prisma.CaseCreateManyInput[] = [];

        rows.forEach((row) => {
          const { caseData, detailData } = splitCaseDataBySchema(row);
          caseRows.push({
            ...caseData,
            caseType: CaseType.SCA,
          });
        });

        const created = await prisma.case.createManyAndReturn({
          data: caseRows,
        });

        const specialProceedingRows: Prisma.SpecialProceedingCreateManyInput[] =
          rows.map((row, index) => {
            const { detailData } = splitCaseDataBySchema(row);
            return {
              ...(detailData as Prisma.SpecialProceedingCreateWithoutCaseInput),
              baseCaseID: created[index].id,
            };
          });

        if (specialProceedingRows.length > 0) {
          await prisma.specialProceeding.createMany({
            data: specialProceedingRows,
          });
        }

        return { ids: created.map((c) => c.id), count: created.length };
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      const imported = meta.importedCount;
      const errors = meta.errorCount;
      const sheets = meta.sheetSummary;

      console.log(
        `✓ Import completed: ${imported} special proceeding cases imported, ${errors} row(s) failed validation`,
      );
      if (sheets.length > 0) {
        sheets.forEach(
          (s: {
            sheet: string;
            valid: number;
            rows: number;
            failed: number;
          }) => {
            console.log(
              `  📋 "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
            );
          },
        );
      }

      if (result.result?.failedExcel) {
        console.log(
          "⚠ Failed rows file generated:",
          result.result.failedExcel.fileName,
        );
      }

      await createLog({
        action: LogAction.IMPORT_CASES,
        details: {
          ids: meta.importedIds ?? [],
        },
      });
    } else {
      console.error("✗ Import failed:", result.error);
    }

    return result;
  } catch (error) {
    console.error("Special proceeding upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportSpecialProceedingsExcel(): Promise<
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

    const caseFieldKeys = getSchemaFieldKeys(SpecialProceedingSchema, {
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
      include: { specialProceeding: true },
    });

    const specialProceedingCases: SpecialProceedingData[] = cases
      .filter(
        (c): c is Case & { specialProceeding: SpecialProceeding } =>
          !!c.specialProceeding,
      )
      .map((c) => ({
        ...c.specialProceeding,
        ...c,
      }));

    const headerMap = getExcelHeaderMap(SpecialProceedingSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];

    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = specialProceedingCases.map((item) => {
      const formatDate = (value: Date | null | undefined) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return headerKeys.reduce(
        (acc, key) => {
          const headerName = header(key, key);
          const value = dateKeys.includes(key)
            ? formatDate(item[key] as Date | null | undefined)
            : (item[key] ?? "");
          acc[headerName] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Special Proceedings");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `special-proceedings-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Special proceedings export error:", error);
    return { success: false, error: "Export failed" };
  }
}
