"use server";

import ActionResult from "@/app/components/ActionResult";
import { EmployeeSchema } from "@/app/components/Employee/schema";
import { LogAction, Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  excelDateToJSDate,
  ExportExcelData,
  findColumnValue,
  isExcel,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";
import { createLog } from "../ActivityLogs/LogActions";

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

    if ((await isExcel(file)) === false) {
      return { success: false, error: "File is not a valid Excel document" };
    }

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(
      `✓ Employee Excel file received: ${file.name} (${file.size} bytes)`,
    );
    console.log(`✓ Found ${rawData.length} rows in sheet "${sheetName}"`);

    const mappedData = rawData.map((row: any) => {
      const employeeNameCell = findColumnValue(row, [
        "Employee Name",
        "EMPLOYEE NAME",
        "Name",
      ]);
      const employeeNumberCell = findColumnValue(row, [
        "Employee Number",
        "EMPLOYEE NUMBER",
        "Employee No",
        "Emp No",
      ]);
      const positionCell = findColumnValue(row, ["Position", "POSITION"]);
      const branchCell = findColumnValue(row, [
        "Branch/Station",
        "BRANCH/STATION",
        "Branch",
        "BRANCH",
        "Station",
      ]);
      const tinCell = findColumnValue(row, ["TIN", "Tin Number", "TIN Number"]);
      const gsisCell = findColumnValue(row, ["GSIS", "GSIS Number"]);
      const philHealthCell = findColumnValue(row, [
        "PhilHealth",
        "PHILHEALTH",
        "PhilHealth Number",
      ]);
      const pagIbigCell = findColumnValue(row, [
        "PAG-IBIG",
        "PAG IBIG",
        "Pag-Ibig Number",
      ]);
      const birthdayCell = findColumnValue(row, [
        "Birthday",
        "BIRTHDAY",
        "Birth Date",
        "Date of Birth",
      ]);
      const bloodTypeCell = findColumnValue(row, [
        "Bloodtype",
        "BLOODTYPE",
        "Blood Type",
        "BLOOD TYPE",
      ]);
      const allergiesCell = findColumnValue(row, ["Allergies", "ALLERGIES"]);
      const heightCell = findColumnValue(row, ["Height", "HEIGHT"]);
      const weightCell = findColumnValue(row, ["Weight", "WEIGHT"]);
      const contactPersonCell = findColumnValue(row, [
        "Contact Person",
        "CONTACT PERSON",
        "Emergency Contact",
      ]);
      const contactNumberCell = findColumnValue(row, [
        "Contact Number",
        "CONTACT NUMBER",
        "Contact No",
        "Phone",
      ]);
      const emailCell = findColumnValue(row, ["Email", "EMAIL"]);

      let birthDate: Date | undefined;
      if (typeof birthdayCell === "number") {
        birthDate = excelDateToJSDate(birthdayCell);
      } else if (birthdayCell) {
        const parsed = new Date(birthdayCell);
        if (!isNaN(parsed.getTime())) {
          birthDate = parsed;
        }
      }

      return {
        employeeName: employeeNameCell?.toString(),
        employeeNumber: employeeNumberCell?.toString(),
        position: positionCell?.toString(),
        branch: branchCell?.toString(),
        tinNumber: tinCell?.toString() || undefined,
        gsisNumber: gsisCell?.toString() || undefined,
        philHealthNumber: philHealthCell?.toString() || undefined,
        pagIbigNumber: pagIbigCell?.toString() || undefined,
        birthDate,
        bloodType: normalizeBloodType(bloodTypeCell),
        allergies: allergiesCell?.toString() || undefined,
        height: (() => {
          if (heightCell === undefined || heightCell === "") return undefined;
          const num = Number(heightCell);
          return Number.isNaN(num) ? undefined : num;
        })(),
        weight: (() => {
          if (weightCell === undefined || weightCell === "") return undefined;
          const num = Number(weightCell);
          return Number.isNaN(num) ? undefined : num;
        })(),
        contactPerson: contactPersonCell?.toString(),
        contactNumber: contactNumberCell?.toString() || undefined,
        email: emailCell?.toString() || "",
      };
    });

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

    const createdEmployees = await prisma.employee.createManyAndReturn({
      data: validationResults.employees,
    });
    await createLog({
      action: LogAction.IMPORT_EMPLOYEES,
      details: {
        ids: createdEmployees.map((e) => e.id),
      },
    });

    return { success: true, result: undefined };
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
