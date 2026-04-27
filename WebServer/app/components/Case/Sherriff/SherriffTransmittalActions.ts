"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  buildStandaloneFind,
  ExportExcelData,
  getExcelHeaderMap,
  getSchemaFieldKeys,
  LogAction,
  PaginatedResult,
  SheriffCaseData,
  SheriffCaseSchema,
  SheriffCasesFilterOptions,
  SheriffCaseStats,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

const formatExcelDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
};

export async function getSheriffTransmittals(
  options?: SheriffCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<SheriffCaseData>>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;
    const find = buildStandaloneFind(SheriffCaseSchema, options);

    const [items, total] = await prisma.$transaction([
      prisma.sheriffCaseTransmittal.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sheriffCaseTransmittal.count({
        where: find.where,
      }),
    ]);

    return {
      success: true,
      result: {
        items: items as SheriffCaseData[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching sheriff transmittals:", error);
    return { success: false, error: "Error fetching sheriff transmittals" };
  }
}

export async function getSheriffTransmittalStats(
  options?: SheriffCasesFilterOptions,
): Promise<ActionResult<SheriffCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildStandaloneFind(SheriffCaseSchema, options);
    const items = (await prisma.sheriffCaseTransmittal.findMany({
      where: find.where,
    })) as SheriffCaseData[];

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const countByDateFiled = (start: Date) =>
      items.filter((item) => {
        if (!item.dateFiled) return false;
        const date = new Date(item.dateFiled);
        return !Number.isNaN(date.getTime()) && date >= start;
      }).length;

    return {
      success: true,
      result: {
        totalCases: items.length,
        thisMonthCases: countByDateFiled(monthStart),
        todayCases: countByDateFiled(todayStart),
        recentlyFiled: countByDateFiled(thirtyDaysAgo),
      },
    };
  } catch (error) {
    console.error("Error fetching sheriff transmittal stats:", error);
    return {
      success: false,
      error: "Error fetching sheriff transmittal stats",
    };
  }
}

export async function exportSheriffTransmittalsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const fieldKeys = getSchemaFieldKeys(SheriffCaseSchema, {
      all: ["id", "createdAt", "updatedAt"],
    });
    const dateKeys = fieldKeys.dateKeys;
    const items = await prisma.sheriffCaseTransmittal.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(SheriffCaseSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];
    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = (items as SheriffCaseData[]).map((item) =>
      headerKeys.reduce(
        (acc, key) => {
          acc[header(key, key)] = dateKeys.includes(key)
            ? formatExcelDate(item[key] as Date | string | null | undefined)
            : (item[key] ?? "");
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    );

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheriff Transmittals");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `sheriff-transmittals-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Sheriff transmittal export error:", error);
    return { success: false, error: "Export failed" };
  }
}
