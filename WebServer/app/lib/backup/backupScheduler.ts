import "server-only";

import { getSystemSettings } from "@/app/components/Settings/SettingsActions";
import type { ChildProcess } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import { access, mkdir, readdir, rm } from "node:fs/promises";
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
  FIXED_BACKUP_DESTINATION_FOLDER,
  FIXED_BACKUP_SOURCE_PATH,
  IDENTITY_REFRESH_RETRY_MS,
  MANUAL_BACKUP_FOLDER,
  MAX_BACKUP_LOG_ENTRIES,
  MAX_TIMER_MS,
  NOTARIAL_REMOTE_NAME,
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
import { getS3StorageUsage } from "./remotes/s3";
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
  NotarialSnapshot,
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
  NotarialSnapshot,
};

export type { OneDriveDriveOption };

export interface BackupRemoteStorageUsage {
  remoteName: string;
  totalBytes: number | null;
  usedBytes: number | null;
  freeBytes: number | null;
  trashedBytes: number | null;
  otherBytes: number | null;
  objects: number | null;
}

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
const NOTARIAL_RESTIC_SOURCE_CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "backup",
  "notarial-restic-source-cache",
);
const NOTARIAL_RESTIC_CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "backup",
  "restic-cache",
);
const RCLONE_EXECUTABLE_FOR_RESTIC = path.join(
  process.cwd(),
  "node_modules",
  "rclone.js",
  "bin",
  process.platform === "win32" ? "rclone.exe" : "rclone",
);
const RCLONE_EXECUTABLE_NAME_FOR_RESTIC =
  process.platform === "win32" ? "rclone.exe" : "rclone";
const RCLONE_EXECUTABLE_DIR_FOR_RESTIC = path.dirname(
  RCLONE_EXECUTABLE_FOR_RESTIC,
);
const NOTARIAL_PRIMARY_REPOSITORY_BUCKET =
  process.env.NOTARIAL_RESTIC_PRIMARY_BUCKET?.trim() || "backups";
const NOTARIAL_PRIMARY_REPOSITORY_FOLDER =
  process.env.NOTARIAL_RESTIC_PRIMARY_FOLDER?.trim() || "notarial";
const NOTARIAL_RCLONE_MOUNT_READY_TIMEOUT_MS = 30_000;

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

function buildRetentionWithinArg(intervalKey: BackupIntervalKey): string {
  switch (intervalKey) {
    case "5m":
      return "5m";
    case "15m":
      return "15m";
    case "1h":
      return "1h";
    case "1d":
      return "1d";
    case "1w":
      return "7d";
    case "1mo":
      return "30d";
    case "1y":
      return "365d";
  }
}

function isResticRepositoryMissingError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("is there a repository") ||
    lowered.includes("unable to open config file") ||
    lowered.includes("config file does not exist") ||
    lowered.includes("repository does not exist") ||
    lowered.includes("no such file")
  );
}

function normalizePathSegmentsForComparison(value: string): string[] {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim().toLowerCase().replace(/:$/, ""))
    .filter((part) => !!part);
}

function hasPathSuffix(candidate: string[], suffix: string[]): boolean {
  if (suffix.length === 0 || suffix.length > candidate.length) {
    return false;
  }

  const startIndex = candidate.length - suffix.length;

  for (let index = 0; index < suffix.length; index += 1) {
    if (candidate[startIndex + index] !== suffix[index]) {
      return false;
    }
  }

  return true;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findDirectoryWithSuffix(
  rootPath: string,
  suffixSegments: string[],
  maxDepth = 10,
): Promise<string | null> {
  const queue: Array<{ directory: string; depth: number }> = [
    { directory: rootPath, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const relative = path.relative(rootPath, current.directory);
    const relativeSegments = normalizePathSegmentsForComparison(relative);

    if (hasPathSuffix(relativeSegments, suffixSegments)) {
      return current.directory;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      queue.push({
        directory: path.join(current.directory, entry.name),
        depth: current.depth + 1,
      });
    }
  }

  return null;
}

async function resolveRestoredNotarialSourcePath(
  restoreTargetPath: string,
): Promise<string> {
  const sourcePath = path.resolve(NOTARIAL_RESTIC_SOURCE_CACHE_PATH);
  const parsedSource = path.parse(sourcePath);
  const sourcePathWithoutRoot = sourcePath
    .slice(parsedSource.root.length)
    .replace(/^[\\/]+/, "");
  const normalizedDriveSegment = parsedSource.root
    .replace(/[\\/:]/g, "")
    .trim()
    .toLowerCase();

  const candidatePaths = [
    path.join(restoreTargetPath, sourcePathWithoutRoot),
    path.join(restoreTargetPath, normalizedDriveSegment, sourcePathWithoutRoot),
    path.join(restoreTargetPath, path.basename(sourcePath)),
  ];

  for (const candidatePath of candidatePaths) {
    if (!candidatePath || !(await pathExists(candidatePath))) {
      continue;
    }

    return candidatePath;
  }

  const expectedPathSuffix = normalizePathSegmentsForComparison(
    sourcePathWithoutRoot,
  );
  const candidateSuffixes: string[][] = [];

  if (expectedPathSuffix.length > 0) {
    candidateSuffixes.push(expectedPathSuffix);
  }

  if (normalizedDriveSegment && expectedPathSuffix.length > 0) {
    candidateSuffixes.push([normalizedDriveSegment, ...expectedPathSuffix]);
  }

  candidateSuffixes.push([
    path.basename(sourcePath).trim().toLowerCase().replace(/:$/, ""),
  ]);

  for (const suffixSegments of candidateSuffixes) {
    if (suffixSegments.length === 0) {
      continue;
    }

    const matchedDirectory = await findDirectoryWithSuffix(
      restoreTargetPath,
      suffixSegments,
    );

    if (matchedDirectory) {
      return matchedDirectory;
    }
  }

  throw new Error(
    "Could not determine restored notarial snapshot folder from restic output.",
  );
}

function normalizeEndpointForComparison(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\/+$/, "");
}

function extractS3BucketFromBasePath(basePath: string): string {
  const parts = basePath
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => !!part);

  return parts[0] ?? "";
}

function buildResticRepositoryDestination(
  remoteName: string,
  repositoryPath: string,
): string {
  const rcloneDestination = buildRcloneDestination(remoteName, repositoryPath);
  return `rclone:${rcloneDestination}`;
}

function buildResticCommandEnv(): NodeJS.ProcessEnv {
  const hasResticPassword =
    !!process.env.RESTIC_PASSWORD?.trim() ||
    !!process.env.RESTIC_PASSWORD_FILE?.trim();

  if (!hasResticPassword) {
    throw new Error(
      "RESTIC_PASSWORD or RESTIC_PASSWORD_FILE is required to run notarial restic backups.",
    );
  }

  const configuredExecutable = process.env.RCLONE_EXECUTABLE?.trim() ?? "";
  const preferredExecutableDirs = new Set<string>();

  if (configuredExecutable && path.isAbsolute(configuredExecutable)) {
    preferredExecutableDirs.add(path.dirname(configuredExecutable));
  }

  preferredExecutableDirs.add(RCLONE_EXECUTABLE_DIR_FOR_RESTIC);

  const existingPath = process.env.PATH ?? "";
  const prependedPath = Array.from(preferredExecutableDirs)
    .filter((entry) => !!entry)
    .join(path.delimiter);
  const mergedPath = prependedPath
    ? `${prependedPath}${existingPath ? path.delimiter : ""}${existingPath}`
    : existingPath;

  return {
    ...process.env,
    RCLONE_CONFIG: RCLONE_CONFIG_PATH,
    RESTIC_CACHE_DIR: NOTARIAL_RESTIC_CACHE_PATH,
    PATH: mergedPath,
  };
}

function getResticRcloneProgramOptionArgs(): string[] {
  const configuredExecutable = process.env.RCLONE_EXECUTABLE?.trim() ?? "";

  if (configuredExecutable) {
    const program =
      process.platform === "win32" && path.isAbsolute(configuredExecutable)
        ? path.basename(configuredExecutable)
        : configuredExecutable;
    return ["-o", `rclone.program=${program}`];
  }

  return ["-o", `rclone.program=${RCLONE_EXECUTABLE_NAME_FOR_RESTIC}`];
}

async function runResticCommand(
  args: string[],
  options: {
    trackAsActiveBackup?: boolean;
    silent?: boolean;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<string> {
  const rcloneProgramOptionArgs = getResticRcloneProgramOptionArgs();
  const finalArgs = [...rcloneProgramOptionArgs, ...args];

  if (!options.silent) {
    appendBackupLog("info", `Executing restic ${finalArgs.join(" ")}`);
  }

  return await new Promise<string>((resolve, reject) => {
    const subprocess = spawn("restic", finalArgs, {
      windowsHide: true,
      env: options.env,
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

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const finalize = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

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

      const message = formatBackupError(error);
      const lowered = message.toLowerCase();
      const formattedError =
        lowered.includes("enoent") && lowered.includes("restic")
          ? new Error(
              "restic executable was not found. Install restic and restart the server.",
            )
          : error instanceof Error
            ? error
            : new Error(message);

      if (!options.silent) {
        appendBackupLog("error", formatBackupError(formattedError));
      }

      finalize(() => reject(formattedError));
    });

    subprocess.on("close", (code) => {
      if (options.trackAsActiveBackup && activeBackupProcess === subprocess) {
        activeBackupProcess = null;
      }

      const stdoutText = Buffer.concat(stdoutChunks).toString("utf8").trim();
      const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();

      if ((code ?? 0) === 0) {
        if (!options.silent) {
          appendBackupLog("info", "restic command completed successfully.");
        }

        finalize(() => resolve(stdoutText));
        return;
      }

      const errorMessage =
        stderrText ||
        stdoutText ||
        `restic command failed with exit code ${String(code ?? 0)}`;

      if (!options.silent) {
        appendBackupLog("error", errorMessage);
      }

      finalize(() => reject(new Error(errorMessage)));
    });
  });
}

async function ensureResticRepositoryInitialized(
  repositoryDestination: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  try {
    await runResticCommand(["-r", repositoryDestination, "snapshots"], {
      silent: true,
      env,
    });
    return;
  } catch (error) {
    const message = formatBackupError(error);
    const repositoryMissing = isResticRepositoryMissingError(message);

    if (!repositoryMissing) {
      throw error;
    }
  }

  appendBackupLog(
    "info",
    `Initializing restic repository at ${repositoryDestination}.`,
  );
  await runResticCommand(["-r", repositoryDestination, "init"], {
    trackAsActiveBackup: true,
    env,
  });
}

function parseRcloneLsfEntries(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[\\/]+$/, ""))
    .filter((line) => !!line);
}

function normalizeDirectoryEntryForComparison(entry: string): string {
  return entry
    .trim()
    .replace(/[\\/]+$/, "")
    .toLowerCase();
}

async function waitForNotarialSourceMountReady(
  notarialSource: string,
  mountPath: string,
  mountProcess: ChildProcess,
  getStderrTail: () => string,
): Promise<void> {
  const sourceListingOutput = await runRcloneCommand(
    ["lsf", notarialSource, "--max-depth", "1"],
    {},
    { silent: true, timeoutMs: 20_000 },
  );

  const expectedEntries = parseRcloneLsfEntries(sourceListingOutput);
  const expectedEntrySet = new Set(
    expectedEntries.map((entry) => normalizeDirectoryEntryForComparison(entry)),
  );

  const emptyRemoteReadyAt = Date.now() + 1_200;
  const deadline = Date.now() + NOTARIAL_RCLONE_MOUNT_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (cancelBackupRequested) {
      throw new Error("Backup cancelled by user.");
    }

    if (mountProcess.exitCode !== null) {
      const stderrTail = getStderrTail();
      throw new Error(
        `rclone mount exited before becoming ready (exit code ${String(mountProcess.exitCode)}).${stderrTail ? ` ${stderrTail}` : ""}`,
      );
    }

    try {
      const mountedEntries = await readdir(mountPath);

      if (expectedEntrySet.size === 0) {
        if (Date.now() >= emptyRemoteReadyAt) {
          return;
        }
      } else {
        const mountedEntrySet = new Set(
          mountedEntries.map((entry) =>
            normalizeDirectoryEntryForComparison(entry),
          ),
        );

        const hasExpectedEntry = Array.from(expectedEntrySet).some((entry) =>
          mountedEntrySet.has(entry),
        );

        if (hasExpectedEntry) {
          return;
        }
      }
    } catch {
      // Keep waiting while mount initializes.
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for rclone mount at ${mountPath}.`);
}

async function startNotarialSourceMount(
  notarialSource: string,
  mountPath: string,
): Promise<{
  mountProcess: ChildProcess;
  getStderrTail: () => string;
}> {
  await rm(mountPath, { recursive: true, force: true });
  await mkdir(mountPath, { recursive: true });

  const mountArgs = [
    "mount",
    notarialSource,
    mountPath,
    "--config",
    RCLONE_CONFIG_PATH,
    "--read-only",
    "--vfs-cache-mode",
    "off",
    "--dir-cache-time",
    "1m",
    "--poll-interval",
    "30s",
    "--attr-timeout",
    "1s",
  ];

  appendBackupLog(
    "info",
    `Mounting notarial source ${notarialSource} at ${mountPath} for restic snapshot.`,
  );

  const mountProcess = spawn(RCLONE_EXECUTABLE_FOR_RESTIC, mountArgs, {
    windowsHide: true,
    env: {
      ...process.env,
      RCLONE_CONFIG: RCLONE_CONFIG_PATH,
    },
  });

  activeBackupProcess = mountProcess;

  let stderrTail = "";

  mountProcess.stderr?.on("data", (chunk) => {
    const text = Buffer.from(chunk).toString("utf8");
    stderrTail = `${stderrTail}${text}`.slice(-4_000);
  });

  mountProcess.on("error", (error) => {
    stderrTail = `${stderrTail}\n${formatBackupError(error)}`.slice(-4_000);
  });

  await waitForNotarialSourceMountReady(
    notarialSource,
    mountPath,
    mountProcess,
    () => stderrTail.trim(),
  );

  appendBackupLog("info", `Notarial source mount is ready at ${mountPath}.`);

  return {
    mountProcess,
    getStderrTail: () => stderrTail.trim(),
  };
}

async function stopNotarialSourceMount(
  mountProcess: ChildProcess,
  mountPath: string,
): Promise<void> {
  if (mountProcess.exitCode === null) {
    await new Promise<void>((resolve) => {
      let settled = false;

      const finalize = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };

      const timeoutHandle = setTimeout(() => {
        try {
          mountProcess.kill();
        } catch {
          // Ignore and resolve below.
        }

        finalize();
      }, 5_000);

      mountProcess.once("close", () => {
        clearTimeout(timeoutHandle);
        finalize();
      });

      try {
        mountProcess.kill();
      } catch {
        clearTimeout(timeoutHandle);
        finalize();
      }
    });
  }

  if (activeBackupProcess === mountProcess) {
    activeBackupProcess = null;
  }

  try {
    await rm(mountPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup issues for mount path.
  }
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
  const existingRemoteBasePath = (
    current.remoteBasePaths[normalizedName] ?? ""
  ).trim();

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
    timeoutMs?: number;
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
      let settled = false;
      const timeoutMs =
        typeof options.timeoutMs === "number" && options.timeoutMs > 0
          ? options.timeoutMs
          : 0;
      const timeoutHandle =
        timeoutMs > 0
          ? setTimeout(() => {
              if (settled) {
                return;
              }

              settled = true;

              try {
                subprocess.kill();
              } catch {
                // Ignore kill failures and reject with timeout.
              }

              reject(
                new Error(
                  `rclone command timed out after ${String(Math.floor(timeoutMs / 1000))} seconds`,
                ),
              );
            }, timeoutMs)
          : null;

      const clearTimeoutHandle = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      };

      const finalize = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeoutHandle();
        callback();
      };

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
        clearTimeoutHandle();

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

        finalize(() => reject(error));
      });

      subprocess.on("close", (code) => {
        clearTimeoutHandle();

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

          finalize(() => resolve(stdoutText));
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

        finalize(() =>
          reject(
            new Error(
              stderrText ||
                stdoutText ||
                `rclone command failed with exit code ${String(code)}`,
            ),
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
  const activeCaseSelectedRemoteNames = current.caseEnabled
    ? selectedRemoteNames
    : [];

  const notarialSelectedRemoteNames = Array.from(
    new Set(
      current.notarialSelectedRemoteNames
        .map((remoteName) => normalizeRemoteName(remoteName))
        .filter((remoteName) => !!remoteName),
    ),
  );
  const activeNotarialSelectedRemoteNames = current.notarialEnabled
    ? notarialSelectedRemoteNames
    : [];

  if (
    activeCaseSelectedRemoteNames.length === 0 &&
    activeNotarialSelectedRemoteNames.length === 0
  ) {
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
    `${runLabel} started for ${activeCaseSelectedRemoteNames.length} database remote(s) and ${activeNotarialSelectedRemoteNames.length} notarial remote(s).`,
  );

  try {
    const remoteOutputs: string[] = [];

    for (const remoteName of activeCaseSelectedRemoteNames) {
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

    if (activeNotarialSelectedRemoteNames.length > 0) {
      const settingsResult = await getSystemSettings();
      if (!settingsResult.success) {
        throw new Error(
          `Failed to load system settings for notarial sync: ${settingsResult.error}`,
        );
      }

      const garageBucket = (settingsResult.result.garageBucket ?? "").trim();
      if (!garageBucket) {
        throw new Error(
          "Garage bucket is not configured. Set Garage bucket in System Settings to run notarial sync.",
        );
      }

      const notarialSource = buildRcloneDestination(
        NOTARIAL_REMOTE_NAME,
        garageBucket,
      );
      const retentionWithinArg = buildRetentionWithinArg(
        current.notarialSnapshotRetentionInterval,
      );
      const remoteConfigMap = await getRemoteConfigMap();
      const notarialRemoteConfig = remoteConfigMap.get(NOTARIAL_REMOTE_NAME);
      const notarialEndpoint = normalizeEndpointForComparison(
        notarialRemoteConfig?.options.endpoint,
      );
      const resticEnv = buildResticCommandEnv();
      const primaryRepositoryRelativePath = joinRemotePath(
        NOTARIAL_PRIMARY_REPOSITORY_BUCKET,
        NOTARIAL_PRIMARY_REPOSITORY_FOLDER,
      );

      if (!primaryRepositoryRelativePath) {
        throw new Error(
          "Primary notarial restic repository path is empty. Configure NOTARIAL_RESTIC_PRIMARY_BUCKET and NOTARIAL_RESTIC_PRIMARY_FOLDER.",
        );
      }

      const primaryRepositoryResticDestination =
        buildResticRepositoryDestination(
          NOTARIAL_REMOTE_NAME,
          primaryRepositoryRelativePath,
        );
      const primaryRepositoryRcloneSource = buildRcloneDestination(
        NOTARIAL_REMOTE_NAME,
        primaryRepositoryRelativePath,
      );

      await mkdir(NOTARIAL_RESTIC_CACHE_PATH, { recursive: true });

      const mountedNotarialSource = await startNotarialSourceMount(
        notarialSource,
        NOTARIAL_RESTIC_SOURCE_CACHE_PATH,
      );

      try {
        await ensureResticRepositoryInitialized(
          primaryRepositoryResticDestination,
          resticEnv,
        );

        appendBackupLog(
          "info",
          `Creating notarial restic snapshot on primary repository ${primaryRepositoryResticDestination}.`,
        );
        await runResticCommand(
          [
            "-r",
            primaryRepositoryResticDestination,
            "backup",
            NOTARIAL_RESTIC_SOURCE_CACHE_PATH,
          ],
          {
            trackAsActiveBackup: true,
            env: resticEnv,
          },
        );

        appendBackupLog(
          "info",
          `Applying restic retention (${retentionWithinArg}) on primary repository ${primaryRepositoryResticDestination}.`,
        );
        await runResticCommand(
          [
            "-r",
            primaryRepositoryResticDestination,
            "forget",
            "--keep-within",
            retentionWithinArg,
            "--prune",
          ],
          {
            trackAsActiveBackup: true,
            env: resticEnv,
          },
        );
      } finally {
        await stopNotarialSourceMount(
          mountedNotarialSource.mountProcess,
          NOTARIAL_RESTIC_SOURCE_CACHE_PATH,
        );
      }

      for (const remoteName of activeNotarialSelectedRemoteNames) {
        const remoteBasePath = getRemoteBasePath(current, remoteName);
        const targetRemoteConfig = remoteConfigMap.get(remoteName);
        const targetEndpoint = normalizeEndpointForComparison(
          targetRemoteConfig?.options.endpoint,
        );
        const targetBucket = extractS3BucketFromBasePath(remoteBasePath);
        const isS3Target =
          (targetRemoteConfig?.provider ?? "").trim().toLowerCase() === "s3";

        if (
          isS3Target &&
          !!notarialEndpoint &&
          notarialEndpoint === targetEndpoint &&
          targetBucket === garageBucket
        ) {
          throw new Error(
            `Notarial destination "${remoteName}" points to the same Garage endpoint and source bucket (${garageBucket}), which can cause recursive backup content. Use a different destination bucket/account for notarial repository replication.`,
          );
        }

        const destinationRepositoryRelativePath = joinRemotePath(
          remoteBasePath,
          current.remotePath,
          "notarial-restic",
        );
        const destinationRepository = buildRcloneDestination(
          remoteName,
          destinationRepositoryRelativePath,
        );

        const sameAsPrimaryRepository =
          isS3Target &&
          !!notarialEndpoint &&
          notarialEndpoint === targetEndpoint &&
          joinRemotePath(destinationRepositoryRelativePath) ===
            joinRemotePath(primaryRepositoryRelativePath);

        if (sameAsPrimaryRepository) {
          appendBackupLog(
            "warn",
            `Skipping repository replication for ${remoteName} because it points to the primary notarial repository path (${destinationRepository}).`,
          );
          continue;
        }

        appendBackupLog(
          "info",
          `Replicating primary notarial repository ${primaryRepositoryRcloneSource} to ${destinationRepository}.`,
        );
        await runRcloneCommand(
          ["sync", primaryRepositoryRcloneSource, destinationRepository],
          {
            "check-first": true,
          },
          {
            trackAsActiveBackup: true,
          },
        );

        appendBackupLog(
          "info",
          `Completed notarial repository replication to remote ${remoteName}.`,
        );
      }
    }

    const nowIso = new Date().toISOString();
    const completionMessage =
      remoteOutputs.length > 0
        ? remoteOutputs.join("\n")
        : `${runLabel} completed for ${activeCaseSelectedRemoteNames.length} database remote(s) and ${activeNotarialSelectedRemoteNames.length} notarial remote(s).`;

    const updated = await writeBackupConfigFile({
      ...current,
      lastRunAt: nowIso,
      lastRunStatus: "SUCCESS",
      lastRunMessage: completionMessage,
    });
    appendBackupLog(
      "info",
      `${runLabel} completed successfully for ${activeCaseSelectedRemoteNames.length} database remote(s) and ${activeNotarialSelectedRemoteNames.length} notarial remote(s).`,
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

  const hasActiveCaseDestinations =
    config.caseEnabled && config.selectedRemoteNames.length > 0;
  const hasActiveNotarialDestinations =
    config.notarialEnabled && config.notarialSelectedRemoteNames.length > 0;

  if (!hasActiveCaseDestinations && !hasActiveNotarialDestinations) {
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

  if (typeof patch.caseEnabled === "boolean") {
    next.caseEnabled = patch.caseEnabled;
  }

  if (typeof patch.notarialEnabled === "boolean") {
    next.notarialEnabled = patch.notarialEnabled;
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

  if (patch.notarialSelectedRemoteNames !== undefined) {
    next.notarialSelectedRemoteNames = normalizeSelectedRemoteNames(
      patch.notarialSelectedRemoteNames,
      undefined,
      false,
    );
  }

  if (patch.notarialSnapshotRetentionInterval !== undefined) {
    if (!isBackupIntervalKey(patch.notarialSnapshotRetentionInterval)) {
      throw new Error("Select a valid notarial snapshot retention interval.");
    }

    next.notarialSnapshotRetentionInterval =
      patch.notarialSnapshotRetentionInterval;
  }

  // Destination folder is fixed and not user-editable.
  next.remotePath = FIXED_BACKUP_DESTINATION_FOLDER;

  const hasActiveCaseDestinations =
    next.caseEnabled && next.selectedRemoteNames.length > 0;
  const hasActiveNotarialDestinations =
    next.notarialEnabled && next.notarialSelectedRemoteNames.length > 0;

  if (
    next.enabled &&
    !hasActiveCaseDestinations &&
    !hasActiveNotarialDestinations
  ) {
    throw new Error(
      "Select at least one active destination account (Cases or Notarial) before enabling scheduling.",
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

/**
 * Synchronize the notarial remote with Garage system settings.
 * Creates or updates the notarial S3 remote based on current Garage configuration.
 * Called automatically when system settings are loaded/updated.
 */
export async function syncNotarialRemote(): Promise<void> {
  await ensureBackupArtifacts();

  const settingsResult = await getSystemSettings();
  if (!settingsResult.success) {
    throw new Error(
      `Failed to load system settings for notarial sync: ${settingsResult.error}`,
    );
  }

  const settings = settingsResult.result;

  // Check if Garage is fully configured
  if (
    !settings.garageHost ||
    !settings.garageAccessKey ||
    !settings.garageSecretKey ||
    !settings.garageBucket
  ) {
    // Garage not configured, optionally remove the remote if it exists
    try {
      await runRcloneCommand(["config", "delete", NOTARIAL_REMOTE_NAME]);
    } catch {
      // Remote might not exist, that's fine
    }
    return;
  }

  // Build the S3 remote configuration for Garage
  const garagePort = settings.garagePort || 3900;
  const protocol = settings.garageIsHttps ? "https" : "http";
  const endpoint = `${protocol}://${settings.garageHost}:${garagePort}`;
  const region = settings.garageRegion?.trim() || "garage";

  // Configure the notarial remote as S3 pointing to Garage
  const provider = "s3";
  const remoteOptions = {
    provider: "Other",
    access_key_id: settings.garageAccessKey,
    secret_access_key: settings.garageSecretKey,
    endpoint: endpoint,
    region,
    acl: "private",
    force_path_style: "true",
  };

  const configMap = await getRemoteConfigMap();
  const remoteExists = configMap.has(NOTARIAL_REMOTE_NAME);

  if (remoteExists) {
    await runRcloneCommand([
      "config",
      "update",
      NOTARIAL_REMOTE_NAME,
      ...buildRemoteOptionArgs(remoteOptions, "update"),
    ]);
    return;
  }

  await runRcloneCommand([
    "config",
    "create",
    NOTARIAL_REMOTE_NAME,
    provider,
    ...buildRemoteOptionArgs(remoteOptions, "create"),
  ]);
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export async function getBackupRemoteStorageUsage(
  remoteName: string,
): Promise<BackupRemoteStorageUsage> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is managed by Garage settings and is not available in backup account operations.`,
    );
  }

  await ensureBackupArtifacts();

  const [configMap, currentConfig] = await Promise.all([
    getRemoteConfigMap(),
    readBackupConfigFile(),
  ]);
  const remoteConfig = configMap.get(normalizedName);
  const remoteProvider = (remoteConfig?.provider ?? "").trim().toLowerCase();

  // S3 requires special handling: use getS3StorageUsage with fallback from about to size
  if (remoteProvider === "s3") {
    const configuredBasePath = getRemoteBasePath(currentConfig, normalizedName);
    const basePathSegments = configuredBasePath
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => !!segment);
    const bucket = basePathSegments[0] ?? "";

    if (!bucket) {
      throw new Error(
        "S3 storage usage requires a bucket. Set S3 Bucket in account settings.",
      );
    }

    return getS3StorageUsage(normalizedName, bucket, runRcloneCommand);
  }

  let aboutTarget = `${normalizedName}:`;

  if (remoteProvider === "smb") {
    const configuredBasePath = getRemoteBasePath(currentConfig, normalizedName);
    const basePathSegments = configuredBasePath
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => !!segment);
    const share = basePathSegments[0] ?? "";

    if (!share) {
      throw new Error(
        "SMB storage usage requires a share. Set SMB Share in account settings.",
      );
    }

    aboutTarget = `${normalizedName}:${share}`;
  }

  const output = await runRcloneCommand(
    ["about", aboutTarget, "--json"],
    {},
    { silent: true, timeoutMs: 10_000 },
  );

  const parsed = JSON.parse(output) as Record<string, unknown>;

  return {
    remoteName: normalizedName,
    totalBytes: toNullableNumber(parsed.total),
    usedBytes: toNullableNumber(parsed.used),
    freeBytes: toNullableNumber(parsed.free),
    trashedBytes: toNullableNumber(parsed.trashed),
    otherBytes: toNullableNumber(parsed.other),
    objects: toNullableNumber(parsed.objects),
  };
}

function parseNotarialSnapshotsOutput(output: string): NotarialSnapshot[] {
  let parsed: unknown;

  try {
    parsed = output.trim() ? (JSON.parse(output) as unknown) : [];
  } catch {
    throw new Error("Failed to parse restic snapshots output.");
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const seenSnapshotIds = new Set<string>();
  const snapshots: NotarialSnapshot[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const typedEntry = entry as {
      id?: unknown;
      short_id?: unknown;
      time?: unknown;
    };
    const snapshotId =
      typeof typedEntry.id === "string" ? typedEntry.id.trim() : "";
    const snapshotTime =
      typeof typedEntry.time === "string" ? typedEntry.time.trim() : "";

    if (!snapshotId || !snapshotTime || seenSnapshotIds.has(snapshotId)) {
      continue;
    }

    seenSnapshotIds.add(snapshotId);
    snapshots.push({
      id: snapshotId,
      shortId:
        typeof typedEntry.short_id === "string" && typedEntry.short_id.trim()
          ? typedEntry.short_id.trim()
          : snapshotId.slice(0, 8),
      time: snapshotTime,
    });
  }

  snapshots.sort((left, right) => {
    const leftTime = new Date(left.time).getTime();
    const rightTime = new Date(right.time).getTime();

    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
      return 0;
    }
    if (!Number.isFinite(leftTime)) {
      return 1;
    }
    if (!Number.isFinite(rightTime)) {
      return -1;
    }

    return rightTime - leftTime;
  });

  return snapshots;
}

export async function listNotarialSnapshots(
  remoteName: string,
): Promise<NotarialSnapshot[]> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is managed by Garage settings and cannot be selected for notarial snapshots.`,
    );
  }

  await ensureBackupArtifacts();

  const [current, configMap] = await Promise.all([
    readBackupConfigFile(),
    getRemoteConfigMap(),
  ]);

  if (!configMap.has(normalizedName)) {
    throw new Error(`Remote ${normalizedName} was not found.`);
  }

  const remoteBasePath = getRemoteBasePath(current, normalizedName);
  const repositoryRelativePath = joinRemotePath(
    remoteBasePath,
    current.remotePath,
    "notarial-restic",
  );
  const repositoryDestination = buildResticRepositoryDestination(
    normalizedName,
    repositoryRelativePath,
  );
  const resticEnv = buildResticCommandEnv();

  try {
    const output = await runResticCommand(
      ["-r", repositoryDestination, "snapshots", "--json"],
      {
        silent: true,
        env: resticEnv,
      },
    );

    return parseNotarialSnapshotsOutput(output);
  } catch (error) {
    if (isResticRepositoryMissingError(formatBackupError(error))) {
      return [];
    }

    throw error instanceof Error ? error : new Error(formatBackupError(error));
  }
}

export async function restoreNotarialSnapshot(
  remoteName: string,
  snapshotId: string,
): Promise<void> {
  const normalizedName = normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is managed by Garage settings and cannot be selected for notarial restore.`,
    );
  }

  const normalizedSnapshotId = snapshotId.trim();
  if (!normalizedSnapshotId) {
    throw new Error("Snapshot ID is required.");
  }

  if (backupRunning) {
    throw new Error("A backup operation is already running.");
  }

  await ensureBackupArtifacts();

  const [current, configMap, settingsResult, availableSnapshots] =
    await Promise.all([
      readBackupConfigFile(),
      getRemoteConfigMap(),
      getSystemSettings(),
      listNotarialSnapshots(normalizedName),
    ]);

  if (!configMap.has(normalizedName)) {
    throw new Error(`Remote ${normalizedName} was not found.`);
  }

  if (!configMap.has(NOTARIAL_REMOTE_NAME)) {
    throw new Error(
      "Notarial source remote is not configured. Save Garage settings first.",
    );
  }

  if (!settingsResult.success) {
    throw new Error(
      `Failed to load system settings for notarial restore: ${settingsResult.error}`,
    );
  }

  const garageBucket = (settingsResult.result.garageBucket ?? "").trim();
  if (!garageBucket) {
    throw new Error(
      "Garage bucket is not configured. Set Garage bucket in System Settings before restoring notarial snapshots.",
    );
  }

  const selectedSnapshot = availableSnapshots.find(
    (snapshot) =>
      snapshot.id === normalizedSnapshotId ||
      snapshot.shortId === normalizedSnapshotId,
  );

  if (!selectedSnapshot) {
    throw new Error(
      "Selected notarial snapshot was not found for this destination account.",
    );
  }

  const remoteBasePath = getRemoteBasePath(current, normalizedName);
  const repositoryRelativePath = joinRemotePath(
    remoteBasePath,
    current.remotePath,
    "notarial-restic",
  );
  const repositoryDestination = buildResticRepositoryDestination(
    normalizedName,
    repositoryRelativePath,
  );
  const notarialSource = buildRcloneDestination(
    NOTARIAL_REMOTE_NAME,
    garageBucket,
  );
  const resticEnv = buildResticCommandEnv();
  const restoreTargetPath = path.join(
    process.cwd(),
    "data",
    "backup",
    "notarial-restore",
    `${Date.now()}-${normalizedName.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
  );

  backupRunning = true;
  cancelBackupRequested = false;

  try {
    await mkdir(restoreTargetPath, { recursive: true });

    appendBackupLog(
      "info",
      `Restoring notarial snapshot ${selectedSnapshot.shortId} from ${normalizedName}.`,
    );
    await runResticCommand(
      [
        "-r",
        repositoryDestination,
        "restore",
        selectedSnapshot.id,
        "--target",
        restoreTargetPath,
      ],
      {
        trackAsActiveBackup: true,
        env: resticEnv,
      },
    );

    if (cancelBackupRequested) {
      throw new Error("Restore cancelled by user.");
    }

    const restoredSourcePath =
      await resolveRestoredNotarialSourcePath(restoreTargetPath);

    appendBackupLog(
      "info",
      `Syncing restored notarial files from ${restoredSourcePath} to ${notarialSource}.`,
    );
    await runRcloneCommand(
      ["sync", restoredSourcePath, notarialSource],
      {
        "check-first": true,
      },
      {
        trackAsActiveBackup: true,
      },
    );

    appendBackupLog(
      "info",
      `Notarial snapshot restore completed from ${normalizedName}.`,
    );
  } catch (error) {
    const formattedError = formatBackupError(error);
    appendBackupLog(
      "error",
      `Notarial snapshot restore failed: ${formattedError}`,
    );
    throw new Error(formattedError);
  } finally {
    try {
      await rm(restoreTargetPath, { recursive: true, force: true });
    } catch (cleanupError) {
      appendBackupLog(
        "warn",
        `Could not clean temporary notarial restore folder: ${formatBackupError(cleanupError)}`,
      );
    }

    activeBackupProcess = null;
    cancelBackupRequested = false;
    backupRunning = false;
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

  // Prevent creation of reserved "notarial" remote
  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote name "${NOTARIAL_REMOTE_NAME}" is reserved for notarial storage and cannot be created manually.`,
    );
  }

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

  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is managed by Garage settings and cannot be re-logged manually.`,
    );
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

  if (normalizedCurrent === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is managed by Garage settings and cannot be edited manually.`,
    );
  }

  if (!normalizedNext) {
    throw new Error("Remote name is required.");
  }

  if (normalizedNext === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote name "${NOTARIAL_REMOTE_NAME}" is reserved for Garage-managed notarial storage.`,
    );
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
      const existingIdentity =
        updatedRemoteAccountIdentities[normalizedCurrent];
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

    const updatedNotarialSelectedRemoteNames = remoteNameChanged
      ? Array.from(
          new Set(
            currentConfig.notarialSelectedRemoteNames
              .map((name) =>
                normalizeRemoteName(name) === normalizedCurrent
                  ? targetRemoteName
                  : normalizeRemoteName(name),
              )
              .filter((name) => !!name),
          ),
        )
      : currentConfig.notarialSelectedRemoteNames;

    const updatedConfig = await writeBackupConfigFile({
      ...currentConfig,
      selectedRemoteNames: updatedSelectedRemoteNames,
      notarialSelectedRemoteNames: updatedNotarialSelectedRemoteNames,
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

  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is managed by Garage settings and cannot be cleared manually.`,
    );
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

  // Prevent deletion of reserved "notarial" remote
  if (normalizedName === NOTARIAL_REMOTE_NAME) {
    throw new Error(
      `Remote "${NOTARIAL_REMOTE_NAME}" is reserved for notarial storage and cannot be deleted.`,
    );
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
  const updatedNotarialSelectedRemoteNames =
    current.notarialSelectedRemoteNames.filter(
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
  const notarialSelectedRemotesChanged =
    updatedNotarialSelectedRemoteNames.length !==
    current.notarialSelectedRemoteNames.length;

  if (
    selectedRemotesChanged ||
    notarialSelectedRemotesChanged ||
    identityWasCached ||
    basePathWasConfigured
  ) {
    const updated = await writeBackupConfigFile({
      ...current,
      selectedRemoteNames: updatedSelectedRemoteNames,
      notarialSelectedRemoteNames: updatedNotarialSelectedRemoteNames,
      remoteAccountIdentities: updatedRemoteAccountIdentities,
      remoteBasePaths: updatedRemoteBasePaths,
      enabled:
        (selectedRemotesChanged || notarialSelectedRemotesChanged) &&
        updatedSelectedRemoteNames.length === 0 &&
        updatedNotarialSelectedRemoteNames.length === 0
          ? false
          : current.enabled,
    });

    if (selectedRemotesChanged || notarialSelectedRemotesChanged) {
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
  const [config, allRemotes] = await Promise.all([
    readBackupConfigFile(),
    listBackupRemotes(),
  ]);

  // Filter out the reserved notarial remote from user-facing list
  const remotes = allRemotes.filter(
    (remote) => remote.name !== NOTARIAL_REMOTE_NAME,
  );

  return {
    config,
    remotes,
    providers: BACKUP_PROVIDER_OPTIONS,
    importSourceOptions: BACKUP_IMPORT_SOURCE_OPTIONS,
    logs: getBackupLogsSnapshot(),
    accountSetupInProgress: accountSetupRunning,
  };
}
