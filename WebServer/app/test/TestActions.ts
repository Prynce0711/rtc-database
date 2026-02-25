"use server";
import ActionResult from "@/app/components/ActionResult";
import { ReceivingLogSchema } from "@/app/components/Case/ReceivingLogs/schema";
import { Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import Roles from "@/app/lib/Roles";
import { isExcel } from "@/app/lib/utils";
import * as XLSX from "xlsx";
import { prettifyError, z } from "zod";
import { prisma } from "../lib/prisma";

type ExcelImportResult = {
  rawData: any[];
  mappedData: any[];
  validationResults: {
    receivingLogs: any[];
    total: number;
    valid: number;
    errors: Array<{
      row: number;
      errors: {
        issues: Array<{ path: PropertyKey[]; message: string; code: string }>;
      };
    }>;
  };
};

const excelDateToJSDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
  );
};

// Fuzzy column name matcher
const findColumnValue = (row: any, possibleNames: string[]): any => {
  // First try exact match (case-insensitive)
  for (const name of possibleNames) {
    for (const key in row) {
      if (key.toLowerCase().trim() === name.toLowerCase().trim()) {
        return row[key];
      }
    }
  }

  // Then try partial match
  for (const name of possibleNames) {
    for (const key in row) {
      const keyLower = key.toLowerCase().trim();
      const nameLower = name.toLowerCase().trim();
      if (keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
        return row[key];
      }
    }
  }

  return undefined;
};

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
): Promise<ActionResult<ExcelImportResult>> {
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

    // Serialize data for client component (convert Dates to strings)
    const serializeData = (data: any): any => {
      if (data instanceof Date) {
        return data.toISOString();
      }
      if (Array.isArray(data)) {
        return data.map(serializeData);
      }
      if (data && typeof data === "object") {
        const serialized: any = {};
        for (const key in data) {
          serialized[key] = serializeData(data[key]);
        }
        return serialized;
      }
      return data;
    };

    return {
      success: true,
      result: {
        rawData: serializeData(rawData),
        mappedData: serializeData(mappedData),
        validationResults: {
          receivingLogs: serializeData(validationResults.receivingLogs),
          total: validationResults.total,
          valid: validationResults.valid,
          errors: validationResults.errors.map((err) => ({
            row: err.row,
            errors: {
              issues: err.errors.issues.map((issue) => ({
                path: issue.path,
                message: issue.message,
                code: issue.code,
              })),
            },
          })),
        },
      },
    };
  } catch (error) {
    console.error("Receiving Log upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function deleteAllReceiveLogs(): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.recievingLog.deleteMany({});
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting receiving logs:", error);
    return { success: false, error: "Failed to delete receiving logs" };
  }
}
