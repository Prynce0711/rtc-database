"use server";

import ActionResult from "@/app/components/ActionResult";
import { SherriffSchema } from "@/app/components/Case/Sherriff/schema";
import { LogAction, Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  ExportExcelData,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  ProcessExcelMeta,
  processExcelUpload,
  QUERY_CHUNK_SIZE,
  UploadExcelResult,
  valuesAreEqual,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";

const parseDateCell = (value: unknown): Date | undefined => {
  if (value == null || value === "") return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

export async function uploadSherriffExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const candidateCaseNumbers = new Set<string>();

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows =
          XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        for (const row of rows) {
          const normalized = normalizeRowBySchema(SherriffSchema, row);
          const caseNumber = normalized.ejfCaseNumber;
          if (typeof caseNumber !== "string") continue;
          const trimmed = caseNumber.trim();
          if (trimmed) {
            candidateCaseNumbers.add(trimmed);
          }
        }
      }
    } catch (peekError) {
      console.warn(
        "⚠ Unable to preview sheriff workbook for matching:",
        peekError,
      );
    }

    const existingByCaseNumber = new Map<string, Record<string, unknown>[]>();
    const exactMatchCache = new Map<string, boolean>();

    if (candidateCaseNumbers.size > 0) {
      const allCaseNumbers = Array.from(candidateCaseNumbers);

      for (let i = 0; i < allCaseNumbers.length; i += QUERY_CHUNK_SIZE) {
        const caseNumberChunk = allCaseNumbers.slice(i, i + QUERY_CHUNK_SIZE);

        const existingRecords = await prisma.sherriff.findMany({
          where: {
            ejfCaseNumber: {
              in: caseNumberChunk,
            },
          },
        });

        for (const existingRecord of existingRecords) {
          if (!existingRecord.ejfCaseNumber) continue;

          const key = existingRecord.ejfCaseNumber.trim();
          if (!key) continue;

          const bucket = existingByCaseNumber.get(key) ?? [];
          bucket.push(existingRecord as unknown as Record<string, unknown>);
          existingByCaseNumber.set(key, bucket);
        }
      }
    }

    const headerMap = getExcelHeaderMap(SherriffSchema);
    const caseNumberHeaders = headerMap.ejfCaseNumber ?? ["EJF Case Number"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(SherriffSchema, row);
      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      Prisma.SherriffCreateManyInput,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { "EJF Case Number": caseNumberHeaders },
      schema: SherriffSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: [
        "ejfCaseNumber",
        "mortgagee",
        "mortgagor",
        "name",
        "remarks",
      ],
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
          return { exists: cachedResult };
        }

        const caseNumberKey =
          typeof mappedRow.ejfCaseNumber === "string"
            ? mappedRow.ejfCaseNumber.trim()
            : "";

        const candidates = caseNumberKey
          ? (existingByCaseNumber.get(caseNumberKey) ?? [])
          : [];

        const hasExactMatch = candidates.some((existingRecord) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(value, existingRecord[key]),
          ),
        );

        exactMatchCache.set(cacheKey, hasExactMatch);

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);
        if (isMappedRowEmpty(cells, ["date"])) {
          return { skip: true };
        }

        const mapped: Prisma.SherriffCreateManyInput = {
          ejfCaseNumber: cells.ejfCaseNumber
            ? String(cells.ejfCaseNumber)
            : undefined,
          mortgagee: cells.mortgagee ? String(cells.mortgagee) : undefined,
          mortgagor: cells.mortgagor ? String(cells.mortgagor) : undefined,
          name: cells.name ? String(cells.name) : undefined,
          date: parseDateCell(cells.date),
          remarks: cells.remarks ? String(cells.remarks) : undefined,
        };

        const validation = SherriffSchema.safeParse(mapped);
        if (!validation.success) {
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped,
        };
      },
      onBatchInsert: async (rows) => {
        const created = await prisma.sherriff.createManyAndReturn({
          data: rows,
        });
        return {
          ids: created.map((record) => record.id),
          count: created.length,
        };
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const meta: ProcessExcelMeta = result.result?.meta;

    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: meta.importedIds ?? [],
      },
    });

    return {
      success: true,
      result: result.result,
    };
  } catch (error) {
    console.error("Sheriff upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportSherriffExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const records = await prisma.sherriff.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(SherriffSchema);
    const headerKeys = [
      "ejfCaseNumber",
      "date",
      "name",
      "mortgagee",
      "mortgagor",
      "remarks",
    ] as const;
    type HeaderKey = (typeof headerKeys)[number];
    const header = (key: HeaderKey, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = records.map((record) => {
      let dateStr = "";
      let timeStr = "";

      if (record.date) {
        const date = new Date(record.date);
        dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
        timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
      }

      return {
        [header("ejfCaseNumber", "EJF Case Number")]:
          record.ejfCaseNumber ?? "",
        [header("date", "Date")]: dateStr,
        Time: timeStr,
        [header("name", "Name")]: record.name ?? "",
        [header("mortgagee", "Mortgagee")]: record.mortgagee ?? "",
        [header("mortgagor", "Mortgagor")]: record.mortgagor ?? "",
        [header("remarks", "Remarks")]: record.remarks ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheriff");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `sheriff-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Sheriff export error:", error);
    return { success: false, error: "Export failed" };
  }
}
