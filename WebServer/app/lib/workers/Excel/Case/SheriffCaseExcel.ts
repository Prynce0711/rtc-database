"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseType,
  Prisma,
  ProcessExcelMeta,
  QUERY_CHUNK_SIZE,
  SheriffCaseSchema,
  UploadExcelResult,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  processExcelUpload,
  splitCaseDataBySchema,
  valuesAreEqual,
} from "@rtc-database/shared";
import {
  parseSheriffCaseNumber,
  syncSheriffCaseCounterToAtLeast,
} from "@rtc-database/shared/lib/caseNumbering";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";

export async function uploadSheriffCaseExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
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
          const normalized = normalizeRowBySchema(SheriffCaseSchema, row);
          const caseNumber = normalized.caseNumber;
          if (typeof caseNumber !== "string") continue;
          const trimmed = caseNumber.trim();
          if (trimmed) {
            candidateCaseNumbers.add(trimmed);
          }
        }
      }
    } catch (peekError) {
      console.warn(
        "WARN Unable to preview sheriff workbook for matching:",
        peekError,
      );
    }

    const existingByCaseNumber = new Map<string, Record<string, unknown>[]>();
    const exactMatchCache = new Map<string, boolean>();

    if (candidateCaseNumbers.size > 0) {
      const allCaseNumbers = Array.from(candidateCaseNumbers);

      for (let i = 0; i < allCaseNumbers.length; i += QUERY_CHUNK_SIZE) {
        const caseNumberChunk = allCaseNumbers.slice(i, i + QUERY_CHUNK_SIZE);

        const existingCases = await prisma.case.findMany({
          where: {
            caseType: CaseType.SHERRIFF,
            caseNumber: {
              in: caseNumberChunk,
            },
          },
          include: {
            sheriffCase: true,
          },
        });

        for (const existingCase of existingCases) {
          if (!existingCase.sheriffCase || !existingCase.caseNumber) continue;

          const key = existingCase.caseNumber.trim();
          if (!key) continue;

          const mergedCase = {
            ...existingCase,
            ...existingCase.sheriffCase,
          } as Record<string, unknown>;

          const bucket = existingByCaseNumber.get(key) ?? [];
          bucket.push(mergedCase);
          existingByCaseNumber.set(key, bucket);
        }
      }
    }

    const headerMap = getExcelHeaderMap(SheriffCaseSchema);
    const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(SheriffCaseSchema, row);
      return {
        ...values,
      };
    };

    const result = await processExcelUpload<SheriffCaseSchema>({
      file,
      requiredHeaders: { "Case Number": caseNumberHeaders },
      schema: SheriffCaseSchema,
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

        const hydrated = {
          ...cells,
          caseType: CaseType.SHERRIFF,
        };

        const validation = SheriffCaseSchema.safeParse(hydrated);
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
              caseType: CaseType.SHERRIFF,
              isManual: true,
              number: null,
              area: null,
              year: null,
            });
          });

          const created = await tx.case.createManyAndReturn({
            data: caseRows,
          });

          const sheriffRows: Prisma.SheriffCaseCreateManyInput[] = rows.map(
            (row, index) => {
              const { detailData } = splitCaseDataBySchema(row);
              return {
                ...(detailData as Prisma.SheriffCaseCreateWithoutCaseInput),
                baseCaseID: created[index].id,
              };
            },
          );

          if (sheriffRows.length > 0) {
            await tx.sheriffCase.createMany({ data: sheriffRows });
          }

          const maxPerYear = new Map<number, number>();

          rows.forEach((row) => {
            const parsed = parseSheriffCaseNumber(String(row.caseNumber ?? ""));
            if (!parsed) return;

            const current = maxPerYear.get(parsed.year);
            if (!current || parsed.number > current) {
              maxPerYear.set(parsed.year, parsed.number);
            }
          });

          for (const [year, number] of maxPerYear.entries()) {
            await syncSheriffCaseCounterToAtLeast(tx, year, number);
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
        `OK Import completed: ${imported} sheriff cases imported, ${errors} row(s) failed validation`,
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
    console.error("Sheriff upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
