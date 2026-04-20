import Database from "better-sqlite3";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getDatabasePath } from "./databasePath";

const require = createRequire(import.meta.url);
const sharedPackageEntryPath = require.resolve("@rtc-database/shared");
const sharedPackageRoot = path.dirname(path.dirname(sharedPackageEntryPath));
const sharedMigrationsPath = path.join(
  sharedPackageRoot,
  "prisma",
  "migrations",
);

const hasCaseTable = (database: Database.Database): boolean => {
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get("Case") as { name?: string } | undefined;

  return Boolean(table?.name);
};

const listMigrationDirectories = async (): Promise<string[]> => {
  const entries = await fs.readdir(sharedMigrationsPath, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

export const ensureNativeDatabaseReady = async (): Promise<void> => {
  const databasePath = getDatabasePath();
  await fs.mkdir(path.dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);

  try {
    database.pragma("foreign_keys = ON");

    if (hasCaseTable(database)) {
      return;
    }

    const migrationDirectories = await listMigrationDirectories();

    database.exec("BEGIN IMMEDIATE");

    try {
      for (const migrationDirectory of migrationDirectories) {
        const migrationSqlPath = path.join(
          sharedMigrationsPath,
          migrationDirectory,
          "migration.sql",
        );
        const migrationSql = await fs.readFile(migrationSqlPath, "utf8");
        database.exec(migrationSql);
      }

      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.close();
  }
};
