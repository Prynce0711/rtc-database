import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@rtc-database/shared/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  processExcelUpload,
  findColumnValue,
  isMappedRowEmpty,
} from "../packages/shared/src/lib/excel";

interface MonthlyRow {
  month: string;
  category: string;
  branch: string;
  criminal: number;
  civil: number;
  total: number;
}

async function loadEnv() {
  const envPath = path.resolve(__dirname, "../WebServer/.env");
  try {
    const envText = await fs.readFile(envPath, "utf8");
    envText.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").replace(/^"|"$/g, "");
      process.env[key] = value;
    });
  } catch (error) {
    // ignore if file missing
  }
}

function parseMonthFromFilename(name: string): string | undefined {
  const lower = name.toLowerCase();
  const yearMatch = name.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : undefined;
  const months: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };
  for (const [key, num] of Object.entries(months)) {
    if (lower.includes(key) && year) {
      return `${year}-${num}`;
    }
  }
  const numericMatch = name.match(/(0[1-9]|1[0-2])[-_ ]?(20\d{2})/);
  if (numericMatch) {
    return `${numericMatch[2]}-${numericMatch[1]}`;
  }
  return undefined;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  await loadEnv();
  const dbUrl = process.env.DATABASE_URL || "file:./WebServer/dev.db";
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: dbUrl }),
  });
  await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
  await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
  await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000;`);

  const baseDir = path.resolve(__dirname, "../RTC-DATA/Analytics/Monthly Report RTC Nov 2023");
  const dirents = await fs.readdir(baseDir, { withFileTypes: true });
  const files = dirents
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => /\.xls[xm]?$/.test(n));

  console.log(`Importing ${files.length} Excel files from ${baseDir}`);
  let importedTotal = 0;

  for (const fileName of files) {
    const filePath = path.join(baseDir, fileName);
    console.log(`Processing ${fileName}`);
    const workbook = XLSX.readFile(filePath);
    const fallbackMonth = parseMonthFromFilename(fileName);
    if (!fallbackMonth) {
      console.warn(`  Skipping ${fileName}: unable to parse month from filename`);
      continue;
    }

    const getMonthlyCells = (row: Record<string, unknown>) => {
      const monthCell = findColumnValue(row, ["Month", "Period", "Report Month"]);
      const categoryCell = findColumnValue(row, ["Category", "Case Category"]);
      const branchCell = findColumnValue(row, ["Branch", "Branch/Station", "Station"]);
      const criminalCell = findColumnValue(row, ["Criminal", "Crim"]);
      const civilCell = findColumnValue(row, ["Civil"]);
      const totalCell = findColumnValue(row, ["Total", "Grand Total"]);
      return { monthCell, categoryCell, branchCell, criminalCell, civilCell, totalCell };
    };

    const result = await processExcelUpload<MonthlyRow, ReturnType<typeof getMonthlyCells>>({
      workbook,
      requiredHeaders: {
        Category: ["Category", "Case Category"],
        Branch: ["Branch", "Branch/Station", "Station"],
      },
      getCells: getMonthlyCells,
      schema: undefined as any,
      skipRowsWithoutCell: ["categoryCell", "branchCell"],
      checkExactMatch: async (_cells, mappedRow) => {
        const existingRows = await prisma.monthlyStatistics.findMany({
          where: {
            month: mappedRow.month,
            category: mappedRow.category,
            branch: mappedRow.branch,
          },
        });
        const mappedEntries = Object.entries(mappedRow);
        const hasExactMatch = existingRows.some((existingRow) =>
          mappedEntries.every(
            ([key, value]) =>
              String((existingRow as Record<string, unknown>)[key]) ===
              String(value),
          ),
        );
        return { exists: hasExactMatch };
      },
      mapRow: (row) => {
        const cells = getMonthlyCells(row);
        if (isMappedRowEmpty(cells)) return { skip: true };
        const month = normalizeText(cells.monthCell || fallbackMonth);
        const category = "Pending Cases";
        const branch = normalizeText(cells.branchCell);
        if (!month) {
          return { errorMessage: "Month is required in the file row." };
        }
        const criminal = toNumber(cells.criminalCell);
        const civil = toNumber(cells.civilCell);
        const totalFromFile = toNumber(cells.totalCell);
        const computedTotal = criminal + civil;
        const total = cells.totalCell === undefined ? computedTotal : totalFromFile;
        return {
          mapped: { month, category, branch, criminal, civil, total },
          uniqueKey: `${month}|${category}|${branch}`,
        };
      },
      onBatchInsert: async (rows) => {
        const inserted = await prisma.monthlyStatistics.createMany({
          data: rows,
          skipDuplicates: true,
        });
        return { ids: [], count: inserted.count };
      },
    });

    if (result.success && result.result) {
      importedTotal += result.result.meta.imported ?? 0;
      console.log(`  Imported ${result.result.meta.imported ?? 0} rows from ${fileName}`);
    } else {
      console.warn(`  Failed to import ${fileName}:`, result.error || "unknown error");
    }
  }

  console.log(`Total imported rows: ${importedTotal}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
