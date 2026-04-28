"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseImportConflictMode,
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
  conflictMode: CaseImportConflictMode = "create",
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    console.log(`OK Excel file received: ${file.name} (${file.size} bytes)`);

    const headerMap = getExcelHeaderMap(CivilCaseSchema);
    const branchHeaders = headerMap.branch ?? ["Branch"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(CivilCaseSchema, row);
      return {
        ...values,
      };
    };

    const getCaseNumberKey = (
      cells: ReturnType<typeof getMappedCells>,
    ): string | undefined => {
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

      return caseNumber || undefined;
    };

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
          const caseNumber = getCaseNumberKey(getMappedCells(row));
          if (caseNumber) {
            candidateCaseNumbers.add(caseNumber);
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
            caseType: CaseType.CIVIL,
            caseNumber: {
              in: caseNumberChunk,
            },
          },
          orderBy: {
            id: "asc",
          },
          include: {
            civilCase: true,
          },
        });

        for (const existingCase of existingCases) {
          if (!existingCase.civilCase || !existingCase.caseNumber) continue;

          const key = existingCase.caseNumber.trim();
          if (!key || existingCaseIdByCaseNumber.has(key)) continue;
          existingCaseIdByCaseNumber.set(key, existingCase.id);
        }
      }
    }

    const result = await processExcelUpload<CivilCaseSchema>({
      file,
      requiredHeaders: { Branch: branchHeaders },
      schema: CivilCaseSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber"],
      checkExactMatch: async () => ({ exists: false }),
      mapRow: (row) => {
        const cells = getMappedCells(row);

        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const caseNumber = getCaseNumberKey(cells);
        const undocketed = caseNumber?.toLocaleLowerCase().includes(
          "undocketed",
        );

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
          const rowsToUpdate: Array<{ row: CivilCaseSchema; caseId: number }> =
            [];
          const rowsToCreate: CivilCaseSchema[] = [];
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
                caseType: CaseType.CIVIL,
                isManual: true,
                number: null,
                area: null,
                year: null,
              } satisfies Prisma.CaseUpdateInput,
            });

            await tx.civilCase.update({
              where: { baseCaseID: caseId },
              data: detailData as Prisma.CivilCaseUpdateInput,
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
                  caseType: CaseType.CIVIL,
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

            const civilRows: Prisma.CivilCaseCreateManyInput[] =
              rowsToCreate.map((row, index) => {
                const { detailData } = splitCaseDataBySchema(row);
                return {
                  ...(detailData as Prisma.CivilCaseCreateWithoutCaseInput),
                  baseCaseID: created[index].id,
                };
              });

            if (civilRows.length > 0) {
              await tx.civilCase.createMany({ data: civilRows });
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
    console.error("Upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
