"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseType,
  Prisma,
  ProcessExcelMeta,
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
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    console.log(`OK Excel file received: ${file.name} (${file.size} bytes)`);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `OK Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );
    } catch (peekError) {
      console.warn(
        "WARN Unable to preview sheriff workbook for matching:",
        peekError,
      );
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
            caseType: CaseType.SHERRIFF,
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
