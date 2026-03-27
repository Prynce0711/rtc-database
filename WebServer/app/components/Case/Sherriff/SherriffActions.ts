"use server";

import { PaginatedResult } from "@/app/components/Filter/FilterTypes";
import { LogAction, Prisma, Sherriff } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../../ActionResult";
import { createLog } from "../../ActivityLogs/LogActions";
import { SherriffFilterOptions, SherriffSchema } from "./schema";

export type SherriffStats = {
  total: number;
  today: number;
  thisMonth: number;
  uniqueNames: number;
};

function buildSherriffWhere(
  options?: SherriffFilterOptions,
): Prisma.SherriffWhereInput {
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};
  const conditions: Prisma.SherriffWhereInput[] = [];

  const addStringFilter = (
    key: "ejfCaseNumber" | "mortgagee" | "mortgagor" | "name" | "remarks",
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

  addStringFilter("ejfCaseNumber", filters?.ejfCaseNumber);
  addStringFilter("mortgagee", filters?.mortgagee);
  addStringFilter("mortgagor", filters?.mortgagor);
  addStringFilter("name", filters?.name);
  addStringFilter("remarks", filters?.remarks);

  if (filters?.date?.start || filters?.date?.end) {
    conditions.push({
      date: {
        gte: filters.date.start ? new Date(filters.date.start) : undefined,
        lte: filters.date.end ? new Date(filters.date.end) : undefined,
      },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getSherriffById(
  id: number,
): Promise<ActionResult<Sherriff>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const item = await prisma.sherriff.findUnique({ where: { id } });

    if (!item) {
      return { success: false, error: "Sheriff record not found" };
    }

    return { success: true, result: item };
  } catch (error) {
    console.error("Error fetching sheriff record by id:", error);
    return { success: false, error: "Failed to fetch sheriff record" };
  }
}

export async function getSherriffsByIds(
  ids: Array<number | string>,
): Promise<ActionResult<Sherriff[]>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid IDs provided" };
    }

    const items = await prisma.sherriff.findMany({
      where: { id: { in: validIds } },
    });

    const orderMap = new Map(
      validIds.map((entryId, index) => [entryId, index]),
    );
    items.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    if (items.length !== validIds.length) {
      return {
        success: false,
        error: "One or more sheriff records were not found",
      };
    }

    return { success: true, result: items };
  } catch (error) {
    console.error("Error fetching sheriff records by ids:", error);
    return { success: false, error: "Failed to fetch sheriff records" };
  }
}

export async function getSherriffsPage(
  options?: SherriffFilterOptions,
): Promise<ActionResult<PaginatedResult<Sherriff>>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;

    const where = buildSherriffWhere(options);
    const orderBy: Prisma.SherriffOrderByWithRelationInput = {
      [options?.sortKey ?? "date"]: options?.sortOrder ?? "desc",
    };

    const [items, total] = await prisma.$transaction([
      prisma.sherriff.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sherriff.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching sheriff records page:", error);
    return { success: false, error: "Failed to fetch sheriff records" };
  }
}

export async function getSherriffsStats(
  options?: SherriffFilterOptions,
): Promise<ActionResult<SherriffStats>> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const where = buildSherriffWhere(options);
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

    const [total, today, thisMonth, distinctNames] = await prisma.$transaction([
      prisma.sherriff.count({ where }),
      prisma.sherriff.count({
        where: {
          AND: [
            where,
            {
              date: {
                gte: todayStart,
                lt: tomorrowStart,
              },
            },
          ],
        },
      }),
      prisma.sherriff.count({
        where: {
          AND: [
            where,
            {
              date: {
                gte: monthStart,
                lt: nextMonthStart,
              },
            },
          ],
        },
      }),
      prisma.sherriff.findMany({
        where,
        select: { name: true },
        distinct: ["name"],
      }),
    ]);

    return {
      success: true,
      result: {
        total,
        today,
        thisMonth,
        uniqueNames: distinctNames.filter((entry) => !!entry.name).length,
      },
    };
  } catch (error) {
    console.error("Error fetching sheriff stats:", error);
    return { success: false, error: "Failed to fetch sheriff stats" };
  }
}

export async function createSherriff(
  data: Record<string, unknown>,
): Promise<ActionResult<Sherriff>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const parsedData = SherriffSchema.safeParse(data);
    if (!parsedData.success) {
      throw new Error(`Invalid sheriff data: ${parsedData.error.message}`);
    }

    const newRecord = await prisma.sherriff.create({
      data: parsedData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newRecord.id,
      },
    });

    return { success: true, result: newRecord };
  } catch (error) {
    console.error("Error creating sheriff record:", error);
    return { success: false, error: "Error creating sheriff record" };
  }
}

export async function updateSherriff(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Sherriff>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const parsedData = SherriffSchema.safeParse(data);
    if (!parsedData.success) {
      throw new Error(`Invalid sheriff data: ${parsedData.error.message}`);
    }

    const oldRecord = await prisma.sherriff.findUnique({
      where: { id },
    });

    if (!oldRecord) {
      throw new Error("Sheriff record not found");
    }

    const updatedRecord = await prisma.sherriff.update({
      where: { id },
      data: parsedData.data,
    });

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: oldRecord,
        to: updatedRecord,
      } as any,
    });

    return { success: true, result: updatedRecord };
  } catch (error) {
    console.error("Error updating sheriff record:", error);
    return { success: false, error: "Error updating sheriff record" };
  }
}

export async function deleteSherriff(id: number): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!id) {
      throw new Error("Record ID is required for deletion");
    }

    const recordToDelete = await prisma.sherriff.findUnique({
      where: { id },
    });

    if (!recordToDelete) {
      throw new Error("Sheriff record not found");
    }

    await prisma.sherriff.delete({
      where: { id },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting sheriff record:", error);
    return { success: false, error: "Error deleting sheriff record" };
  }
}
