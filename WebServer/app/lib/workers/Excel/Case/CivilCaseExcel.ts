"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseType,
  CivilCaseSchema,
  Prisma,
  ProcessExcelMeta,
  QUERY_CHUNK_SIZE,
  UploadExcelResult,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  processExcelUpload,
  splitCaseDataBySchema,
  valuesAreEqual,
} from "@rtc-database/shared";
import {
  parseCaseNumber,
  syncCaseCounterToAtLeast,
} from "@rtc-database/shared/lib/caseNumbering";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { IS_WORKER } from "../ExcelWorkerUtils";

export async function uploadCivilCaseExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    console.log(`OK Excel file received: ${file.name} (${file.size} bytes)`);

    const candidateCaseNumbers = new Set<string>();

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `OK Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows =
          XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        for (const row of rows) {
          const normalized = normalizeRowBySchema(CivilCaseSchema, row);
          const caseNumber = normalized.caseNumber;
          if (typeof caseNumber !== "string") continue;
          const trimmed = caseNumber.trim();
          if (trimmed) {
            candidateCaseNumbers.add(trimmed);
          }
        }
      }
    } catch (peekError) {
      console.warn("WARN Unable to preview workbook for logging:", peekError);
    }

    const existingByCaseNumber = new Map<string, Record<string, unknown>[]>();
    const exactMatchCache = new Map<string, boolean>();

    if (candidateCaseNumbers.size > 0) {
      const allCaseNumbers = Array.from(candidateCaseNumbers);

      for (let i = 0; i < allCaseNumbers.length; i += QUERY_CHUNK_SIZE) {
        const caseNumberChunk = allCaseNumbers.slice(i, i + QUERY_CHUNK_SIZE);

        const existingCases = await prisma.case.findMany({
          where: {
            caseType: CaseType.CIVIL,
            caseNumber: {
              in: caseNumberChunk,
            },
          },
          include: {
            civilCase: true,
          },
        });

        for (const existingCase of existingCases) {
          if (!existingCase.civilCase || !existingCase.caseNumber) continue;

          const key = existingCase.caseNumber.trim();
          if (!key) continue;

          const mergedCase = {
            ...existingCase,
            ...existingCase.civilCase,
          } as Record<string, unknown>;

          const bucket = existingByCaseNumber.get(key) ?? [];
          bucket.push(mergedCase);
          existingByCaseNumber.set(key, bucket);
        }
      }
    }

    const headerMap = getExcelHeaderMap(CivilCaseSchema);
    const branchHeaders = headerMap.branch ?? ["Branch"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(CivilCaseSchema, row);
      return {
        ...values,
      };
    };

    const result = await processExcelUpload<CivilCaseSchema>({
      file,
      requiredHeaders: { Branch: branchHeaders },
      schema: CivilCaseSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber"],
      checkExactMatch: async (_cells, mappedRow) => {
        const mappedEntries = Object.entries(mappedRow);

        const cacheKey = JSON.stringify(
          mappedEntries
            .slice()
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [
              key,
              value instanceof Date
                ? value.getTime()
                : typeof value === "string"
                  ? value.trim()
                  : (value ?? null),
            ]),
        );

        const cachedResult = exactMatchCache.get(cacheKey);
        if (cachedResult !== undefined) {
          return {
            exists: cachedResult,
            fields: cachedResult ? mappedEntries.map(([key]) => key) : [],
          };
        }

        const caseNumberKey =
          typeof mappedRow.caseNumber === "string"
            ? mappedRow.caseNumber.trim()
            : "";

        const candidates = caseNumberKey
          ? (existingByCaseNumber.get(caseNumberKey) ?? [])
          : [];

        const hasExactMatch = candidates.some((existingRow) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(value, existingRow[key]),
          ),
        );

        exactMatchCache.set(cacheKey, hasExactMatch);

        return {
          exists: hasExactMatch,
          fields: hasExactMatch ? mappedEntries.map(([key]) => key) : [],
        };
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);

        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const caseNumberRaw = cells.caseNumber?.toString().trim();
        const petitioner = cells.petitioners
          ?.toString()
          .trim()
          .replace(" ", "-");
        const respondent = cells.defendants
          ?.toString()
          .trim()
          .replace(" ", "-");
        const dateFiled =
          cells.dateFiled instanceof Date || typeof cells.dateFiled === "string"
            ? new Date(cells.dateFiled)
            : null;

        const caseNumber = cells.caseNumber
          ?.toString()
          .trim()
          ?.toLowerCase()
          .includes("undocketed")
          ? caseNumberRaw +
            `${petitioner ? "-" + petitioner : ""}-${respondent ? "-" + respondent : ""}-${dateFiled?.getTime() ?? "nofiledate"}`
          : caseNumberRaw;

        const undocketed = caseNumber
          ?.toLocaleLowerCase()
          .includes("undocketed");

        const hydrated = {
          ...cells,
          caseNumber,
          assistantBranch: cells.assistantBranch ?? cells.branch ?? null,
          caseType: CaseType.CIVIL,
          undocketed,
        };

        const validation = CivilCaseSchema.safeParse(hydrated);
        if (!validation.success) {
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped: validation.data,
        };
      },
      onBatchInsert: async (rows) => {
        return prisma.$transaction(async (tx) => {
          const caseRows: Prisma.CaseCreateManyInput[] = [];

          rows.forEach((row) => {
            const { caseData } = splitCaseDataBySchema(row);
            caseRows.push({
              ...caseData,
              caseType: CaseType.CIVIL,
              isManual: true,
              number: null,
              area: null,
              year: null,
            });
          });

          const created = await tx.case.createManyAndReturn({
            data: caseRows,
          });

          const civilRows: Prisma.CivilCaseCreateManyInput[] = rows.map(
            (row, index) => {
              const { detailData } = splitCaseDataBySchema(row);
              return {
                ...(detailData as Prisma.CivilCaseCreateWithoutCaseInput),
                baseCaseID: created[index].id,
              };
            },
          );

          if (civilRows.length > 0) {
            await tx.civilCase.createMany({ data: civilRows });
          }

          const maxPerBucket = new Map<
            string,
            { area: string; year: number; number: number }
          >();

          rows.forEach((row) => {
            const parsed = parseCaseNumber(String(row.caseNumber ?? ""));
            if (!parsed) return;

            const key = `${CaseType.CIVIL}|${parsed.area}|${parsed.year}`;
            const current = maxPerBucket.get(key);
            if (!current || parsed.number > current.number) {
              maxPerBucket.set(key, {
                area: parsed.area,
                year: parsed.year,
                number: parsed.number,
              });
            }
          });

          for (const bucket of maxPerBucket.values()) {
            await syncCaseCounterToAtLeast(
              tx,
              CaseType.CIVIL,
              bucket.area,
              bucket.year,
              bucket.number,
            );
          }

          return { ids: created.map((c) => c.id), count: created.length };
        });
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      const imported = meta.importedCount;
      const errors = meta.errorCount;
      const sheets = meta.sheetSummary;

      console.log(
        `OK Import completed: ${imported} cases imported, ${errors} row(s) failed validation`,
      );
      if (sheets.length > 0) {
        sheets.forEach((s) => {
          console.log(
            `  Sheet "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
          );
        });
      }

      if (result.result?.failedExcel) {
        console.log(
          "WARN Failed rows file generated:",
          result.result.failedExcel.fileName,
        );
      }
    } else {
      console.error("ERROR Import failed:", result.error);
    }

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
