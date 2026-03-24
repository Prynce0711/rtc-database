"use server";

import ActionResult from "@/app/components/ActionResult";
import { ReceivingLogSchema } from "@/app/components/Case/ReceivingLogs/schema";
import { LogAction, Prisma } from "@/app/generated/prisma/client";
import { CaseType } from "@/app/generated/prisma/enums";
import { validateSession } from "@/app/lib/authActions";
import {
  ExportExcelData,
  findColumnValue,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  ProcessExcelMeta,
  processExcelUpload,
  UploadExcelResult,
  valuesAreEqual,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";

// Parse time string in various formats
const parseTime = (
  timeStr: string,
): { hours: number; minutes: number; seconds: number } | null => {
  if (!timeStr) return null;

  const str = timeStr.toString().trim();

  // Handle formats like "9:30AM", "9:30 AM", "09:30:00", etc.
  const timeRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[AaPp][Mm])?/;
  const match = str.match(timeRegex);

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const ampm = match[4]?.trim().toUpperCase();

  // Convert 12-hour to 24-hour format
  if (ampm) {
    if (ampm === "PM" && hours !== 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }
  }

  return { hours, minutes, seconds };
};

// Convert case type abbreviations to enum values
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

export async function uploadReceiveExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    console.log(
      `✓ Receiving Log Excel file received: ${file.name} (${file.size} bytes)`,
    );
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `✓ Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );
    } catch (peekError) {
      console.warn("⚠ Unable to preview workbook for logging:", peekError);
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
        const where: Prisma.RecievingLogWhereInput = {
          caseNumber: mappedRow.caseNumber,
          caseType: mappedRow.caseType,
          dateRecieved: mappedRow.dateRecieved,
          bookAndPage: mappedRow.bookAndPage,
        };

        const existingLogs = await prisma.recievingLog.findMany({ where });
        const mappedEntries = Object.entries(mappedRow);

        const hasExactMatch = existingLogs.some((existingLog) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(
              value,
              (existingLog as Record<string, unknown>)[key],
            ),
          ),
        );

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
      `✓ Import completed: ${imported} receiving logs imported, ${errors} row(s) failed validation`,
    );
    if (sheets.length > 0) {
      sheets.forEach((s) => {
        console.log(
          `  📋 "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
        );
      });
    }

    if (result.result?.failedExcel) {
      console.log(
        "⚠ Failed rows file generated:",
        result.result.failedExcel.fileName,
      );
    }

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
    console.error("Receiving Log upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportReceiveLogsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const receivingLogs = await prisma.recievingLog.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(ReceivingLogSchema);
    const headerKeys = [
      "bookAndPage",
      "dateRecieved",
      "caseType",
      "caseNumber",
      "content",
      "branchNumber",
      "notes",
    ] as const;
    type HeaderKey = (typeof headerKeys)[number];
    const header = (key: HeaderKey, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = receivingLogs.map((log) => {
      let dateStr = "";
      let timeStr = "";

      if (log.dateRecieved) {
        const date = new Date(log.dateRecieved);
        // Format date as MM/DD/YYYY
        dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
        // Format time as HH:MM:SS
        timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
      }

      return {
        [header("bookAndPage", "Book and Pages")]: log.bookAndPage ?? "",
        [header("dateRecieved", "Date Recieve")]: dateStr,
        Time: timeStr,
        [header("caseType", "Abbreviation")]: log.caseType,
        [header("caseNumber", "Case no.")]: log.caseNumber ?? "",
        [header("content", "Content")]: log.content ?? "",
        [header("branchNumber", "Branch no.")]: log.branchNumber ?? "",
        [header("notes", "Notes")]: log.notes ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receiving Logs");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `receiving-logs-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Receiving Log export error:", error);
    return { success: false, error: "Export failed" };
  }
}
