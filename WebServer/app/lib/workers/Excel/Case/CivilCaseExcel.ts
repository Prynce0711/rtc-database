"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  CaseType,
  CivilCaseSchema,
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

export async function uploadCivilCaseExcel(
  file: File,
  overrideDuplicates = false,
  overwriteDuplicates = false,
  validateOnly = false,
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
      console.warn("WARN Unable to preview workbook for logging:", peekError);
    }

    const headerMap = getExcelHeaderMap(CivilCaseSchema);
    const branchHeaders = headerMap.branch ?? ["Branch"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const cells = normalizeRowBySchema(CivilCaseSchema, row);

      const caseNumberRaw = cells.caseNumber?.toString().trim();
      const petitioner = cells.petitioners?.toString().trim().replace(" ", "-");
      const respondent = cells.defendants?.toString().trim().replace(" ", "-");
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

      return {
        ...cells,
        caseNumber,
      };
    };

    const result = await processExcelUpload<CivilCaseSchema>({
      overrideDuplicates,
      overwriteDuplicates,
      validateOnly,
      file,
      requiredHeaders: { Branch: branchHeaders },
      schema: CivilCaseSchema,
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
            caseType: CaseType.CIVIL,
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

        const undocketed = cells.caseNumber
          ?.toString()
          ?.toLocaleLowerCase()
          .includes("undocketed");

        const hydrated = {
          ...cells,
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
      onBatchInsert: async (rows, overwrite) => {
        return prisma.$transaction(async (tx) => {
          if (overwrite) {
            const caseNumbers = rows
              .map((row) => String(row.caseNumber ?? "").trim())
              .filter(Boolean);
            if (caseNumbers.length > 0) {
              await tx.case.deleteMany({
                where: { caseType: CaseType.CIVIL, caseNumber: { in: caseNumbers } },
              });
            }
          }

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
