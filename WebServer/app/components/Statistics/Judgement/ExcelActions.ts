"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { ExcelTypes } from "@/app/lib/workers/Excel/ExcelWorkerUtils";
import { startExcelUpload } from "@/app/lib/workers/Excel/WorkerActions";
import {
  ActionResult,
  ExportExcelData,
  UploadExcelResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";

const toNumber = (value: unknown): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBranch = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
};

const normalizeHeaderKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const findColumnValue = (
  row: Record<string, unknown>,
  possibleNames: string[],
): unknown => {
  const normalizedTargets = new Set(
    possibleNames
      .map((name) => normalizeHeaderKey(String(name)))
      .filter((name) => name.length > 0),
  );

  if (normalizedTargets.size === 0) return undefined;

  for (const key of Object.keys(row)) {
    if (normalizedTargets.has(normalizeHeaderKey(key))) {
      return row[key];
    }
  }

  return undefined;
};

const getMtcCells = (row: Record<string, unknown>) => {
  const branchNoCell = findColumnValue(row, [
    "Branches No.",
    "Branch No",
    "Branch",
  ]);
  const civilVCell = findColumnValue(row, [
    "civilV",
    "Civil V",
    "Civil Voluntary",
  ]);
  const civilInCCell = findColumnValue(row, [
    "civilInC",
    "Civil In-C",
    "Civil Inc",
  ]);
  const criminalVCell = findColumnValue(row, [
    "criminalV",
    "Criminal V",
    "Criminal Voluntary",
  ]);
  const criminalInCCell = findColumnValue(row, [
    "criminalInC",
    "Criminal In-C",
    "Criminal Inc",
  ]);
  const totalHeardCell = findColumnValue(row, [
    "totalHeard",
    "Total Cases Heard",
  ]);
  const disposedCivilCell = findColumnValue(row, [
    "disposedCivil",
    "Disposed Civil",
  ]);
  const disposedCrimCell = findColumnValue(row, [
    "disposedCrim",
    "Disposed Crim",
  ]);
  const totalDisposedCell = findColumnValue(row, [
    "totalDisposed",
    "Total Cases Disposed",
  ]);
  const pdlMCell = findColumnValue(row, ["pdlM", "PDL M"]);
  const pdlFCell = findColumnValue(row, ["pdlF", "PDL F"]);
  const pdlTotalCell = findColumnValue(row, ["pdlTotal", "PDL Total"]);
  const pdlVCell = findColumnValue(row, ["pdlV", "PDL V"]);
  const pdlICell = findColumnValue(row, ["pdlI", "PDL I", "PDL In-C"]);
  const pdlBailCell = findColumnValue(row, ["pdlBail", "PDL Bail"]);
  const pdlRecognizanceCell = findColumnValue(row, [
    "pdlRecognizance",
    "PDL Recognizance",
  ]);
  const pdlMinRorCell = findColumnValue(row, ["pdlMinRor", "PDL Min/Ror"]);
  const pdlMaxSentenceCell = findColumnValue(row, [
    "pdlMaxSentence",
    "PDL Max Sentence",
  ]);
  const pdlDismissalCell = findColumnValue(row, [
    "pdlDismissal",
    "PDL Dismissal",
  ]);
  const pdlAcquittalCell = findColumnValue(row, [
    "pdlAcquittal",
    "PDL Acquittal",
  ]);
  const pdlMinSentenceCell = findColumnValue(row, [
    "pdlMinSentence",
    "PDL Min Sentence",
  ]);
  const pdlOthersCell = findColumnValue(row, ["pdlOthers", "PDL Others"]);
  const totalCell = findColumnValue(row, ["total", "TOTAL"]);

  return {
    branchNoCell,
    civilVCell,
    civilInCCell,
    criminalVCell,
    criminalInCCell,
    totalHeardCell,
    disposedCivilCell,
    disposedCrimCell,
    totalDisposedCell,
    pdlMCell,
    pdlFCell,
    pdlTotalCell,
    pdlVCell,
    pdlICell,
    pdlBailCell,
    pdlRecognizanceCell,
    pdlMinRorCell,
    pdlMaxSentenceCell,
    pdlDismissalCell,
    pdlAcquittalCell,
    pdlMinSentenceCell,
    pdlOthersCell,
    totalCell,
  };
};

const getRtcCells = (row: Record<string, unknown>) => {
  const branchNoCell = findColumnValue(row, [
    "Branches No.",
    "Branch No",
    "Branch",
  ]);
  const civilVCell = findColumnValue(row, ["civilV", "Civil V"]);
  const civilInCCell = findColumnValue(row, [
    "civilInC",
    "Civil In-C",
    "Civil Inc",
  ]);
  const criminalVCell = findColumnValue(row, ["criminalV", "Criminal V"]);
  const criminalInCCell = findColumnValue(row, [
    "criminalInC",
    "Criminal In-C",
    "Criminal Inc",
  ]);
  const totalHeardCell = findColumnValue(row, [
    "totalHeard",
    "Total Cases Heard",
  ]);
  const disposedCivilCell = findColumnValue(row, [
    "disposedCivil",
    "Disposed Civil",
  ]);
  const disposedCrimCell = findColumnValue(row, [
    "disposedCrim",
    "Disposed Crim",
  ]);
  const summaryProcCell = findColumnValue(row, ["summaryProc", "Summary Proc"]);
  const casesDisposedCell = findColumnValue(row, [
    "casesDisposed",
    "Cases Disposed",
  ]);
  const pdlMCell = findColumnValue(row, ["pdlM", "PDL M"]);
  const pdlFCell = findColumnValue(row, ["pdlF", "PDL F"]);
  const pdlCICLCell = findColumnValue(row, ["pdlCICL", "PDL CICL"]);
  const pdlTotalCell = findColumnValue(row, ["pdlTotal", "PDL Total"]);
  const pdlVCell = findColumnValue(row, ["pdlV", "PDL V"]);
  const pdlInCCell = findColumnValue(row, ["pdlInC", "PDL In-C", "PDL Inc"]);
  const pdlBailCell = findColumnValue(row, ["pdlBail", "PDL Bail"]);
  const pdlRecognizanceCell = findColumnValue(row, [
    "pdlRecognizance",
    "PDL Recognizance",
  ]);
  const pdlMinRorCell = findColumnValue(row, ["pdlMinRor", "PDL Min/Ror"]);
  const pdlMaxSentenceCell = findColumnValue(row, [
    "pdlMaxSentence",
    "PDL Max Sentence",
  ]);
  const pdlDismissalCell = findColumnValue(row, [
    "pdlDismissal",
    "PDL Dismissal",
  ]);
  const pdlAcquittalCell = findColumnValue(row, [
    "pdlAcquittal",
    "PDL Acquittal",
  ]);
  const pdlMinSentenceCell = findColumnValue(row, [
    "pdlMinSentence",
    "PDL Min Sentence",
  ]);
  const pdlProbationCell = findColumnValue(row, [
    "pdlProbation",
    "PDL Probation",
  ]);
  const ciclMCell = findColumnValue(row, ["ciclM", "CICL M"]);
  const ciclFCell = findColumnValue(row, ["ciclF", "CICL F"]);
  const ciclVCell = findColumnValue(row, ["ciclV", "CICL V"]);
  const ciclInCCell = findColumnValue(row, [
    "ciclInC",
    "CICL In-C",
    "CICL Inc",
  ]);
  const fineCell = findColumnValue(row, ["fine", "Fine"]);
  const totalCell = findColumnValue(row, ["total", "TOTAL"]);

  return {
    branchNoCell,
    civilVCell,
    civilInCCell,
    criminalVCell,
    criminalInCCell,
    totalHeardCell,
    disposedCivilCell,
    disposedCrimCell,
    summaryProcCell,
    casesDisposedCell,
    pdlMCell,
    pdlFCell,
    pdlCICLCell,
    pdlTotalCell,
    pdlVCell,
    pdlInCCell,
    pdlBailCell,
    pdlRecognizanceCell,
    pdlMinRorCell,
    pdlMaxSentenceCell,
    pdlDismissalCell,
    pdlAcquittalCell,
    pdlMinSentenceCell,
    pdlProbationCell,
    ciclMCell,
    ciclFCell,
    ciclVCell,
    ciclInCCell,
    fineCell,
    totalCell,
  };
};

export async function uploadMunicipalJudgementExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    return startExcelUpload({
      type: ExcelTypes.MUNICIPAL_JUDGEMENT,
      file,
    });
  } catch (error) {
    console.error("Municipal judgement Excel upload failed:", error);
    return { success: false, error: "Municipal judgement Excel upload failed" };
  }
}

export async function exportMunicipalJudgementExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.judgementMunicipal.findMany({
      orderBy: { id: "asc" },
    });

    const rows = records.map((record) => ({
      "Branch No": record.branchNo ?? "",
      civilV: record.civilV,
      civilInC: record.civilInc,
      criminalV: record.criminalV,
      criminalInC: record.criminalInc,
      totalHeard: record.totalHeard,
      disposedCivil: record.disposedCivil,
      disposedCrim: record.disposedCrim,
      totalDisposed: record.totalDisposed,
      pdlM: record.pdlM,
      pdlF: record.pdlF,
      pdlTotal: record.pdlTotal,
      pdlV: record.pdlV,
      pdlI: record.pdlI,
      pdlBail: record.pdlBail,
      pdlRecognizance: record.pdlRecognizance,
      pdlMinRor: record.pdlMinRor,
      pdlMaxSentence: record.pdlMaxSentence,
      pdlDismissal: record.pdlDismissal,
      pdlAcquittal: record.pdlAcquittal,
      pdlMinSentence: record.pdlMinSentence,
      pdlOthers: record.pdlOthers,
      total: record.total,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Municipal Judgement");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

    return {
      success: true,
      result: {
        fileName: `judgement-municipal-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Municipal judgement Excel export failed:", error);
    return { success: false, error: "Municipal judgement Excel export failed" };
  }
}

export async function uploadRegionalJudgementExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    return startExcelUpload({
      type: ExcelTypes.REGIONAL_JUDGEMENT,
      file,
    });
  } catch (error) {
    console.error("Regional judgement Excel upload failed:", error);
    return { success: false, error: "Regional judgement Excel upload failed" };
  }
}

export async function exportRegionalJudgementExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.judgementRegional.findMany({
      orderBy: { id: "asc" },
    });

    const rows = records.map((record) => ({
      "Branch No": record.branchNo ?? "",
      civilV: record.civilV,
      civilInC: record.civilInc,
      criminalV: record.criminalV,
      criminalInC: record.criminalInc,
      totalHeard: record.totalHeard,
      disposedCivil: record.disposedCivil,
      disposedCrim: record.disposedCrim,
      summaryProc: record.summaryProc,
      casesDisposed: record.casesDisposed,
      pdlM: record.pdlM,
      pdlF: record.pdlF,
      pdlCICL: record.pdlCICL,
      pdlTotal: record.pdlTotal,
      pdlV: record.pdlV,
      pdlInC: record.pdlInc,
      pdlBail: record.pdlBail,
      pdlRecognizance: record.pdlRecognizance,
      pdlMinRor: record.pdlMinRor,
      pdlMaxSentence: record.pdlMaxSentence,
      pdlDismissal: record.pdlDismissal,
      pdlAcquittal: record.pdlAcquittal,
      pdlMinSentence: record.pdlMinSentence,
      pdlProbation: record.pdlProbation,
      ciclM: record.ciclM,
      ciclF: record.ciclF,
      ciclV: record.ciclV,
      ciclInC: record.ciclInc,
      fine: record.fine,
      total: record.total,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Regional Judgement");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

    return {
      success: true,
      result: {
        fileName: `judgement-regional-${Date.now()}.xlsx`,
        base64,
      },
    };
  } catch (error) {
    console.error("Regional judgement Excel export failed:", error);
    return { success: false, error: "Regional judgement Excel export failed" };
  }
}
