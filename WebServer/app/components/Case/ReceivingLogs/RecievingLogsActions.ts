"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult, PaginatedResult } from "@rtc-database/shared";
import {
  LogAction,
  Prisma,
  RecievingLog,
} from "@rtc-database/shared/prisma/client";
import { CaseType } from "@rtc-database/shared/prisma/enums";
import {
  ReceivingLogFilterOptions,
  ReceivingLogSchema,
} from "@rtc-database/shared/src/Case/RecievingLogs/RecievingLogsSchema";
import { createLog } from "../../ActivityLogs/LogActions";

const CASE_TYPE_VALUES = new Set(Object.values(CaseType));

export type ReceivingLogStats = {
  total: number;
  today: number;
  thisMonth: number;
  docTypes: number;
};

export type ArchiveRecentFile = {
  id: number;
  fileName: string;
  caseNumber: string | null;
  caseType: CaseType;
  branchNumber: string | null;
  dateRecieved: Date | null;
  uploadedAt: Date;
};

function buildReceivingLogWhere(
  options?: ReceivingLogFilterOptions,
): Prisma.RecievingLogWhereInput {
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};
  const conditions: Prisma.RecievingLogWhereInput[] = [];

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

export async function getRecievingLogs(): Promise<
  ActionResult<RecievingLog[]>
> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const logs = await prisma.recievingLog.findMany({
      orderBy: {
        dateRecieved: "desc",
      },
    });

    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching receiving logs:", error);
    return { success: false, error: "Failed to fetch receiving logs" };
  }
}

export async function getRecievingLogById(
  logId: number,
): Promise<ActionResult<RecievingLog>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const log = await prisma.recievingLog.findUnique({ where: { id: logId } });

    if (!log) {
      return { success: false, error: "Receiving log not found" };
    }

    return { success: true, result: log };
  } catch (error) {
    console.error("Error fetching receiving log by id:", error);
    return { success: false, error: "Failed to fetch receiving log" };
  }
}

export async function getRecievingLogsByIds(
  ids: Array<number | string>,
): Promise<ActionResult<RecievingLog[]>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid log IDs provided" };
    }

    const logs = await prisma.recievingLog.findMany({
      where: { id: { in: validIds } },
    });

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    logs.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    if (logs.length !== validIds.length) {
      return {
        success: false,
        error: "One or more receiving logs were not found",
      };
    }

    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching receiving logs by ids:", error);
    return { success: false, error: "Failed to fetch receiving logs" };
  }
}

export async function getRecievingLogsPage(
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

    const where = buildReceivingLogWhere(options);
    const orderBy: Prisma.RecievingLogOrderByWithRelationInput = {
      [options?.sortKey ?? "dateRecieved"]: options?.sortOrder ?? "desc",
    };

    const [items, total] = await prisma.$transaction([
      prisma.recievingLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.recievingLog.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching receiving logs page:", error);
    return { success: false, error: "Failed to fetch receiving logs" };
  }
}

export async function getRecievingLogsStats(
  options?: ReceivingLogFilterOptions,
): Promise<ActionResult<ReceivingLogStats>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const where = buildReceivingLogWhere(options);
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
      prisma.recievingLog.count({ where }),
      prisma.recievingLog.count({
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
      prisma.recievingLog.count({
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
      prisma.recievingLog.findMany({
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
    console.error("Error fetching receiving log stats:", error);
    return { success: false, error: "Failed to fetch receiving log stats" };
  }
}

export async function createRecievingLog(
  data: Record<string, unknown>,
): Promise<ActionResult<RecievingLog>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const logData = ReceivingLogSchema.safeParse(data);
    if (!logData.success) {
      throw new Error(`Invalid receiving log data: ${logData.error.message}`);
    }

    const newLog = await prisma.recievingLog.create({
      data: logData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newLog.id,
      },
    });

    return { success: true, result: newLog };
  } catch (error) {
    console.error("Error creating receiving log:", error);
    return { success: false, error: "Error creating receiving log" };
  }
}

export async function updateRecievingLog(
  logId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<RecievingLog>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const logData = ReceivingLogSchema.safeParse(data);
    if (!logData.success) {
      throw new Error(`Invalid receiving log data: ${logData.error.message}`);
    }

    const oldLog = await prisma.recievingLog.findUnique({
      where: { id: logId },
    });

    if (!oldLog) {
      throw new Error("Receiving log not found");
    }

    const updatedLog = await prisma.recievingLog.update({
      where: { id: logId },
      data: logData.data,
    });

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: oldLog,
        to: updatedLog,
      },
    });

    return { success: true, result: updatedLog };
  } catch (error) {
    console.error("Error updating receiving log:", error);
    return { success: false, error: "Error updating receiving log" };
  }
}

export async function deleteRecievingLog(
  logId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!logId) {
      throw new Error("Log ID is required for deletion");
    }

    const logToDelete = await prisma.recievingLog.findUnique({
      where: { id: logId },
    });

    if (!logToDelete) {
      throw new Error("Receiving log not found");
    }

    await prisma.recievingLog.delete({
      where: { id: logId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: logId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting receiving log:", error);
    return { success: false, error: "Error deleting receiving log" };
  }
}

export async function getRecentArchiveFiles(
  limit = 5,
): Promise<ActionResult<ArchiveRecentFile[]>> {
  try {
    const sessionValidation = await validateSession([
      Roles.ARCHIVE,
      Roles.ADMIN,
      Roles.ATTY,
    ]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLimit = Math.min(Math.max(Math.trunc(limit || 5), 1), 20);

    const logs = await prisma.recievingLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: normalizedLimit,
      select: {
        id: true,
        content: true,
        caseNumber: true,
        caseType: true,
        branchNumber: true,
        dateRecieved: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      result: logs.map((log) => ({
        id: log.id,
        fileName:
          log.content?.trim() ||
          [log.caseType, log.caseNumber].filter(Boolean).join(" - ") ||
          `Archive File #${log.id}`,
        caseNumber: log.caseNumber,
        caseType: log.caseType,
        branchNumber: log.branchNumber,
        dateRecieved: log.dateRecieved,
        uploadedAt: log.createdAt,
      })),
    };
  } catch (error) {
    console.error("Error fetching recent archive files:", error);
    return { success: false, error: "Failed to fetch recent archive files" };
  }
}
