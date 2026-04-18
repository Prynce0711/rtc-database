"use server";

import { EmployeeSchema } from "@/app/components/Employee/schema";
import { validateSession } from "@/app/lib/authActions";
import {
  ExportExcelData,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  ProcessExcelMeta,
  processExcelUpload,
  UploadExcelResult,
} from "@rtc-database/shared";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import { LogAction } from "@rtc-database/shared/prisma/client";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../ActivityLogs/LogActions";

export async function uploadEmployeeExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    console.log(
      `✓ Employee Excel file received: ${file.name} (${file.size} bytes)`,
    );
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
      skipRowsWithoutCell: ["employeeNumber"], // Don't skip rows just because employee number is missing - we'll catch that in validation and report it as an error, but we want to attempt to process the row in case other data is present that can be used for error reporting
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
        `✓ Import completed: ${imported} employees imported, ${errors} row(s) failed validation`,
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
        action: LogAction.IMPORT_EMPLOYEES,
        details: {
          ids: meta.importedIds ?? [],
        },
      });
    } else {
      console.error("✗ Import failed:", result.error);
    }

    return result;
  } catch (error) {
    console.error("Employee upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportEmployeesExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employees = await prisma.employee.findMany({
      orderBy: { id: "asc" },
    });

    const headers = [
      "Employee Name",
      "Employee Number",
      "Position",
      "Branch/Station",
      "Birthday",
      "Date Hired",
      "Employment Type",
      "Age",
      "Retirement Eligibility",
      "Contact Number",
      "Email",
    ];

    const aoa = [
      headers,
      ...employees.map((e, index) => {
        const row = index + 2;
        return [
          e.employeeName,
          e.employeeNumber ?? "",
          e.position,
          e.branch,
          e.birthDate,
          e.dateHired,
          e.employmentType,
          {
            f: `IF(AND(E${row}<>"",ISNUMBER(E${row})),DATEDIF(E${row},TODAY(),"Y"),"")`,
            t: "n",
          },
          {
            f: `IF(H${row}="","",IF(H${row}>=60,"Eligible","Not Eligible"))`,
            t: "s",
          },
          e.contactNumber ?? "",
          e.email ?? "",
        ];
      }),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    const headerFill = {
      fgColor: { rgb: "A7E3E3" },
    };
    const headerFont = {
      name: "Aptos Narrow",
      bold: true,
    };
    const bodyFont = {
      name: "Aptos Narrow",
    };

    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c });
      const cell = worksheet[cellAddress];
      if (cell) {
        cell.s = {
          font: headerFont,
          fill: headerFill,
        };
      }
    }

    for (let r = 1; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        if (cell) {
          cell.s = {
            ...(cell.s ?? {}),
            font: bodyFont,
          };
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `employees-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_EMPLOYEES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Employee export error:", error);
    return { success: false, error: "Export failed" };
  }
}
