"use server";

import {
  RTCJudgementRow,
  RTCJudgementRowSchema,
} from "@/app/components/Statistics/Judgement/Schema";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  UploadExcelResult,
  isMappedRowEmpty,
  processExcelUpload,
  valuesAreEqual,
} from "@rtc-database/shared";
import { IS_WORKER } from "../ExcelWorkerUtils";

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

export async function uploadRegionalJudgementExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    const result = await processExcelUpload<
      RTCJudgementRow,
      ReturnType<typeof getRtcCells>
    >({
      file,
      requiredHeaders: {
        "Branch No": ["Branches No.", "Branch No", "Branch"],
      },
      getCells: getRtcCells,
      schema: RTCJudgementRowSchema,
      skipRowsWithoutCell: ["branchNoCell"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingRows = await prisma.judgementRegional.findMany({
          where: {
            branchNo: mappedRow.branchNo,
          },
        });

        const mappedEntries = Object.entries(mappedRow);
        const hasExactMatch = existingRows.some((existingRow) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(
              value,
              (existingRow as Record<string, unknown>)[key],
            ),
          ),
        );

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getRtcCells(row);
        if (isMappedRowEmpty(cells)) {
          return { skip: true };
        }

        return {
          mapped: {
            branchNo: toBranch(cells.branchNoCell),
            civilV: toNumber(cells.civilVCell),
            civilInC: toNumber(cells.civilInCCell),
            criminalV: toNumber(cells.criminalVCell),
            criminalInC: toNumber(cells.criminalInCCell),
            totalHeard: toNumber(cells.totalHeardCell),
            disposedCivil: toNumber(cells.disposedCivilCell),
            disposedCrim: toNumber(cells.disposedCrimCell),
            summaryProc: toNumber(cells.summaryProcCell),
            casesDisposed: toNumber(cells.casesDisposedCell),
            pdlM: toNumber(cells.pdlMCell),
            pdlF: toNumber(cells.pdlFCell),
            pdlCICL: toNumber(cells.pdlCICLCell),
            pdlTotal: toNumber(cells.pdlTotalCell),
            pdlV: toNumber(cells.pdlVCell),
            pdlInC: toNumber(cells.pdlInCCell),
            pdlBail: toNumber(cells.pdlBailCell),
            pdlRecognizance: toNumber(cells.pdlRecognizanceCell),
            pdlMinRor: toNumber(cells.pdlMinRorCell),
            pdlMaxSentence: toNumber(cells.pdlMaxSentenceCell),
            pdlDismissal: toNumber(cells.pdlDismissalCell),
            pdlAcquittal: toNumber(cells.pdlAcquittalCell),
            pdlMinSentence: toNumber(cells.pdlMinSentenceCell),
            pdlProbation: toNumber(cells.pdlProbationCell),
            ciclM: toNumber(cells.ciclMCell),
            ciclF: toNumber(cells.ciclFCell),
            ciclV: toNumber(cells.ciclVCell),
            ciclInC: toNumber(cells.ciclInCCell),
            fine: toNumber(cells.fineCell),
            total: toNumber(cells.totalCell),
          },
        };
      },
      onBatchInsert: async (rows) => {
        const inserted = await prisma.judgementRegional.createManyAndReturn({
          data: rows.map((row) => ({
            branchNo: row.branchNo ?? undefined,
            civilV: toNumber(row.civilV),
            civilInc: toNumber(row.civilInC),
            criminalV: toNumber(row.criminalV),
            criminalInc: toNumber(row.criminalInC),
            totalHeard: toNumber(row.totalHeard),
            disposedCivil: toNumber(row.disposedCivil),
            disposedCrim: toNumber(row.disposedCrim),
            summaryProc: toNumber(row.summaryProc),
            casesDisposed: toNumber(row.casesDisposed),
            pdlM: toNumber(row.pdlM),
            pdlF: toNumber(row.pdlF),
            pdlCICL: toNumber(row.pdlCICL),
            pdlTotal: toNumber(row.pdlTotal),
            pdlV: toNumber(row.pdlV),
            pdlInc: toNumber(row.pdlInC),
            pdlBail: toNumber(row.pdlBail),
            pdlRecognizance: toNumber(row.pdlRecognizance),
            pdlMinRor: toNumber(row.pdlMinRor),
            pdlMaxSentence: toNumber(row.pdlMaxSentence),
            pdlDismissal: toNumber(row.pdlDismissal),
            pdlAcquittal: toNumber(row.pdlAcquittal),
            pdlMinSentence: toNumber(row.pdlMinSentence),
            pdlProbation: toNumber(row.pdlProbation),
            ciclM: toNumber(row.ciclM),
            ciclF: toNumber(row.ciclF),
            ciclV: toNumber(row.ciclV),
            ciclInc: toNumber(row.ciclInC),
            fine: toNumber(row.fine),
            total: toNumber(row.total),
          })),
        });

        return { ids: inserted.map((item) => item.id), count: inserted.length };
      },
    });

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Regional judgement Excel upload failed:", error);
    return { success: false, error: "Regional judgement Excel upload failed" };
  }
}
