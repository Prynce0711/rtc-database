"use server";

import ActionResult from "@/app/components/ActionResult";
import { PetitionSchema } from "@/app/components/Case/Petition/schema";
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
import { createLog } from "../../ActivityLogs/LogActions";

export async function uploadPetitionExcel(
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
      `✓ Petition Excel file received: ${file.name} (${file.size} bytes)`,
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
      ]);
      const petitionerNameCell = findColumnValue(row, [
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
        "Nature of Petition",
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
        petitioner: petitionerNameCell?.toString() || undefined,
        raffledTo: raffledToCell?.toString() || undefined,
        date: date || undefined,
        nature: natureCell?.toString() || undefined,
      };
    });

    const validationResults = {
      petitions: [] as Prisma.PetitionCreateManyInput[],
      total: mappedData.length,
      valid: 0,
      errors: [] as Array<{ row: number; errors: z.ZodError }>,
    };

    mappedData.forEach((row, index) => {
      const validated = PetitionSchema.safeParse(row);
      if (validated.success) {
        validationResults.petitions.push(validated.data);
        validationResults.valid += 1;
      } else {
        validationResults.errors.push({
          row: index + 2,
          errors: validated.error,
        });
      }
    });

    console.log(
      `✓ Petition rows validated: ${validationResults.valid}/${validationResults.total}`,
    );

    if (validationResults.errors.length > 0) {
      console.log(
        `⚠ ${validationResults.errors.length} petition rows have validation errors:`,
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

    const createdPetitions = await prisma.petition.createManyAndReturn({
      data: validationResults.petitions,
    });

    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: createdPetitions.map((petition) => petition.id),
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Petition upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportPetitionsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const petitions = await prisma.petition.findMany({
      orderBy: { id: "asc" },
    });

    const rows = petitions.map((petition) => {
      let dateStr = "";

      if (petition.date) {
        const date = new Date(petition.date);
        // Format date as MM/DD/YYYY
        dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      }

      return {
        "Case Number": petition.caseNumber,
        "Petitioner/s": petition.petitioner ?? "",
        "Raffled To": petition.raffledTo ?? "",
        Date: dateStr,
        Nature: petition.nature ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Petitions");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `petitions-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Petition export error:", error);
    return { success: false, error: "Export failed" };
  }
}
