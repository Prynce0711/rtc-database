"use server";

import {
  extractCommissionYears,
  getCommissionYearLabel,
  normalizeCommissionText,
  normalizePetitionNumber,
  NotarialCommissionSchema,
} from "@/app/components/NotarialCommission/schema";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  ProcessExcelMeta,
  UploadExcelResult,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  processExcelUpload,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { IS_WORKER } from "../ExcelWorkerUtils";

const toCellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
};

const getWorkbookCommissionYears = (
  workbook: XLSX.WorkBook,
  fileName: string,
) => {
  const candidates: string[] = [fileName];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      range: 0,
      blankrows: false,
    }) as unknown[][];

    rows.slice(0, 12).forEach((row) => {
      const cells = row.map(toCellText).filter((value) => value.length > 0);
      if (cells.length > 0) {
        candidates.push(cells.join(" "));
        candidates.push(...cells);
      }
    });
  });

  for (const candidate of candidates) {
    const years = extractCommissionYears(candidate);
    if (years.termStartYear || years.termEndYear) {
      return years;
    }
  }

  return {};
};

export async function uploadNotarialCommissionExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }

    console.log(
      `OK Notarial commission Excel file received: ${file.name} (${file.size} bytes)`,
    );

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    console.log(
      `OK Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
    );

    const workbookYears = getWorkbookCommissionYears(workbook, file.name);
    const workbookTermLabel =
      workbookYears.termStartYear || workbookYears.termEndYear
        ? getCommissionYearLabel(
            workbookYears.termStartYear,
            workbookYears.termEndYear,
          )
        : undefined;

    const headerMap = getExcelHeaderMap(NotarialCommissionSchema);
    const petitionHeaders = headerMap.petition ?? ["Petition"];
    const nameHeaders = headerMap.name ?? ["Name"];
    const termHeaders = headerMap.termOfCommission ?? ["Term of Commission"];
    const addressHeaders = headerMap.address ?? ["Address"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(NotarialCommissionSchema, row);
      const rawPetition = normalizePetitionNumber(
        values.petition ? String(values.petition) : undefined,
      );
      const rawName = normalizeCommissionText(
        values.name ? String(values.name) : undefined,
      );
      const rawTerm = normalizeCommissionText(
        values.termOfCommission
          ? String(values.termOfCommission)
          : undefined,
      );
      const rawAddress = normalizeCommissionText(
        values.address ? String(values.address) : undefined,
      );
      const hasVisibleContent = [
        rawPetition,
        rawName,
        rawTerm,
        rawAddress,
      ].some((value) => value.length > 0);
      const termOfCommission =
        rawTerm || (hasVisibleContent ? workbookTermLabel : undefined);
      const detectedYears = extractCommissionYears(
        termOfCommission,
        hasVisibleContent ? workbookTermLabel : undefined,
        hasVisibleContent ? file.name : undefined,
      );

      return {
        petition: rawPetition,
        name: rawName,
        termOfCommission,
        address: rawAddress,
        termStartYear: detectedYears.termStartYear,
        termEndYear: detectedYears.termEndYear,
      };
    };

    const result = await processExcelUpload<NotarialCommissionSchema>({
      file,
      workbook,
      requiredHeaders: {
        Petition: petitionHeaders,
        Name: nameHeaders,
        "Term of Commission": termHeaders,
        Address: addressHeaders,
      },
      getCells: getMappedCells,
      schema: NotarialCommissionSchema,
      skipRowsWithoutCell: ["termStartYear", "termEndYear"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existing = await prisma.notarialCommission.findFirst({
          where: {
            petition: mappedRow.petition,
            name: mappedRow.name,
            termOfCommission: mappedRow.termOfCommission,
            address: mappedRow.address,
          },
          select: { id: true },
        });

        return {
          exists: !!existing,
          fields: ["petition", "name", "termOfCommission", "address"],
        };
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);
        if (isMappedRowEmpty(cells, ["termStartYear", "termEndYear"])) {
          return { skip: true };
        }

        const validation = NotarialCommissionSchema.safeParse(cells);
        if (!validation.success) {
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped: validation.data,
          uniqueKey: [
            validation.data.petition,
            validation.data.name,
            validation.data.termOfCommission,
            validation.data.address,
          ].join("|"),
        };
      },
      onBatchInsert: async (rows) => {
        const created = await prisma.notarialCommission.createManyAndReturn({
          data: rows.map((row) => ({
            petition: row.petition,
            name: row.name,
            termOfCommission: row.termOfCommission,
            address: row.address,
            termStartYear: row.termStartYear,
            termEndYear: row.termEndYear,
          })),
        });
        return {
          ids: created.map((record) => record.id),
          count: created.length,
        };
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      console.log(
        `OK Import completed: ${meta.importedCount} notarial commission row(s) imported, ${meta.errorCount} row(s) failed validation`,
      );

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
    console.error("Notarial commission upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
