"use server";

import ActionResult from "@/app/components/ActionResult";
import { CaseSchema } from "@/app/components/Case/schema";
import { CaseType, LogAction, Prisma } from "@/app/generated/prisma/client";
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

type FailedRow = Record<string, unknown>;
type ValidationErrorDetail = z.ZodError | { message: string };

// Helper function to validate that a date is reasonable (between 1900 and 2100)
function isValidDate(date: Date): boolean {
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
}

const formatDateCell = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    const parsed = excelDateToJSDate(value);
    if (parsed && isValidDate(parsed)) {
      return parsed.toLocaleDateString("en-PH");
    }
    return undefined;
  }
  if (value instanceof Date) {
    return isValidDate(value) ? value.toLocaleDateString("en-PH") : undefined;
  }
  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime()) && isValidDate(asDate)) {
      return asDate.toLocaleDateString("en-PH");
    }
  }
  return undefined;
};

export async function uploadExcel(
  file: File,
  caseType: CaseType,
): Promise<ActionResult<ExportExcelData | undefined>> {
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

    console.log(`✓ Excel file received: ${file.name} (${file.size} bytes)`);
    console.log(
      `✓ Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
    );

    // Validate results tracking
    const validationResults = {
      total: 0,
      valid: 0,
      imported: 0,
      importedIds: [] as number[],
      errors: [] as Array<{
        row: number;
        sheet: string;
        errors: ValidationErrorDetail;
      }>,
      sheetSummary: [] as Array<{
        sheet: string;
        rows: number;
        valid: number;
        failed: number;
      }>,
    };

    // Track failed rows with original data for export
    const failedRowsBySheet = new Map<string, FailedRow[]>();

    // Track case numbers seen in this upload (across sheets) to prevent duplicates in-batch
    const seenCaseNumbers = new Set<string>();

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json<FailedRow>(worksheet);

      // Grab the header row separately so we can detect columns even when the first data rows are empty
      const headerRow =
        (XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          range: 0,
          blankrows: false,
        })[0] as string[] | undefined) || [];

      console.log(
        `\n📋 Processing sheet "${sheetName}": ${sheetData.length} rows`,
      );

      // Ensure required Branch column exists before row processing
      const branchHeaders = [
        "Branch",
        "Branch/Station",
        "Branch Station",
        "BR",
      ];

      const caseNumberHeaders = [
        "Case No",
        "Case Number",
        "Criminal Case No",
        "Criminal Case Number",
      ];
      const normalize = (val: string) =>
        val.toLowerCase().replace(/[\s.]/g, "").trim();
      const branchTargets = branchHeaders.map(normalize);
      const hasBranchColumn = headerRow.some((cell) => {
        if (typeof cell !== "string") return false;
        const normalized = normalize(cell);
        return branchTargets.some(
          (target) =>
            normalized === target ||
            normalized.includes(target) ||
            target.includes(normalized),
        );
      });

      if (!hasBranchColumn) {
        const errorReason = `Sheet "${sheetName}" is missing a Branch column (expected one of: ${branchHeaders.join(", ")}).`;
        console.warn(`⚠ ${errorReason}`);

        const failedRows =
          sheetData.length > 0
            ? sheetData.map((row) => ({ ...row, __error: errorReason }))
            : [{ __error: errorReason }];

        validationResults.total += sheetData.length;
        validationResults.errors.push(
          ...failedRows.map((_, idx) => ({
            row: idx + 2, // header assumed at row 1
            sheet: sheetName,
            errors: { message: errorReason },
          })),
        );
        failedRowsBySheet.set(sheetName, failedRows);
        validationResults.sheetSummary.push({
          sheet: sheetName,
          rows: sheetData.length,
          valid: 0,
          failed: failedRows.length,
        });
        continue;
      }

      let sheetValid = 0;
      let sheetFailed = 0;
      const sheetFailedRows: FailedRow[] = [];
      const sheetValidCases: Prisma.CaseCreateManyInput[] = [];

      // Track duplicates within this sheet
      const sheetSeenCaseNumbers = new Set<string>();

      // Collect case numbers to pre-check duplicates in DB
      const sheetCaseNumbers = sheetData
        .map((row) =>
          findColumnValue(row, caseNumberHeaders)?.toString().trim(),
        )
        .filter((val): val is string => !!val);

      const existingCaseNumbers = sheetCaseNumbers.length
        ? await prisma.case.findMany({
            where: { caseNumber: { in: sheetCaseNumbers } },
            select: { caseNumber: true },
          })
        : [];
      const existingCaseSet = new Set(
        existingCaseNumbers.map((c) => c.caseNumber.trim()),
      );

      console.log(
        `✓ Sheet "${sheetName}": Branch column found, processing rows...`,
      );

      // Map and validate each row with CaseSchema
      for (let index = 0; index < sheetData.length; index++) {
        const row = sheetData[index];

        // Extract all cell values with fuzzy matching
        const branchCell = findColumnValue(row, branchHeaders);
        const assistantBranchCell = findColumnValue(row, [
          "Assistant Branch",
          "Asst Branch",
        ]);
        const caseNumberCell = findColumnValue(row, caseNumberHeaders);
        const dateFiledCell = findColumnValue(row, [
          "Date Filed",
          "Filing Date",
        ]);
        const nameCell = findColumnValue(row, [
          "Name",
          "Accused",
          "Accused Name",
        ]);
        const chargeCell = findColumnValue(row, ["Charge", "Offense"]);
        const infoSheetCell = findColumnValue(row, [
          "Info Sheet",
          "Information Sheet",
          "IS",
          "I.S",
        ]);
        const courtCell = findColumnValue(row, ["Court"]);
        const detainedCell = findColumnValue(row, [
          "Detained",
          "Detention",
          "Status",
        ]);
        const consolidationCell = findColumnValue(row, ["Consolidation"]);
        const eqcNumberCell = findColumnValue(row, ["EQC No", "EQ Number"]);
        const bondCell = findColumnValue(row, ["Bond", "BOND"]);
        const raffleCell = findColumnValue(row, [
          "Raffle Date",
          "Raffled Date",
        ]);
        const committee1Cell = findColumnValue(row, [
          "Committee 1",
          "Commitee 1",
        ]);
        const committee2Cell = findColumnValue(row, [
          "Committee 2",
          "Commitee 2",
        ]);
        const judgeCell = findColumnValue(row, ["Judge", "JUDGE"]);
        const aoCell = findColumnValue(row, ["AO", "A.O.", "A.O"]);
        const complainantCell = findColumnValue(row, [
          "Complainant",
          "COMPLAINANT",
        ]);
        const houseNoCell = findColumnValue(row, [
          "House No",
          "HOUSE NO",
          "House Number",
        ]);
        const streetCell = findColumnValue(row, ["Street"]);
        const barangayCell = findColumnValue(row, ["Barangay"]);
        const municipalityCell = findColumnValue(row, ["Municipality"]);
        const provinceCell = findColumnValue(row, ["Province"]);
        const countsCell = findColumnValue(row, ["Counts"]);
        const jdfCell = findColumnValue(row, ["JDF"]);
        const sajjCell = findColumnValue(row, ["SAJJ", "sajj"]);
        const sajj2Cell = findColumnValue(row, ["SAJJ2", "sajj2", "SAJJ 2"]);
        const mfCell = findColumnValue(row, ["MF", "mf"]);
        const stfCell = findColumnValue(row, ["STF", "stf"]);
        const lrfCell = findColumnValue(row, ["LRF", "lrf"]);
        const vcfCell = findColumnValue(row, ["VCF", "vcf"]);
        const totalCell = findColumnValue(row, ["Total", "TOTAL"]);
        const amountInvolvedCell = findColumnValue(row, [
          "Amount Involved",
          "AMOUNT INVOLVED",
        ]);

        // Skip rows that have a Case Number but no other mapped columns filled (ignore unknown columns)
        const hasContent = (val: unknown) => {
          if (val === undefined || val === null) return false;
          if (typeof val === "string") return val.trim() !== "";
          return true; // numbers/dates/other truthy values
        };
        const mappedValuesExcludingCase = [
          branchCell,
          assistantBranchCell,
          dateFiledCell,
          nameCell,
          chargeCell,
          infoSheetCell,
          courtCell,
          detainedCell,
          consolidationCell,
          eqcNumberCell,
          bondCell,
          raffleCell,
          committee1Cell,
          committee2Cell,
          judgeCell,
          aoCell,
          complainantCell,
          houseNoCell,
          streetCell,
          barangayCell,
          municipalityCell,
          provinceCell,
          countsCell,
          jdfCell,
          sajjCell,
          sajj2Cell,
          mfCell,
          stfCell,
          lrfCell,
          vcfCell,
          totalCell,
          amountInvolvedCell,
        ];
        const hasOtherMappedContent =
          mappedValuesExcludingCase.some(hasContent);

        if (hasContent(caseNumberCell) && !hasOtherMappedContent) {
          continue;
        }

        const normalizedCaseNumber = caseNumberCell?.toString().trim();
        if (normalizedCaseNumber) {
          if (
            existingCaseSet.has(normalizedCaseNumber) ||
            seenCaseNumbers.has(normalizedCaseNumber)
          ) {
            sheetFailed++;
            sheetFailedRows.push({
              ...row,
              __error: "Case number already exists",
            });
            validationResults.errors.push({
              row: index + 2,
              sheet: sheetName,
              errors: { message: "Case number already exists" },
            });
            continue;
          }

          if (sheetSeenCaseNumbers.has(normalizedCaseNumber)) {
            sheetFailed++;
            sheetFailedRows.push({
              ...row,
              __error: "Case number duplicated in this file",
            });
            validationResults.errors.push({
              row: index + 2,
              sheet: sheetName,
              errors: { message: "Case number duplicated in this file" },
            });
            continue;
          }
        }

        let dateFiled: Date | undefined;
        if (typeof dateFiledCell === "number") {
          const parsed = excelDateToJSDate(dateFiledCell);
          if (parsed && isValidDate(parsed)) {
            dateFiled = parsed;
          }
        } else if (dateFiledCell) {
          const parsed = new Date(dateFiledCell);
          if (!isNaN(parsed.getTime()) && isValidDate(parsed)) {
            dateFiled = parsed;
          }
        }

        let raffleDate: Date | undefined;
        if (typeof raffleCell === "number") {
          const parsed = excelDateToJSDate(raffleCell);
          if (parsed && isValidDate(parsed)) {
            raffleDate = parsed;
          }
        } else if (raffleCell) {
          const parsed = new Date(raffleCell);
          if (!isNaN(parsed.getTime()) && isValidDate(parsed)) {
            raffleDate = parsed;
          }
        }

        // Map to schema object
        const mappedRow = {
          branch: branchCell?.toString(),
          assistantBranch:
            assistantBranchCell?.toString() || branchCell?.toString(),
          caseNumber: caseNumberCell?.toString(),
          dateFiled,
          name: nameCell?.toString(),
          charge: chargeCell?.toString(),
          infoSheet: infoSheetCell?.toString(),
          court: courtCell?.toString(),
          detained: detainedCell?.toString() || null,
          consolidation: consolidationCell?.toString() || null,
          eqcNumber: eqcNumberCell ? Number(eqcNumberCell) : undefined,
          bond: bondCell?.toString(),
          raffleDate,
          committee1: committee1Cell?.toString() || null,
          committee2: committee2Cell?.toString() || null,
          caseType,
          judge: judgeCell?.toString(),
          ao: aoCell?.toString(),
          complainant: complainantCell?.toString(),
          houseNo: houseNoCell?.toString(),
          street: streetCell?.toString(),
          barangay: barangayCell?.toString(),
          municipality: municipalityCell?.toString(),
          province: provinceCell?.toString(),
          counts: countsCell?.toString(),
          jdf: jdfCell?.toString(),
          sajj: sajjCell?.toString(),
          sajj2: sajj2Cell?.toString(),
          mf: mfCell?.toString(),
          stf: stfCell?.toString(),
          lrf: lrfCell?.toString(),
          vcf: vcfCell?.toString(),
          total: totalCell?.toString(),
          amountInvolved: amountInvolvedCell?.toString(),
        };

        // Validate row with CaseSchema
        const validatedCase = CaseSchema.safeParse(mappedRow);

        validationResults.total++;
        if (validatedCase.success) {
          if (normalizedCaseNumber) {
            sheetSeenCaseNumbers.add(normalizedCaseNumber);
            seenCaseNumbers.add(normalizedCaseNumber);
          }
          sheetValidCases.push(validatedCase.data);
          validationResults.valid++;
          sheetValid++;
        } else {
          const errorReason =
            prettifyError(validatedCase.error) || "Validation failed";
          sheetFailed++;
          sheetFailedRows.push({
            ...row,
            __error: errorReason,
          });
          validationResults.errors.push({
            row: index + 2, // +2 because row 1 is headers
            sheet: sheetName,
            errors: validatedCase.error,
          });
        }
      }

      // Import valid cases from this sheet to database in batch
      if (sheetValidCases.length > 0) {
        console.log(
          `✓ Sheet "${sheetName}": Importing ${sheetValidCases.length} valid cases to database...`,
        );
        try {
          const createdCases = await prisma.case.createManyAndReturn({
            data: sheetValidCases,
          });
          validationResults.imported += createdCases.length;
          validationResults.importedIds.push(...createdCases.map((c) => c.id));
          console.log(
            `✓ Sheet "${sheetName}": Imported ${createdCases.length} cases`,
          );
        } catch (error: any) {
          console.error(
            `✗ Sheet "${sheetName}": Failed to import cases:`,
            error,
          );
          return {
            success: false,
            error: `Database import failed: ${error.message}`,
          };
        }
      }

      // Store failed rows for this sheet
      if (sheetFailedRows.length > 0) {
        failedRowsBySheet.set(sheetName, sheetFailedRows);
      }

      // Add sheet summary
      validationResults.sheetSummary.push({
        sheet: sheetName,
        rows: sheetData.length,
        valid: sheetValid,
        failed: sheetFailed,
      });

      console.log(
        `✓ Sheet "${sheetName}": ${sheetValid}/${sheetData.length} rows valid`,
      );
    }

    console.log(
      `\n✓ Total validated: ${validationResults.valid}/${validationResults.total} rows from ${validationResults.sheetSummary.length} sheet(s)`,
    );
    console.log(`✓ Total imported: ${validationResults.imported} cases`);

    // Log per-sheet summary
    validationResults.sheetSummary.forEach((summary) => {
      console.log(
        `  📋 "${summary.sheet}": ${summary.valid}/${summary.rows} valid, ${summary.failed} failed`,
      );
    });

    if (validationResults.errors.length > 0) {
      console.log(
        `⚠ ${validationResults.errors.length} rows have validation errors`,
      );
    }

    // Create failed rows workbook if there are any failures
    let failedExcelData: ExportExcelData | undefined;
    if (failedRowsBySheet.size > 0) {
      const failedWorkbook = XLSX.utils.book_new();

      // Add each sheet with its failed rows
      failedRowsBySheet.forEach((failedRows, sheetName) => {
        const failedWorksheet = XLSX.utils.json_to_sheet(failedRows);
        XLSX.utils.book_append_sheet(
          failedWorkbook,
          failedWorksheet,
          sheetName,
        );
      });

      const base64 = XLSX.write(failedWorkbook, {
        type: "base64",
        bookType: "xlsx",
      });
      const fileName = `failed-cases-${Date.now()}.xlsx`;

      failedExcelData = { fileName, base64 };
      console.log(
        `✓ Created failed rows Excel file with ${failedRowsBySheet.size} sheet(s)`,
      );
    }

    if (validationResults.valid === 0) {
      // Return failed Excel file even when no valid cases
      if (failedExcelData) {
        return {
          success: false,
          error:
            "No valid cases to import. Download failed rows file to review errors.",
        };
      }
      return {
        success: false,
        error: "No valid cases to import",
      };
    }

    // Log the import action
    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: validationResults.importedIds,
      },
    });

    // Return success with failed rows file if any
    const successMessage =
      validationResults.errors.length > 0
        ? `✓ Successfully imported ${validationResults.imported} cases. ${validationResults.errors.length} rows failed validation.`
        : `✓ Successfully imported all ${validationResults.imported} cases.`;

    console.log(successMessage);
    return { success: true, result: failedExcelData };
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
      "CASE TYPE": item.caseType,
      Branch: item.branch,
      "ASSISTANT BRANCH": item.assistantBranch,
      "CASE NO": item.caseNumber,
      "DATE FILED": item.dateFiled,
      NAME: item.name,
      CHARGE: item.charge,
      "INFO SHEET": item.infoSheet,
      COURT: item.court,
      DETAINED: item.detained || "",
      CONSOLIDATION: item.consolidation,
      "ECQ NO.": item.eqcNumber ?? "",
      BOND: item.bond ?? "",
      "RAFFLE DATE": item.raffleDate ?? "",
      "COMMITTEE 1": item.committee1 ?? "",
      "COMMITTEE 2": item.committee2 ?? "",
      JUDGE: item.judge ?? "",
      AO: item.ao ?? "",
      COMPLAINANT: item.complainant ?? "",
      "HOUSE NO": item.houseNo ?? "",
      STREET: item.street ?? "",
      BARANGAY: item.barangay ?? "",
      MUNICIPALITY: item.municipality ?? "",
      PROVINCE: item.province ?? "",
      COUNTS: item.counts ?? "",
      JDF: item.jdf ?? "",
      SAJJ: item.sajj ?? "",
      "SAJJ 2": item.sajj2 ?? "",
      MF: item.mf ?? "",
      STF: item.stf ?? "",
      LRF: item.lrf ?? "",
      VCF: item.vcf ?? "",
      TOTAL: item.total ?? "",
      "AMOUNT INVOLVED": item.amountInvolved ?? "",
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
