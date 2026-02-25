"use server";

import ActionResult from "@/app/components/ActionResult";
import { CaseSchema } from "@/app/components/Case/schema";
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

export async function uploadExcel(file: File): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if ((await isExcel(file)) === false) {
      return { success: false, error: "File is not a valid Excel document" };
    }

    const buffer = await file.arrayBuffer();

    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✓ Excel file received: ${file.name} (${file.size} bytes)`);
    console.log(`✓ Found ${rawData.length} rows in sheet "${sheetName}"`);

    // Map Excel columns to schema properties with fuzzy matching
    const mappedData = rawData.map((row: any) => {
      const branchCell = findColumnValue(row, [
        "Branch",
        "BRANCH",
        "Branch/Station",
        "BRANCH/STATION",
        "Branch Station",
        "BR.",
        "BR",
      ]);
      const assistantBranchCell = findColumnValue(row, [
        "Assistant Branch",
        "ASSISTANT BRANCH",
        "Asst Branch",
      ]);
      const caseNumberCell = findColumnValue(row, [
        "Case No.",
        "Case Number",
        "CASE NUMBER",
        "Criminal Case No",
        "Criminal Case No.",
        "Criminal Case Number",
      ]);
      const dateFiledCell = findColumnValue(row, [
        "Date Filed",
        "DATE FILED",
        "Filing Date",
      ]);
      const nameCell = findColumnValue(row, [
        "Name",
        "NAME",
        "Accused",
        "Accused Name",
      ]);
      const chargeCell = findColumnValue(row, ["Charge", "CHARGE", "Offense"]);
      const infoSheetCell = findColumnValue(row, [
        "Info Sheet",
        "INFO SHEET",
        "Information Sheet",
        "IS",
        "I.S.",
        "I.S",
        "IS.",
      ]);
      const courtCell = findColumnValue(row, ["Court", "COURT"]);
      const detainedCell = findColumnValue(row, [
        "Detained",
        "DETAINED",
        "Status",
      ]);
      const consolidationCell = findColumnValue(row, [
        "Consolidation",
        "CONSOLIDATION",
      ]);
      const eqcNumberCell = findColumnValue(row, [
        "EQC No",
        "ECQ No.",
        "ECQ NO.",
        "EQ Number",
      ]);
      const bondCell = findColumnValue(row, ["Bond", "BOND"]);
      const raffleCell = findColumnValue(row, [
        "Raffle Date",
        "RAFFLE DATE",
        "Raffled Date",
      ]);
      const committee1Cell = findColumnValue(row, [
        "Committee 1",
        "COMMITTEE 1",
        "Commitee 1",
        "COMMITEE 1",
      ]);
      const committee2Cell = findColumnValue(row, [
        "Committee 2",
        "COMMITTEE 2",
        "Commitee 2",
        "COMMITEE 2",
      ]);

      let dateFiled: Date | undefined;
      if (typeof dateFiledCell === "number") {
        dateFiled = excelDateToJSDate(dateFiledCell);
      } else if (dateFiledCell) {
        const parsed = new Date(dateFiledCell);
        if (!isNaN(parsed.getTime())) {
          dateFiled = parsed;
        }
      }

      let raffleDate: Date | undefined;
      if (typeof raffleCell === "number") {
        raffleDate = excelDateToJSDate(raffleCell);
      } else if (raffleCell) {
        const parsed = new Date(raffleCell);
        if (!isNaN(parsed.getTime())) {
          raffleDate = parsed;
        }
      }

      return {
        branch: branchCell?.toString(),
        assistantBranch:
          assistantBranchCell?.toString() || branchCell?.toString(),
        caseNumber: caseNumberCell?.toString(),
        dateFiled,
        name: nameCell?.toString(),
        charge: chargeCell?.toString(),
        infoSheet: infoSheetCell?.toString(),
        court: courtCell?.toString(),
        detained:
          detainedCell?.toString().toUpperCase() === "DETAINED" ||
          detainedCell?.toString().toUpperCase() === "YES",
        consolidation: consolidationCell?.toString(),
        eqcNumber: eqcNumberCell ? Number(eqcNumberCell) : undefined,
        bond: bondCell ? Number(bondCell) : undefined,
        raffleDate,
        committe1: committee1Cell ? Number(committee1Cell) : undefined,
        committe2: committee2Cell ? Number(committee2Cell) : undefined,
      };
    });

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
    const createdCases = await prisma.case.createManyAndReturn({
      data: validationResults.cases,
    });
    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: createdCases.map((c) => c.id),
      },
    });

    return { success: true, result: undefined };
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

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Export error:", error);
    return { success: false, error: "Export failed" };
  }
}
