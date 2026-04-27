"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  buildStandaloneFind,
  calculateCivilCaseStats,
  CivilCaseData,
  CivilCaseSchema,
  CivilCasesFilterOptions,
  CivilCaseStats,
  ExportExcelData,
  getExcelHeaderMap,
  getSchemaFieldKeys,
  LogAction,
  PaginatedResult,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

const formatExcelDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
};

export async function getCivilTransmittals(
  options?: CivilCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<CivilCaseData>>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;
    const find = buildStandaloneFind(CivilCaseSchema, options);

    const [items, total] = await prisma.$transaction([
      prisma.civilCaseTransmittal.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.civilCaseTransmittal.count({
        where: find.where,
      }),
    ]);

    return {
      success: true,
      result: {
        items: items as CivilCaseData[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching civil transmittals:", error);
    return { success: false, error: "Error fetching civil transmittals" };
  }
}

export async function getCivilTransmittalStats(
  options?: CivilCasesFilterOptions,
): Promise<ActionResult<CivilCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildStandaloneFind(CivilCaseSchema, options);
    const items = await prisma.civilCaseTransmittal.findMany({
      where: find.where,
    });

    return {
      success: true,
      result: calculateCivilCaseStats(items as CivilCaseData[]),
    };
  } catch (error) {
    console.error("Error fetching civil transmittal stats:", error);
    return {
      success: false,
      error: "Error fetching civil transmittal stats",
    };
  }
}

export async function exportCivilTransmittalsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const fieldKeys = getSchemaFieldKeys(CivilCaseSchema, {
      all: ["id", "createdAt", "updatedAt"],
    });
    const dateKeys = fieldKeys.dateKeys;
    const items = await prisma.civilCaseTransmittal.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(CivilCaseSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];
    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = (items as CivilCaseData[]).map((item) =>
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Civil Transmittals");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `civil-transmittals-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Civil transmittal export error:", error);
    return { success: false, error: "Export failed" };
  }
}
