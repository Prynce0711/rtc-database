const fs = require("fs/promises");
const path = require("path");
const XLSX = require("xlsx");
const Database = require("better-sqlite3");

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function findColumnValue(row, candidates) {
  for (const key of Object.keys(row)) {
    const normalizedKey = String(key).trim().toLowerCase();
    for (const candidate of candidates) {
      if (normalizedKey === candidate.toLowerCase()) {
        return row[key];
      }
    }
  }
  return undefined;
}

function isMappedRowEmpty(cells, skipRows = []) {
  return skipRows.every((key) => {
    const value = cells[key];
    return value === undefined || value === null || value === "";
  });
}

function parseMonthFromFilename(name) {
  const lower = name.toLowerCase();
  const yearMatch = name.match(/(20\d{2})/);
  const year = yearMatch ? yearMatch[1] : undefined;
  const months = {
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

function hasRequiredHeaders(headerKeys, row, requiredHeaders) {
  for (const headerKey of Object.values(requiredHeaders)) {
    if (Array.isArray(headerKey)) {
      const found = headerKey.some((candidate) =>
        headerKeys.some((key) => key.trim().toLowerCase() === candidate.toLowerCase()),
      );
      if (!found) return false;
    }
  }
  return true;
}

async function main() {
  const baseDir = path.resolve(__dirname, "..", "..", "RTC-DATA", "Analytics", "Monthly Report RTC Nov 2023");
  const dbPath = path.resolve(__dirname, "..", "dev.db");
  const dirents = await fs.readdir(baseDir, { withFileTypes: true });
  const files = dirents
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => /\.xls[xm]?$/.test(n));

  if (files.length === 0) {
    console.log(`No Excel files found in ${baseDir}`);
    return;
  }

  console.log(`Importing ${files.length} files from ${baseDir}`);
  const db = new Database(dbPath, { readonly: false });
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");

  const insertStmt = db.prepare(`INSERT OR IGNORE INTO monthlyStatistics (month, category, branch, criminal, civil, total) VALUES (?, ?, ?, ?, ?, ?)`);
  let importedTotal = 0;

  for (const fileName of files) {
    const filePath = path.join(baseDir, fileName);
    const workbook = XLSX.readFile(filePath);
    const fallbackMonth = parseMonthFromFilename(fileName);
    if (!fallbackMonth) {
      console.warn(`Skipping ${fileName}: unable to parse month from filename`);
      continue;
    }

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      if (rows.length === 0) continue;
      const headerKeys = Object.keys(rows[0]);
      const requiredHeaders = {
        Category: ["Category", "Case Category"],
        Branch: ["Branch", "Branch/Station", "Station"],
      };
      if (!hasRequiredHeaders(headerKeys, rows[0], requiredHeaders)) {
        console.warn(`Skipping sheet ${sheetName} in ${fileName}: required headers not found`);
        continue;
      }
      for (const row of rows) {
        const cells = {
          monthCell: findColumnValue(row, ["Month", "Period", "Report Month"]),
          categoryCell: findColumnValue(row, ["Category", "Case Category"]),
          branchCell: findColumnValue(row, ["Branch", "Branch/Station", "Station"]),
          criminalCell: findColumnValue(row, ["Criminal", "Crim"]),
          civilCell: findColumnValue(row, ["Civil"]),
          totalCell: findColumnValue(row, ["Total", "Grand Total"]),
        };

        if (isMappedRowEmpty(cells, ["categoryCell", "branchCell"])) {
          continue;
        }

        const month = normalizeText(cells.monthCell || fallbackMonth);
        const category = "Pending Cases";
        const branch = normalizeText(cells.branchCell);
        if (!month || !branch) {
          continue;
        }
        const criminal = toNumber(cells.criminalCell);
        const civil = toNumber(cells.civilCell);
        const totalFromFile = toNumber(cells.totalCell);
        const total = cells.totalCell === undefined || cells.totalCell === "" ? criminal + civil : totalFromFile;
        const info = insertStmt.run(month, category, branch, criminal, civil, total);
        if (info.changes > 0) {
          importedTotal += 1;
        }
      }
    }
  }

  console.log(`Imported ${importedTotal} rows into ${dbPath}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
