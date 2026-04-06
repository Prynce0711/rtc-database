import "server-only";

import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BACKUP_INTERVAL_OPTIONS = [
  5, 10, 15, 30, 60, 120, 360, 720, 1440,
] as const;

export type BackupIntervalMinutes = (typeof BACKUP_INTERVAL_OPTIONS)[number];
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
  intervalMinutes: BackupIntervalMinutes;
  nextRunAt: string | null;
  remoteName: string;
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
  intervalMinutes?: number;
  nextRunAt?: string | null;
  remoteName?: string;
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
const FIXED_BACKUP_SOURCE_PATH = path.join(process.cwd(), "dev.db");
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
let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
let backupRunning = false;
let activeBackupProcess: ChildProcess | null = null;
let cancelBackupRequested = false;
let backupLogs: BackupLogEntry[] = [];
let accountSetupRunning = false;
let activeAccountSetupProcess: ChildProcess | null = null;
let accountSetupStartedAt = 0;

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

function normalizeInterval(value: unknown): BackupIntervalMinutes {
  const parsed = typeof value === "number" ? value : Number(value);
  if (BACKUP_INTERVAL_OPTIONS.includes(parsed as BackupIntervalMinutes)) {
    return parsed as BackupIntervalMinutes;
  }

  return 60;
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
    intervalMinutes: 60,
    nextRunAt: null,
    remoteName: "",
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

  return {
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    intervalMinutes: normalizeInterval(value.intervalMinutes),
    nextRunAt: normalizeIsoDate(value.nextRunAt),
    remoteName:
      typeof value.remoteName === "string"
        ? normalizeRemoteName(value.remoteName)
        : defaults.remoteName,
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

function clearScheduleTimer(): void {
  if (!scheduleTimer) {
    return;
  }

  clearTimeout(scheduleTimer);
  scheduleTimer = null;
}

function resolveNextRunDate(config: BackupConfig): Date {
  const intervalMs = config.intervalMinutes * 60 * 1000;

  if (!config.nextRunAt) {
    return new Date(Date.now() + intervalMs);
  }

  const parsed = new Date(config.nextRunAt);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() + intervalMs);
  }

  if (parsed.getTime() <= Date.now()) {
    return new Date(Date.now() + 1000);
  }

  return parsed;
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
): Promise<BackupConfig> {
  if (backupRunning) {
    throw new Error("A backup is already running.");
  }

  let current = await readBackupConfigFile();

  if (trigger === "scheduled" && !current.enabled) {
    return current;
  }

  if (!current.remoteName) {
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

  current = await writeBackupConfigFile({
    ...current,
    lastRunStatus: "RUNNING",
    lastRunMessage:
      trigger === "manual"
        ? "Manual backup started..."
        : "Scheduled backup started...",
  });

  const destination = buildRcloneDestination(
    current.remoteName,
    current.remotePath,
  );
  appendBackupLog(
    "info",
    `Backup started from ${sourcePath} to ${destination}`,
  );

  try {
    const output = await runRcloneCommand(
      ["copy", sourcePath, destination],
      {
        "create-empty-src-dirs": true,
        "check-first": true,
      },
      {
        trackAsActiveBackup: true,
      },
    );

    const nowIso = new Date().toISOString();

    let nextRunAt = current.nextRunAt;
    if (trigger === "scheduled" && current.enabled) {
      nextRunAt = new Date(
        Date.now() + current.intervalMinutes * 60 * 1000,
      ).toISOString();
    }

    const updated = await writeBackupConfigFile({
      ...current,
      nextRunAt,
      lastRunAt: nowIso,
      lastRunStatus: "SUCCESS",
      lastRunMessage: output || "Backup completed.",
    });
    appendBackupLog("info", "Backup completed successfully.");

    if (trigger === "scheduled") {
      scheduleFromConfig(updated);
    }

    return updated;
  } catch (error) {
    const message = formatBackupError(error);
    const wasCancelled = cancelBackupRequested;
    const nowIso = new Date().toISOString();

    let nextRunAt = current.nextRunAt;
    if (trigger === "scheduled" && current.enabled) {
      nextRunAt = new Date(
        Date.now() + current.intervalMinutes * 60 * 1000,
      ).toISOString();
    }

    const updated = await writeBackupConfigFile({
      ...current,
      nextRunAt,
      lastRunAt: nowIso,
      lastRunStatus: wasCancelled ? "CANCELLED" : "FAILED",
      lastRunMessage: wasCancelled ? "Backup cancelled by user." : message,
    });
    appendBackupLog(
      wasCancelled ? "warn" : "error",
      wasCancelled ? "Backup cancelled by user." : message,
    );

    if (trigger === "scheduled") {
      console.error("Scheduled backup failed:", message);
      scheduleFromConfig(updated);
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

async function runScheduledBackup(): Promise<void> {
  scheduleTimer = null;

  try {
    await runBackup("scheduled");
  } catch (error) {
    console.error("Error in scheduled backup:", formatBackupError(error));
  }
}

function scheduleFromConfig(config: BackupConfig): void {
  clearScheduleTimer();

  if (!config.enabled) {
    return;
  }

  const targetDate = resolveNextRunDate(config);
  const msUntilRun = targetDate.getTime() - Date.now();

  if (msUntilRun > MAX_TIMER_MS) {
    scheduleTimer = setTimeout(() => {
      void scheduleFromLatestConfig();
    }, MAX_TIMER_MS);
    return;
  }

  const safeDelay = Math.max(msUntilRun, 1000);
  scheduleTimer = setTimeout(() => {
    void runScheduledBackup();
  }, safeDelay);
}

async function scheduleFromLatestConfig(): Promise<void> {
  const latest = await readBackupConfigFile();
  scheduleFromConfig(latest);
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

  if (patch.intervalMinutes !== undefined) {
    const interval = Number(patch.intervalMinutes);

    if (!BACKUP_INTERVAL_OPTIONS.includes(interval as BackupIntervalMinutes)) {
      throw new Error("Unsupported backup interval.");
    }

    next.intervalMinutes = interval as BackupIntervalMinutes;
  }

  if (patch.nextRunAt !== undefined) {
    if (patch.nextRunAt === null || patch.nextRunAt === "") {
      next.nextRunAt = null;
    } else {
      const parsed = new Date(patch.nextRunAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid next backup date/time.");
      }

      next.nextRunAt = parsed.toISOString();
    }
  }

  if (patch.remoteName !== undefined) {
    next.remoteName = normalizeRemoteName(patch.remoteName);
  }

  if (patch.remotePath !== undefined) {
    next.remotePath = patch.remotePath.trim();
  }

  if (next.enabled && !next.remoteName) {
    throw new Error(
      "Select a backup account before enabling automatic backups.",
    );
  }

  const saved = await writeBackupConfigFile(next);
  scheduleFromConfig(saved);
  return saved;
}

export async function runBackupNow(): Promise<BackupConfig> {
  return runBackup("manual");
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
  if (normalizeRemoteName(current.remoteName) === normalizedName) {
    const updated = await writeBackupConfigFile({
      ...current,
      remoteName: "",
      enabled: false,
      nextRunAt: null,
    });

    scheduleFromConfig(updated);
  }

  return listBackupRemotes();
}

export async function getBackupOverview(): Promise<{
  config: BackupConfig;
  remotes: BackupRemote[];
  providers: BackupProviderOption[];
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
    logs: getBackupLogsSnapshot(),
    accountSetupInProgress: accountSetupRunning,
  };
}
