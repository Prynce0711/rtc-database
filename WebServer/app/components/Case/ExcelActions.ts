"use server";

import ActionResult from "@/app/components/ActionResult";
import { CaseSchema } from "@/app/components/Case/schema";
import { Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";

type ExportExcelResult = {
  fileName: string;
  base64: string;
};

export async function uploadExcel(file: File): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession(Roles.ADMIN);
    if (!sessionResult.success) {
      return sessionResult;
    }
    // Validate file type
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/x-excel",
    ];

    if (!validMimeTypes.includes(file.type)) {
      return { success: false, error: "Invalid file type" };
    }

    // Validate file extension
    const validExtensions = [".xlsx", ".xls"];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasValidExtension) {
      return { success: false, error: "Invalid file extension" };
    }

    // Read file buffer and validate magic bytes
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check for Excel file signatures
    const isXlsx =
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04; // PK.. (ZIP file)
    const isXls =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1; // OLE2 compound document

    if (!isXlsx && !isXls) {
      return { success: false, error: "File is not a valid Excel document" };
    }

    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✓ Excel file received: ${file.name} (${file.size} bytes)`);
    console.log(`✓ Found ${rawData.length} rows in sheet "${sheetName}"`);

    // Helper function to convert Excel serial date to JS Date
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

    // Map Excel columns to schema properties
    const mappedData = rawData.map((row: any) => ({
      branch: row["Branch"]?.toString(),
      assistantBranch:
        row["ASSISTANT BRANCH"]?.toString() || row["Branch"]?.toString(),
      caseNumber: row["CASE NO"]?.toString(),
      dateFiled:
        typeof row["DATE FILED"] === "number"
          ? excelDateToJSDate(row["DATE FILED"])
          : row["DATE FILED"],
      name: row["NAME"]?.toString(),
      charge: row["CHARGE"]?.toString(),
      infoSheet: row["INFO SHEET"]?.toString(),
      court: row["COURT"]?.toString(),
      detained: row["DETAINED"]?.toString().toUpperCase() === "DETAINED",
      consolidation: row["CONSOLIDATION"]?.toString(),
      eqcNumber: row["ECQ NO."] ? Number(row["ECQ NO."]) : undefined,
      bond: row["BOND"] ? Number(row["BOND"]) : undefined,
      raffleDate: row["RAFFLE DATE"]
        ? typeof row["RAFFLE DATE"] === "number"
          ? excelDateToJSDate(row["RAFFLE DATE"])
          : new Date(row["RAFFLE DATE"])
        : undefined,
      committe1: row["COMMITEE 1"] ? Number(row["COMMITEE 1"]) : undefined,
      committe2: row["COMMITTEE 2"] ? Number(row["COMMITTEE 2"]) : undefined,
    }));

    console.log("Mapped data sample:", mappedData[0]);

    // Validate each row with CaseSchema
    const validationResults = {
      cases: [] as Prisma.CaseCreateManyInput[],
      total: mappedData.length,
      valid: 0,
      errors: [] as Array<{ row: number; errors: z.ZodError }>,
    };

    mappedData.forEach((row, index) => {
      const validatedCase = CaseSchema.safeParse(row);
      if (validatedCase.success) {
        validationResults.cases.push(validatedCase.data);
        validationResults.valid++;
      } else {
        validationResults.errors.push({
          row: index + 2,
          errors: validatedCase.error,
        }); // +2 because row 1 is headers
      }
    });

    console.log(
      `✓ Validated: ${validationResults.valid}/${validationResults.total} rows`,
    );

    if (validationResults.errors.length > 0) {
      console.log(
        `⚠ ${validationResults.errors.length} rows have validation errors:`,
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

    // TODO: Save validated data to database
    // const prisma = ...
    // await prisma.case.createMany({ data: validatedCases });
    await prisma.case.createMany({ data: validationResults.cases });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportCasesExcel(): Promise<
  ActionResult<ExportExcelResult>
> {
  try {
    const sessionResult = await validateSession(Roles.ADMIN);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const cases = await prisma.case.findMany({ orderBy: { id: "asc" } });

    const rows = cases.map((item) => ({
      Branch: item.branch,
      "ASSISTANT BRANCH": item.assistantBranch,
      "CASE NO": item.caseNumber,
      "DATE FILED": item.dateFiled,
      NAME: item.name,
      CHARGE: item.charge,
      "INFO SHEET": item.infoSheet,
      COURT: item.court,
      DETAINED: item.detained ? "DETAINED" : "RELEASED",
      CONSOLIDATION: item.consolidation,
      "ECQ NO.": item.eqcNumber ?? "",
      BOND: item.bond ?? "",
      "RAFFLE DATE": item.raffleDate ?? "",
      "COMMITEE 1": item.committe1 ?? "",
      "COMMITTEE 2": item.committe2 ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cases");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `cases-export-${Date.now()}.xlsx`;

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Export error:", error);
    return { success: false, error: "Export failed" };
  }
}
