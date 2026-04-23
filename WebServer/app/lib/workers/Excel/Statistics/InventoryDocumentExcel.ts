"use server";

import { InventoryDocumentSchema } from "@/app/components/Statistics/Annual/Schema";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  UploadExcelResult,
  excelDateToJSDate,
  findColumnValue,
  isMappedRowEmpty,
  isValidDate,
  processExcelUpload,
  valuesAreEqual,
} from "@rtc-database/shared";

const toText = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
};

const toIsoDateString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value === "number") {
    const parsed = excelDateToJSDate(value);
    if (isValidDate(parsed)) {
      return parsed.toISOString();
    }
    return undefined;
  }

  if (value instanceof Date) {
    if (isValidDate(value)) {
      return value.toISOString();
    }
    return undefined;
  }

  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime()) && isValidDate(parsed)) {
    return parsed.toISOString();
  }

  return undefined;
};

const getInventoryCells = (row: Record<string, unknown>) => {
  const regionCell = findColumnValue(row, ["Region"]);
  const provinceCell = findColumnValue(row, ["Province"]);
  const courtCell = findColumnValue(row, ["Court"]);
  const cityMunicipalityCell = findColumnValue(row, [
    "City Municipality",
    "City/Municipality",
    "cityMunicipality",
  ]);
  const branchCell = findColumnValue(row, ["Branch", "Branch No"]);
  const civilSmallClaimsFiledCell = findColumnValue(row, [
    "Civil Small Claims Filed",
    "civilSmallClaimsFiled",
  ]);
  const criminalCasesFiledCell = findColumnValue(row, [
    "Criminal Cases Filed",
    "criminalCasesFiled",
  ]);
  const civilSmallClaimsDisposedCell = findColumnValue(row, [
    "Civil Small Claims Disposed",
    "civilSmallClaimsDisposed",
  ]);
  const criminalCasesDisposedCell = findColumnValue(row, [
    "Criminal Cases Disposed",
    "criminalCasesDisposed",
  ]);
  const dateRecordedCell = findColumnValue(row, [
    "Date Recorded",
    "dateRecorded",
    "Date",
  ]);

  return {
    regionCell,
    provinceCell,
    courtCell,
    cityMunicipalityCell,
    branchCell,
    civilSmallClaimsFiledCell,
    criminalCasesFiledCell,
    civilSmallClaimsDisposedCell,
    criminalCasesDisposedCell,
    dateRecordedCell,
  };
};

export async function uploadInventoryDocumentExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const result = await processExcelUpload<
      InventoryDocumentSchema,
      ReturnType<typeof getInventoryCells>
    >({
      file,
      requiredHeaders: {
        Region: ["Region"],
        Province: ["Province"],
        Court: ["Court"],
        CityMunicipality: [
          "City Municipality",
          "City/Municipality",
          "cityMunicipality",
        ],
        Branch: ["Branch", "Branch No"],
      },
      getCells: getInventoryCells,
      schema: InventoryDocumentSchema,
      skipRowsWithoutCell: [
        "regionCell",
        "provinceCell",
        "courtCell",
        "cityMunicipalityCell",
        "branchCell",
      ],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingRows = await prisma.inventoryDocument.findMany({
          where: {
            region: mappedRow.region,
            province: mappedRow.province,
            court: mappedRow.court,
            cityMunicipality: mappedRow.cityMunicipality,
            branch: mappedRow.branch,
          },
        });

        const mappedEntries = Object.entries(mappedRow);
        const hasExactMatch = existingRows.some((existingRow) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(
              value,
              (existingRow as Record<string, unknown>)[key],
            ),
          ),
        );

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getInventoryCells(row);
        if (isMappedRowEmpty(cells)) {
          return { skip: true };
        }

        return {
          mapped: {
            region: toText(cells.regionCell) ?? "",
            province: toText(cells.provinceCell) ?? "",
            court: toText(cells.courtCell) ?? "",
            cityMunicipality: toText(cells.cityMunicipalityCell) ?? "",
            branch: toText(cells.branchCell) ?? "",
            civilSmallClaimsFiled: toText(cells.civilSmallClaimsFiledCell),
            criminalCasesFiled: toText(cells.criminalCasesFiledCell),
            civilSmallClaimsDisposed: toText(
              cells.civilSmallClaimsDisposedCell,
            ),
            criminalCasesDisposed: toText(cells.criminalCasesDisposedCell),
            dateRecorded: toIsoDateString(cells.dateRecordedCell),
          },
        };
      },
      onBatchInsert: async (rows) => {
        const inserted = await prisma.inventoryDocument.createManyAndReturn({
          data: rows.map((row) => ({
            region: row.region,
            province: row.province,
            court: row.court,
            cityMunicipality: row.cityMunicipality,
            branch: row.branch,
            civilSmallClaimsFiled: row.civilSmallClaimsFiled?.toString(),
            criminalCasesFiled: row.criminalCasesFiled?.toString(),
            civilSmallClaimsDisposed: row.civilSmallClaimsDisposed?.toString(),
            criminalCasesDisposed: row.criminalCasesDisposed?.toString(),
            dateRecorded: row.dateRecorded
              ? new Date(row.dateRecorded)
              : undefined,
          })),
        });

        return { ids: inserted.map((item) => item.id), count: inserted.length };
      },
    });

    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);

    return result;
  } catch (error) {
    console.error("Inventory Excel upload failed:", error);
    return { success: false, error: "Inventory Excel upload failed" };
  }
}
