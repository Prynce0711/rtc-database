"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { startExcelUpload } from "@/app/lib/workers/Excel/excel.worker";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import {
  ActionResult,
  excelDateToJSDate,
  ExportExcelData,
  findColumnValue,
  isValidDate,
  UploadExcelResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";

const toText = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
};

const normalizeHeaderToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const extractYearFromHeader = (value: string): number | undefined => {
  const match = value.match(/(?:19|20)\d{2}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : undefined;
};

const findPendingValueByYear = (
  row: Record<string, unknown>,
  targetYear: number,
): unknown => {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeaderToken(key);
    if (!normalized.includes("pending")) continue;

    const year =
      extractYearFromHeader(key) ?? extractYearFromHeader(normalized);
    if (year === targetYear) {
      return value;
    }
  }

  return undefined;
};

const resolveCourtReportYear = (
  row: Record<string, unknown>,
  explicitYearValue: unknown,
): number => {
  const explicitYear = Number(String(explicitYearValue ?? "").trim());
  if (
    Number.isInteger(explicitYear) &&
    explicitYear >= 1900 &&
    explicitYear <= 2100
  ) {
    return explicitYear;
  }

  const pendingYears = Object.keys(row)
    .map((key) => {
      const normalized = normalizeHeaderToken(key);
      if (!normalized.includes("pending")) return undefined;
      return extractYearFromHeader(key) ?? extractYearFromHeader(normalized);
    })
    .filter((year): year is number => year !== undefined);

  if (pendingYears.length > 0) {
    return Math.max(...pendingYears);
  }

  return new Date().getFullYear();
};

const toReportYear = (value: unknown): number => {
  const parsed = Number(String(value ?? "").trim());
  if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) {
    return parsed;
  }
  return new Date().getFullYear();
};

const toIsoDateString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value === "number") {
    const parsed = excelDateToJSDate(value);
    if (isValidDate(parsed)) {
      return parsed.toISOString();
    }
    return undefined;
  }

  if (value instanceof Date) {
    if (isValidDate(value)) {
      return value.toISOString();
    }
    return undefined;
  }

  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime()) && isValidDate(parsed)) {
    return parsed.toISOString();
  }

  return undefined;
};

const getCourtCells = (row: Record<string, unknown>) => {
  const explicitReportYearCell = findColumnValue(row, [
    "Report Year",
    "Year",
    "reportYear",
  ]);
  const reportYearCell = resolveCourtReportYear(row, explicitReportYearCell);
  const branchCell = findColumnValue(row, ["Branch", "Branches", "Branch No"]);
  const pendingLastYearCell =
    findColumnValue(row, ["Pending Last Year", "pendingLastYear"]) ??
    findPendingValueByYear(row, reportYearCell - 1);
  const raffledOrAddedCell = findColumnValue(row, [
    "Raffled Or Added",
    "Raffled/Added",
    "RaffledOrAdded",
  ]);
  const disposedCell = findColumnValue(row, ["Disposed"]);
  const pendingThisYearCell =
    findColumnValue(row, ["Pending This Year", "pendingThisYear"]) ??
    findPendingValueByYear(row, reportYearCell);
  const percentageOfDispositionCell = findColumnValue(row, [
    "Percentage Of Disposition",
    "% Disposition",
    "percentageOfDisposition",
  ]);

  return {
    reportYearCell,
    branchCell,
    pendingLastYearCell,
    raffledOrAddedCell,
    disposedCell,
    pendingThisYearCell,
    percentageOfDispositionCell,
  };
};

const getInventoryCells = (row: Record<string, unknown>) => {
  const regionCell = findColumnValue(row, ["Region"]);
  const provinceCell = findColumnValue(row, ["Province"]);
  const courtCell = findColumnValue(row, ["Court"]);
  const cityMunicipalityCell = findColumnValue(row, [
    "City Municipality",
    "City/Municipality",
    "cityMunicipality",
  ]);
  const branchCell = findColumnValue(row, ["Branch", "Branch No"]);
  const civilSmallClaimsFiledCell = findColumnValue(row, [
    "Civil Small Claims Filed",
    "civilSmallClaimsFiled",
  ]);
  const criminalCasesFiledCell = findColumnValue(row, [
    "Criminal Cases Filed",
    "criminalCasesFiled",
  ]);
  const civilSmallClaimsDisposedCell = findColumnValue(row, [
    "Civil Small Claims Disposed",
    "civilSmallClaimsDisposed",
  ]);
  const criminalCasesDisposedCell = findColumnValue(row, [
    "Criminal Cases Disposed",
    "criminalCasesDisposed",
  ]);
  const dateRecordedCell = findColumnValue(row, [
    "Date Recorded",
    "dateRecorded",
    "Date",
  ]);

  return {
    regionCell,
    provinceCell,
    courtCell,
    cityMunicipalityCell,
    branchCell,
    civilSmallClaimsFiledCell,
    criminalCasesFiledCell,
    civilSmallClaimsDisposedCell,
    criminalCasesDisposedCell,
    dateRecordedCell,
  };
};

export async function uploadMunicipalTrialCourtExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    return startExcelUpload({
      type: ExcelTypes.MUNICIPAL_TRIAL_COURT,
      file,
    });
  } catch (error) {
    console.error("Municipal Trial Court Excel upload failed:", error);
    return {
      success: false,
      error: "Municipal Trial Court Excel upload failed",
    };
  }
}

export async function exportMunicipalTrialCourtExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.municipalTrialCourt.findMany({
      orderBy: { id: "asc" },
    });

    const rows = records.map((record) => ({
      "Report Year": record.reportYear ?? "",
      Branch: record.branch,
      pendingLastYear: record.pendingLastYear ?? "",
      RaffledOrAdded: record.RaffledOrAdded ?? "",
      Disposed: record.Disposed ?? "",
      pendingThisYear: record.pendingThisYear ?? "",
      percentageOfDisposition: record.percentageOfDisposition ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "MTC Annual");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    return {
      success: true,
      result: {
        fileName: `annual-mtc-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Municipal Trial Court Excel export failed:", error);
    return {
      success: false,
      error: "Municipal Trial Court Excel export failed",
    };
  }
}

export async function uploadRegionalTrialCourtExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    return startExcelUpload({
      type: ExcelTypes.REGIONAL_TRIAL_COURT,
      file,
    });
  } catch (error) {
    console.error("Regional Trial Court Excel upload failed:", error);
    return {
      success: false,
      error: "Regional Trial Court Excel upload failed",
    };
  }
}

export async function exportRegionalTrialCourtExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.regionalTrialCourt.findMany({
      orderBy: { id: "asc" },
    });

    const rows = records.map((record) => ({
      "Report Year": record.reportYear ?? "",
      Branch: record.branch,
      pendingLastYear: record.pendingLastYear ?? "",
      RaffledOrAdded: record.RaffledOrAdded ?? "",
      Disposed: record.Disposed ?? "",
      pendingThisYear: record.pendingThisYear ?? "",
      percentageOfDisposition: record.percentageOfDisposition ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "RTC Annual");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    return {
      success: true,
      result: {
        fileName: `annual-rtc-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Regional Trial Court Excel export failed:", error);
    return {
      success: false,
      error: "Regional Trial Court Excel export failed",
    };
  }
}

export async function uploadInventoryDocumentExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    return startExcelUpload({
      type: ExcelTypes.INVENTORY_DOCUMENT,
      file,
    });
  } catch (error) {
    console.error("Inventory Excel upload failed:", error);
    return { success: false, error: "Inventory Excel upload failed" };
  }
}

export async function exportInventoryDocumentExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.inventoryDocument.findMany({
      orderBy: { id: "asc" },
    });

    const rows = records.map((record) => ({
      Region: record.region,
      Province: record.province,
      Court: record.court,
      cityMunicipality: record.cityMunicipality,
      Branch: record.branch,
      civilSmallClaimsFiled: record.civilSmallClaimsFiled ?? "",
      criminalCasesFiled: record.criminalCasesFiled ?? "",
      civilSmallClaimsDisposed: record.civilSmallClaimsDisposed ?? "",
      criminalCasesDisposed: record.criminalCasesDisposed ?? "",
      dateRecorded: record.dateRecorded
        ? record.dateRecorded.toISOString()
        : "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Annual");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    return {
      success: true,
      result: {
        fileName: `annual-inventory-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Inventory Excel export failed:", error);
    return { success: false, error: "Inventory Excel export failed" };
  }
}
