import "server-only";

import Database from "better-sqlite3";
import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const BACKUP_INTERVAL_DEFINITIONS = [
  {
    value: "5m",
    label: "Every 5 minutes",
    description: "Automatic backup every 5 minutes",
    folderName: "every-5-minutes",
    unit: "minutes",
    amount: 5,
  },
  {
    value: "15m",
    label: "Every 15 minutes",
    description: "Automatic backup every 15 minutes",
    folderName: "every-15-minutes",
    unit: "minutes",
    amount: 15,
  },
  {
    value: "1h",
    label: "Every 1 hour",
    description: "Automatic backup every hour",
    folderName: "every-1-hour",
    unit: "hours",
    amount: 1,
  },
  {
    value: "1d",
    label: "Every 1 day",
    description: "Automatic backup every day",
    folderName: "every-1-day",
    unit: "days",
    amount: 1,
  },
  {
    value: "1w",
    label: "Every 1 week",
    description: "Automatic backup every week",
    folderName: "every-1-week",
    unit: "weeks",
    amount: 1,
  },
  {
    value: "1mo",
    label: "Every 1 month",
    description: "Automatic backup every month",
    folderName: "every-1-month",
    unit: "months",
    amount: 1,
  },
  {
    value: "1y",
    label: "Every 1 year",
    description: "Automatic backup every year",
    folderName: "every-1-year",
    unit: "years",
    amount: 1,
  },
] as const;

export type BackupIntervalKey =
  (typeof BACKUP_INTERVAL_DEFINITIONS)[number]["value"];

export interface BackupIntervalOption {
  value: BackupIntervalKey;
  label: string;
  description: string;
  folderName: string;
}

export const BACKUP_INTERVAL_OPTIONS: BackupIntervalOption[] =
  BACKUP_INTERVAL_DEFINITIONS.map((definition) => ({
    value: definition.value,
    label: definition.label,
    description: definition.description,
    folderName: definition.folderName,
  }));

const BACKUP_INTERVAL_KEYS: BackupIntervalKey[] = BACKUP_INTERVAL_OPTIONS.map(
  (option) => option.value,
);

const BACKUP_INTERVAL_LOOKUP = new Map<
  BackupIntervalKey,
  (typeof BACKUP_INTERVAL_DEFINITIONS)[number]
>(
  BACKUP_INTERVAL_DEFINITIONS.map((definition) => [
    definition.value,
    definition,
  ]) as Array<
    [BackupIntervalKey, (typeof BACKUP_INTERVAL_DEFINITIONS)[number]]
  >,
);

const DEFAULT_SELECTED_INTERVALS: BackupIntervalKey[] = ["1h"];
const MANUAL_BACKUP_FOLDER = "manual";

export type BackupImportSourceKey = "manual" | BackupIntervalKey;

export interface BackupImportSourceOption {
  value: BackupImportSourceKey;
  label: string;
  description: string;
  folderName: string;
}

export const BACKUP_IMPORT_SOURCE_OPTIONS: BackupImportSourceOption[] = [
  {
    value: "manual",
    label: "Manual Backup",
    description: "Import from the manual backup folder",
    folderName: MANUAL_BACKUP_FOLDER,
  },
  ...BACKUP_INTERVAL_OPTIONS.map((interval) => ({
    value: interval.value,
    label: interval.label,
    description: `Import from ${interval.folderName} backups`,
    folderName: interval.folderName,
  })),
];

export type BackupRunStatus =
  | "IDLE"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export interface BackupLogEntry {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface BackupConfig {
  enabled: boolean;
  selectedIntervals: BackupIntervalKey[];
  selectedRemoteNames: string[];
  remotePath: string;
  lastRunAt: string | null;
  lastRunStatus: BackupRunStatus;
  lastRunMessage: string | null;
  updatedAt: string;
}

export interface BackupRemote {
  name: string;
  provider: string;
}

export interface BackupProviderOption {
  value: string;
  label: string;
  description: string;
}

export interface BackupConfigPatch {
  enabled?: boolean;
  selectedIntervals?: string[];
  selectedRemoteNames?: string[];
  remotePath?: string;
}

export const BACKUP_PROVIDER_OPTIONS: BackupProviderOption[] = [
  {
    value: "drive",
    label: "Google Drive",
    description: "Google Drive remote (rclone type: drive)",
  },
  {
    value: "onedrive",
    label: "OneDrive",
    description: "Microsoft OneDrive remote",
  },
  {
    value: "dropbox",
    label: "Dropbox",
    description: "Dropbox storage remote",
  },
  {
    value: "s3",
    label: "S3 Compatible",
    description: "Amazon S3 or S3-compatible object storage",
  },
  {
    value: "b2",
    label: "Backblaze B2",
    description: "Backblaze B2 cloud storage",
  },
  {
    value: "ftp",
    label: "FTP",
    description: "FTP server remote",
  },
  {
    value: "sftp",
    label: "SFTP",
    description: "SFTP/SSH remote",
  },
  {
    value: "local",
    label: "Local Folder",
    description: "Another local path as destination",
  },
];

const BACKUP_DATA_DIR = path.join(process.cwd(), "data", "backup");
const BACKUP_CONFIG_PATH = path.join(BACKUP_DATA_DIR, "backup-config.json");
const RCLONE_CONFIG_PATH = path.join(BACKUP_DATA_DIR, "rclone.conf");
const PRISMA_SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");
const FIXED_BACKUP_SOURCE_PATH = path.join(process.cwd(), "dev.db");
const IMPORT_TEMP_DB_PATH = path.join(BACKUP_DATA_DIR, "import-temp.db");
const PRE_IMPORT_BACKUP_PATH = path.join(
  BACKUP_DATA_DIR,
  "dev.db.pre-import.bak",
);
const RCLONE_EXECUTABLE_NAME =
  process.platform === "win32" ? "rclone.exe" : "rclone";
const MAX_BACKUP_LOG_ENTRIES = 500;
const MAX_TIMER_MS = 2_147_000_000;
const ACCOUNT_SETUP_STALE_MS = 3 * 60 * 1000;
const DEFAULT_AUTH_CALLBACK_PORT = 53682;

type RclonePromiseApi = ((...args: unknown[]) => Promise<Buffer>) &
  Record<string, (...args: unknown[]) => Promise<Buffer>>;

type RcloneApi = ((...args: unknown[]) => ChildProcess) & {
  promises?: RclonePromiseApi;
};

let rcloneApi: RcloneApi | null = null;

let schedulerStarted = false;
const scheduleTimers: Partial<
  Record<BackupIntervalKey, ReturnType<typeof setTimeout>>
> = {};
const intervalNextRunTargets: Partial<Record<BackupIntervalKey, string>> = {};
let backupRunning = false;
let activeBackupProcess: ChildProcess | null = null;
let cancelBackupRequested = false;
let backupLogs: BackupLogEntry[] = [];
let accountSetupRunning = false;
let activeAccountSetupProcess: ChildProcess | null = null;
let accountSetupStartedAt = 0;
let cachedPrismaSchemaExpectations: PrismaTableExpectation[] | null = null;

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

function isBackupRunStatus(value: unknown): value is BackupRunStatus {
  return (
    value === "IDLE" ||
    value === "RUNNING" ||
    value === "SUCCESS" ||
    value === "FAILED" ||
    value === "CANCELLED"
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isBackupIntervalKey(value: unknown): value is BackupIntervalKey {
  return (
    typeof value === "string" &&
    BACKUP_INTERVAL_LOOKUP.has(value as BackupIntervalKey)
  );
}

function isBackupImportSourceKey(
  value: unknown,
): value is BackupImportSourceKey {
  return (
    value === "manual" ||
    (typeof value === "string" && isBackupIntervalKey(value))
  );
}

function mapLegacyIntervalToKey(value: unknown): BackupIntervalKey | null {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  switch (parsed) {
    case 5:
      return "5m";
    case 15:
      return "15m";
    case 60:
      return "1h";
    case 1440:
      return "1d";
    case 10080:
      return "1w";
    case 43200:
      return "1mo";
    case 525600:
      return "1y";
    default:
      return null;
  }
}

function normalizeSelectedIntervals(
  value: unknown,
  legacyIntervalMinutes?: unknown,
  fallbackToDefault = true,
): BackupIntervalKey[] {
  if (Array.isArray(value)) {
    const normalized = Array.from(
      new Set(
        value.filter((entry): entry is BackupIntervalKey =>
          isBackupIntervalKey(entry),
        ),
      ),
    );

    if (normalized.length > 0 || !fallbackToDefault) {
      return normalized;
    }
  }

  const legacy = mapLegacyIntervalToKey(legacyIntervalMinutes);
  if (legacy) {
    return [legacy];
  }

  return fallbackToDefault ? [...DEFAULT_SELECTED_INTERVALS] : [];
}

function normalizeSelectedRemoteNames(
  value: unknown,
  legacyRemoteName?: unknown,
  fallbackToLegacy = true,
): string[] {
  if (Array.isArray(value)) {
    const normalized = Array.from(
      new Set(
        value
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => normalizeRemoteName(entry))
          .filter((entry) => !!entry),
      ),
    );

    if (normalized.length > 0 || !fallbackToLegacy) {
      return normalized;
    }
  }

  if (typeof legacyRemoteName === "string") {
    const normalizedLegacy = normalizeRemoteName(legacyRemoteName);
    if (normalizedLegacy) {
      return [normalizedLegacy];
    }
  }

  return [];
}

function getIntervalDefinition(intervalKey: BackupIntervalKey) {
  const definition = BACKUP_INTERVAL_LOOKUP.get(intervalKey);
  if (!definition) {
    throw new Error(`Unsupported backup interval: ${intervalKey}`);
  }

  return definition;
}

function addIntervalToDate(base: Date, intervalKey: BackupIntervalKey): Date {
  const definition = getIntervalDefinition(intervalKey);
  const target = new Date(base);

  switch (definition.unit) {
    case "minutes":
      target.setMinutes(target.getMinutes() + definition.amount);
      break;
    case "hours":
      target.setHours(target.getHours() + definition.amount);
      break;
    case "days":
      target.setDate(target.getDate() + definition.amount);
      break;
    case "weeks":
      target.setDate(target.getDate() + 7 * definition.amount);
      break;
    case "months":
      target.setMonth(target.getMonth() + definition.amount);
      break;
    case "years":
      target.setFullYear(target.getFullYear() + definition.amount);
      break;
  }

  return target;
}

function joinRemotePath(...segments: string[]): string {
  return segments
    .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ""))
    .filter((segment) => !!segment)
    .join("/");
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

async function getPrismaSchemaExpectations(): Promise<
  PrismaTableExpectation[]
> {
  if (cachedPrismaSchemaExpectations) {
    return cachedPrismaSchemaExpectations;
  }

  let schemaContent: string;
  try {
    schemaContent = await readFile(PRISMA_SCHEMA_PATH, "utf8");
  } catch {
    throw new Error(
      `Cannot validate backup file: schema.prisma not found at ${PRISMA_SCHEMA_PATH}.`,
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
}

async function validateDatabaseAgainstPrismaSchema(
  databasePath: string,
): Promise<void> {
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
        missingTables.length > 8 ? ` and ${missingTables.length - 8} more` : "";

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
}

function resolveImportSourceFolder(source: BackupImportSourceKey): string {
  if (source === "manual") {
    return MANUAL_BACKUP_FOLDER;
  }

  return getIntervalDefinition(source).folderName;
}

async function applyImportedDatabaseFromTempFile(
  tempFilePath: string,
): Promise<void> {
  await access(tempFilePath);
  await validateDatabaseAgainstPrismaSchema(tempFilePath);

  try {
    await copyFile(FIXED_BACKUP_SOURCE_PATH, PRE_IMPORT_BACKUP_PATH);
  } catch {
    // Ignore pre-import backup failures and continue with import.
  }

  try {
    await copyFile(tempFilePath, FIXED_BACKUP_SOURCE_PATH);
  } catch (error) {
    const message = formatBackupError(error);
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
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeRemoteName(value: string): string {
  return value.trim().replace(/:+$/, "");
}

function formatBackupError(error: unknown): string {
  if (Buffer.isBuffer(error)) {
    const message = error.toString("utf8").trim();
    return message || "rclone command failed";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown backup error";
}

function isAuthServerPortConflictError(message: string): boolean {
  const lowered = message.toLowerCase();

  return (
    lowered.includes("failed to start auth webserver") &&
    (lowered.includes("address already in use") ||
      lowered.includes("only one usage of each socket address") ||
      lowered.includes("bind:"))
  );
}

function extractAuthCallbackPort(message: string): number {
  const match = message.match(/(?:127\.0\.0\.1|localhost):(\d{2,5})/i);
  const parsed = Number(match?.[1] ?? "");

  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  return DEFAULT_AUTH_CALLBACK_PORT;
}

async function runExecFile(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(String(stdout ?? ""));
      },
    );
  });
}

async function forceReleaseAuthCallbackPort(port: number): Promise<boolean> {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    const output = await runExecFile("netstat", ["-ano", "-p", "tcp"]);
    const processIds = new Set<string>();

    for (const line of output.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) {
        continue;
      }

      const protocol = parts[0].toUpperCase();
      const localAddress = parts[1];
      const state = parts[3].toUpperCase();
      const processId = parts[4];

      if (protocol !== "TCP") {
        continue;
      }

      if (state !== "LISTENING") {
        continue;
      }

      if (!localAddress.endsWith(`:${String(port)}`)) {
        continue;
      }

      if (!/^\d+$/.test(processId) || processId === "0") {
        continue;
      }

      processIds.add(processId);
    }

    if (processIds.size === 0) {
      return false;
    }

    for (const processId of processIds) {
      try {
        await runExecFile("taskkill", ["/PID", processId, "/F"]);
      } catch {
        // Ignore individual taskkill failures and continue.
      }
    }

    appendBackupLog(
      "warn",
      `Released callback port ${String(port)} by terminating existing authorization process(es).`,
    );

    return true;
  } catch {
    return false;
  }
}

async function ensureAccountSetupIsAvailable(
  forceRestart = false,
): Promise<void> {
  if (!accountSetupRunning) {
    return;
  }

  if (!activeAccountSetupProcess) {
    accountSetupRunning = false;
    accountSetupStartedAt = 0;
    return;
  }

  if (forceRestart) {
    appendBackupLog(
      "warn",
      "Override requested. Terminating existing account authorization flow.",
    );

    try {
      activeAccountSetupProcess.kill();
    } catch {
      // Ignore and wait for the process close handler.
    }

    const deadline = Date.now() + 5_000;
    while (accountSetupRunning && Date.now() < deadline) {
      await sleep(100);
    }

    if (accountSetupRunning) {
      throw new Error(
        "Unable to stop the existing account authorization flow. Close the previous browser sign-in window and try again.",
      );
    }

    return;
  }

  const ageMs = Date.now() - accountSetupStartedAt;
  if (ageMs > ACCOUNT_SETUP_STALE_MS) {
    appendBackupLog(
      "warn",
      "Detected stale account authorization flow. Terminating previous process.",
    );

    try {
      activeAccountSetupProcess.kill();
    } catch {
      // Ignore and wait for the process close handler.
    }

    const deadline = Date.now() + 3_000;
    while (accountSetupRunning && Date.now() < deadline) {
      await sleep(100);
    }
  }

  if (accountSetupRunning) {
    throw new Error(
      "Another account authorization is already in progress. Complete it in the browser, then try again.",
    );
  }
}

function appendBackupLog(
  level: BackupLogEntry["level"],
  message: string,
): void {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }

  const entry: BackupLogEntry = {
    at: new Date().toISOString(),
    level,
    message: trimmed,
  };

  backupLogs.push(entry);
  if (backupLogs.length > MAX_BACKUP_LOG_ENTRIES) {
    backupLogs = backupLogs.slice(backupLogs.length - MAX_BACKUP_LOG_ENTRIES);
  }

  const prefix =
    level === "error"
      ? "[rclone:error]"
      : level === "warn"
        ? "[rclone:warn]"
        : "[rclone]";

  if (level === "error") {
    console.error(prefix, trimmed);
  } else if (level === "warn") {
    console.warn(prefix, trimmed);
  } else {
    console.log(prefix, trimmed);
  }
}

function appendBackupChunk(
  level: BackupLogEntry["level"],
  chunk: Buffer,
): void {
  const text = chunk.toString("utf8");

  for (const line of text.split(/\r?\n/)) {
    appendBackupLog(level, line);
  }
}

function getBackupLogsSnapshot(): BackupLogEntry[] {
  return [...backupLogs];
}

function isBundledVirtualPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return normalized.startsWith("/root/") || normalized.includes("/root/");
}

async function findPnpmRcloneExecutable(
  nodeModulesPath: string,
): Promise<string | null> {
  const pnpmDir = path.join(nodeModulesPath, ".pnpm");

  try {
    const entries = await readdir(pnpmDir, { withFileTypes: true });
    const rcloneEntry = entries.find(
      (entry) => entry.isDirectory() && entry.name.startsWith("rclone.js@"),
    );

    if (!rcloneEntry) {
      return null;
    }

    return path.join(
      pnpmDir,
      rcloneEntry.name,
      "node_modules",
      "rclone.js",
      "bin",
      RCLONE_EXECUTABLE_NAME,
    );
  } catch {
    return null;
  }
}

async function resolveRcloneExecutablePath(): Promise<string | null> {
  const cwdNodeModules = path.join(process.cwd(), "node_modules");
  const parentNodeModules = path.join(process.cwd(), "..", "node_modules");

  const candidates: string[] = [
    path.join(cwdNodeModules, "rclone.js", "bin", RCLONE_EXECUTABLE_NAME),
    path.join(parentNodeModules, "rclone.js", "bin", RCLONE_EXECUTABLE_NAME),
  ];

  const pnpmCandidateFromCwd = await findPnpmRcloneExecutable(cwdNodeModules);
  if (pnpmCandidateFromCwd) {
    candidates.push(pnpmCandidateFromCwd);
  }

  const pnpmCandidateFromParent =
    await findPnpmRcloneExecutable(parentNodeModules);
  if (pnpmCandidateFromParent) {
    candidates.push(pnpmCandidateFromParent);
  }

  const deduped = [...new Set(candidates)];

  for (const candidate of deduped) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

async function getRcloneApi(): Promise<RcloneApi> {
  if (rcloneApi) {
    return rcloneApi;
  }

  const configuredExecutable = process.env.RCLONE_EXECUTABLE;

  if (configuredExecutable) {
    if (!isBundledVirtualPath(configuredExecutable)) {
      try {
        await access(configuredExecutable);
      } catch {
        const resolvedExecutable = await resolveRcloneExecutablePath();
        if (resolvedExecutable) {
          process.env.RCLONE_EXECUTABLE = resolvedExecutable;
        }
      }
    } else {
      const resolvedExecutable = await resolveRcloneExecutablePath();
      if (resolvedExecutable) {
        process.env.RCLONE_EXECUTABLE = resolvedExecutable;
      }
    }
  } else {
    const resolvedExecutable = await resolveRcloneExecutablePath();
    if (resolvedExecutable) {
      process.env.RCLONE_EXECUTABLE = resolvedExecutable;
    }
  }

  const imported = await import("rclone.js");
  const moduleExport = (imported as { default?: unknown }).default ?? imported;

  if (typeof moduleExport !== "function") {
    throw new Error("Failed to initialize rclone.js API.");
  }

  rcloneApi = moduleExport as RcloneApi;
  return rcloneApi;
}

async function ensureBackupArtifacts(): Promise<void> {
  await mkdir(BACKUP_DATA_DIR, { recursive: true });

  try {
    await access(RCLONE_CONFIG_PATH);
  } catch {
    await writeFile(RCLONE_CONFIG_PATH, "", "utf8");
  }
}

async function getDefaultBackupConfig(): Promise<BackupConfig> {
  return {
    enabled: false,
    selectedIntervals: [...DEFAULT_SELECTED_INTERVALS],
    selectedRemoteNames: [],
    remotePath: "rtc-backups",
    lastRunAt: null,
    lastRunStatus: "IDLE",
    lastRunMessage: null,
    updatedAt: new Date().toISOString(),
  };
}

async function normalizeBackupConfig(
  value: Partial<BackupConfig>,
): Promise<BackupConfig> {
  const defaults = await getDefaultBackupConfig();
  const legacy = value as Partial<BackupConfig> & {
    intervalMinutes?: unknown;
    remoteName?: unknown;
  };

  return {
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    selectedIntervals: normalizeSelectedIntervals(
      legacy.selectedIntervals,
      legacy.intervalMinutes,
    ),
    selectedRemoteNames: normalizeSelectedRemoteNames(
      legacy.selectedRemoteNames,
      legacy.remoteName,
    ),
    remotePath:
      typeof value.remotePath === "string"
        ? value.remotePath.trim()
        : defaults.remotePath,
    lastRunAt: normalizeIsoDate(value.lastRunAt),
    lastRunStatus: isBackupRunStatus(value.lastRunStatus)
      ? value.lastRunStatus
      : defaults.lastRunStatus,
    lastRunMessage:
      typeof value.lastRunMessage === "string" ? value.lastRunMessage : null,
    updatedAt: normalizeIsoDate(value.updatedAt) ?? defaults.updatedAt,
  };
}

async function readBackupConfigFile(): Promise<BackupConfig> {
  await ensureBackupArtifacts();

  try {
    const raw = await readFile(BACKUP_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BackupConfig>;
    return normalizeBackupConfig(parsed);
  } catch {
    const defaults = await getDefaultBackupConfig();
    await writeFile(
      BACKUP_CONFIG_PATH,
      JSON.stringify(defaults, null, 2),
      "utf8",
    );
    return defaults;
  }
}

async function writeBackupConfigFile(
  config: BackupConfig,
): Promise<BackupConfig> {
  const toWrite: BackupConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  await ensureBackupArtifacts();
  await writeFile(BACKUP_CONFIG_PATH, JSON.stringify(toWrite, null, 2), "utf8");
  return toWrite;
}

async function getRemoteTypeMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    const raw = await readFile(RCLONE_CONFIG_PATH, "utf8");
    let activeRemote = "";

    for (const line of raw.split(/\r?\n/)) {
      const section = line.match(/^\[(.+)]\s*$/);
      if (section) {
        activeRemote = section[1].trim();
        continue;
      }

      if (!activeRemote) {
        continue;
      }

      const typeField = line.match(/^\s*type\s*=\s*(.+)\s*$/);
      if (typeField) {
        map.set(activeRemote, typeField[1].trim());
      }
    }
  } catch {
    return map;
  }

  return map;
}

function buildRcloneDestination(
  remoteName: string,
  remotePath: string,
): string {
  const cleanedRemote = normalizeRemoteName(remoteName);
  const cleanedPath = remotePath.trim().replace(/^\/+/, "");

  return cleanedPath ? `${cleanedRemote}:${cleanedPath}` : `${cleanedRemote}:`;
}

function clearScheduleTimer(intervalKey: BackupIntervalKey): void {
  const timer = scheduleTimers[intervalKey];
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  delete scheduleTimers[intervalKey];
}

function clearAllScheduleTimers(): void {
  for (const intervalKey of BACKUP_INTERVAL_KEYS) {
    clearScheduleTimer(intervalKey);
  }
}

function clearIntervalScheduleState(intervalKey: BackupIntervalKey): void {
  clearScheduleTimer(intervalKey);
  delete intervalNextRunTargets[intervalKey];
}

function scheduleIntervalTimer(
  intervalKey: BackupIntervalKey,
  targetDate: Date,
): void {
  clearScheduleTimer(intervalKey);

  const remainingMs = targetDate.getTime() - Date.now();
  if (remainingMs <= 1000) {
    scheduleTimers[intervalKey] = setTimeout(() => {
      void runScheduledBackup(intervalKey);
    }, 1000);
    return;
  }

  if (remainingMs > MAX_TIMER_MS) {
    scheduleTimers[intervalKey] = setTimeout(() => {
      scheduleIntervalTimer(intervalKey, targetDate);
    }, MAX_TIMER_MS);
    return;
  }

  scheduleTimers[intervalKey] = setTimeout(() => {
    void runScheduledBackup(intervalKey);
  }, remainingMs);
}

function scheduleNextIntervalRun(
  intervalKey: BackupIntervalKey,
  fromDate: Date = new Date(),
): void {
  const nextTarget = addIntervalToDate(fromDate, intervalKey);
  intervalNextRunTargets[intervalKey] = nextTarget.toISOString();
  scheduleIntervalTimer(intervalKey, nextTarget);
}

function ensureIntervalScheduled(intervalKey: BackupIntervalKey): void {
  const targetIso = intervalNextRunTargets[intervalKey];

  if (!targetIso) {
    scheduleNextIntervalRun(intervalKey);
    return;
  }

  const targetDate = new Date(targetIso);
  if (
    Number.isNaN(targetDate.getTime()) ||
    targetDate.getTime() <= Date.now()
  ) {
    scheduleNextIntervalRun(intervalKey);
    return;
  }

  if (!scheduleTimers[intervalKey]) {
    scheduleIntervalTimer(intervalKey, targetDate);
  }
}

async function runRcloneCommand(
  args: unknown[],
  flags: Record<string, unknown> = {},
  options: {
    trackAsActiveBackup?: boolean;
    trackAsActiveAccountSetup?: boolean;
  } = {},
): Promise<string> {
  try {
    const api = await getRcloneApi();
    appendBackupLog(
      "info",
      `Executing rclone ${args.map((arg) => String(arg)).join(" ")}`,
    );

    const subprocess = api(...args, {
      config: RCLONE_CONFIG_PATH,
      ...flags,
    });

    if (options.trackAsActiveBackup) {
      activeBackupProcess = subprocess;
      if (cancelBackupRequested) {
        try {
          subprocess.kill();
        } catch {
          // Ignore and let close/error handlers update state.
        }
      }
    }

    if (options.trackAsActiveAccountSetup) {
      accountSetupRunning = true;
      accountSetupStartedAt = Date.now();
      activeAccountSetupProcess = subprocess;
    }

    return await new Promise<string>((resolve, reject) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      subprocess.stdout?.on("data", (chunk) => {
        const bufferChunk = Buffer.from(chunk);
        stdoutChunks.push(bufferChunk);
        appendBackupChunk("info", bufferChunk);
      });

      subprocess.stderr?.on("data", (chunk) => {
        const bufferChunk = Buffer.from(chunk);
        stderrChunks.push(bufferChunk);
        appendBackupChunk("warn", bufferChunk);
      });

      subprocess.on("error", (error) => {
        if (options.trackAsActiveBackup && activeBackupProcess === subprocess) {
          activeBackupProcess = null;
        }

        if (
          options.trackAsActiveAccountSetup &&
          activeAccountSetupProcess === subprocess
        ) {
          activeAccountSetupProcess = null;
          accountSetupRunning = false;
          accountSetupStartedAt = 0;
        }

        appendBackupLog("error", formatBackupError(error));
        reject(error);
      });

      subprocess.on("close", (code) => {
        if (options.trackAsActiveBackup && activeBackupProcess === subprocess) {
          activeBackupProcess = null;
        }

        if (
          options.trackAsActiveAccountSetup &&
          activeAccountSetupProcess === subprocess
        ) {
          activeAccountSetupProcess = null;
          accountSetupRunning = false;
          accountSetupStartedAt = 0;
        }

        const stdoutText = Buffer.concat(stdoutChunks).toString("utf8").trim();
        const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();

        if ((code ?? 0) === 0) {
          appendBackupLog("info", "rclone command completed successfully.");
          resolve(stdoutText);
          return;
        }

        appendBackupLog(
          "error",
          stderrText ||
            stdoutText ||
            `rclone command failed with exit code ${String(code)}`,
        );

        reject(
          new Error(
            stderrText ||
              stdoutText ||
              `rclone command failed with exit code ${String(code)}`,
          ),
        );
      });
    });
  } catch (error) {
    const message = formatBackupError(error);
    const lowered = message.toLowerCase();

    if (lowered.includes("enoent") && lowered.includes("rclone")) {
      throw new Error(
        "rclone executable was not found. Run `pnpm --dir WebServer rebuild rclone.js` and restart the server.",
      );
    }

    throw error instanceof Error ? error : new Error(message);
  }
}

async function runBackup(
  trigger: "manual" | "scheduled",
  scheduledInterval?: BackupIntervalKey,
): Promise<BackupConfig> {
  if (backupRunning) {
    throw new Error("A backup is already running.");
  }

  let current = await readBackupConfigFile();

  let intervalKey: BackupIntervalKey | null = null;

  if (trigger === "scheduled") {
    if (!scheduledInterval || !isBackupIntervalKey(scheduledInterval)) {
      throw new Error("Invalid scheduled backup interval.");
    }

    intervalKey = scheduledInterval;
  }

  if (intervalKey && !current.enabled) {
    return current;
  }

  if (intervalKey && !current.selectedIntervals.includes(intervalKey)) {
    return current;
  }

  const selectedRemoteNames = Array.from(
    new Set(
      current.selectedRemoteNames
        .map((remoteName) => normalizeRemoteName(remoteName))
        .filter((remoteName) => !!remoteName),
    ),
  );

  if (selectedRemoteNames.length === 0) {
    throw new Error("No backup account selected.");
  }

  const sourcePath = FIXED_BACKUP_SOURCE_PATH;

  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Database file not found: ${sourcePath}`);
  }

  backupRunning = true;
  cancelBackupRequested = false;

  const intervalDefinition =
    intervalKey !== null ? getIntervalDefinition(intervalKey) : null;

  const runLabel =
    trigger === "manual"
      ? "Manual backup"
      : `${intervalDefinition?.label ?? "Scheduled"} backup`;

  const targetFolder =
    trigger === "manual" || !intervalDefinition
      ? MANUAL_BACKUP_FOLDER
      : intervalDefinition.folderName;

  const destinationRelativePath = joinRemotePath(
    current.remotePath,
    targetFolder,
    path.basename(sourcePath),
  );

  current = await writeBackupConfigFile({
    ...current,
    lastRunStatus: "RUNNING",
    lastRunMessage: `${runLabel} started...`,
  });

  appendBackupLog(
    "info",
    `${runLabel} started from ${sourcePath} to ${selectedRemoteNames.length} remote(s).`,
  );

  try {
    const remoteOutputs: string[] = [];

    for (const remoteName of selectedRemoteNames) {
      const destination = buildRcloneDestination(
        remoteName,
        destinationRelativePath,
      );

      appendBackupLog(
        "info",
        `Syncing ${runLabel.toLowerCase()} to remote ${remoteName}: ${destination}`,
      );

      const output = await runRcloneCommand(
        ["copyto", sourcePath, destination],
        {
          "check-first": true,
        },
        {
          trackAsActiveBackup: true,
        },
      );

      if (output) {
        remoteOutputs.push(`${remoteName}: ${output}`);
      }

      appendBackupLog("info", `Completed sync to remote ${remoteName}.`);
    }

    const nowIso = new Date().toISOString();
    const completionMessage =
      remoteOutputs.length > 0
        ? remoteOutputs.join("\n")
        : `${runLabel} completed for ${selectedRemoteNames.length} remote(s).`;

    const updated = await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "SUCCESS",
      lastRunMessage: completionMessage,
    });
    appendBackupLog(
      "info",
      `${runLabel} completed successfully for ${selectedRemoteNames.length} remote(s).`,
    );

    return updated;
  } catch (error) {
    const message = formatBackupError(error);
    const wasCancelled = cancelBackupRequested;
    const nowIso = new Date().toISOString();

    const updated = await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: wasCancelled ? "CANCELLED" : "FAILED",
      lastRunMessage: wasCancelled ? "Backup cancelled by user." : message,
    });
    appendBackupLog(
      wasCancelled ? "warn" : "error",
      wasCancelled ? "Backup cancelled by user." : message,
    );

    if (intervalKey) {
      console.error(`Scheduled backup failed for ${intervalKey}:`, message);
      return updated;
    }

    throw new Error(message);
  } finally {
    activeBackupProcess = null;
    cancelBackupRequested = false;
    backupRunning = false;
  }
}

export async function cancelRunningBackup(): Promise<BackupConfig> {
  if (!backupRunning) {
    const current = await readBackupConfigFile();

    if (current.lastRunStatus === "RUNNING") {
      return writeBackupConfigFile({
        ...current,
        lastRunAt: current.lastRunAt ?? new Date().toISOString(),
        lastRunStatus: "CANCELLED",
        lastRunMessage:
          "Backup marked as cancelled. No active backup process was found.",
      });
    }

    throw new Error("No backup is currently running.");
  }

  cancelBackupRequested = true;
  appendBackupLog("warn", "Backup cancellation requested.");

  const waitDeadline = Date.now() + 10000;
  while (backupRunning && Date.now() < waitDeadline) {
    if (activeBackupProcess) {
      try {
        activeBackupProcess.kill();
      } catch {
        // Ignore and wait for close.
      }
    }

    await sleep(120);
  }

  if (backupRunning) {
    throw new Error("Backup cancellation timed out. Please try again.");
  }

  return readBackupConfigFile();
}

async function runScheduledBackup(
  intervalKey: BackupIntervalKey,
): Promise<void> {
  clearScheduleTimer(intervalKey);
  delete intervalNextRunTargets[intervalKey];

  try {
    await runBackup("scheduled", intervalKey);
  } catch (error) {
    console.error(
      `Error in scheduled backup for ${intervalKey}:`,
      formatBackupError(error),
    );
  } finally {
    try {
      const latest = await readBackupConfigFile();

      if (latest.enabled && latest.selectedIntervals.includes(intervalKey)) {
        scheduleNextIntervalRun(intervalKey);
      } else {
        clearIntervalScheduleState(intervalKey);
      }
    } catch (error) {
      console.error(
        `Failed to reschedule interval ${intervalKey}:`,
        formatBackupError(error),
      );
    }
  }
}

function scheduleFromConfig(config: BackupConfig): void {
  if (!config.enabled) {
    clearAllScheduleTimers();

    for (const intervalKey of BACKUP_INTERVAL_KEYS) {
      delete intervalNextRunTargets[intervalKey];
    }

    return;
  }

  if (config.selectedRemoteNames.length === 0) {
    clearAllScheduleTimers();

    for (const intervalKey of BACKUP_INTERVAL_KEYS) {
      delete intervalNextRunTargets[intervalKey];
    }

    return;
  }

  const selectedIntervals = new Set(config.selectedIntervals);

  for (const intervalKey of BACKUP_INTERVAL_KEYS) {
    if (!selectedIntervals.has(intervalKey)) {
      clearIntervalScheduleState(intervalKey);
      continue;
    }

    ensureIntervalScheduled(intervalKey);
  }
}

export async function startBackupScheduler(): Promise<void> {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  try {
    const config = await readBackupConfigFile();
    scheduleFromConfig(config);
  } catch (error) {
    schedulerStarted = false;
    console.error(
      "Failed to start backup scheduler:",
      formatBackupError(error),
    );
  }
}

export async function getBackupConfig(): Promise<BackupConfig> {
  await ensureBackupArtifacts();
  return readBackupConfigFile();
}

export async function updateBackupConfig(
  patch: BackupConfigPatch,
): Promise<BackupConfig> {
  const current = await readBackupConfigFile();

  const next: BackupConfig = {
    ...current,
  };

  if (typeof patch.enabled === "boolean") {
    next.enabled = patch.enabled;
  }

  if (patch.selectedIntervals !== undefined) {
    next.selectedIntervals = normalizeSelectedIntervals(
      patch.selectedIntervals,
      undefined,
      false,
    );
  }

  if (patch.selectedRemoteNames !== undefined) {
    next.selectedRemoteNames = normalizeSelectedRemoteNames(
      patch.selectedRemoteNames,
      undefined,
      false,
    );
  }

  if (patch.remotePath !== undefined) {
    next.remotePath = patch.remotePath.trim();
  }

  if (next.enabled && next.selectedRemoteNames.length === 0) {
    throw new Error(
      "Select at least one destination account before enabling automatic backups.",
    );
  }

  if (next.enabled && next.selectedIntervals.length === 0) {
    throw new Error(
      "Select at least one backup interval before enabling automatic backups.",
    );
  }

  const saved = await writeBackupConfigFile(next);
  scheduleFromConfig(saved);
  return saved;
}

export async function runBackupNow(): Promise<BackupConfig> {
  return runBackup("manual");
}

export async function importBackupFromRemote(
  remoteName: string,
  source: string,
): Promise<BackupConfig> {
  const normalizedRemoteName = normalizeRemoteName(remoteName);
  if (!normalizedRemoteName) {
    throw new Error("Remote name is required.");
  }

  if (!isBackupImportSourceKey(source)) {
    throw new Error("Invalid backup source.");
  }

  const config = await readBackupConfigFile();
  const remoteSourceRelativePath = joinRemotePath(
    config.remotePath,
    resolveImportSourceFolder(source),
    path.basename(FIXED_BACKUP_SOURCE_PATH),
  );
  const remoteSource = buildRcloneDestination(
    normalizedRemoteName,
    remoteSourceRelativePath,
  );

  if (backupRunning) {
    throw new Error("A backup or database update is already running.");
  }

  let current = await readBackupConfigFile();

  backupRunning = true;
  cancelBackupRequested = false;

  current = await writeBackupConfigFile({
    ...current,
    lastRunStatus: "RUNNING",
    lastRunMessage: "Updating database from remote backup...",
  });
  appendBackupLog(
    "warn",
    `Updating database from remote backup ${normalizedRemoteName}:${remoteSourceRelativePath}`,
  );

  try {
    await runRcloneCommand(
      ["copyto", remoteSource, IMPORT_TEMP_DB_PATH],
      {
        "check-first": true,
      },
      {
        trackAsActiveBackup: true,
      },
    );

    await applyImportedDatabaseFromTempFile(IMPORT_TEMP_DB_PATH);

    const nowIso = new Date().toISOString();
    const message = `Database updated from remote ${normalizedRemoteName}.`;

    const updated = await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "SUCCESS",
      lastRunMessage: message,
    });

    appendBackupLog("info", message);

    return updated;
  } catch (error) {
    const message = formatBackupError(error);
    const nowIso = new Date().toISOString();

    await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "FAILED",
      lastRunMessage: message,
    });

    appendBackupLog("error", message);

    throw new Error(message);
  } finally {
    activeBackupProcess = null;
    cancelBackupRequested = false;
    backupRunning = false;

    try {
      await unlink(IMPORT_TEMP_DB_PATH);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

export async function importBackupFromLocalPath(
  localFilePath: string,
): Promise<BackupConfig> {
  const trimmedPath = localFilePath.trim();
  if (!trimmedPath) {
    throw new Error("Local backup file path is required.");
  }

  const resolvedPath = path.resolve(trimmedPath);
  if (resolvedPath === FIXED_BACKUP_SOURCE_PATH) {
    throw new Error("Selected file is already the active database.");
  }

  let sourceStats;
  try {
    sourceStats = await stat(resolvedPath);
  } catch {
    throw new Error(`Local file not found: ${resolvedPath}`);
  }

  if (!sourceStats.isFile()) {
    throw new Error("Selected local backup path is not a file.");
  }

  if (backupRunning) {
    throw new Error("A backup or database update is already running.");
  }

  let current = await readBackupConfigFile();

  backupRunning = true;
  cancelBackupRequested = false;

  current = await writeBackupConfigFile({
    ...current,
    lastRunStatus: "RUNNING",
    lastRunMessage: "Updating database from local backup file...",
  });
  appendBackupLog("warn", `Updating database from local file ${resolvedPath}`);

  try {
    await copyFile(resolvedPath, IMPORT_TEMP_DB_PATH);
    await applyImportedDatabaseFromTempFile(IMPORT_TEMP_DB_PATH);

    const nowIso = new Date().toISOString();
    const message = `Database updated from local file ${resolvedPath}.`;

    const updated = await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "SUCCESS",
      lastRunMessage: message,
    });

    appendBackupLog("info", message);

    return updated;
  } catch (error) {
    const message = formatBackupError(error);
    const nowIso = new Date().toISOString();

    await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "FAILED",
      lastRunMessage: message,
    });

    appendBackupLog("error", message);

    throw new Error(message);
  } finally {
    activeBackupProcess = null;
    cancelBackupRequested = false;
    backupRunning = false;

    try {
      await unlink(IMPORT_TEMP_DB_PATH);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

export async function importBackupFromLocalUpload(
  fileName: string,
  fileBytes: Uint8Array,
): Promise<BackupConfig> {
  const normalizedFileName =
    path.basename(fileName || "").trim() || "uploaded-backup.db";

  if (!(fileBytes instanceof Uint8Array) || fileBytes.byteLength === 0) {
    throw new Error("Selected backup file is empty.");
  }

  if (backupRunning) {
    throw new Error("A backup or database update is already running.");
  }

  let current = await readBackupConfigFile();

  backupRunning = true;
  cancelBackupRequested = false;

  current = await writeBackupConfigFile({
    ...current,
    lastRunStatus: "RUNNING",
    lastRunMessage: "Updating database from uploaded backup file...",
  });
  appendBackupLog(
    "warn",
    `Updating database from uploaded file ${normalizedFileName}`,
  );

  try {
    await writeFile(IMPORT_TEMP_DB_PATH, fileBytes);
    await applyImportedDatabaseFromTempFile(IMPORT_TEMP_DB_PATH);

    const nowIso = new Date().toISOString();
    const message = `Database updated from uploaded file ${normalizedFileName}.`;

    const updated = await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "SUCCESS",
      lastRunMessage: message,
    });

    appendBackupLog("info", message);

    return updated;
  } catch (error) {
    const message = formatBackupError(error);
    const nowIso = new Date().toISOString();

    await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "FAILED",
      lastRunMessage: message,
    });

    appendBackupLog("error", message);

    throw new Error(message);
  } finally {
    activeBackupProcess = null;
    cancelBackupRequested = false;
    backupRunning = false;

    try {
      await unlink(IMPORT_TEMP_DB_PATH);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

export async function listBackupRemotes(): Promise<BackupRemote[]> {
  await ensureBackupArtifacts();

  try {
    const output = await runRcloneCommand(["listremotes"]);
    const typeMap = await getRemoteTypeMap();

    return output
      .split(/\r?\n/)
      .map((line) => normalizeRemoteName(line))
      .filter((line) => !!line)
      .map((name) => ({
        name,
        provider: typeMap.get(name) || "unknown",
      }));
  } catch (error) {
    const message = formatBackupError(error).toLowerCase();

    if (
      message.includes("didn't find section") ||
      message.includes("no remotes") ||
      message.includes("config file")
    ) {
      return [];
    }

    throw new Error(formatBackupError(error));
  }
}

export async function createBackupRemote(
  remoteName: string,
  provider: string,
  options: Record<string, string> = {},
  forceRestart = false,
): Promise<BackupRemote[]> {
  await ensureBackupArtifacts();

  const normalizedName = normalizeRemoteName(remoteName);
  const normalizedProvider = provider.trim();

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(normalizedName)) {
    throw new Error(
      "Remote name must start with a letter/number and only use letters, numbers, _ or -.",
    );
  }

  if (!normalizedProvider) {
    throw new Error("Provider is required.");
  }

  await ensureAccountSetupIsAvailable(forceRestart);

  const optionArgs: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    const cleanKey = key.trim();
    if (!cleanKey) {
      continue;
    }

    const cleanValue = value.trim();
    if (!cleanValue) {
      continue;
    }

    optionArgs.push(cleanKey, cleanValue);
  }

  const configCreateArgs: string[] = [
    "config",
    "create",
    normalizedName,
    normalizedProvider,
    ...optionArgs,
  ];

  const runCreateCommand = async (): Promise<void> => {
    await runRcloneCommand(
      configCreateArgs,
      {},
      {
        trackAsActiveAccountSetup: true,
      },
    );
  };

  try {
    await runCreateCommand();
  } catch (error) {
    const message = formatBackupError(error);

    if (isAuthServerPortConflictError(message)) {
      if (forceRestart) {
        const callbackPort = extractAuthCallbackPort(message);
        const released = await forceReleaseAuthCallbackPort(callbackPort);

        if (released) {
          appendBackupLog(
            "warn",
            "Retrying account authorization after releasing callback port.",
          );

          try {
            await runCreateCommand();
          } catch (retryError) {
            const retryMessage = formatBackupError(retryError);

            if (isAuthServerPortConflictError(retryMessage)) {
              throw new Error(
                `Could not take over the local callback port (${String(callbackPort)}). Close any previous browser sign-in flow and try again.`,
              );
            }

            throw new Error(retryMessage);
          }

          return listBackupRemotes();
        }

        throw new Error(
          `Could not release the local callback port (${String(callbackPort)}). Close any previous browser sign-in flow and try again.`,
        );
      }

      throw new Error(
        "Another account authorization is already using the local callback port (http://localhost:53682/). If you refreshed during sign-in, finish or close the earlier browser auth flow, then try again.",
      );
    }

    throw new Error(message);
  }

  return listBackupRemotes();
}

export async function deleteBackupRemote(
  remoteName: string,
): Promise<BackupRemote[]> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  await runRcloneCommand(["config", "delete", normalizedName]);

  const current = await readBackupConfigFile();
  const updatedSelectedRemoteNames = current.selectedRemoteNames.filter(
    (remoteName) => normalizeRemoteName(remoteName) !== normalizedName,
  );

  if (
    updatedSelectedRemoteNames.length !== current.selectedRemoteNames.length
  ) {
    const updated = await writeBackupConfigFile({
      ...current,
      selectedRemoteNames: updatedSelectedRemoteNames,
      enabled: updatedSelectedRemoteNames.length > 0 ? current.enabled : false,
    });

    scheduleFromConfig(updated);
  }

  return listBackupRemotes();
}

export async function getBackupOverview(): Promise<{
  config: BackupConfig;
  remotes: BackupRemote[];
  providers: BackupProviderOption[];
  importSourceOptions: BackupImportSourceOption[];
  logs: BackupLogEntry[];
  accountSetupInProgress: boolean;
}> {
  const [config, remotes] = await Promise.all([
    readBackupConfigFile(),
    listBackupRemotes(),
  ]);

  return {
    config,
    remotes,
    providers: BACKUP_PROVIDER_OPTIONS,
    importSourceOptions: BACKUP_IMPORT_SOURCE_OPTIONS,
    logs: getBackupLogsSnapshot(),
    accountSetupInProgress: accountSetupRunning,
  };
}
