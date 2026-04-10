import "server-only";

import Database from "better-sqlite3";
import {
  access,
  copyFile,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { BACKUP_DATA_DIR } from "./configStore";
import {
  MANUAL_BACKUP_FOLDER,
  type BackupImportSourceKey,
  type BackupIntervalKey,
} from "./constants";
import type { BackupConfig, BackupLogEntry } from "./types";

interface PrismaTableExpectation {
  modelName: string;
  tableName: string;
  requiredColumns: string[];
}

interface SqliteTableRow {
  name: string;
}

interface SqliteColumnRow {
  name: string;
}

interface RunRcloneCommandOptions {
  trackAsActiveBackup?: boolean;
  trackAsActiveAccountSetup?: boolean;
  silent?: boolean;
}

type RunRcloneCommand = (
  args: string[],
  flags?: Record<string, unknown>,
  options?: RunRcloneCommandOptions,
) => Promise<string>;

interface BackupIntervalDefinitionLike {
  folderName: string;
}

const DEFAULT_PRISMA_SCHEMA_PATH = path.join(
  process.cwd(),
  "prisma",
  "schema.prisma",
);
const DEFAULT_IMPORT_TEMP_DB_PATH = path.join(
  BACKUP_DATA_DIR,
  "import-temp.db",
);
const DEFAULT_PRE_IMPORT_BACKUP_PATH = path.join(
  BACKUP_DATA_DIR,
  "dev.db.pre-import.bak",
);

export interface BackupImporterDeps {
  fixedBackupSourcePath: string;
  prismaSchemaPath?: string;
  importTempDbPath?: string;
  preImportBackupPath?: string;
  isBackupImportSourceKey: (value: unknown) => value is BackupImportSourceKey;
  getIntervalDefinition: (
    intervalKey: BackupIntervalKey,
  ) => BackupIntervalDefinitionLike;
  normalizeRemoteName: (value: string) => string;
  readBackupConfigFile: () => Promise<BackupConfig>;
  writeBackupConfigFile: (config: BackupConfig) => Promise<BackupConfig>;
  joinRemotePath: (...segments: string[]) => string;
  buildRcloneDestination: (remoteName: string, remotePath: string) => string;
  runRcloneCommand: RunRcloneCommand;
  formatBackupError: (error: unknown) => string;
  isRemotePathNotFoundError: (message: string) => boolean;
  appendBackupLog: (level: BackupLogEntry["level"], message: string) => void;
  getBackupRunning: () => boolean;
  setBackupRunning: (value: boolean) => void;
  setCancelBackupRequested: (value: boolean) => void;
  clearActiveBackupProcess: () => void;
}

export interface BackupImporter {
  importBackupFromRemote: (
    remoteName: string,
    source: string,
  ) => Promise<BackupConfig>;
  importBackupFromLocalPath: (localFilePath: string) => Promise<BackupConfig>;
  importBackupFromLocalUpload: (
    fileName: string,
    fileBytes: Uint8Array,
  ) => Promise<BackupConfig>;
}

let configuredBackupImporter: BackupImporter | null = null;

function getConfiguredBackupImporter(): BackupImporter {
  if (!configuredBackupImporter) {
    throw new Error(
      "Backup importer is not configured. Ensure backupScheduler is imported before calling importer APIs.",
    );
  }

  return configuredBackupImporter;
}

function quoteSqliteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function parsePrismaSchemaExpectations(
  schemaContent: string,
): PrismaTableExpectation[] {
  const modelNames = new Set<string>();
  const modelNamePattern = /^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm;

  for (const match of schemaContent.matchAll(modelNamePattern)) {
    modelNames.add(match[1]);
  }

  const expectations: PrismaTableExpectation[] = [];
  const modelPattern =
    /^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)^\s*\}/gm;

  for (const match of schemaContent.matchAll(modelPattern)) {
    const modelName = match[1];
    const body = match[2] ?? "";
    const mappedName = body.match(/@@map\("([^"]+)"\)/)?.[1]?.trim();
    const tableName = mappedName || modelName;
    const requiredColumns = new Set<string>();

    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (
        !line ||
        line.startsWith("//") ||
        line.startsWith("///") ||
        line.startsWith("@@")
      ) {
        continue;
      }

      const [fieldName, fieldType] = line.split(/\s+/, 3);
      if (!fieldName || !fieldType || fieldName.startsWith("@")) {
        continue;
      }

      if (fieldType.endsWith("[]") || line.includes("@relation(")) {
        continue;
      }

      const normalizedFieldType = fieldType.replace(/\?/g, "");
      if (modelNames.has(normalizedFieldType)) {
        continue;
      }

      requiredColumns.add(fieldName);
    }

    expectations.push({
      modelName,
      tableName,
      requiredColumns: Array.from(requiredColumns),
    });
  }

  return expectations;
}

export function createBackupImporter(deps: BackupImporterDeps): BackupImporter {
  const prismaSchemaPath = deps.prismaSchemaPath ?? DEFAULT_PRISMA_SCHEMA_PATH;
  const importTempDbPath = deps.importTempDbPath ?? DEFAULT_IMPORT_TEMP_DB_PATH;
  const preImportBackupPath =
    deps.preImportBackupPath ?? DEFAULT_PRE_IMPORT_BACKUP_PATH;

  let cachedPrismaSchemaExpectations: PrismaTableExpectation[] | null = null;

  const getPrismaSchemaExpectations = async (): Promise<
    PrismaTableExpectation[]
  > => {
    if (cachedPrismaSchemaExpectations) {
      return cachedPrismaSchemaExpectations;
    }

    let schemaContent: string;
    try {
      schemaContent = await readFile(prismaSchemaPath, "utf8");
    } catch {
      throw new Error(
        `Cannot validate backup file: schema.prisma not found at ${prismaSchemaPath}.`,
      );
    }

    const expectations = parsePrismaSchemaExpectations(schemaContent);
    if (expectations.length === 0) {
      throw new Error(
        "Cannot validate backup file: no Prisma models were found in schema.prisma.",
      );
    }

    cachedPrismaSchemaExpectations = expectations;
    return expectations;
  };

  const validateDatabaseAgainstPrismaSchema = async (
    databasePath: string,
  ): Promise<void> => {
    const expectations = await getPrismaSchemaExpectations();

    let database: Database.Database | null = null;
    try {
      database = new Database(databasePath, {
        readonly: true,
        fileMustExist: true,
      });
    } catch {
      throw new Error("Selected backup file is not a valid SQLite database.");
    }

    try {
      const tableRows = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as SqliteTableRow[];

      const existingTableNames = new Set(
        tableRows.map((row) => String(row.name || "").toLowerCase()),
      );

      const missingTables = expectations
        .filter(
          (expectation) =>
            !existingTableNames.has(expectation.tableName.toLowerCase()),
        )
        .map((expectation) => expectation.tableName);

      if (missingTables.length > 0) {
        const preview = missingTables.slice(0, 8).join(", ");
        const suffix =
          missingTables.length > 8
            ? ` and ${missingTables.length - 8} more`
            : "";

        throw new Error(
          `Backup file schema mismatch with schema.prisma: missing required tables (${preview}${suffix}).`,
        );
      }

      const missingColumns: string[] = [];

      for (const expectation of expectations) {
        const columns = database
          .prepare(
            `PRAGMA table_info(${quoteSqliteIdentifier(expectation.tableName)})`,
          )
          .all() as SqliteColumnRow[];

        const existingColumns = new Set(
          columns.map((column) => String(column.name || "").toLowerCase()),
        );

        for (const columnName of expectation.requiredColumns) {
          if (!existingColumns.has(columnName.toLowerCase())) {
            missingColumns.push(`${expectation.tableName}.${columnName}`);
          }
        }
      }

      if (missingColumns.length > 0) {
        const preview = missingColumns.slice(0, 10).join(", ");
        const suffix =
          missingColumns.length > 10
            ? ` and ${missingColumns.length - 10} more`
            : "";

        throw new Error(
          `Backup file schema mismatch with schema.prisma: missing required columns (${preview}${suffix}).`,
        );
      }
    } finally {
      database.close();
    }
  };

  const resolveImportSourceFolder = (source: BackupImportSourceKey): string => {
    if (source === "manual") {
      return MANUAL_BACKUP_FOLDER;
    }

    return deps.getIntervalDefinition(source).folderName;
  };

  const doesRemoteBackupExist = async (
    remoteName: string,
    remoteFolderRelativePath: string,
    backupFileName: string,
  ): Promise<boolean> => {
    const remoteFolder = deps.buildRcloneDestination(
      remoteName,
      remoteFolderRelativePath,
    );

    try {
      const output = await deps.runRcloneCommand(
        ["lsf", remoteFolder],
        {
          "files-only": true,
        },
        {
          silent: true,
        },
      );

      const files = output
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/\/+$/g, ""))
        .filter((line) => !!line);

      return files.includes(backupFileName);
    } catch (error) {
      const message = deps.formatBackupError(error);

      if (deps.isRemotePathNotFoundError(message)) {
        return false;
      }

      throw new Error(message);
    }
  };

  const applyImportedDatabaseFromTempFile = async (
    tempFilePath: string,
  ): Promise<void> => {
    await access(tempFilePath);
    await validateDatabaseAgainstPrismaSchema(tempFilePath);

    try {
      await copyFile(deps.fixedBackupSourcePath, preImportBackupPath);
    } catch {
      // Ignore pre-import backup failures and continue with import.
    }

    try {
      await copyFile(tempFilePath, deps.fixedBackupSourcePath);
    } catch (error) {
      const message = deps.formatBackupError(error);
      const lowered = message.toLowerCase();

      if (
        lowered.includes("ebusy") ||
        lowered.includes("eperm") ||
        lowered.includes("access is denied")
      ) {
        throw new Error(
          "Database file is currently in use. Close active connections and try again.",
        );
      }

      throw error instanceof Error ? error : new Error(message);
    }
  };

  const importBackupFromRemote = async (
    remoteName: string,
    source: string,
  ): Promise<BackupConfig> => {
    const normalizedRemoteName = deps.normalizeRemoteName(remoteName);
    if (!normalizedRemoteName) {
      throw new Error("Remote name is required.");
    }

    if (!deps.isBackupImportSourceKey(source)) {
      throw new Error("Invalid backup source.");
    }

    if (deps.getBackupRunning()) {
      throw new Error("A backup or database update is already running.");
    }

    const config = await deps.readBackupConfigFile();
    const sourceFolder = resolveImportSourceFolder(source);
    const backupFileName = path.basename(deps.fixedBackupSourcePath);
    const remoteBasePath = (
      config.remoteBasePaths[normalizedRemoteName] ?? ""
    ).trim();
    const remoteSourceFolderRelativePath = deps.joinRemotePath(
      remoteBasePath,
      config.remotePath,
      sourceFolder,
    );
    const remoteSourceRelativePath = deps.joinRemotePath(
      remoteSourceFolderRelativePath,
      backupFileName,
    );
    const remoteSource = deps.buildRcloneDestination(
      normalizedRemoteName,
      remoteSourceRelativePath,
    );

    const backupExists = await doesRemoteBackupExist(
      normalizedRemoteName,
      remoteSourceFolderRelativePath,
      backupFileName,
    );

    if (!backupExists) {
      throw new Error(
        `Backup does not exist in ${normalizedRemoteName}:${remoteSourceRelativePath}.`,
      );
    }

    let current = await deps.readBackupConfigFile();

    deps.setBackupRunning(true);
    deps.setCancelBackupRequested(false);

    current = await deps.writeBackupConfigFile({
      ...current,
      lastRunStatus: "RUNNING",
      lastRunMessage: "Updating database from remote backup...",
    });
    deps.appendBackupLog(
      "warn",
      `Updating database from remote backup ${normalizedRemoteName}:${remoteSourceRelativePath}`,
    );

    try {
      await deps.runRcloneCommand(
        ["copyto", remoteSource, importTempDbPath],
        {
          "check-first": true,
        },
        {
          trackAsActiveBackup: true,
        },
      );

      await applyImportedDatabaseFromTempFile(importTempDbPath);

      const nowIso = new Date().toISOString();
      const message = `Database updated from remote ${normalizedRemoteName}.`;

      const updated = await deps.writeBackupConfigFile({
        ...current,
        lastRunAt: nowIso,
        lastRunStatus: "SUCCESS",
        lastRunMessage: message,
      });

      deps.appendBackupLog("info", message);

      return updated;
    } catch (error) {
      const rawMessage = deps.formatBackupError(error);
      const message = deps.isRemotePathNotFoundError(rawMessage)
        ? `Backup does not exist in ${normalizedRemoteName}:${remoteSourceRelativePath}.`
        : rawMessage;
      const nowIso = new Date().toISOString();

      await deps.writeBackupConfigFile({
        ...current,
        lastRunAt: nowIso,
        lastRunStatus: "FAILED",
        lastRunMessage: message,
      });

      deps.appendBackupLog("error", message);

      throw new Error(message);
    } finally {
      deps.clearActiveBackupProcess();
      deps.setCancelBackupRequested(false);
      deps.setBackupRunning(false);

      try {
        await unlink(importTempDbPath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  };

  const importBackupFromLocalPath = async (
    localFilePath: string,
  ): Promise<BackupConfig> => {
    const trimmedPath = localFilePath.trim();
    if (!trimmedPath) {
      throw new Error("Local backup file path is required.");
    }

    const resolvedPath = path.resolve(trimmedPath);
    if (resolvedPath === deps.fixedBackupSourcePath) {
      throw new Error("Selected file is already the active database.");
    }

    let sourceStats: Awaited<ReturnType<typeof stat>>;
    try {
      sourceStats = await stat(resolvedPath);
    } catch {
      throw new Error(`Local file not found: ${resolvedPath}`);
    }

    if (!sourceStats.isFile()) {
      throw new Error("Selected local backup path is not a file.");
    }

    if (deps.getBackupRunning()) {
      throw new Error("A backup or database update is already running.");
    }

    let current = await deps.readBackupConfigFile();

    deps.setBackupRunning(true);
    deps.setCancelBackupRequested(false);

    current = await deps.writeBackupConfigFile({
      ...current,
      lastRunStatus: "RUNNING",
      lastRunMessage: "Updating database from local backup file...",
    });
    deps.appendBackupLog(
      "warn",
      `Updating database from local file ${resolvedPath}`,
    );

    try {
      await copyFile(resolvedPath, importTempDbPath);
      await applyImportedDatabaseFromTempFile(importTempDbPath);

      const nowIso = new Date().toISOString();
      const message = `Database updated from local file ${resolvedPath}.`;

      const updated = await deps.writeBackupConfigFile({
        ...current,
        lastRunAt: nowIso,
        lastRunStatus: "SUCCESS",
        lastRunMessage: message,
      });

      deps.appendBackupLog("info", message);

      return updated;
    } catch (error) {
      const message = deps.formatBackupError(error);
      const nowIso = new Date().toISOString();

      await deps.writeBackupConfigFile({
        ...current,
        lastRunAt: nowIso,
        lastRunStatus: "FAILED",
        lastRunMessage: message,
      });

      deps.appendBackupLog("error", message);

      throw new Error(message);
    } finally {
      deps.clearActiveBackupProcess();
      deps.setCancelBackupRequested(false);
      deps.setBackupRunning(false);

      try {
        await unlink(importTempDbPath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  };

  const importBackupFromLocalUpload = async (
    fileName: string,
    fileBytes: Uint8Array,
  ): Promise<BackupConfig> => {
    const normalizedFileName =
      path.basename(fileName || "").trim() || "uploaded-backup.db";

    if (!(fileBytes instanceof Uint8Array) || fileBytes.byteLength === 0) {
      throw new Error("Selected backup file is empty.");
    }

    if (deps.getBackupRunning()) {
      throw new Error("A backup or database update is already running.");
    }

    let current = await deps.readBackupConfigFile();

    deps.setBackupRunning(true);
    deps.setCancelBackupRequested(false);

    current = await deps.writeBackupConfigFile({
      ...current,
      lastRunStatus: "RUNNING",
      lastRunMessage: "Updating database from uploaded backup file...",
    });
    deps.appendBackupLog(
      "warn",
      `Updating database from uploaded file ${normalizedFileName}`,
    );

    try {
      await writeFile(importTempDbPath, fileBytes);
      await applyImportedDatabaseFromTempFile(importTempDbPath);

      const nowIso = new Date().toISOString();
      const message = `Database updated from uploaded file ${normalizedFileName}.`;

      const updated = await deps.writeBackupConfigFile({
        ...current,
        lastRunAt: nowIso,
        lastRunStatus: "SUCCESS",
        lastRunMessage: message,
      });

      deps.appendBackupLog("info", message);

      return updated;
    } catch (error) {
      const message = deps.formatBackupError(error);
      const nowIso = new Date().toISOString();

      await deps.writeBackupConfigFile({
        ...current,
        lastRunAt: nowIso,
        lastRunStatus: "FAILED",
        lastRunMessage: message,
      });

      deps.appendBackupLog("error", message);

      throw new Error(message);
    } finally {
      deps.clearActiveBackupProcess();
      deps.setCancelBackupRequested(false);
      deps.setBackupRunning(false);

      try {
        await unlink(importTempDbPath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  };

  return {
    importBackupFromRemote,
    importBackupFromLocalPath,
    importBackupFromLocalUpload,
  };
}

export function configureBackupImporter(deps: BackupImporterDeps): void {
  configuredBackupImporter = createBackupImporter(deps);
}

export async function importBackupFromRemote(
  remoteName: string,
  source: string,
): Promise<BackupConfig> {
  return getConfiguredBackupImporter().importBackupFromRemote(
    remoteName,
    source,
  );
}

export async function importBackupFromLocalPath(
  localFilePath: string,
): Promise<BackupConfig> {
  return getConfiguredBackupImporter().importBackupFromLocalPath(localFilePath);
}

export async function importBackupFromLocalUpload(
  fileName: string,
  fileBytes: Uint8Array,
): Promise<BackupConfig> {
  return getConfiguredBackupImporter().importBackupFromLocalUpload(
    fileName,
    fileBytes,
  );
}
