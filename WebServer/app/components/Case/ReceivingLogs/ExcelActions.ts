"use server";

import ActionResult from "@/app/components/ActionResult";
import { ReceivingLogSchema } from "@/app/components/Case/ReceivingLogs/schema";
import { LogAction, Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  excelDateToJSDate,
  ExportExcelData,
  findColumnValue,
  isExcel,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";
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
const convertCaseType = (abbreviation: string | undefined): string => {
  if (!abbreviation) return "UNKNOWN";

  const abbrev = abbreviation.toString().toUpperCase().trim();
  const caseTypeMap: Record<string, string> = {
    CC: "CRIMINAL",
    CVC: "CIVIL",
    LRC: "LAND_REGISTRATION_CASE",
    P: "PETITION",
  };

  return caseTypeMap[abbrev] || "UNKNOWN";
};

export async function uploadReceiveExcel(
  file: File,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if ((await isExcel(file)) === false) {
      return { success: false, error: "File is not a valid Excel document" };
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(
      `✓ Receiving Log Excel file received: ${file.name} (${file.size} bytes)`,
    );
    console.log(`✓ Found ${rawData.length} rows in sheet "${sheetName}"`);

    const mappedData = rawData.map((row: any) => {
      // Use fuzzy matching for column names
      const dateRecievedCell = findColumnValue(row, [
        "Date Recieve",
        "Date Receive",
        "Date Received",
        "DateRecieved",
      ]);
      const timeCell = findColumnValue(row, ["Time", "TIME"]);
      const bookAndPageCell = findColumnValue(row, [
        "Book and Pages",
        "Book & Pages",
        "BookAndPages",
        "Book and Page",
      ]);
      const caseTypeCell = findColumnValue(row, [
        "Abbreviation",
        "Case Type",
        "CaseType",
        "Type",
      ]);
      const caseNumberCell = findColumnValue(row, [
        "Case no.",
        "Case No.",
        "Case No",
        "Case Number",
        "CaseNumber",
      ]);
      const contentCell = findColumnValue(row, [
        "Content",
        "CONTENT",
        "Contents",
      ]);
      const branchNumberCell = findColumnValue(row, [
        "Branch no.",
        "Branch No.",
        "Branch No",
        "Branch Number",
        "BranchNumber",
        "Branch",
      ]);
      const notesCell = findColumnValue(row, [
        "Notes",
        "NOTES",
        "Note",
        "Remarks",
      ]);

      let dateRecieved: Date | undefined;

      // Handle different date formats
      if (typeof dateRecievedCell === "number") {
        // Excel serial date
        dateRecieved = excelDateToJSDate(dateRecievedCell);
      } else if (dateRecievedCell) {
        // Try parsing as text date
        const parsedDate = new Date(dateRecievedCell);
        if (!isNaN(parsedDate.getTime())) {
          dateRecieved = parsedDate;
        }
      }

      // Combine date and time if both exist
      if (dateRecieved && timeCell) {
        const timeData = parseTime(timeCell.toString());
        if (timeData) {
          dateRecieved.setHours(
            timeData.hours,
            timeData.minutes,
            timeData.seconds,
            0,
          );
        }
      }

      return {
        bookAndPage: bookAndPageCell?.toString() || undefined,
        dateRecieved: dateRecievedCell ? dateRecieved : undefined,
        caseType: convertCaseType(caseTypeCell?.toString()),
        caseNumber: caseNumberCell?.toString() || undefined,
        content: contentCell?.toString() || undefined,
        branchNumber: branchNumberCell?.toString() || undefined,
        notes: notesCell?.toString() || undefined,
      };
    });

    const validationResults = {
      receivingLogs: [] as Prisma.RecievingLogCreateManyInput[],
      total: mappedData.length,
      valid: 0,
      errors: [] as Array<{ row: number; errors: z.ZodError }>,
    };

    mappedData.forEach((row, index) => {
      const validated = ReceivingLogSchema.safeParse(row);
      if (validated.success) {
        validationResults.receivingLogs.push(validated.data);
        validationResults.valid += 1;
      } else {
        validationResults.errors.push({
          row: index + 2,
          errors: validated.error,
        });
      }
    });

    console.log(
      `✓ Receiving Log rows validated: ${validationResults.valid}/${validationResults.total}`,
    );

    if (validationResults.errors.length > 0) {
      console.log(
        `⚠ ${validationResults.errors.length} receiving log rows have validation errors:`,
      );

      let errorText = "";
      validationResults.errors.forEach(({ row, errors }) => {
        errorText += `  Row ${row}: ${prettifyError(errors)}\n`;
        console.log(`  Row ${row}:`, prettifyError(errors));
      });

      return {
        success: false,
        error: `Validation failed: ${validationResults.errors.length} rows have errors\n${errorText}`,
      };
    }

    const createdLogs = await prisma.recievingLog.createManyAndReturn({
      data: validationResults.receivingLogs,
    });
    await createLog({
      action: LogAction.IMPORT_CASES,
      details: {
        ids: createdLogs.map((log) => log.id),
      },
    });

    return { success: true, result: undefined };
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
        "Book and Pages": log.bookAndPage ?? "",
        "Date Recieve": dateStr,
        Time: timeStr,
        Abbreviation: log.caseType,
        "Case no.": log.caseNumber ?? "",
        Content: log.content ?? "",
        "Branch no.": log.branchNumber ?? "",
        Notes: log.notes ?? "",
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
