"use server";

import { PetitionSchema } from "@/app/components/Case/Petition/schema";
import {
  Case,
  CaseType,
  LogAction,
  Petition,
  Prisma,
} from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  parseCaseNumber,
  syncCaseCounterToAtLeast,
} from "@/app/lib/caseNumbering";
import {
  ExportExcelData,
  getExcelHeaderMap,
  isMappedRowEmpty,
  normalizeRowBySchema,
  ProcessExcelMeta,
  processExcelUpload,
  QUERY_CHUNK_SIZE,
  UploadExcelResult,
  valuesAreEqual,
} from "@/app/lib/excel";
import { prisma } from "@/app/lib/prisma";
import { splitCaseDataBySchema } from "@/app/lib/PrismaHelper";
import Roles from "@/app/lib/Roles";
import { getSchemaFieldKeys } from "@/app/lib/utils";
import { ActionResult } from "@rtc-database/shared";
import * as XLSX from "xlsx";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";
import { BaseCaseSchema } from "../BaseCaseSchema";

export async function uploadPetitionExcel(
  file: File,
): Promise<ActionResult<UploadExcelResult, UploadExcelResult>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    console.log(
      `📥 Received petition Excel file: ${file.name} (${file.size} bytes)`,
    );

    console.log(
      `✓ Petition Excel file received: ${file.name} (${file.size} bytes)`,
    );

    const candidateCaseNumbers = new Set<string>();

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      console.log(
        `✓ Found ${workbook.SheetNames.length} sheet(s): ${workbook.SheetNames.join(", ")}`,
      );

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows =
          XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        for (const row of rows) {
          const normalized = normalizeRowBySchema(PetitionSchema, row);
          const caseNumber = normalized.caseNumber;
          if (typeof caseNumber !== "string") continue;
          const trimmed = caseNumber.trim();
          if (trimmed) {
            candidateCaseNumbers.add(trimmed);
          }
        }
      }
    } catch (peekError) {
      console.warn("⚠ Unable to preview workbook for logging:", peekError);
    }

    const existingByCaseNumber = new Map<string, Record<string, unknown>[]>();
    const exactMatchCache = new Map<string, boolean>();

    if (candidateCaseNumbers.size > 0) {
      const allCaseNumbers = Array.from(candidateCaseNumbers);

      for (let i = 0; i < allCaseNumbers.length; i += QUERY_CHUNK_SIZE) {
        const caseNumberChunk = allCaseNumbers.slice(i, i + QUERY_CHUNK_SIZE);

        const existingCases = await prisma.case.findMany({
          where: {
            caseType: CaseType.PETITION,
            caseNumber: {
              in: caseNumberChunk,
            },
          },
          include: {
            petition: true,
          },
        });

        for (const existingCase of existingCases) {
          if (!existingCase.petition || !existingCase.caseNumber) continue;

          const key = existingCase.caseNumber.trim();
          if (!key) continue;

          const mergedCase = {
            ...existingCase,
            ...existingCase.petition,
          } as Record<string, unknown>;

          const bucket = existingByCaseNumber.get(key) ?? [];
          bucket.push(mergedCase);
          existingByCaseNumber.set(key, bucket);
        }
      }
    }

    const headerMap = getExcelHeaderMap(PetitionSchema);
    const caseNumberHeaders = headerMap.caseNumber ?? ["Case Number"];

    const getMappedCells = (row: Record<string, unknown>) => {
      const values = normalizeRowBySchema(PetitionSchema, row);

      return {
        ...values,
      };
    };

    const result = await processExcelUpload<
      PetitionSchema,
      ReturnType<typeof getMappedCells>
    >({
      file,
      requiredHeaders: { "Case Number": caseNumberHeaders },
      schema: PetitionSchema,
      getCells: getMappedCells,
      skipRowsWithoutCell: ["caseNumber"],
      checkExactMatch: async (_cells, mappedRow) => {
        const mappedEntries = Object.entries(mappedRow);

        const cacheKey = JSON.stringify(
          mappedEntries
            .slice()
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [
              key,
              value instanceof Date
                ? value.getTime()
                : typeof value === "string"
                  ? value.trim()
                  : (value ?? null),
            ]),
        );

        const cachedResult = exactMatchCache.get(cacheKey);
        if (cachedResult !== undefined) {
          return { exists: cachedResult };
        }

        const caseNumberKey =
          typeof mappedRow.caseNumber === "string"
            ? mappedRow.caseNumber.trim()
            : "";

        const candidates = caseNumberKey
          ? (existingByCaseNumber.get(caseNumberKey) ?? [])
          : [];

        const hasExactMatch = candidates.some((existingRow) =>
          mappedEntries.every(([key, value]) =>
            valuesAreEqual(value, existingRow[key]),
          ),
        );

        exactMatchCache.set(cacheKey, hasExactMatch);

        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getMappedCells(row);

        if (isMappedRowEmpty(cells, ["caseNumber"])) {
          return { skip: true };
        }

        const hydrated = {
          ...cells,
          caseType: CaseType.PETITION,
          dateFiled: cells.dateFiled ?? cells.date ?? null,
          branch: cells.branch ?? cells.raffledTo ?? null,
          assistantBranch:
            cells.assistantBranch ?? cells.raffledTo ?? cells.branch ?? null,
        };

        const validation = PetitionSchema.safeParse(hydrated);
        if (!validation.success) {
          return {
            errorMessage: prettifyError(validation.error),
          };
        }

        return {
          mapped: validation.data,
        };
      },
      onBatchInsert: async (rows) => {
        return prisma.$transaction(async (tx) => {
          const caseRows: Prisma.CaseCreateManyInput[] = [];

          rows.forEach((row) => {
            const { caseData } = splitCaseDataBySchema(row);
            caseRows.push({
              ...caseData,
              caseType: CaseType.PETITION,
              isManual: true,
              number: null,
              area: null,
              year: null,
            });
          });

          const created = await tx.case.createManyAndReturn({
            data: caseRows,
          });

          const petitionRows: Prisma.PetitionCreateManyInput[] = rows.map(
            (row, index) => {
              const { detailData } = splitCaseDataBySchema(row);
              return {
                ...(detailData as Prisma.PetitionCreateWithoutCaseInput),
                baseCaseID: created[index].id,
              };
            },
          );

          if (petitionRows.length > 0) {
            await tx.petition.createMany({ data: petitionRows });
          }

          const maxPerBucket = new Map<
            string,
            { area: string; year: number; number: number }
          >();

          rows.forEach((row) => {
            const parsed = parseCaseNumber(String(row.caseNumber ?? ""));
            if (!parsed) return;

            const key = `${CaseType.PETITION}|${parsed.area}|${parsed.year}`;
            const current = maxPerBucket.get(key);
            if (!current || parsed.number > current.number) {
              maxPerBucket.set(key, {
                area: parsed.area,
                year: parsed.year,
                number: parsed.number,
              });
            }
          });

          for (const bucket of maxPerBucket.values()) {
            await syncCaseCounterToAtLeast(
              tx,
              CaseType.PETITION,
              bucket.area,
              bucket.year,
              bucket.number,
            );
          }

          return { ids: created.map((c) => c.id), count: created.length };
        });
      },
    });

    if (result.success) {
      const meta: ProcessExcelMeta = result.result?.meta;
      const imported = meta.importedCount;
      const errors = meta.errorCount;
      const sheets = meta.sheetSummary;

      console.log(
        `✓ Import completed: ${imported} petitions imported, ${errors} row(s) failed validation`,
      );
      if (sheets.length > 0) {
        sheets.forEach(
          (s: {
            sheet: string;
            valid: number;
            rows: number;
            failed: number;
          }) => {
            console.log(
              `  📋 "${s.sheet}": ${s.valid}/${s.rows} valid, ${s.failed} failed`,
            );
          },
        );
      }

      if (result.result?.failedExcel) {
        console.log(
          "⚠ Failed rows file generated:",
          result.result.failedExcel.fileName,
        );
      }

      await createLog({
        action: LogAction.IMPORT_CASES,
        details: {
          ids: meta.importedIds ?? [],
        },
      });
    } else {
      console.error("✗ Import failed:", result.error);
    }

    return result;
  } catch (error) {
    console.error("Petition upload error:", error);
    return { success: false, error: "Upload failed" };
  }
}

export async function exportPetitionsExcel(): Promise<
  ActionResult<ExportExcelData>
> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const baseCaseFieldKeys = getSchemaFieldKeys(BaseCaseSchema, {
      all: ["id"],
    });

    const caseFieldKeys = getSchemaFieldKeys(PetitionSchema, {
      all: ["id"],
      stringKeys: [...baseCaseFieldKeys.stringKeys],
      dateKeys: [...baseCaseFieldKeys.dateKeys],
    });

    const dateKeys = [
      caseFieldKeys.dateKeys,
      baseCaseFieldKeys.dateKeys,
    ].flat();

    const cases = await prisma.case.findMany({
      orderBy: { id: "asc" },
      include: { petition: true },
    });

    const petitionCases = cases
      .filter((c): c is Case & { petition: Petition } => !!c.petition)
      .map((c) => ({
        ...c.petition,
        ...c,
      }));

    const headerMap = getExcelHeaderMap(PetitionSchema);
    const headerKeys = Object.keys(headerMap) as (keyof typeof headerMap)[];

    const header = (key: keyof typeof headerMap, fallback: string) =>
      headerMap[key]?.[0] ?? fallback;

    const rows = petitionCases.map((petitionCase) => {
      const formatDate = (value: Date | null | undefined) => {
        if (!value) return "";
        const date = new Date(value);
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      };

      return headerKeys.reduce(
        (acc, key) => {
          const headerName = header(key, key);
          const value = dateKeys.includes(key)
            ? formatDate(petitionCase[key] as Date | null | undefined)
            : (petitionCase[key] ?? "");
          acc[headerName] = value;
          return acc;
        },
        {} as Record<string, unknown>,
      );
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Petition Cases");

    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    const fileName = `petitions-export-${Date.now()}.xlsx`;

    await createLog({
      action: LogAction.EXPORT_CASES,
      details: null,
    });

    return { success: true, result: { fileName, base64 } };
  } catch (error) {
    console.error("Petition export error:", error);
    return { success: false, error: "Export failed" };
  }
}
