"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseImportConflictMode,
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
} from "@rtc-database/shared";
import {
  parseSheriffCaseNumber,
  syncSheriffCaseCounterToAtLeast,
} from "@rtc-database/shared/lib/caseNumbering";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { IS_WORKER } from "../ExcelWorkerUtils";

export async function uploadSheriffCaseExcel(
  file: File,
  conflictMode: CaseImportConflictMode = "create",
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

    const existingCaseIdByCaseNumber = new Map<string, number>();

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
          orderBy: {
            id: "asc",
          },
          include: {
            sheriffCase: true,
          },
        });

        for (const existingCase of existingCases) {
          if (!existingCase.sheriffCase || !existingCase.caseNumber) continue;

          const key = existingCase.caseNumber.trim();
          if (!key || existingCaseIdByCaseNumber.has(key)) continue;
          existingCaseIdByCaseNumber.set(key, existingCase.id);
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
      checkExactMatch: async () => ({ exists: false }),
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
          const rowsToUpdate: Array<{ row: SheriffCaseSchema; caseId: number }> =
            [];
          const rowsToCreate: SheriffCaseSchema[] = [];
          const pendingCreateIndexByCaseNumber =
            conflictMode === "update-existing"
              ? new Map<string, number>()
              : null;

          rows.forEach((row) => {
            const caseNumber = String(row.caseNumber ?? "").trim();
            const existingCaseId =
              conflictMode === "update-existing"
                ? existingCaseIdByCaseNumber.get(caseNumber)
                : undefined;

            if (existingCaseId) {
              rowsToUpdate.push({ row, caseId: existingCaseId });
              return;
            }

            if (
              conflictMode === "update-existing" &&
              pendingCreateIndexByCaseNumber &&
              caseNumber
            ) {
              const pendingIndex =
                pendingCreateIndexByCaseNumber.get(caseNumber);
              if (pendingIndex !== undefined) {
                rowsToCreate[pendingIndex] = row;
                return;
              }

              pendingCreateIndexByCaseNumber.set(
                caseNumber,
                rowsToCreate.length,
              );
            }

            rowsToCreate.push(row);
          });

          const affectedIds: number[] = [];
          let createdCount = 0;
          let updatedCount = 0;

          for (const { row, caseId } of rowsToUpdate) {
            const { caseData, detailData } = splitCaseDataBySchema(row);
            const caseNumber = String(caseData.caseNumber ?? "").trim();

            await tx.case.update({
              where: { id: caseId },
              data: {
                ...caseData,
                caseNumber,
                caseType: CaseType.SHERRIFF,
                isManual: true,
                number: null,
                area: null,
                year: null,
              } satisfies Prisma.CaseUpdateInput,
            });

            await tx.sheriffCase.update({
              where: { baseCaseID: caseId },
              data: detailData as Prisma.SheriffCaseUpdateInput,
            });

            affectedIds.push(caseId);
            updatedCount += 1;
          }

          if (rowsToCreate.length > 0) {
            const caseRows: Prisma.CaseCreateManyInput[] = rowsToCreate.map(
              (row) => {
                const { caseData } = splitCaseDataBySchema(row);
                return {
                  ...caseData,
                  caseNumber: String(caseData.caseNumber ?? "").trim(),
                  caseType: CaseType.SHERRIFF,
                  isManual: true,
                  number: null,
                  area: null,
                  year: null,
                };
              },
            );

            const created = await tx.case.createManyAndReturn({
              data: caseRows,
            });

            const sheriffRows: Prisma.SheriffCaseCreateManyInput[] =
              rowsToCreate.map((row, index) => {
                const { detailData } = splitCaseDataBySchema(row);
                return {
                  ...(detailData as Prisma.SheriffCaseCreateWithoutCaseInput),
                  baseCaseID: created[index].id,
                };
              });

            if (sheriffRows.length > 0) {
              await tx.sheriffCase.createMany({ data: sheriffRows });
            }

            if (conflictMode === "update-existing") {
              rowsToCreate.forEach((row, index) => {
                const caseNumber = String(row.caseNumber ?? "").trim();
                const createdCase = created[index];
                if (!caseNumber || !createdCase) return;
                existingCaseIdByCaseNumber.set(caseNumber, createdCase.id);
              });
            }

            affectedIds.push(...created.map((item) => item.id));
            createdCount = created.length;
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

          return {
            ids: Array.from(new Set(affectedIds)),
            count: createdCount + updatedCount,
            createdCount,
            updatedCount,
          };
        });
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      const imported = meta.importedCount;
      const created = meta.createdCount ?? 0;
      const updated = meta.updatedCount ?? 0;
      const errors = meta.errorCount;
      const sheets = meta.sheetSummary;

      console.log(
        `OK Import completed: ${imported} row(s) processed (${created} created, ${updated} updated), ${errors} row(s) failed validation`,
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
