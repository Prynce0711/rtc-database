"use server";

import ActionResult from "@/app/components/ActionResult";
import { EmployeeSchema } from "@/app/components/Employee/schema";
import { Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";

type ExportEmployeeExcelResult = {
  fileName: string;
  base64: string;
};

// Helper to convert Excel serial date to JS Date
const excelDateToJSDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
  );
};

// Map blood type display values (e.g. "A+", "O-") to enum values
const normalizeBloodType = (value: unknown): string | undefined => {
  if (!value) return undefined;

  const raw = value.toString().trim().toUpperCase();
  if (!raw) return undefined;

  const map: Record<string, string> = {
    "A+": "A_Positive",
    "A-": "A_Negative",
    "B+": "B_Positive",
    "B-": "B_Negative",
    "AB+": "AB_Positive",
    "AB-": "AB_Negative",
    "O+": "O_Positive",
    "O-": "O_Negative",
  };

  return map[raw] ?? undefined;
};

export async function uploadEmployeeExcel(
  file: File,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/x-excel",
    ];

    if (!validMimeTypes.includes(file.type)) {
      return { success: false, error: "Invalid file type" };
    }

    const validExtensions = [".xlsx", ".xls"];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasValidExtension) {
      return { success: false, error: "Invalid file extension" };
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const isXlsx =
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;
    const isXls =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1;

    if (!isXlsx && !isXls) {
      return { success: false, error: "File is not a valid Excel document" };
    }

    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(
      `✓ Employee Excel file received: ${file.name} (${file.size} bytes)`,
    );
    console.log(`✓ Found ${rawData.length} rows in sheet "${sheetName}"`);

    const mappedData = rawData.map((row: any) => {
      const birthdayCell = row["BIRTHDAY"];

      let birthDate: Date | string | undefined;
      if (typeof birthdayCell === "number") {
        birthDate = excelDateToJSDate(birthdayCell);
      } else if (birthdayCell) {
        birthDate = new Date(birthdayCell);
      }

      return {
        employeeName: row["EMPLOYEE NAME"]?.toString(),
        employeeNumber: row["EMPLOYEE NUMBER"]?.toString(),
        position: row["POSITION"]?.toString(),
        branch:
          row["BRANCH/STATION"]?.toString() ||
          row["BRANCH"]?.toString() ||
          undefined,
        tinNumber: row["TIN"]?.toString() || undefined,
        gsisNumber: row["GSIS"]?.toString() || undefined,
        philHealthNumber: row["PHILHEALTH"]?.toString() || undefined,
        pagIbigNumber: row["PAG-IBIG"]?.toString() || undefined,
        birthDate,
        bloodType: normalizeBloodType(row["BLOODTYPE"]),
        allergies: row["ALLERGIES"]?.toString() || undefined,
        height: (() => {
          const value = row["HEIGHT"];
          if (value === undefined || value === "") return undefined;
          const num = Number(value);
          return Number.isNaN(num) ? undefined : num;
        })(),
        weight: (() => {
          const value = row["WEIGHT"];
          if (value === undefined || value === "") return undefined;
          const num = Number(value);
          return Number.isNaN(num) ? undefined : num;
        })(),
        contactPerson: row["CONTACT PERSON"]?.toString(),
        contactNumber: row["CONTACT NUMBER"]?.toString() || undefined,
        email: row["EMAIL"]?.toString() || "",
      };
    });

    console.log("Employee mapped data sample:", mappedData[0]);

    const validationResults = {
      employees: [] as Prisma.EmployeeCreateManyInput[],
      total: mappedData.length,
      valid: 0,
      errors: [] as Array<{ row: number; errors: z.ZodError }>,
    };

    mappedData.forEach((row, index) => {
      const validated = EmployeeSchema.safeParse(row);
      if (validated.success) {
        validationResults.employees.push(validated.data);
        validationResults.valid += 1;
      } else {
        validationResults.errors.push({
          row: index + 2,
          errors: validated.error,
        });
      }
    });

    console.log(
      `✓ Employee rows validated: ${validationResults.valid}/${validationResults.total}`,
    );

    if (validationResults.errors.length > 0) {
      console.log(
        `⚠ ${validationResults.errors.length} employee rows have validation errors:`,
      );

      let errorText = "";
      validationResults.errors.forEach(({ row, errors }) => {
        errorText += `  Row ${row}: ${prettifyError(errors)}\n`;
        console.log(`  Row ${row}:`, prettifyError(errors));
      });

      return {
        success: false,
        error: `Validation failed: ${validationResults.errors.length} rows have errors\n${errorText}`,
      };
    }

    await prisma.employee.createMany({ data: validationResults.employees });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Employee upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportEmployeesExcel(): Promise<
  ActionResult<ExportEmployeeExcelResult>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employees = await prisma.employee.findMany({
      orderBy: { id: "asc" },
    });

    const bloodTypeDisplayMap: Record<string, string> = {
      A_Positive: "A+",
      A_Negative: "A-",
      B_Positive: "B+",
      B_Negative: "B-",
      AB_Positive: "AB+",
      AB_Negative: "AB-",
      O_Positive: "O+",
      O_Negative: "O-",
    };

    const rows = employees.map((e) => ({
      "EMPLOYEE NAME": e.employeeName,
      "EMPLOYEE NUMBER": e.employeeNumber,
      POSITION: e.position,
      "BRANCH/STATION": e.branch,
      TIN: e.tinNumber ?? "",
      GSIS: e.gsisNumber ?? "",
      PHILHEALTH: e.philHealthNumber ?? "",
      "PAG-IBIG": e.pagIbigNumber ?? "",
      BIRTHDAY: e.birthDate,
      BLOODTYPE: e.bloodType
        ? (bloodTypeDisplayMap[e.bloodType] ?? e.bloodType)
        : "",
      ALLERGIES: e.allergies ?? "",
      HEIGHT: e.height ?? "",
      WEIGHT: e.weight ?? "",
      "CONTACT PERSON": e.contactPerson,
      "CONTACT NUMBER": e.contactNumber ?? "",
      EMAIL: e.email ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `employees-export-${Date.now()}.xlsx`;

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Employee export error:", error);
    return { success: false, error: "Export failed" };
  }
}
