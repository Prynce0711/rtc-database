import "server-only";

import {
  BACKUP_INTERVAL_LOOKUP,
  DEFAULT_AUTH_CALLBACK_PORT,
  OAUTH_ACCOUNT_PROVIDERS,
  ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL,
  ONEDRIVE_DEFAULT_ACCESS_SCOPES,
  REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE,
  SENSITIVE_RCLONE_OPTION_KEYS,
  type BackupImportSourceKey,
  type BackupIntervalKey,
} from "./constants";

export function joinRemotePath(...segments: string[]): string {
  const normalizedParts: string[] = [];

  for (const rawSegment of segments) {
    const parts = rawSegment
      .trim()
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => part.trim())
      .filter((part) => !!part);

    normalizedParts.push(...parts);
  }

  return normalizedParts.join("/");
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/(token\s*=\s*)(.+)/gi, "$1***")
    .replace(/("access_token"\s*:\s*")(.*?)(")/gi, "$1***$3")
    .replace(/("refresh_token"\s*:\s*")(.*?)(")/gi, "$1***$3");
}

export function formatRcloneArgsForLog(args: string[]): string {
  const formatted: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const current = String(args[index] ?? "");
    const previous = String(args[index - 1] ?? "").toLowerCase();

    if (SENSITIVE_RCLONE_OPTION_KEYS.has(previous)) {
      formatted.push("***");
      continue;
    }

    if (
      current.includes('"access_token"') ||
      current.includes('"refresh_token"')
    ) {
      formatted.push("***");
      continue;
    }

    formatted.push(current);
  }

  return formatted.join(" ");
}

function normalizeRemoteOptions(
  options: Record<string, string>,
  mode: "create" | "update",
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(options)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    const value = rawValue.trim();
    if (
      !value &&
      mode !== "update" &&
      !REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE.has(key)
    ) {
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

export function buildProviderAwareRemoteOptions(
  provider: string,
  options: Record<string, string>,
  mode: "create" | "update",
): Record<string, string> {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedOptions = normalizeRemoteOptions(options, mode);

  if (normalizedProvider === "s3" && !normalizedOptions.provider) {
    // Use rclone's generic provider default for S3-compatible backends.
    normalizedOptions.provider = "Other";
  }

  if (!normalizedOptions.token && normalizedOptions.config_token) {
    normalizedOptions.token = normalizedOptions.config_token;
  }
  delete normalizedOptions.config_token;

  if (!OAUTH_ACCOUNT_PROVIDERS.has(normalizedProvider)) {
    return normalizedOptions;
  }

  if (mode === "create" && !normalizedOptions.config_is_local) {
    // Follow rclone headless setup behavior for server-side remote creation.
    normalizedOptions.config_is_local = "false";
  }

  if (normalizedProvider !== "onedrive") {
    return normalizedOptions;
  }

  if (mode === "create") {
    normalizedOptions.config_type = normalizedOptions.config_type || "onedrive";
    normalizedOptions.drive_type = normalizedOptions.drive_type || "personal";
  }

  if (
    !normalizedOptions.access_scopes &&
    (mode === "create" || !!normalizedOptions.token)
  ) {
    normalizedOptions.access_scopes = ONEDRIVE_DEFAULT_ACCESS_SCOPES;
  }

  const clearDriveIdRequested =
    mode === "update" &&
    (normalizedOptions.config_driveid === ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL ||
      normalizedOptions.drive_id === ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL);

  const configuredDriveId =
    normalizedOptions.config_driveid || normalizedOptions.drive_id;

  if (mode === "create") {
    if (configuredDriveId) {
      normalizedOptions.config_driveid = configuredDriveId;
    }
    delete normalizedOptions.drive_id;
  } else {
    if (clearDriveIdRequested) {
      // Preserve an explicit "none" drive selection by writing an empty drive_id.
      normalizedOptions.drive_id = "";
    } else if (configuredDriveId) {
      normalizedOptions.drive_id = configuredDriveId;
    }
    delete normalizedOptions.config_driveid;
  }

  return normalizedOptions;
}

export function buildRemoteOptionArgs(
  options: Record<string, string>,
  mode: "create" | "update" = "create",
): string[] {
  const optionArgs: string[] = [];

  for (const [key, value] of Object.entries(options)) {
    const cleanKey = key.trim();
    if (!cleanKey) {
      continue;
    }

    const cleanValue = value.trim();
    if (
      !cleanValue &&
      mode !== "update" &&
      !REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE.has(cleanKey)
    ) {
      continue;
    }

    optionArgs.push(cleanKey, cleanValue);
  }

  return optionArgs;
}

export function isBackupIntervalKey(
  value: unknown,
): value is BackupIntervalKey {
  return (
    typeof value === "string" &&
    BACKUP_INTERVAL_LOOKUP.has(value as BackupIntervalKey)
  );
}

export function isBackupImportSourceKey(
  value: unknown,
): value is BackupImportSourceKey {
  return (
    value === "manual" ||
    (typeof value === "string" && isBackupIntervalKey(value))
  );
}

export function getIntervalDefinition(intervalKey: BackupIntervalKey) {
  const definition = BACKUP_INTERVAL_LOOKUP.get(intervalKey);
  if (!definition) {
    throw new Error(`Unsupported backup interval: ${intervalKey}`);
  }

  return definition;
}

export function addIntervalToDate(
  base: Date,
  intervalKey: BackupIntervalKey,
): Date {
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

export function formatBackupError(error: unknown): string {
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

export function isRemotePathNotFoundError(message: string): boolean {
  const lowered = message.toLowerCase();

  return (
    lowered.includes("directory not found") ||
    lowered.includes("object not found") ||
    lowered.includes("path not found") ||
    lowered.includes("no such file") ||
    lowered.includes("doesn't exist")
  );
}

export function isRemoteBackendStateInvalidError(message: string): boolean {
  const lowered = message.toLowerCase();

  return (
    lowered.includes("unable to get drive_id and drive_type") ||
    lowered.includes("objecthandle is invalid") ||
    lowered.includes("invalidobjecthandle") ||
    lowered.includes("failed to query root for drive") ||
    lowered.includes("re-configure this backend")
  );
}

export function isAuthServerPortConflictError(message: string): boolean {
  const lowered = message.toLowerCase();

  return (
    lowered.includes("failed to start auth webserver") &&
    (lowered.includes("address already in use") ||
      lowered.includes("only one usage of each socket address") ||
      lowered.includes("bind:"))
  );
}

export function extractAuthCallbackPort(message: string): number {
  const match = message.match(/(?:127\.0\.0\.1|localhost):(\d{2,5})/i);
  const parsed = Number(match?.[1] ?? "");

  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  return DEFAULT_AUTH_CALLBACK_PORT;
}
