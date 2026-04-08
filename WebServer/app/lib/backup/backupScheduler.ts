import "server-only";

import type { ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import rclone from "rclone.js";
import {
  RCLONE_CONFIG_PATH,
  ensureBackupArtifacts,
  getRemoteConfigMap,
  normalizeRemoteName,
  normalizeSelectedIntervals,
  normalizeSelectedRemoteNames,
  readBackupConfigFile,
  updateRemoteConfigOptionsInFile,
  writeBackupConfigFile,
} from "./configStore";
import {
  ACCOUNT_SETUP_STALE_MS,
  AUTH_FLOW_INTERACTIVE_TIMEOUT_MS,
  AUTH_FLOW_RCLONE_LOW_LEVEL_RETRIES,
  AUTH_FLOW_RCLONE_RETRIES,
  BACKUP_IMPORT_SOURCE_OPTIONS,
  BACKUP_INTERVAL_KEYS,
  BACKUP_INTERVAL_OPTIONS,
  BACKUP_PROVIDER_OPTIONS,
  FIXED_BACKUP_SOURCE_PATH,
  IDENTITY_REFRESH_RETRY_MS,
  MANUAL_BACKUP_FOLDER,
  MAX_BACKUP_LOG_ENTRIES,
  MAX_TIMER_MS,
  OAUTH_ACCOUNT_PROVIDERS,
  ONEDRIVE_DRIVE_SELECTION_SOURCE_OPTION_KEY,
  type BackupImportSourceKey,
  type BackupImportSourceOption,
  type BackupIntervalKey,
  type BackupIntervalOption,
  type BackupProviderOption,
} from "./constants";
import { configureBackupImporter } from "./importer";
import { getDropboxAccountIdentityFallback } from "./remotes/dropbox";
import {
  extractAccountIdentityFromUserInfo,
  getGoogleDriveAccountIdentityFallback,
} from "./remotes/google";
import {
  getOneDriveAccountIdentityFallback,
  retryOnedriveCreateWithDriveSelection as retryOnedriveCreateWithDriveSelectionForRemote,
  type OneDriveDriveOption,
} from "./remotes/onedrive";
import {
  clearAllScheduleTimers,
  clearIntervalScheduleState,
  ensureIntervalScheduled,
  scheduleNextIntervalRun,
} from "./runtime";
import type {
  BackupConfig,
  BackupConfigPatch,
  BackupLogEntry,
  BackupRemote,
  BackupRunStatus,
} from "./types";
import {
  addIntervalToDate,
  buildProviderAwareRemoteOptions,
  buildRemoteOptionArgs,
  extractAuthCallbackPort,
  formatBackupError,
  formatRcloneArgsForLog,
  getIntervalDefinition,
  isAuthServerPortConflictError,
  isBackupImportSourceKey,
  isBackupIntervalKey,
  isRemoteBackendStateInvalidError,
  isRemotePathNotFoundError,
  joinRemotePath,
  redactSensitiveText,
} from "./utils";

export {
  BACKUP_IMPORT_SOURCE_OPTIONS,
  BACKUP_INTERVAL_OPTIONS,
  BACKUP_PROVIDER_OPTIONS,
};
export type {
  BackupConfig,
  BackupConfigPatch,
  BackupImportSourceKey,
  BackupImportSourceOption,
  BackupIntervalKey,
  BackupIntervalOption,
  BackupLogEntry,
  BackupProviderOption,
  BackupRemote,
  BackupRunStatus,
};

export type { OneDriveDriveOption };

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
const pendingIdentityRefreshRemotes = new Set<string>();
const lastIdentityRefreshAttemptAt = new Map<string, number>();

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

function buildRcloneDestination(
  remoteName: string,
  remotePath: string,
): string {
  const cleanedRemote = normalizeRemoteName(remoteName);
  const cleanedPath = remotePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "");

  return cleanedPath ? `${cleanedRemote}:${cleanedPath}` : `${cleanedRemote}:`;
}

function getRemoteBasePath(config: BackupConfig, remoteName: string): string {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    return "";
  }

  return (config.remoteBasePaths[normalizedName] ?? "").trim();
}

async function saveRemoteBasePath(
  remoteName: string,
  remoteBasePath: string,
): Promise<void> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    return;
  }

  const trimmedRemoteBasePath = joinRemotePath(remoteBasePath);
  const current = await readBackupConfigFile();
  const existingRemoteBasePath = (current.remoteBasePaths[normalizedName] ?? "").trim();

  if (existingRemoteBasePath === trimmedRemoteBasePath) {
    return;
  }

  const nextRemoteBasePaths = {
    ...current.remoteBasePaths,
  };

  if (trimmedRemoteBasePath) {
    nextRemoteBasePaths[normalizedName] = trimmedRemoteBasePath;
  } else {
    delete nextRemoteBasePaths[normalizedName];
  }

  await writeBackupConfigFile({
    ...current,
    remoteBasePaths: nextRemoteBasePaths,
  });
}

async function runRcloneCommand(
  args: string[],
  flags: Record<string, unknown> = {},
  options: {
    trackAsActiveBackup?: boolean;
    trackAsActiveAccountSetup?: boolean;
    silent?: boolean;
  } = {},
): Promise<string> {
  try {
    if (!options.silent) {
      appendBackupLog(
        "info",
        `Executing rclone ${formatRcloneArgsForLog(args)}`,
      );
    }

    const subprocess = rclone(...args, {
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

        if (!options.silent) {
          appendBackupChunk("info", bufferChunk);
        }
      });

      subprocess.stderr?.on("data", (chunk) => {
        const bufferChunk = Buffer.from(chunk);
        stderrChunks.push(bufferChunk);

        if (!options.silent) {
          appendBackupChunk("warn", bufferChunk);
        }
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

        if (!options.silent) {
          appendBackupLog("error", formatBackupError(error));
        }

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
          if (!options.silent) {
            appendBackupLog("info", "rclone command completed successfully.");
          }

          resolve(stdoutText);
          return;
        }

        if (!options.silent) {
          appendBackupLog(
            "error",
            stderrText ||
              stdoutText ||
              `rclone command failed with exit code ${String(code)}`,
          );
        }

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
  const backupFileName = path.basename(sourcePath);

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
      const remoteBasePath = getRemoteBasePath(current, remoteName);
      const destinationRelativePath = joinRemotePath(
        remoteBasePath,
        current.remotePath,
        targetFolder,
        backupFileName,
      );
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
  clearIntervalScheduleState(
    scheduleTimers,
    intervalNextRunTargets,
    intervalKey,
  );

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
        scheduleNextIntervalRun(
          scheduleTimers,
          intervalNextRunTargets,
          intervalKey,
          addIntervalToDate,
          MAX_TIMER_MS,
          (scheduledIntervalKey) => {
            void runScheduledBackup(scheduledIntervalKey);
          },
        );
      } else {
        clearIntervalScheduleState(
          scheduleTimers,
          intervalNextRunTargets,
          intervalKey,
        );
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
    clearAllScheduleTimers(scheduleTimers, BACKUP_INTERVAL_KEYS);

    for (const intervalKey of BACKUP_INTERVAL_KEYS) {
      delete intervalNextRunTargets[intervalKey];
    }

    return;
  }

  if (config.selectedRemoteNames.length === 0) {
    clearAllScheduleTimers(scheduleTimers, BACKUP_INTERVAL_KEYS);

    for (const intervalKey of BACKUP_INTERVAL_KEYS) {
      delete intervalNextRunTargets[intervalKey];
    }

    return;
  }

  const selectedIntervals = new Set(config.selectedIntervals);

  for (const intervalKey of BACKUP_INTERVAL_KEYS) {
    if (!selectedIntervals.has(intervalKey)) {
      clearIntervalScheduleState(
        scheduleTimers,
        intervalNextRunTargets,
        intervalKey,
      );
      continue;
    }

    ensureIntervalScheduled(
      scheduleTimers,
      intervalNextRunTargets,
      intervalKey,
      addIntervalToDate,
      MAX_TIMER_MS,
      (scheduledIntervalKey) => {
        void runScheduledBackup(scheduledIntervalKey);
      },
    );
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

configureBackupImporter({
  fixedBackupSourcePath: FIXED_BACKUP_SOURCE_PATH,
  isBackupImportSourceKey,
  getIntervalDefinition,
  normalizeRemoteName,
  readBackupConfigFile,
  writeBackupConfigFile,
  joinRemotePath,
  buildRcloneDestination,
  runRcloneCommand,
  formatBackupError,
  isRemotePathNotFoundError,
  appendBackupLog,
  getBackupRunning: () => backupRunning,
  setBackupRunning: (value) => {
    backupRunning = value;
  },
  setCancelBackupRequested: (value) => {
    cancelBackupRequested = value;
  },
  clearActiveBackupProcess: () => {
    activeBackupProcess = null;
  },
});

async function getRemoteAccountIdentity(
  remoteName: string,
  provider: string,
): Promise<string | null> {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!OAUTH_ACCOUNT_PROVIDERS.has(normalizedProvider)) {
    return null;
  }

  const normalizedName = normalizeRemoteName(remoteName);

  try {
    const output = await runRcloneCommand(
      ["config", "userinfo", `${normalizedName}:`],
      {},
      {
        silent: true,
      },
    );

    const trimmedOutput = output.trim();
    if (trimmedOutput) {
      try {
        const parsed = JSON.parse(trimmedOutput) as unknown;
        const identity = extractAccountIdentityFromUserInfo(
          parsed,
          trimmedOutput,
        );

        if (identity) {
          return identity;
        }
      } catch {
        const identity = extractAccountIdentityFromUserInfo(
          trimmedOutput,
          trimmedOutput,
        );

        if (identity) {
          return identity;
        }
      }
    }
  } catch {
    // Continue to fallback logic below.
  }

  if (normalizedProvider === "drive") {
    return getGoogleDriveAccountIdentityFallback(normalizedName, {
      getRemoteConfigMap,
      runRcloneCommand,
    });
  }

  if (normalizedProvider === "dropbox") {
    return getDropboxAccountIdentityFallback(normalizedName, {
      getRemoteConfigMap,
      runRcloneCommand,
    });
  }

  if (normalizedProvider === "onedrive") {
    return getOneDriveAccountIdentityFallback(normalizedName, {
      getRemoteConfigMap,
      readBackupConfigFile,
      runRcloneCommand,
    });
  }

  return null;
}

async function setCachedRemoteAccountIdentity(
  remoteName: string,
  identity: string | null,
): Promise<void> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    return;
  }

  const current = await readBackupConfigFile();
  const next = {
    ...current.remoteAccountIdentities,
  };

  const trimmedIdentity = typeof identity === "string" ? identity.trim() : "";

  if (trimmedIdentity) {
    if (next[normalizedName] === trimmedIdentity) {
      return;
    }

    next[normalizedName] = trimmedIdentity;
  } else if (normalizedName in next) {
    delete next[normalizedName];
  } else {
    return;
  }

  await writeBackupConfigFile({
    ...current,
    remoteAccountIdentities: next,
  });
}

async function refreshCachedRemoteAccountIdentity(
  remoteName: string,
  provider: string,
): Promise<void> {
  const identity = await getRemoteAccountIdentity(remoteName, provider);
  await setCachedRemoteAccountIdentity(remoteName, identity);
}

function refreshCachedRemoteAccountIdentityInBackground(
  remoteName: string,
  provider: string,
  options: {
    force?: boolean;
  } = {},
): void {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    return;
  }

  const normalizedProvider = provider.trim().toLowerCase();
  if (!OAUTH_ACCOUNT_PROVIDERS.has(normalizedProvider)) {
    return;
  }

  if (pendingIdentityRefreshRemotes.has(normalizedName)) {
    return;
  }

  const now = Date.now();
  const lastAttemptAt = lastIdentityRefreshAttemptAt.get(normalizedName) ?? 0;

  if (!options.force && now - lastAttemptAt < IDENTITY_REFRESH_RETRY_MS) {
    return;
  }

  pendingIdentityRefreshRemotes.add(normalizedName);
  lastIdentityRefreshAttemptAt.set(normalizedName, now);

  void refreshCachedRemoteAccountIdentity(normalizedName, normalizedProvider)
    .catch((error) => {
      appendBackupLog(
        "warn",
        `Could not refresh cached account identity for ${normalizedName}: ${formatBackupError(error)}`,
      );
    })
    .finally(() => {
      pendingIdentityRefreshRemotes.delete(normalizedName);
    });
}

function isOpaqueOneDriveIdentity(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.includes("@") || trimmed.includes(" ")) {
    return false;
  }

  return /^[A-Za-z0-9_-]{20,}$/.test(trimmed);
}

export async function listBackupRemotes(): Promise<BackupRemote[]> {
  await ensureBackupArtifacts();

  try {
    const output = await runRcloneCommand(["listremotes"]);
    const configMap = await getRemoteConfigMap();
    const backupConfig = await readBackupConfigFile();
    const cachedIdentities = backupConfig.remoteAccountIdentities;
    const remoteBasePaths = backupConfig.remoteBasePaths;

    const remoteNames = output
      .split(/\r?\n/)
      .map((line) => normalizeRemoteName(line))
      .filter((line) => !!line);

    return remoteNames.map((name) => {
      const config = configMap.get(name);
      const provider = config?.provider || "unknown";
      const normalizedProvider = provider.trim().toLowerCase();
      const cachedIdentity = cachedIdentities[name] ?? null;
      const hasOpaqueOneDriveIdentity =
        normalizedProvider === "onedrive" &&
        typeof cachedIdentity === "string" &&
        isOpaqueOneDriveIdentity(cachedIdentity);
      const accountIdentity = hasOpaqueOneDriveIdentity ? null : cachedIdentity;

      if (!accountIdentity) {
        if (hasOpaqueOneDriveIdentity) {
          void setCachedRemoteAccountIdentity(name, null).catch(() => {
            // Ignore cache-clear failures; refresh below will retry.
          });
        }

        refreshCachedRemoteAccountIdentityInBackground(name, provider);
      }

      return {
        name,
        provider,
        options: config?.options ?? {},
        accountIdentity,
        basePath: remoteBasePaths[name] ?? "",
      };
    });
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
  remoteBasePath = "",
): Promise<BackupRemote[]> {
  await ensureBackupArtifacts();

  const normalizedName = normalizeRemoteName(remoteName);
  const normalizedProvider = provider.trim();
  const normalizedRemoteBasePath = joinRemotePath(remoteBasePath);

  const listBackupRemotesWithConfiguredBasePath = async (): Promise<
    BackupRemote[]
  > => {
    await saveRemoteBasePath(normalizedName, normalizedRemoteBasePath);
    return listBackupRemotes();
  };

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(normalizedName)) {
    throw new Error(
      "Remote name must start with a letter/number and only use letters, numbers, _ or -.",
    );
  }

  if (!normalizedProvider) {
    throw new Error("Provider is required.");
  }

  const normalizedProviderKey = normalizedProvider.toLowerCase();
  const providerOptions = buildProviderAwareRemoteOptions(
    normalizedProviderKey,
    options,
    "create",
  );
  const hasProvidedOAuthToken =
    OAUTH_ACCOUNT_PROVIDERS.has(normalizedProviderKey) &&
    typeof providerOptions.token === "string" &&
    providerOptions.token.trim().length > 0;

  if (normalizedProviderKey === "onedrive" && hasProvidedOAuthToken) {
    await retryOnedriveCreateWithDriveSelectionForRemote(
      normalizedName,
      providerOptions,
      {
        appendBackupLog,
        runRcloneCommand,
        redactSensitiveText,
      },
      {
        rcloneConfigPath: RCLONE_CONFIG_PATH,
        retries: AUTH_FLOW_RCLONE_RETRIES,
        lowLevelRetries: AUTH_FLOW_RCLONE_LOW_LEVEL_RETRIES,
        interactiveTimeoutMs: AUTH_FLOW_INTERACTIVE_TIMEOUT_MS,
      },
    );

    refreshCachedRemoteAccountIdentityInBackground(
      normalizedName,
      normalizedProvider,
      {
        force: true,
      },
    );
    return listBackupRemotesWithConfiguredBasePath();
  }

  if (!hasProvidedOAuthToken) {
    await ensureAccountSetupIsAvailable(forceRestart);
  }

  const optionArgs = buildRemoteOptionArgs(providerOptions, "create");

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
      {
        "auto-confirm": true,
        retries: AUTH_FLOW_RCLONE_RETRIES,
        "low-level-retries": AUTH_FLOW_RCLONE_LOW_LEVEL_RETRIES,
      },
      {
        trackAsActiveAccountSetup: !hasProvidedOAuthToken,
      },
    );
  };

  try {
    await runCreateCommand();
  } catch (error) {
    const message = formatBackupError(error);

    if (
      normalizedProviderKey === "onedrive" &&
      hasProvidedOAuthToken &&
      isRemoteBackendStateInvalidError(message)
    ) {
      await retryOnedriveCreateWithDriveSelectionForRemote(
        normalizedName,
        providerOptions,
        {
          appendBackupLog,
          runRcloneCommand,
          redactSensitiveText,
        },
        {
          rcloneConfigPath: RCLONE_CONFIG_PATH,
          retries: AUTH_FLOW_RCLONE_RETRIES,
          lowLevelRetries: AUTH_FLOW_RCLONE_LOW_LEVEL_RETRIES,
          interactiveTimeoutMs: AUTH_FLOW_INTERACTIVE_TIMEOUT_MS,
        },
        message,
      );

      refreshCachedRemoteAccountIdentityInBackground(
        normalizedName,
        normalizedProvider,
        {
          force: true,
        },
      );
      return listBackupRemotesWithConfiguredBasePath();
    }

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

          refreshCachedRemoteAccountIdentityInBackground(
            normalizedName,
            normalizedProvider,
            {
              force: true,
            },
          );
          return listBackupRemotesWithConfiguredBasePath();
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

  refreshCachedRemoteAccountIdentityInBackground(
    normalizedName,
    normalizedProvider,
    {
      force: true,
    },
  );
  return listBackupRemotesWithConfiguredBasePath();
}

export async function reloginBackupRemote(
  remoteName: string,
  forceRestart = false,
): Promise<BackupRemote[]> {
  await ensureBackupArtifacts();

  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  const configMap = await getRemoteConfigMap();
  const existing = configMap.get(normalizedName);

  if (!existing) {
    throw new Error(`Remote ${normalizedName} was not found.`);
  }

  const existingProvider = existing.provider.trim().toLowerCase();
  if (!OAUTH_ACCOUNT_PROVIDERS.has(existingProvider)) {
    throw new Error(
      "Re-login is only supported for Google Drive, OneDrive, and Dropbox accounts.",
    );
  }

  await ensureAccountSetupIsAvailable(forceRestart);

  const runReconnectCommand = async (): Promise<void> => {
    await runRcloneCommand(
      ["config", "reconnect", `${normalizedName}:`],
      {
        "auto-confirm": true,
        retries: AUTH_FLOW_RCLONE_RETRIES,
        "low-level-retries": AUTH_FLOW_RCLONE_LOW_LEVEL_RETRIES,
      },
      {
        trackAsActiveAccountSetup: true,
      },
    );
  };

  try {
    await runReconnectCommand();
  } catch (error) {
    const message = formatBackupError(error);

    if (isAuthServerPortConflictError(message)) {
      if (forceRestart) {
        const callbackPort = extractAuthCallbackPort(message);
        const released = await forceReleaseAuthCallbackPort(callbackPort);

        if (released) {
          appendBackupLog(
            "warn",
            "Retrying account re-login after releasing callback port.",
          );

          try {
            await runReconnectCommand();
          } catch (retryError) {
            const retryMessage = formatBackupError(retryError);

            if (isAuthServerPortConflictError(retryMessage)) {
              throw new Error(
                `Could not take over the local callback port (${String(callbackPort)}). Close any previous browser sign-in flow and try again.`,
              );
            }

            throw new Error(retryMessage);
          }

          refreshCachedRemoteAccountIdentityInBackground(
            normalizedName,
            existingProvider,
            {
              force: true,
            },
          );
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

  refreshCachedRemoteAccountIdentityInBackground(
    normalizedName,
    existingProvider,
    {
      force: true,
    },
  );
  return listBackupRemotes();
}

export async function updateBackupRemote(
  currentRemoteName: string,
  nextRemoteName: string,
  provider: string,
  options: Record<string, string> = {},
  remoteBasePath?: string,
): Promise<BackupRemote[]> {
  await ensureBackupArtifacts();

  const normalizedCurrent = normalizeRemoteName(currentRemoteName);
  const normalizedNext = normalizeRemoteName(nextRemoteName);
  const normalizedProvider = provider.trim().toLowerCase();
  const hasExplicitRemoteBasePath = typeof remoteBasePath === "string";
  const normalizedRemoteBasePath = hasExplicitRemoteBasePath
    ? joinRemotePath(remoteBasePath)
    : "";

  if (!normalizedCurrent) {
    throw new Error("Current remote name is required.");
  }

  if (!normalizedNext) {
    throw new Error("Remote name is required.");
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(normalizedNext)) {
    throw new Error(
      "Remote name must start with a letter/number and only use letters, numbers, _ or -.",
    );
  }

  const configMap = await getRemoteConfigMap();
  const existing = configMap.get(normalizedCurrent);

  if (!existing) {
    throw new Error(`Remote ${normalizedCurrent} was not found.`);
  }

  const existingProvider = existing.provider.trim().toLowerCase();
  if (normalizedProvider && existingProvider !== normalizedProvider) {
    throw new Error(
      "Changing provider type is not supported for existing accounts. Create a new account instead.",
    );
  }

  let targetRemoteName = normalizedCurrent;

  if (normalizedNext !== normalizedCurrent) {
    await runRcloneCommand([
      "config",
      "rename",
      normalizedCurrent,
      normalizedNext,
    ]);
    targetRemoteName = normalizedNext;
  }

  const optionsForUpdate = {
    ...options,
  };
  const oneDriveDriveSelectionSource =
    existingProvider === "onedrive"
      ? (optionsForUpdate[ONEDRIVE_DRIVE_SELECTION_SOURCE_OPTION_KEY] ?? "")
          .trim()
          .toLowerCase()
      : "";
  delete optionsForUpdate[ONEDRIVE_DRIVE_SELECTION_SOURCE_OPTION_KEY];

  const providerOptions = buildProviderAwareRemoteOptions(
    existingProvider,
    optionsForUpdate,
    "update",
  );
  const optionArgs = buildRemoteOptionArgs(providerOptions, "update");
  const isOAuthProvider = OAUTH_ACCOUNT_PROVIDERS.has(existingProvider);

  if (optionArgs.length > 0) {
    if (existingProvider === "onedrive") {
      const hasDriveIdOption = Object.prototype.hasOwnProperty.call(
        providerOptions,
        "drive_id",
      );
      const preferredDriveId = hasDriveIdOption
        ? (providerOptions.drive_id?.trim() ?? "")
        : "";

      const optionsForDirectWrite = {
        ...providerOptions,
      };

      if (hasDriveIdOption) {
        // Keep OneDrive edit updates fully non-interactive to avoid triggering OAuth browser prompts.
        optionsForDirectWrite.drive_id = preferredDriveId;
        optionsForDirectWrite.drive_type =
          optionsForDirectWrite.drive_type?.trim() || "personal";

        if (
          preferredDriveId &&
          oneDriveDriveSelectionSource === "auto-personal"
        ) {
          appendBackupLog(
            "info",
            `Auto-selected OneDrive (personal) drive ID ${preferredDriveId} for ${targetRemoteName}.`,
          );
        }
      }

      if (Object.keys(optionsForDirectWrite).length > 0) {
        await updateRemoteConfigOptionsInFile(
          targetRemoteName,
          optionsForDirectWrite,
        );
      }
    } else {
      await runRcloneCommand([
        "config",
        "update",
        targetRemoteName,
        ...optionArgs,
      ]);
    }

    if (isOAuthProvider) {
      refreshCachedRemoteAccountIdentityInBackground(
        targetRemoteName,
        existingProvider,
        {
          force: true,
        },
      );
    }
  }

  const remoteNameChanged = targetRemoteName !== normalizedCurrent;

  if (remoteNameChanged || hasExplicitRemoteBasePath) {
    const currentConfig = await readBackupConfigFile();
    const updatedRemoteAccountIdentities = {
      ...currentConfig.remoteAccountIdentities,
    };
    const updatedRemoteBasePaths = {
      ...currentConfig.remoteBasePaths,
    };

    if (remoteNameChanged) {
      const existingIdentity = updatedRemoteAccountIdentities[normalizedCurrent];
      if (existingIdentity) {
        updatedRemoteAccountIdentities[targetRemoteName] = existingIdentity;
      }
      delete updatedRemoteAccountIdentities[normalizedCurrent];

      const existingBasePath = updatedRemoteBasePaths[normalizedCurrent];
      if (existingBasePath) {
        updatedRemoteBasePaths[targetRemoteName] = existingBasePath;
      }
      delete updatedRemoteBasePaths[normalizedCurrent];
    }

    if (hasExplicitRemoteBasePath) {
      if (normalizedRemoteBasePath) {
        updatedRemoteBasePaths[targetRemoteName] = normalizedRemoteBasePath;
      } else {
        delete updatedRemoteBasePaths[targetRemoteName];
      }
    }

    const updatedSelectedRemoteNames = remoteNameChanged
      ? Array.from(
          new Set(
            currentConfig.selectedRemoteNames
              .map((name) =>
                normalizeRemoteName(name) === normalizedCurrent
                  ? targetRemoteName
                  : normalizeRemoteName(name),
              )
              .filter((name) => !!name),
          ),
        )
      : currentConfig.selectedRemoteNames;

    const updatedConfig = await writeBackupConfigFile({
      ...currentConfig,
      selectedRemoteNames: updatedSelectedRemoteNames,
      remoteAccountIdentities: updatedRemoteAccountIdentities,
      remoteBasePaths: updatedRemoteBasePaths,
    });

    if (remoteNameChanged) {
      scheduleFromConfig(updatedConfig);
    }
  }

  return listBackupRemotes();
}

async function purgeRemoteBackupFiles(
  normalizedName: string,
  backupRootRelativePath: string,
): Promise<void> {
  const backupRootDestination = buildRcloneDestination(
    normalizedName,
    backupRootRelativePath,
  );

  appendBackupLog(
    "warn",
    `Deleting backup files from ${backupRootDestination}.`,
  );

  try {
    await runRcloneCommand(["purge", backupRootDestination]);
    appendBackupLog(
      "info",
      `Deleted backup files from ${backupRootDestination}.`,
    );
  } catch (error) {
    const message = formatBackupError(error);

    if (isRemotePathNotFoundError(message)) {
      appendBackupLog(
        "warn",
        `No backup files found at ${backupRootDestination}; nothing to delete.`,
      );
      return;
    }

    if (isRemoteBackendStateInvalidError(message)) {
      throw new Error(
        `Could not access remote ${normalizedName} to delete backup files. This account may need re-login or reconfiguration. Re-login the account and try again, or remove the account without deleting backup files.`,
      );
    }

    throw new Error(
      `Failed to delete backup files from ${backupRootDestination}: ${formatBackupError(error)}`,
    );
  }
}

export async function clearBackupRemoteFiles(
  remoteName: string,
): Promise<BackupRemote[]> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  const configMap = await getRemoteConfigMap();
  if (!configMap.has(normalizedName)) {
    throw new Error(`Remote ${normalizedName} was not found.`);
  }

  const current = await readBackupConfigFile();
  const remoteBasePath = getRemoteBasePath(current, normalizedName);
  const backupRootRelativePath = joinRemotePath(
    remoteBasePath,
    current.remotePath,
  );

  if (!backupRootRelativePath) {
    throw new Error(
      "Backup folder path is empty. Set a backup folder path first.",
    );
  }

  await purgeRemoteBackupFiles(normalizedName, backupRootRelativePath);
  return listBackupRemotes();
}

export async function deleteBackupRemote(
  remoteName: string,
  deleteBackupFiles = false,
): Promise<BackupRemote[]> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  if (typeof deleteBackupFiles !== "boolean") {
    throw new Error("Invalid delete backup files option.");
  }

  const current = await readBackupConfigFile();

  if (deleteBackupFiles) {
    const remoteBasePath = getRemoteBasePath(current, normalizedName);
    const backupRootRelativePath = joinRemotePath(
      remoteBasePath,
      current.remotePath,
    );

    if (!backupRootRelativePath) {
      throw new Error(
        "Backup folder path is empty. Set a backup folder path first or remove the account without deleting backup files.",
      );
    }

    await purgeRemoteBackupFiles(normalizedName, backupRootRelativePath);
  }

  await runRcloneCommand(["config", "delete", normalizedName]);
  const updatedSelectedRemoteNames = current.selectedRemoteNames.filter(
    (remoteName) => normalizeRemoteName(remoteName) !== normalizedName,
  );
  const updatedRemoteAccountIdentities = {
    ...current.remoteAccountIdentities,
  };
  const updatedRemoteBasePaths = {
    ...current.remoteBasePaths,
  };
  const identityWasCached = normalizedName in updatedRemoteAccountIdentities;
  const basePathWasConfigured = normalizedName in updatedRemoteBasePaths;
  if (identityWasCached) {
    delete updatedRemoteAccountIdentities[normalizedName];
  }
  if (basePathWasConfigured) {
    delete updatedRemoteBasePaths[normalizedName];
  }

  const selectedRemotesChanged =
    updatedSelectedRemoteNames.length !== current.selectedRemoteNames.length;

  if (selectedRemotesChanged || identityWasCached || basePathWasConfigured) {
    const updated = await writeBackupConfigFile({
      ...current,
      selectedRemoteNames: updatedSelectedRemoteNames,
      remoteAccountIdentities: updatedRemoteAccountIdentities,
      remoteBasePaths: updatedRemoteBasePaths,
      enabled:
        selectedRemotesChanged && updatedSelectedRemoteNames.length === 0
          ? false
          : current.enabled,
    });

    if (selectedRemotesChanged) {
      scheduleFromConfig(updated);
    }
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
