"use server";

import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  ProcessExcelMeta,
  QUERY_CHUNK_SIZE,
  ReceivingLogSchema,
  UploadExcelResult,
  findColumnValue,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  processExcelUpload,
  valuesAreEqual,
} from "@rtc-database/shared";
import { Prisma } from "@rtc-database/shared/prisma/client";
import { CaseType } from "@rtc-database/shared/prisma/enums";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { IS_WORKER } from "../ExcelWorkerUtils";

const parseTime = (
  timeStr: string,
): { hours: number; minutes: number; seconds: number } | null => {
  if (!timeStr) return null;

  const str = timeStr.toString().trim();
  const timeRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[AaPp][Mm])?/;
  const match = str.match(timeRegex);

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const ampm = match[4]?.trim().toUpperCase();

  if (ampm) {
    if (ampm === "PM" && hours !== 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }
  }

  return { hours, minutes, seconds };
};

const convertCaseType = (abbreviation: string | undefined): CaseType => {
  if (!abbreviation) return CaseType.UNKNOWN;

  const abbrev = abbreviation.toString().toUpperCase().trim();
  const caseTypeMap: Record<string, CaseType> = {
    CC: CaseType.CRIMINAL,
    CVC: CaseType.CIVIL,
    LRC: CaseType.LAND_REGISTRATION_CASE,
    P: CaseType.PETITION,
  };

  return caseTypeMap[abbrev] || CaseType.UNKNOWN;
};

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

export async function uploadReceivingLogExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    if (!IS_WORKER) {
      throw new Error("Cannot execute on non-worker");
    }
    const candidateCaseNumbers = new Set<string>();

    console.log(
      `OK Receiving Log Excel file received: ${file.name} (${file.size} bytes)`,
    );
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
          const normalized = normalizeRowBySchema(ReceivingLogSchema, row);
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

        const existingLogs = await prisma.recievingLog.findMany({
          where: {
            caseNumber: {
              in: caseNumberChunk,
            },
          },
        });

        for (const existingLog of existingLogs) {
          if (!existingLog.caseNumber) continue;

          const key = existingLog.caseNumber.trim();
          if (!key) continue;

          const bucket = existingByCaseNumber.get(key) ?? [];
          bucket.push(existingLog as unknown as Record<string, unknown>);
          existingByCaseNumber.set(key, bucket);
        }
      }
    }

    const headerMap = getExcelHeaderMap(ReceivingLogSchema);
    const caseNumberHeaders = headerMap.caseNumber ?? ["Case no."];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(ReceivingLogSchema, row);
      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      Prisma.RecievingLogCreateManyInput,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { "Case no.": caseNumberHeaders },
      schema: ReceivingLogSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: [
        "bookAndPage",
        "caseNumber",
        "content",
        "branchNumber",
        "notes",
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
          typeof mappedRow.caseNumber === "string"
            ? mappedRow.caseNumber.trim()
            : "";

        const candidates = caseNumberKey
          ? (existingByCaseNumber.get(caseNumberKey) ?? [])
          : [];

        const hasExactMatch = candidates.some((existingLog) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(value, existingLog[key]),
          ),
        );

        exactMatchCache.set(cacheKey, hasExactMatch);

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);
        if (isMappedRowEmpty(cells, ["caseType", "dateRecieved"])) {
          return { skip: true };
        }

        const rawCaseType = findColumnValue(
          row,
          headerMap.caseType ?? ["Abbreviation", "Case Type"],
        );
        const rawTime = findColumnValue(row, ["Time", "TIME"]);

        const dateRecieved = parseDateCell(cells.dateRecieved);
        if (dateRecieved && rawTime) {
          const timeData = parseTime(String(rawTime));
          if (timeData) {
            dateRecieved.setHours(
              timeData.hours,
              timeData.minutes,
              timeData.seconds,
              0,
            );
          }
        }

        const mapped: Prisma.RecievingLogCreateManyInput = {
          bookAndPage: cells.bookAndPage
            ? String(cells.bookAndPage)
            : undefined,
          dateRecieved,
          caseType: convertCaseType(
            typeof rawCaseType === "string"
              ? rawCaseType
              : typeof cells.caseType === "string"
                ? cells.caseType
                : undefined,
          ),
          caseNumber: cells.caseNumber ? String(cells.caseNumber) : undefined,
          content: cells.content ? String(cells.content) : undefined,
          branchNumber: cells.branchNumber
            ? String(cells.branchNumber)
            : undefined,
          notes: cells.notes ? String(cells.notes) : undefined,
        };

        const validation = ReceivingLogSchema.safeParse(mapped);
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
        const created = await prisma.recievingLog.createManyAndReturn({
          data: rows,
        });
        return { ids: created.map((log) => log.id), count: created.length };
      },
    });

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const meta: ProcessExcelMeta = result.result?.meta;
    const imported = meta.importedCount;
    const errors = meta.errorCount;
    const sheets = meta.sheetSummary;

    console.log(
      `OK Import completed: ${imported} receiving logs imported, ${errors} row(s) failed validation`,
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

    return {
      success: true,
      result: result.result,
    };
  } catch (error) {
    console.error("Receiving Log upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}
