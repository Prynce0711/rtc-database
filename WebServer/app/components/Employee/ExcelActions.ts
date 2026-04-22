"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { startExcelUpload } from "@/app/lib/workers/Excel/excel.worker";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import {
  ActionResult,
  ExportExcelData,
  UploadExcelResult,
} from "@rtc-database/shared";
import { LogAction } from "@rtc-database/shared/prisma/client";
import * as XLSX from "xlsx";
import { createLog } from "../ActivityLogs/LogActions";

export async function uploadEmployeeExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await startExcelUpload({
      type: ExcelTypes.EMPLOYEE,
      file,
    });

    if (!result.success) {
      return result;
    }

    await createLog({
      action: LogAction.IMPORT_EMPLOYEES,
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
