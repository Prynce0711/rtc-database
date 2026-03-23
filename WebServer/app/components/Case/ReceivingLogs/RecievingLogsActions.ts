"use server";

import { PaginatedResult } from "@/app/components/Filter/FilterTypes";
import { LogAction, Prisma, RecievingLog } from "@/app/generated/prisma/client";
import { CaseType } from "@/app/generated/prisma/enums";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../../ActionResult";
import { createLog } from "../../ActivityLogs/LogActions";
import { ReceivingLogFilterOptions, ReceivingLogSchema } from "./schema";

const CASE_TYPE_VALUES = new Set(Object.values(CaseType));

export type ReceivingLogStats = {
  total: number;
  today: number;
  thisMonth: number;
  docTypes: number;
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
