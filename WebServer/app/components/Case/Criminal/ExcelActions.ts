"use server";

import ActionResult from "@/app/components/ActionResult";
import {
  BaseCaseSchema,
  CriminalCaseData,
  CriminalCaseSchema,
} from "@/app/components/Case/Criminal/schema";
import {
  Case,
  CaseType,
  CriminalCase,
  LogAction,
  Prisma,
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
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import { splitCaseData } from "@/app/lib/PrismaHelper";
import Roles from "@/app/lib/Roles";
import { getSchemaFieldKeys } from "@/app/lib/utils";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";

export async function uploadExcel(
  file: File,
  caseType: CaseType,
): Promise<ActionResult<UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    console.log(`✓ Excel file received: ${file.name} (${file.size} bytes)`);

    // Peek workbook to log sheet names (processExcelUpload will parse again for validation)
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `✓ Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );
    } catch (peekError) {
      console.warn("⚠ Unable to preview workbook for logging:", peekError);
    }

    const headerMap = getExcelHeaderMap(CriminalCaseSchema);
    const branchHeaders = headerMap.branch ?? ["Branch"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(CriminalCaseSchema, row);

      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      CriminalCaseSchema,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { Branch: branchHeaders },
      schema: CriminalCaseSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber"],
      uniqueKeys: ["caseNumber"],
      uniqueKeyLabel: "Case number",
      checkExistingUniqueKeys: async (keys) => {
        const existing = await prisma.case.findMany({
          where: { caseNumber: { in: keys } },
          select: { caseNumber: true },
        });
        return new Set(existing.map((c) => c.caseNumber.trim()));
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);

        // Skip rows that have no mapped content beyond the case number (or are entirely empty)
        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const hydrated = {
          ...cells,
          assistantBranch: cells.assistantBranch ?? cells.branch ?? null,
          caseType,
        };

        const validation = CriminalCaseSchema.safeParse(hydrated);
        if (!validation.success) {
          // console.warn(
          //   "Employee row validation failed:",
          //   prettifyError(validation.error),
          //   { row: cells },
          // );
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped: validation.data,
          uniqueKey: validation.data.caseNumber?.toString().trim(),
        };
      },
      onBatchInsert: async (rows) => {
        const caseRows: Prisma.CaseCreateManyInput[] = [];
        const criminalRows: Prisma.CriminalCaseCreateManyInput[] = [];

        rows.forEach((row) => {
          const { caseData, criminalData } = splitCaseData(row);
          caseRows.push(caseData);
          criminalRows.push({
            ...criminalData,
            caseNumber: caseData.caseNumber,
          });
        });

        const created = await prisma.case.createManyAndReturn({
          data: caseRows,
        });

        if (criminalRows.length > 0) {
          await prisma.criminalCase.createMany({ data: criminalRows });
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
        `✓ Import completed: ${imported} cases imported, ${errors} row(s) failed validation`,
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
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportCasesExcel(): Promise<
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

    const caseFieldKeys = getSchemaFieldKeys(CriminalCaseSchema, {
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
      include: { criminalCase: true },
    });

    const caseCombined: CriminalCaseData[] = cases
      .filter(
        (c): c is Case & { criminalCase: CriminalCase } => !!c.criminalCase,
      )
      .map((c) => ({
        ...c,
        ...c.criminalCase,
      }));

    const headerMap = getExcelHeaderMap(CriminalCaseSchema);
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cases");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `cases-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Cases export error:", error);
    return { success: false, error: "Export failed" };
  }
}
