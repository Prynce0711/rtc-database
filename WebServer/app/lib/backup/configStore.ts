import "server-only";

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BACKUP_INTERVAL_LOOKUP,
  DEFAULT_SELECTED_INTERVALS,
  FIXED_BACKUP_DESTINATION_FOLDER,
  REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE,
  type BackupIntervalKey,
} from "./constants";
import type { BackupConfig, BackupRunStatus } from "./types";

export interface ParsedRemoteConfig {
  provider: string;
  options: Record<string, string>;
}

export const BACKUP_DATA_DIR = path.join(process.cwd(), "data", "backup");
export const BACKUP_CONFIG_PATH = path.join(
  BACKUP_DATA_DIR,
  "backup-config.json",
);
export const RCLONE_CONFIG_PATH = path.join(BACKUP_DATA_DIR, "rclone.conf");

function isBackupRunStatus(value: unknown): value is BackupRunStatus {
  return (
    value === "IDLE" ||
    value === "RUNNING" ||
    value === "SUCCESS" ||
    value === "FAILED" ||
    value === "CANCELLED"
  );
}

function isBackupIntervalKey(value: unknown): value is BackupIntervalKey {
  return (
    typeof value === "string" &&
    BACKUP_INTERVAL_LOOKUP.has(value as BackupIntervalKey)
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

export function normalizeRemoteName(value: string): string {
  return value.trim().replace(/:+$/, "");
}

export function normalizeSelectedIntervals(
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

export function normalizeSelectedRemoteNames(
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

export function normalizeRemoteAccountIdentities(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};

  for (const [rawName, rawIdentity] of Object.entries(value)) {
    if (typeof rawIdentity !== "string") {
      continue;
    }

    const normalizedName = normalizeRemoteName(rawName);
    const trimmedIdentity = rawIdentity.trim();

    if (!normalizedName || !trimmedIdentity) {
      continue;
    }

    normalized[normalizedName] = trimmedIdentity;
  }

  return normalized;
}

export function normalizeRemoteBasePaths(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};

  for (const [rawName, rawBasePath] of Object.entries(value)) {
    if (typeof rawBasePath !== "string") {
      continue;
    }

    const normalizedName = normalizeRemoteName(rawName);
    const trimmedBasePath = rawBasePath
      .trim()
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => part.trim())
      .filter((part) => !!part)
      .join("/");

    if (!normalizedName || !trimmedBasePath) {
      continue;
    }

    normalized[normalizedName] = trimmedBasePath;
  }

  return normalized;
}

export async function ensureBackupArtifacts(): Promise<void> {
  await mkdir(BACKUP_DATA_DIR, { recursive: true });

  try {
    await access(RCLONE_CONFIG_PATH);
  } catch {
    await writeFile(RCLONE_CONFIG_PATH, "", "utf8");
  }
}

async function getDefaultBackupConfig(): Promise<BackupConfig> {
  return {
    enabled: true,
    caseEnabled: true,
    notarialEnabled: true,
    selectedIntervals: [...DEFAULT_SELECTED_INTERVALS],
    selectedRemoteNames: [],
    notarialSelectedRemoteNames: [],
    notarialDeletedFilesMaxAgeDays: 30,
    remoteAccountIdentities: {},
    remoteBasePaths: {},
    remotePath: FIXED_BACKUP_DESTINATION_FOLDER,
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
    caseEnabled:
      typeof value.caseEnabled === "boolean"
        ? value.caseEnabled
        : defaults.caseEnabled,
    notarialEnabled:
      typeof value.notarialEnabled === "boolean"
        ? value.notarialEnabled
        : defaults.notarialEnabled,
    selectedIntervals: normalizeSelectedIntervals(
      legacy.selectedIntervals,
      legacy.intervalMinutes,
    ),
    selectedRemoteNames: normalizeSelectedRemoteNames(
      legacy.selectedRemoteNames,
      legacy.remoteName,
    ),
    notarialSelectedRemoteNames: normalizeSelectedRemoteNames(
      legacy.notarialSelectedRemoteNames,
      undefined,
      false,
    ),
    notarialDeletedFilesMaxAgeDays:
      typeof legacy.notarialDeletedFilesMaxAgeDays === "number" &&
      Number.isFinite(legacy.notarialDeletedFilesMaxAgeDays) &&
      legacy.notarialDeletedFilesMaxAgeDays > 0
        ? Math.floor(legacy.notarialDeletedFilesMaxAgeDays)
        : defaults.notarialDeletedFilesMaxAgeDays,
    remoteAccountIdentities: normalizeRemoteAccountIdentities(
      value.remoteAccountIdentities,
    ),
    remoteBasePaths: normalizeRemoteBasePaths(value.remoteBasePaths),
    remotePath: FIXED_BACKUP_DESTINATION_FOLDER,
    lastRunAt: normalizeIsoDate(value.lastRunAt),
    lastRunStatus: isBackupRunStatus(value.lastRunStatus)
      ? value.lastRunStatus
      : defaults.lastRunStatus,
    lastRunMessage:
      typeof value.lastRunMessage === "string" ? value.lastRunMessage : null,
    updatedAt: normalizeIsoDate(value.updatedAt) ?? defaults.updatedAt,
  };
}

export async function readBackupConfigFile(): Promise<BackupConfig> {
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

export async function writeBackupConfigFile(
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

export async function getRemoteConfigMap(): Promise<
  Map<string, ParsedRemoteConfig>
> {
  const map = new Map<string, ParsedRemoteConfig>();

  try {
    const raw = await readFile(RCLONE_CONFIG_PATH, "utf8");
    let activeRemote = "";
    let activeConfig: ParsedRemoteConfig | null = null;

    for (const line of raw.split(/\r?\n/)) {
      const section = line.match(/^\[(.+)]\s*$/);
      if (section) {
        activeRemote = normalizeRemoteName(section[1]);
        activeConfig = {
          provider: "unknown",
          options: {},
        };
        map.set(activeRemote, activeConfig);
        continue;
      }

      if (!activeRemote || !activeConfig) {
        continue;
      }

      const kvField = line.match(/^\s*([^=]+?)\s*=\s*(.*)\s*$/);
      if (!kvField) {
        continue;
      }

      const key = kvField[1].trim();
      const value = kvField[2].trim();
      if (!key) {
        continue;
      }

      if (key === "type") {
        activeConfig.provider = value || "unknown";
      } else {
        activeConfig.options[key] = value;
      }
    }
  } catch {
    return map;
  }

  return map;
}

function sanitizeConfigOptionValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

export async function updateRemoteConfigOptionsInFile(
  remoteName: string,
  options: Record<string, string>,
): Promise<void> {
  await ensureBackupArtifacts();

  const normalizedRemoteName = normalizeRemoteName(remoteName);
  if (!normalizedRemoteName) {
    throw new Error("Remote name is required.");
  }

  const raw = await readFile(RCLONE_CONFIG_PATH, "utf8");
  const usesCrlf = raw.includes("\r\n");
  const eol = usesCrlf ? "\r\n" : "\n";
  const hadTrailingNewline = raw.endsWith("\n");
  const lines = raw.split(/\r?\n/);

  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const section = lines[index].match(/^\s*\[(.+)]\s*$/);
    if (!section) {
      continue;
    }

    const sectionName = normalizeRemoteName(section[1]);

    if (sectionStart >= 0) {
      sectionEnd = index;
      break;
    }

    if (sectionName === normalizedRemoteName) {
      sectionStart = index;
    }
  }

  if (sectionStart < 0) {
    throw new Error(`Remote ${normalizedRemoteName} was not found.`);
  }

  const pending = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(options)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    pending.set(key, sanitizeConfigOptionValue(rawValue));
  }

  if (pending.size === 0) {
    return;
  }

  const removedLineIndexes = new Set<number>();

  // Keep remote sections compact to avoid accumulating blank lines after repeated updates.
  for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
    if (lines[index].trim() === "") {
      removedLineIndexes.add(index);
    }
  }

  for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
    const kv = lines[index].match(/^\s*([^=]+?)\s*=\s*(.*)\s*$/);
    if (!kv) {
      continue;
    }

    const key = kv[1].trim();
    if (!pending.has(key)) {
      continue;
    }

    const nextValue = pending.get(key) ?? "";
    if (nextValue || REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE.has(key)) {
      lines[index] = `${key} = ${nextValue}`;
    } else {
      removedLineIndexes.add(index);
    }

    pending.delete(key);
  }

  const additionalLines: string[] = [];
  for (const [key, value] of pending.entries()) {
    if (!value && !REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE.has(key)) {
      continue;
    }

    additionalLines.push(`${key} = ${value}`);
  }

  const nextLines: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (index === sectionEnd) {
      nextLines.push(...additionalLines);
    }

    if (removedLineIndexes.has(index)) {
      continue;
    }

    nextLines.push(lines[index]);
  }

  if (sectionEnd >= lines.length) {
    nextLines.push(...additionalLines);
  }

  const dedupedLines = nextLines.filter((line, index, array) => {
    if (line !== "") {
      return true;
    }

    const isEndPadding = index === array.length - 1;
    return !isEndPadding;
  });

  const nextRaw = `${dedupedLines.join(eol)}${hadTrailingNewline ? eol : ""}`;
  await writeFile(RCLONE_CONFIG_PATH, nextRaw, "utf8");
}
