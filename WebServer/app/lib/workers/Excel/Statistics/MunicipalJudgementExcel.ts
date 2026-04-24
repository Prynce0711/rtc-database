"use server";

import {
  MTCJudgementRow,
  MTCJudgementRowSchema,
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

export async function uploadMunicipalJudgementExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    const result = await processExcelUpload<
      MTCJudgementRow,
      ReturnType<typeof getMtcCells>
    >({
      file,
      requiredHeaders: {
        "Branch No": ["Branches No.", "Branch No", "Branch"],
      },
      getCells: getMtcCells,
      schema: MTCJudgementRowSchema,
      skipRowsWithoutCell: ["branchNoCell"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingRows = await prisma.judgementMunicipal.findMany({
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
        const cells = getMtcCells(row);
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
            totalDisposed: toNumber(cells.totalDisposedCell),
            pdlM: toNumber(cells.pdlMCell),
            pdlF: toNumber(cells.pdlFCell),
            pdlTotal: toNumber(cells.pdlTotalCell),
            pdlV: toNumber(cells.pdlVCell),
            pdlI: toNumber(cells.pdlICell),
            pdlBail: toNumber(cells.pdlBailCell),
            pdlRecognizance: toNumber(cells.pdlRecognizanceCell),
            pdlMinRor: toNumber(cells.pdlMinRorCell),
            pdlMaxSentence: toNumber(cells.pdlMaxSentenceCell),
            pdlDismissal: toNumber(cells.pdlDismissalCell),
            pdlAcquittal: toNumber(cells.pdlAcquittalCell),
            pdlMinSentence: toNumber(cells.pdlMinSentenceCell),
            pdlOthers: toNumber(cells.pdlOthersCell),
            total: toNumber(cells.totalCell),
          },
        };
      },
      onBatchInsert: async (rows) => {
        const inserted = await prisma.judgementMunicipal.createManyAndReturn({
          data: rows.map((row) => ({
            branchNo: row.branchNo ?? undefined,
            civilV: toNumber(row.civilV),
            civilInc: toNumber(row.civilInC),
            criminalV: toNumber(row.criminalV),
            criminalInc: toNumber(row.criminalInC),
            totalHeard: toNumber(row.totalHeard),
            disposedCivil: toNumber(row.disposedCivil),
            disposedCrim: toNumber(row.disposedCrim),
            totalDisposed: toNumber(row.totalDisposed),
            pdlM: toNumber(row.pdlM),
            pdlF: toNumber(row.pdlF),
            pdlTotal: toNumber(row.pdlTotal),
            pdlV: toNumber(row.pdlV),
            pdlI: toNumber(row.pdlI),
            pdlBail: toNumber(row.pdlBail),
            pdlRecognizance: toNumber(row.pdlRecognizance),
            pdlMinRor: toNumber(row.pdlMinRor),
            pdlMaxSentence: toNumber(row.pdlMaxSentence),
            pdlDismissal: toNumber(row.pdlDismissal),
            pdlAcquittal: toNumber(row.pdlAcquittal),
            pdlMinSentence: toNumber(row.pdlMinSentence),
            pdlOthers: toNumber(row.pdlOthers),
            total: toNumber(row.total),
          })),
        });

        return { ids: inserted.map((item) => item.id), count: inserted.length };
      },
    });

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Municipal judgement Excel upload failed:", error);
    return { success: false, error: "Municipal judgement Excel upload failed" };
  }
}
