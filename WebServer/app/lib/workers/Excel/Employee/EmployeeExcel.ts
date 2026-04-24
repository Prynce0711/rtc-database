"use server";

import { EmployeeSchema } from "@/app/components/Employee/schema";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  ProcessExcelMeta,
  UploadExcelResult,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  processExcelUpload,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { IS_WORKER } from "../ExcelWorkerUtils";

export async function uploadEmployeeExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    console.log(
      `OK Employee Excel file received: ${file.name} (${file.size} bytes)`,
    );

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `OK Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );
    } catch (peekError) {
      console.warn("WARN Unable to preview workbook for logging:", peekError);
    }

    const headerMap = getExcelHeaderMap(EmployeeSchema);
    const employeeNameHeaders = headerMap.employeeName ?? ["Employee Name"];
    const employeeNumberHeaders = headerMap.employeeNumber ?? [
      "Employee Number",
    ];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(EmployeeSchema, row);

      return {
        ...values,
      };
    };

    const result = await processExcelUpload<EmployeeSchema>({
      file,
      requiredHeaders: {
        "Employee Name": employeeNameHeaders,
        "Employee Number": employeeNumberHeaders,
      },
      getCells: getMappedCells,
      schema: EmployeeSchema,
      skipRowsWithoutCell: ["employeeNumber"],
      uniqueKeys: ["employeeNumber", "email", "contactNumber"],
      checkExistingUniqueKeys: async (keys) => {
        const normalizedKeys = Array.from(
          new Set(
            keys.map((key) => key.trim()).filter((key) => key.length > 0),
          ),
        );

        if (normalizedKeys.length === 0) {
          return new Set<string>();
        }

        const existing = await prisma.employee.findMany({
          where: {
            OR: [
              { employeeNumber: { in: normalizedKeys } },
              { email: { in: normalizedKeys } },
              { contactNumber: { in: normalizedKeys } },
            ],
          },
          select: {
            employeeNumber: true,
            email: true,
            contactNumber: true,
          },
        });

        return new Set(
          existing
            .flatMap((employee) => [
              employee.employeeNumber,
              employee.email,
              employee.contactNumber,
            ])
            .map((value) => value?.trim())
            .filter((value): value is string => !!value),
        );
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);
        if (isMappedRowEmpty(cells, ["employeeNumber"])) {
          return { skip: true };
        }

        const validation = EmployeeSchema.safeParse(cells);
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
        const created = await prisma.employee.createManyAndReturn({
          data: rows,
        });
        return { ids: created.map((e) => e.id), count: created.length };
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      const imported = meta.importedCount;
      const errors = meta.errorCount;
      const sheets = meta.sheetSummary;

      console.log(
        `OK Import completed: ${imported} employees imported, ${errors} row(s) failed validation`,
      );
      if (sheets.length > 0) {
        sheets.forEach((s) => {
          console.log(
            `  SHEET "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
          );
        });
      }

      if (result.result?.failedExcel) {
        console.log(
          "WARN Failed rows file generated:",
          result.result.failedExcel.fileName,
        );
      }
    } else {
      console.error("FAILED Import failed:", result.error);
    }

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Employee upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
