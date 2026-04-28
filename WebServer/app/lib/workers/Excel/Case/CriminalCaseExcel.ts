"use server";
//make this server-only

import { prisma } from "@/app/lib/prisma";
import {
  getExcelHeaderMap,
  getHeaderRowInfo,
  isMappedRowEmpty,
  normalizeRowBySchema,
  ProcessExcelMeta,
  processExcelUpload,
  QUERY_CHUNK_SIZE,
  UploadExcelResult,
} from "@rtc-database/shared";
import {
  parseCaseNumber,
  syncCaseCounterToAtLeast,
} from "@rtc-database/shared/lib/caseNumbering";

import {
  CriminalImportConflictMode,
  ActionResult,
  CaseType,
  CriminalCaseSchema,
  Prisma,
  splitCaseDataBySchema,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { IS_WORKER } from "../ExcelWorkerUtils";

export async function uploadCriminalCaseExcel(
  file: File,
  conflictMode: CriminalImportConflictMode = "create",
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }
    console.log(`OK Excel file received: ${file.name} (${file.size} bytes)`);

    const headerMap = getExcelHeaderMap(CriminalCaseSchema);
    const branchHeaders = headerMap.branch ?? ["Branch"];
    const nameHeaders = headerMap.name ?? ["Name"];
    const expectedHeaders = [
      ...branchHeaders,
      ...nameHeaders,
      ...Object.values(headerMap).flat(),
    ].filter((value): value is string => typeof value === "string");
    const candidateCaseNumbers = new Set<string>();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    // Peek workbook to log sheet names and pre-collect case numbers for faster exact-match checks.
    try {
      console.log(
        `OK Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const headerInfo = getHeaderRowInfo(worksheet, expectedHeaders);
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          {
            header: headerInfo.headerRow,
            range: headerInfo.headerRowIndex + 1,
            blankrows: false,
            defval: null,
          },
        );

        for (const row of rows) {
          const normalized = normalizeRowBySchema(CriminalCaseSchema, row);
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

    const existingCaseIdByCaseNumber = new Map<string, number>();

    if (candidateCaseNumbers.size > 0) {
      const allCaseNumbers = Array.from(candidateCaseNumbers);

      for (let i = 0; i < allCaseNumbers.length; i += QUERY_CHUNK_SIZE) {
        const caseNumberChunk = allCaseNumbers.slice(i, i + QUERY_CHUNK_SIZE);

        const existingCases = await prisma.case.findMany({
          where: {
            caseType: CaseType.CRIMINAL,
            caseNumber: {
              in: caseNumberChunk,
            },
          },
          orderBy: {
            id: "asc",
          },
          include: {
            criminalCase: true,
          },
        });

        for (const existingCase of existingCases) {
          if (!existingCase.criminalCase || !existingCase.caseNumber) continue;

          const key = existingCase.caseNumber.trim();
          if (!key || existingCaseIdByCaseNumber.has(key)) continue;
          existingCaseIdByCaseNumber.set(key, existingCase.id);
        }
      }
    }

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(CriminalCaseSchema, row);

      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      CriminalCaseSchema,
      ReturnType<typeof getMappedCells>
    >({
      file,
      workbook,
      requiredHeaders: {
        Branch: branchHeaders,
        Name: nameHeaders,
      },
      schema: CriminalCaseSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber", "name"],
      checkExactMatch: async () => ({ exists: false }),
      mapRow: (row) => {
        const cells = getMappedCells(row);

        // Skip rows that have no mapped content beyond the case number (or are entirely empty)
        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const hydrated = {
          ...cells,
          assistantBranch: cells.assistantBranch ?? cells.branch ?? null,
          caseType: CaseType.CRIMINAL,
        };

        const validation = CriminalCaseSchema.safeParse(hydrated);
        if (!validation.success) {
          // console.warn(
          //   "Employee row validation failed:",
          //   prettifyError(validation.error),
          //   { row: cells },
          // );
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
          const rowsToUpdate: Array<{ row: CriminalCaseSchema; caseId: number }> =
            [];
          const rowsToCreate: CriminalCaseSchema[] = [];
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
                caseType: CaseType.CRIMINAL,
                isManual: true,
                number: null,
                area: null,
                year: null,
              } satisfies Prisma.CaseUpdateInput,
            });

            await tx.criminalCase.update({
              where: { baseCaseID: caseId },
              data: detailData as Prisma.CriminalCaseUpdateInput,
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
                  caseType: CaseType.CRIMINAL,
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

            const criminalRows: Prisma.CriminalCaseCreateManyInput[] =
              rowsToCreate.map((row, index) => {
                const { detailData } = splitCaseDataBySchema(row);
                return {
                  ...(detailData as Prisma.CriminalCaseCreateWithoutCaseInput),
                  baseCaseID: created[index].id,
                };
              });

            if (criminalRows.length > 0) {
              await tx.criminalCase.createMany({ data: criminalRows });
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

          const maxPerBucket = new Map<
            string,
            { area: string; year: number; number: number }
          >();

          rows.forEach((row) => {
            const parsed = parseCaseNumber(String(row.caseNumber ?? ""));
            if (!parsed) return;

            const key = `${CaseType.CRIMINAL}|${parsed.area}|${parsed.year}`;
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
              CaseType.CRIMINAL,
              bucket.area,
              bucket.year,
              bucket.number,
            );
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
        sheets.forEach(
          (s: {
            sheet: string;
            valid: number;
            rows: number;
            failed: number;
          }) => {
            console.log(
              `  SHEET "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
            );
          },
        );
      }

      if (result.result?.failedExcel) {
        console.log(
          "WARN Failed rows file generated:",
          result.result.failedExcel.fileName,
        );
      }
    } else {
      console.error("FAILED Import failed:", result.error);
    }

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
