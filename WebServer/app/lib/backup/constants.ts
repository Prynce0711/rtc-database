import "server-only";

import path from "node:path";

export const BACKUP_INTERVAL_DEFINITIONS = [
  {
    value: "5m",
    label: "Every 5 minutes",
    description: "Automatic backup every 5 minutes",
    folderName: "last-5-min",
    unit: "minutes",
    amount: 5,
  },
  {
    value: "15m",
    label: "Every 15 minutes",
    description: "Automatic backup every 15 minutes",
    folderName: "last-15-min",
    unit: "minutes",
    amount: 15,
  },
  {
    value: "1h",
    label: "Every 1 hour",
    description: "Automatic backup every hour",
    folderName: "last-hour",
    unit: "hours",
    amount: 1,
  },
  {
    value: "1d",
    label: "Every 1 day",
    description: "Automatic backup every day",
    folderName: "last-day",
    unit: "days",
    amount: 1,
  },
  {
    value: "1w",
    label: "Every 1 week",
    description: "Automatic backup every week",
    folderName: "last-week",
    unit: "weeks",
    amount: 1,
  },
  {
    value: "1mo",
    label: "Every 1 month",
    description: "Automatic backup every month",
    folderName: "last-month",
    unit: "months",
    amount: 1,
  },
  {
    value: "1y",
    label: "Every 1 year",
    description: "Automatic backup every year",
    folderName: "last-year",
    unit: "years",
    amount: 1,
  },
] as const;

export type BackupIntervalDefinition =
  (typeof BACKUP_INTERVAL_DEFINITIONS)[number];

export type BackupIntervalKey = BackupIntervalDefinition["value"];

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

export const BACKUP_INTERVAL_KEYS: BackupIntervalKey[] =
  BACKUP_INTERVAL_OPTIONS.map((option) => option.value);

export const BACKUP_INTERVAL_LOOKUP = new Map<
  BackupIntervalKey,
  BackupIntervalDefinition
>(
  BACKUP_INTERVAL_DEFINITIONS.map((definition) => [
    definition.value,
    definition,
  ]) as Array<[BackupIntervalKey, BackupIntervalDefinition]>,
);

export const DEFAULT_SELECTED_INTERVALS: BackupIntervalKey[] = ["1h"];
export const MANUAL_BACKUP_FOLDER = "manual";

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

export interface BackupProviderOption {
  value: string;
  label: string;
  description: string;
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

// Local backup source path.
export const FIXED_BACKUP_SOURCE_PATH = path.join(process.cwd(), "dev.db");

// Scheduler/logging/runtime numeric limits.
export const MAX_BACKUP_LOG_ENTRIES = 500;
export const MAX_TIMER_MS = 2_147_000_000;
export const ACCOUNT_SETUP_STALE_MS = 3 * 60 * 1000;
export const IDENTITY_REFRESH_RETRY_MS = 60 * 1000;

// Auth flow retry and timeout values.
export const AUTH_FLOW_RCLONE_RETRIES = 1;
export const AUTH_FLOW_RCLONE_LOW_LEVEL_RETRIES = 1;
export const AUTH_FLOW_INTERACTIVE_TIMEOUT_MS = 20_000;
export const DEFAULT_AUTH_CALLBACK_PORT = 53682;

// Provider and remote option constants.
export const OAUTH_ACCOUNT_PROVIDERS = new Set([
  "drive",
  "onedrive",
  "dropbox",
]);
export const ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL = "__RTC_ONEDRIVE_NO_DRIVE_ID__";
export const ONEDRIVE_DRIVE_SELECTION_SOURCE_OPTION_KEY =
  "__rtc_onedrive_drive_selection_source";
export const ONEDRIVE_DEFAULT_ACCESS_SCOPES =
  "Files.Read Files.ReadWrite Files.Read.All Files.ReadWrite.All Sites.Read.All offline_access User.Read openid profile email";

// Option handling for sensitive and special-case values.
export const REMOTE_OPTION_KEYS_ALLOW_EMPTY_VALUE = new Set(["drive_id"]);
export const SENSITIVE_RCLONE_OPTION_KEYS = new Set([
  "token",
  "config_token",
  "pass",
  "password",
  "secret_access_key",
  "key",
  "client_secret",
]);
