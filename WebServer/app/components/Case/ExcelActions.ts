"use server";

import ActionResult from "@/app/components/ActionResult";
import { CaseSchema } from "@/app/components/Case/schema";
import { CaseType, LogAction, Prisma } from "@/app/generated/prisma/client";
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
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../ActivityLogs/LogActions";

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

    const headerMap = getExcelHeaderMap(CaseSchema);
    const branchHeaders = headerMap.branch ?? ["Branch"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(CaseSchema, row);

      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      Prisma.CaseCreateManyInput,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { Branch: branchHeaders },
      schema: CaseSchema,
      skipRowsWithoutCell: {
        getCells: getMappedCells,
        keys: ["caseNumber"],
      },
      uniqueKeys: {
        getCells: getMappedCells,
        keys: ["caseNumber"],
      },
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
          caseType,
        };

        const validation = CaseSchema.safeParse(hydrated);
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

        const mappedRow: Prisma.CaseCreateManyInput = {
          ...validation.data,
          assistantBranch:
            validation.data.assistantBranch ?? validation.data.branch ?? null,
          caseType,
        };

        return {
          mapped: mappedRow,
          uniqueKey: validation.data.caseNumber?.toString().trim(),
        };
      },
      onBatchInsert: async (rows) => {
        const created = await prisma.case.createManyAndReturn({ data: rows });
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

    const cases = await prisma.case.findMany({ orderBy: { id: "asc" } });

    const rows = cases.map((c) => {
      const formatDate = (value: Date | null) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return {
        "Case Number": c.caseNumber ?? "",
        Name: c.name ?? "",
        Branch: c.branch ?? "",
        "Assistant Branch": c.assistantBranch ?? "",
        Type: c.caseType ?? "",
        "Date Filed": formatDate(c.dateFiled as unknown as Date | null),
        Charge: c.charge ?? "",
        Court: c.court ?? "",
        Detained: c.detained ?? "",
        Consolidation: c.consolidation ?? "",
        "EQC Number": c.eqcNumber ?? "",
        Bond: c.bond ?? "",
        "Raffle Date": formatDate(c.raffleDate as unknown as Date | null),
        "Committee 1": c.committee1 ?? "",
        "Committee 2": c.committee2 ?? "",
        Judge: c.judge ?? "",
        AO: c.ao ?? "",
        Complainant: c.complainant ?? "",
        "House No": c.houseNo ?? "",
        Street: c.street ?? "",
        Barangay: c.barangay ?? "",
        Municipality: c.municipality ?? "",
        Province: c.province ?? "",
        Counts: c.counts ?? "",
        JDF: c.jdf ?? "",
        SAJJ: c.sajj ?? "",
        "SAJJ 2": c.sajj2 ?? "",
        MF: c.mf ?? "",
        STF: c.stf ?? "",
        LRF: c.lrf ?? "",
        VCF: c.vcf ?? "",
        Total: c.total ?? "",
        "Amount Involved": c.amountInvolved ?? "",
      };
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
