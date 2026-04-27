"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  buildStandaloneFind,
  calculatePetitionCaseStats,
  ExportExcelData,
  getExcelHeaderMap,
  getSchemaFieldKeys,
  LogAction,
  PaginatedResult,
  PetitionCaseData,
  PetitionCaseSchema,
  PetitionCasesFilterOptions,
  PetitionCaseStats,
} from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { createLog } from "../../ActivityLogs/LogActions";

const formatExcelDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
};

export async function getPetitionTransmittals(
  options?: PetitionCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<PetitionCaseData>>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;
    const find = buildStandaloneFind(PetitionCaseSchema, options);

    const [items, total] = await prisma.$transaction([
      prisma.petitionTransmittal.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.petitionTransmittal.count({
        where: find.where,
      }),
    ]);

    return {
      success: true,
      result: {
        items: items as PetitionCaseData[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching petition transmittals:", error);
    return { success: false, error: "Error fetching petition transmittals" };
  }
}

export async function getPetitionTransmittalStats(
  options?: PetitionCasesFilterOptions,
): Promise<ActionResult<PetitionCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildStandaloneFind(PetitionCaseSchema, options);
    const items = await prisma.petitionTransmittal.findMany({
      where: find.where,
    });

    return {
      success: true,
      result: calculatePetitionCaseStats(items as PetitionCaseData[]),
    };
  } catch (error) {
    console.error("Error fetching petition transmittal stats:", error);
    return {
      success: false,
      error: "Error fetching petition transmittal stats",
    };
  }
}

export async function exportPetitionTransmittalsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const fieldKeys = getSchemaFieldKeys(PetitionCaseSchema, {
      all: ["id", "createdAt", "updatedAt"],
    });
    const dateKeys = fieldKeys.dateKeys;
    const items = await prisma.petitionTransmittal.findMany({
      orderBy: { id: "asc" },
    });

    const headerMap = getExcelHeaderMap(PetitionCaseSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];
    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = (items as PetitionCaseData[]).map((item) =>
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
      "Petition Transmittals",
    );

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `petition-transmittals-export-${Date.now()}.xlsx`;

    await createLog({ action: LogAction.EXPORT_CASES, details: null });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Petition transmittal export error:", error);
    return { success: false, error: "Export failed" };
  }
}
