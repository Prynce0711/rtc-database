"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  buildStandaloneFind,
  calculateCriminalCaseStats,
  CriminalCaseData,
  CriminalCaseSchema,
  CriminalCasesFilterOptions,
  CriminalCaseStats,
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

export async function getCriminalTransmittals(
  options?: CriminalCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<CriminalCaseData>>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;
    const find = buildStandaloneFind(CriminalCaseSchema, options);

    const [items, total] = await prisma.$transaction([
      prisma.criminalCaseTransmittal.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.criminalCaseTransmittal.count({
        where: find.where,
      }),
    ]);

    return {
      success: true,
      result: {
        items: items as CriminalCaseData[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching criminal transmittals:", error);
    return { success: false, error: "Error fetching criminal transmittals" };
  }
}

export async function getCriminalTransmittalStats(
  options?: CriminalCasesFilterOptions,
): Promise<ActionResult<CriminalCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildStandaloneFind(CriminalCaseSchema, options);
    const items = await prisma.criminalCaseTransmittal.findMany({
      where: find.where,
    });

    return {
      success: true,
      result: calculateCriminalCaseStats(items as CriminalCaseData[]),
    };
  } catch (error) {
    console.error("Error fetching criminal transmittal stats:", error);
    return {
      success: false,
      error: "Error fetching criminal transmittal stats",
    };
  }
}

export async function exportCriminalTransmittalsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const fieldKeys = getSchemaFieldKeys(CriminalCaseSchema, {
      all: ["id", "createdAt", "updatedAt"],
    });
    const dateKeys = fieldKeys.dateKeys;
    const items = await prisma.criminalCaseTransmittal.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(CriminalCaseSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];
    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = (items as CriminalCaseData[]).map((item) =>
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
      "Criminal Transmittals",
    );

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `criminal-transmittals-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Criminal transmittal export error:", error);
    return { success: false, error: "Export failed" };
  }
}
