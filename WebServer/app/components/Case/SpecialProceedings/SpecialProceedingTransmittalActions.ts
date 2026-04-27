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
  SpecialProceedingData,
  SpecialProceedingSchema,
  SpecialProceedingsFilterOptions,
  SpecialProceedingStats,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

const formatExcelDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
};

export async function getSpecialProceedingTransmittals(
  options?: SpecialProceedingsFilterOptions,
): Promise<ActionResult<PaginatedResult<SpecialProceedingData>>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;
    const find = buildStandaloneFind(SpecialProceedingSchema, options);

    const [items, total] = await prisma.$transaction([
      prisma.specialProceedingTransmittal.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.specialProceedingTransmittal.count({
        where: find.where,
      }),
    ]);

    return {
      success: true,
      result: {
        items: items as SpecialProceedingData[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching special proceeding transmittals:", error);
    return {
      success: false,
      error: "Error fetching special proceeding transmittals",
    };
  }
}

export async function getSpecialProceedingTransmittalStats(
  options?: SpecialProceedingsFilterOptions,
): Promise<ActionResult<SpecialProceedingStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildStandaloneFind(SpecialProceedingSchema, options);
    const items = (await prisma.specialProceedingTransmittal.findMany({
      where: find.where,
    })) as SpecialProceedingData[];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const caseTypes = new Set(
      items.map((item) => item.nature?.trim()).filter(Boolean),
    );
    const branches = new Set(
      items.map((item) => item.raffledTo?.trim()).filter(Boolean),
    );

    return {
      success: true,
      result: {
        totalCases: items.length,
        thisMonth: items.filter((item) => {
          if (!item.date) return false;
          const date = new Date(item.date);
          return !Number.isNaN(date.getTime()) && date >= monthStart;
        }).length,
        caseTypes: caseTypes.size,
        branches: branches.size,
      },
    };
  } catch (error) {
    console.error(
      "Error fetching special proceeding transmittal stats:",
      error,
    );
    return {
      success: false,
      error: "Error fetching special proceeding transmittal stats",
    };
  }
}

export async function exportSpecialProceedingTransmittalsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const fieldKeys = getSchemaFieldKeys(SpecialProceedingSchema, {
      all: ["id", "createdAt", "updatedAt"],
    });
    const dateKeys = fieldKeys.dateKeys;
    const items = await prisma.specialProceedingTransmittal.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(SpecialProceedingSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];
    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = (items as SpecialProceedingData[]).map((item) =>
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
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Special Proceeding Transmittals",
    );

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName =
      `special-proceeding-transmittals-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Special proceeding transmittal export error:", error);
    return { success: false, error: "Export failed" };
  }
}
