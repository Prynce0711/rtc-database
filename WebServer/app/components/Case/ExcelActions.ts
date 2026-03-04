"use server";

import ActionResult from "@/app/components/ActionResult";
import { CaseSchema } from "@/app/components/Case/schema";
import { CaseType, LogAction, Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  excelDateToJSDate,
  ExportExcelData,
  findColumnValue,
  isMappedRowEmpty,
  isValidDate,
  ProcessExcelMeta,
  processExcelUpload,
  UploadExcelResult,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { createLog } from "../ActivityLogs/LogActions";

export async function uploadExcel(
  file: File,
  caseType: CaseType,
): Promise<ActionResult<UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    console.log(`✓ Excel file received: ${file.name} (${file.size} bytes)`);

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

    const branchHeaders = ["Branch", "Branch/Station", "Branch Station", "BR"];

    const caseNumberHeaders = [
      "Case No",
      "Case Number",
      "Criminal Case No",
      "Criminal Case Number",
    ];

    const getMappedCells = (row: Record<string, unknown>) => {
      const branchCell = findColumnValue(row, branchHeaders);
      const assistantBranchCell = findColumnValue(row, [
        "Assistant Branch",
        "Asst Branch",
      ]);
      const caseNumberCell = findColumnValue(row, caseNumberHeaders);
      const dateFiledCell = findColumnValue(row, ["Date Filed", "Filing Date"]);
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
      const raffleCell = findColumnValue(row, ["Raffle Date", "Raffled Date"]);
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

      return {
        branchCell,
        assistantBranchCell,
        caseNumberCell,
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
      };
    };

    const result = await processExcelUpload<
      Prisma.CaseCreateManyInput,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { Branch: branchHeaders },
      schema: CaseSchema,
      skipRowsWithoutCell: {
        getCells: getMappedCells,
        ignoreKeys: ["caseNumberCell"],
      },
      uniqueKeyLabel: "Case number",
      extractUniqueKey: (row) =>
        findColumnValue(row, caseNumberHeaders)?.toString().trim(),
      checkExistingUniqueKeys: async (keys) => {
        const existing = await prisma.case.findMany({
          where: { caseNumber: { in: keys } },
          select: { caseNumber: true },
        });
        return new Set(existing.map((c) => c.caseNumber.trim()));
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);
        const { caseNumberCell } = cells;

        // Skip rows that have no mapped content beyond the case number (or are entirely empty)
        if (isMappedRowEmpty(cells, ["caseNumberCell"])) {
          return { skip: true };
        }

        let dateFiled: Date | undefined;
        if (typeof cells.dateFiledCell === "number") {
          const parsed = excelDateToJSDate(cells.dateFiledCell);
          if (parsed && isValidDate(parsed)) {
            dateFiled = parsed;
          }
        } else if (typeof cells.dateFiledCell === "string") {
          const parsed = new Date(cells.dateFiledCell);
          if (!isNaN(parsed.getTime()) && isValidDate(parsed)) {
            dateFiled = parsed;
          }
        }

        let raffleDate: Date | undefined;
        if (typeof cells.raffleCell === "number") {
          const parsed = excelDateToJSDate(cells.raffleCell);
          if (parsed && isValidDate(parsed)) {
            raffleDate = parsed;
          }
        } else if (typeof cells.raffleCell === "string") {
          const parsed = new Date(cells.raffleCell);
          if (!isNaN(parsed.getTime()) && isValidDate(parsed)) {
            raffleDate = parsed;
          }
        }

        const mappedRow: Prisma.CaseCreateManyInput = {
          branch: cells.branchCell?.toString(),
          assistantBranch:
            cells.assistantBranchCell?.toString() ||
            cells.branchCell?.toString(),
          caseNumber: cells.caseNumberCell?.toString() ?? "",
          dateFiled,
          name: cells.nameCell?.toString() ?? "",
          charge: cells.chargeCell?.toString(),
          infoSheet: cells.infoSheetCell?.toString(),
          court: cells.courtCell?.toString(),
          detained: cells.detainedCell?.toString() || null,
          consolidation: cells.consolidationCell?.toString() || null,
          eqcNumber: cells.eqcNumberCell
            ? Number(cells.eqcNumberCell)
            : undefined,
          bond: cells.bondCell?.toString(),
          raffleDate,
          committee1: cells.committee1Cell?.toString() || null,
          committee2: cells.committee2Cell?.toString() || null,
          caseType,
          judge: cells.judgeCell?.toString(),
          ao: cells.aoCell?.toString(),
          complainant: cells.complainantCell?.toString(),
          houseNo: cells.houseNoCell?.toString(),
          street: cells.streetCell?.toString(),
          barangay: cells.barangayCell?.toString(),
          municipality: cells.municipalityCell?.toString(),
          province: cells.provinceCell?.toString(),
          counts: cells.countsCell?.toString(),
          jdf: cells.jdfCell?.toString(),
          sajj: cells.sajjCell?.toString(),
          sajj2: cells.sajj2Cell?.toString(),
          mf: cells.mfCell?.toString(),
          stf: cells.stfCell?.toString(),
          lrf: cells.lrfCell?.toString(),
          vcf: cells.vcfCell?.toString(),
          total: cells.totalCell?.toString(),
          amountInvolved: cells.amountInvolvedCell?.toString(),
        };

        return {
          mapped: mappedRow,
          uniqueKey: caseNumberCell?.toString().trim(),
        };
      },
      onBatchInsert: async (rows) => {
        const created = await prisma.case.createManyAndReturn({ data: rows });
        return { ids: created.map((c) => c.id), count: created.length };
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      const imported = meta.importedCount;
      const errors = meta.errorCount;
      const sheets = meta.sheetSummary;

      console.log(
        `✓ Import completed: ${imported} cases imported, ${errors} row(s) failed validation`,
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
        action: LogAction.IMPORT_CASES,
        details: {
          ids: meta.importedIds ?? [],
        },
      });
    } else {
      console.error("✗ Import failed:", result.error);
    }

    return result;
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

    const rows = cases.map((c) => {
      const formatDate = (value: Date | null) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return {
        "Case Number": c.caseNumber ?? "",
        Name: c.name ?? "",
        Branch: c.branch ?? "",
        "Assistant Branch": c.assistantBranch ?? "",
        Type: c.caseType ?? "",
        "Date Filed": formatDate(c.dateFiled as unknown as Date | null),
        Charge: c.charge ?? "",
        Court: c.court ?? "",
        Detained: c.detained ?? "",
        Consolidation: c.consolidation ?? "",
        "EQC Number": c.eqcNumber ?? "",
        Bond: c.bond ?? "",
        "Raffle Date": formatDate(c.raffleDate as unknown as Date | null),
        "Committee 1": c.committee1 ?? "",
        "Committee 2": c.committee2 ?? "",
        Judge: c.judge ?? "",
        AO: c.ao ?? "",
        Complainant: c.complainant ?? "",
        "House No": c.houseNo ?? "",
        Street: c.street ?? "",
        Barangay: c.barangay ?? "",
        Municipality: c.municipality ?? "",
        Province: c.province ?? "",
        Counts: c.counts ?? "",
        JDF: c.jdf ?? "",
        SAJJ: c.sajj ?? "",
        "SAJJ 2": c.sajj2 ?? "",
        MF: c.mf ?? "",
        STF: c.stf ?? "",
        LRF: c.lrf ?? "",
        VCF: c.vcf ?? "",
        Total: c.total ?? "",
        "Amount Involved": c.amountInvolved ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cases");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `cases-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Cases export error:", error);
    return { success: false, error: "Export failed" };
  }
}
