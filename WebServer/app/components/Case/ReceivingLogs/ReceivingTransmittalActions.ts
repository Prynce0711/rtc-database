"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  ExportExcelData,
  getExcelHeaderMap,
  PaginatedResult,
  ReceivingLogSchema,
} from "@rtc-database/shared";
import {
  CaseType,
  LogAction,
  Prisma,
  RecievingLog,
} from "@rtc-database/shared/prisma/client";
import { ReceivingLogFilterOptions } from "@rtc-database/shared/src/Case/RecievingLogs/RecievingLogsSchema";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

const CASE_TYPE_VALUES = new Set(Object.values(CaseType));

export type ReceivingTransmittalStats = {
  total: number;
  today: number;
  thisMonth: number;
  docTypes: number;
};

function buildReceivingTransmittalWhere(
  options?: ReceivingLogFilterOptions,
): Prisma.RecievingLogTransmittalWhereInput {
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};
  const conditions: Prisma.RecievingLogTransmittalWhereInput[] = [];

  const addStringFilter = (
    key: "bookAndPage" | "caseNumber" | "content" | "branchNumber" | "notes",
    value?: string | null,
  ) => {
    if (!value) return;
    const exactMatch = exactMatchMap[key] ?? true;
    conditions.push({
      [key]: {
        [exactMatch ? "equals" : "contains"]: value,
      },
    });
  };

  addStringFilter("bookAndPage", filters?.bookAndPage);
  addStringFilter("caseNumber", filters?.caseNumber);
  addStringFilter("content", filters?.content);
  addStringFilter("branchNumber", filters?.branchNumber);
  addStringFilter("notes", filters?.notes);

  if (filters?.caseType && CASE_TYPE_VALUES.has(filters.caseType)) {
    conditions.push({ caseType: filters.caseType });
  }

  if (filters?.dateRecieved?.start || filters?.dateRecieved?.end) {
    conditions.push({
      dateRecieved: {
        gte: filters.dateRecieved.start
          ? new Date(filters.dateRecieved.start)
          : undefined,
        lte: filters.dateRecieved.end
          ? new Date(filters.dateRecieved.end)
          : undefined,
      },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getReceivingTransmittalsPage(
  options?: ReceivingLogFilterOptions,
): Promise<ActionResult<PaginatedResult<RecievingLog>>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;

    const where = buildReceivingTransmittalWhere(options);
    const orderBy: Prisma.RecievingLogTransmittalOrderByWithRelationInput = {
      [options?.sortKey ?? "dateRecieved"]: options?.sortOrder ?? "desc",
    };

    const [items, total] = await prisma.$transaction([
      prisma.recievingLogTransmittal.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.recievingLogTransmittal.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items: items as RecievingLog[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching receiving transmittals:", error);
    return { success: false, error: "Failed to fetch receiving transmittals" };
  }
}

export async function getReceivingTransmittalStats(
  options?: ReceivingLogFilterOptions,
): Promise<ActionResult<ReceivingTransmittalStats>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const where = buildReceivingTransmittalWhere(options);
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [total, today, thisMonth, distinctTypes] = await prisma.$transaction([
      prisma.recievingLogTransmittal.count({ where }),
      prisma.recievingLogTransmittal.count({
        where: {
          AND: [
            where,
            {
              dateRecieved: {
                gte: todayStart,
                lt: tomorrowStart,
              },
            },
          ],
        },
      }),
      prisma.recievingLogTransmittal.count({
        where: {
          AND: [
            where,
            {
              dateRecieved: {
                gte: monthStart,
                lt: nextMonthStart,
              },
            },
          ],
        },
      }),
      prisma.recievingLogTransmittal.findMany({
        where,
        select: { caseType: true },
        distinct: ["caseType"],
      }),
    ]);

    return {
      success: true,
      result: {
        total,
        today,
        thisMonth,
        docTypes: distinctTypes.length,
      },
    };
  } catch (error) {
    console.error("Error fetching receiving transmittal stats:", error);
    return {
      success: false,
      error: "Failed to fetch receiving transmittal stats",
    };
  }
}

export async function exportReceivingTransmittalsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const receivingLogs = await prisma.recievingLogTransmittal.findMany({
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
        dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
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
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Receiving Transmittals",
    );

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `receiving-transmittals-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Receiving transmittal export error:", error);
    return { success: false, error: "Export failed" };
  }
}
