"use server";

import ActionResult from "@/app/components/ActionResult";
import { SpecialProceedingSchema } from "@/app/components/Case/SpecialProceedings/schema";
import { LogAction, Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { isExcel } from "@/app/lib/utils";
import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";

type ExportSpecialProceedingExcelResult = {
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

// Fuzzy column name matcher
const findColumnValue = (row: any, possibleNames: string[]): any => {
  // First try exact match (case-insensitive)
  for (const name of possibleNames) {
    for (const key in row) {
      if (key.toLowerCase().trim() === name.toLowerCase().trim()) {
        return row[key];
      }
    }
  }

  // Then try partial match
  for (const name of possibleNames) {
    for (const key in row) {
      const keyLower = key.toLowerCase().trim();
      const nameLower = name.toLowerCase().trim();
      if (keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
        return row[key];
      }
    }
  }

  return undefined;
};

export async function uploadSpecialProceedingExcel(
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
      `✓ Special Proceeding Excel file received: ${file.name} (${file.size} bytes)`,
    );
    console.log(`✓ Found ${rawData.length} rows in sheet "${sheetName}"`);

    const mappedData = rawData.map((row: any) => {
      // Use fuzzy matching for column names
      const caseNumberCell = findColumnValue(row, [
        "Case Number",
        "Case no.",
        "Case No.",
        "Case No",
        "CaseNumber",
        "SPC. Case Number",
        "SPC Case No.",
        "SPC. Number",
        "SPC Number",
        "SPC. No.",
        "SPC No.",
      ]);
      const petitionerCell = findColumnValue(row, [
        "Petitioner",
        "Petitioner/s",
        "Petitioner Name",
        "Petitioners",
        "PetitionerName",
      ]);
      const raffledToCell = findColumnValue(row, [
        "Raffled To",
        "Raffled to",
        "RaffledTo",
        "Assigned To",
      ]);
      const dateCell = findColumnValue(row, ["Date", "DATE", "Filing Date"]);
      const natureCell = findColumnValue(row, [
        "Nature",
        "NATURE",
        "Nature of Proceeding",
      ]);
      const respondentCell = findColumnValue(row, [
        "Respondent",
        "Respondent/s",
        "Respondent Name",
        "Respondents",
        "RespondentName",
      ]);

      let date: Date | undefined;

      // Handle different date formats
      if (typeof dateCell === "number") {
        // Excel serial date
        date = excelDateToJSDate(dateCell);
      } else if (dateCell) {
        // Try parsing as text date
        const parsedDate = new Date(dateCell);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      }

      return {
        caseNumber: caseNumberCell?.toString() || "",
        petitioner: petitionerCell?.toString() || undefined,
        raffledTo: raffledToCell?.toString() || undefined,
        date: date || undefined,
        nature: natureCell?.toString() || undefined,
        respondent: respondentCell?.toString() || undefined,
      };
    });

    const validationResults = {
      specialProceedings: [] as Prisma.SpecialProceedingCreateManyInput[],
      total: mappedData.length,
      valid: 0,
      errors: [] as Array<{ row: number; errors: z.ZodError }>,
    };

    mappedData.forEach((row, index) => {
      const validated = SpecialProceedingSchema.safeParse(row);
      if (validated.success) {
        validationResults.specialProceedings.push(validated.data);
        validationResults.valid += 1;
      } else {
        validationResults.errors.push({
          row: index + 2,
          errors: validated.error,
        });
      }
    });

    console.log(
      `✓ Special Proceeding rows validated: ${validationResults.valid}/${validationResults.total}`,
    );

    if (validationResults.errors.length > 0) {
      console.log(
        `⚠ ${validationResults.errors.length} special proceeding rows have validation errors:`,
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

    const createdSpecialProceedings =
      await prisma.specialProceeding.createManyAndReturn({
        data: validationResults.specialProceedings,
      });

    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: createdSpecialProceedings.map((sp) => sp.id),
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Special Proceeding upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportSpecialProceedingsExcel(): Promise<
  ActionResult<ExportSpecialProceedingExcelResult>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const specialProceedings = await prisma.specialProceeding.findMany({
      orderBy: { id: "asc" },
    });

    const rows = specialProceedings.map((sp) => {
      let dateStr = "";

      if (sp.date) {
        const date = new Date(sp.date);
        // Format date as MM/DD/YYYY
        dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      }

      return {
        "Case Number": sp.caseNumber,
        Petitioner: sp.petitioner ?? "",
        "Raffled To": sp.raffledTo ?? "",
        Date: dateStr,
        Nature: sp.nature ?? "",
        Respondent: sp.respondent ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Special Proceedings");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `special-proceedings-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Special Proceeding export error:", error);
    return { success: false, error: "Export failed" };
  }
}
