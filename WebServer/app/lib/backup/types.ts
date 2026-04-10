import "server-only";

import type { BackupIntervalKey } from "./constants";

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
  caseEnabled: boolean;
  notarialEnabled: boolean;
  selectedIntervals: BackupIntervalKey[];
  selectedRemoteNames: string[];
  notarialSelectedRemoteNames: string[];
  notarialSnapshotRetentionInterval: BackupIntervalKey;
  remoteAccountIdentities: Record<string, string>;
  remoteBasePaths: Record<string, string>;
  remotePath: string;
  lastRunAt: string | null;
  lastRunStatus: BackupRunStatus;
  lastRunMessage: string | null;
  updatedAt: string;
}

export interface BackupRemote {
  name: string;
  provider: string;
  options: Record<string, string>;
  accountIdentity: string | null;
  basePath: string;
}

export interface BackupConfigPatch {
  enabled?: boolean;
  caseEnabled?: boolean;
  notarialEnabled?: boolean;
  selectedIntervals?: string[];
  selectedRemoteNames?: string[];
  notarialSelectedRemoteNames?: string[];
  notarialSnapshotRetentionInterval?: string;
  remotePath?: string;
}

export interface NotarialSnapshot {
  id: string;
  shortId: string;
  time: string;
}
