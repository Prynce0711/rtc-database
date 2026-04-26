"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseType,
  PetitionCaseSchema,
  Prisma,
  ProcessExcelMeta,
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

export async function uploadPetitionCaseExcel(
  file: File,
  overrideDuplicates = false,
  overwriteDuplicates = false,
  allowInFileDuplicates = false,
  validateOnly = false,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    console.log(
      `OK Petition Excel file received: ${file.name} (${file.size} bytes)`,
    );

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `OK Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );
    } catch (peekError) {
      console.warn("WARN Unable to preview workbook for logging:", peekError);
    }

    const headerMap = getExcelHeaderMap(PetitionCaseSchema);
    const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(PetitionCaseSchema, row);

      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      PetitionCaseSchema,
      ReturnType<typeof getMappedCells>
    >({
      overrideDuplicates,
      overwriteDuplicates,
      allowInFileDuplicates,
      validateOnly,
      file,
      requiredHeaders: { "Case Number": caseNumberHeaders },
      schema: PetitionCaseSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber"],
      uniqueKeys: ["caseNumber"],
      checkExistingUniqueKeys: async (keys) => {
        const normalizedKeys = Array.from(
          new Set(
            keys.map((key) => key.trim()).filter((key) => key.length > 0),
          ),
        );

        if (normalizedKeys.length === 0) {
          return new Set<string>();
        }

        const existing = await prisma.case.findMany({
          where: {
            caseType: CaseType.PETITION,
            caseNumber: { in: normalizedKeys },
          },
          select: {
            caseNumber: true,
          },
        });

        return new Set(
          existing
            .map((c) => c.caseNumber?.trim())
            .filter((value): value is string => !!value),
        );
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);

        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const hydrated = {
          ...cells,
          caseType: CaseType.PETITION,
          dateFiled: cells.dateFiled ?? cells.date ?? null,
          branch: cells.branch ?? cells.raffledTo ?? null,
          assistantBranch:
            cells.assistantBranch ?? cells.raffledTo ?? cells.branch ?? null,
        };

        const validation = PetitionCaseSchema.safeParse(hydrated);
        if (!validation.success) {
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped: validation.data,
        };
      },
      onBatchInsert: async (rows, overwrite) => {
        return prisma.$transaction(async (tx) => {
          if (overwrite) {
            const caseNumbers = rows
              .map((row) => String(row.caseNumber ?? "").trim())
              .filter(Boolean);
            if (caseNumbers.length > 0) {
              await tx.case.deleteMany({
                where: { caseType: CaseType.PETITION, caseNumber: { in: caseNumbers } },
              });
            }
          }

          const caseRows: Prisma.CaseCreateManyInput[] = [];

          rows.forEach((row) => {
            const { caseData } = splitCaseDataBySchema(row);
            caseRows.push({
              ...caseData,
              caseType: CaseType.PETITION,
              isManual: true,
              number: null,
              area: null,
              year: null,
            });
          });

          const created = await tx.case.createManyAndReturn({
            data: caseRows,
          });

          const petitionRows: Prisma.PetitionCreateManyInput[] = rows.map(
            (row, index) => {
              const { detailData } = splitCaseDataBySchema(row);
              return {
                ...(detailData as Prisma.PetitionCreateWithoutCaseInput),
                baseCaseID: created[index].id,
              };
            },
          );

          if (petitionRows.length > 0) {
            await tx.petition.createMany({ data: petitionRows });
          }

          const maxPerBucket = new Map<
            string,
            { area: string; year: number; number: number }
          >();

          rows.forEach((row) => {
            const parsed = parseCaseNumber(String(row.caseNumber ?? ""));
            if (!parsed) return;

            const key = `${CaseType.PETITION}|${parsed.area}|${parsed.year}`;
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
              CaseType.PETITION,
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
        `OK Import completed: ${imported} petitions imported, ${errors} row(s) failed validation`,
      );
      if (sheets.length > 0) {
        sheets.forEach((s) => {
          console.log(
            `  SHEET "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
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
      console.error("FAILED Import failed:", result.error);
    }

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Petition upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
