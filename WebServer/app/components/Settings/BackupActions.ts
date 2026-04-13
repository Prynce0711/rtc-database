"use server";

import { validateSession } from "@/app/lib/authActions";
import {
  BACKUP_INTERVAL_OPTIONS,
  cancelRunningBackup,
  clearBackupRemoteFiles,
  createBackupRemote,
  deleteBackupRemote,
  getBackupOverview,
  getBackupRemoteStorageUsage,
  listNotarialSnapshots,
  reloginBackupRemote,
  restoreNotarialSnapshot,
  runBackupNow,
  startBackupScheduler,
  updateBackupConfig,
  updateBackupRemote,
  type BackupConfig,
  type BackupImportSourceOption,
  type BackupIntervalOption,
  type BackupLogEntry,
  type BackupProviderOption,
  type BackupRemote,
  type BackupRemoteStorageUsage,
  type NotarialSnapshot,
} from "@/app/lib/backup/backupScheduler";
import {
  ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL,
  ONEDRIVE_DRIVE_SELECTION_SOURCE_OPTION_KEY,
} from "@/app/lib/backup/constants";
import {
  importBackupFromLocalUpload,
  importBackupFromRemote,
} from "@/app/lib/backup/importer";
import {
  listOneDriveRemoteDriveOptions,
  type OneDriveDriveOption,
} from "@/app/lib/backup/remotes/onedrive";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import { z } from "zod";

export interface BackupDashboardData {
  config: BackupConfig;
  remotes: BackupRemote[];
  providers: BackupProviderOption[];
  intervalOptions: BackupIntervalOption[];
  importSourceOptions: BackupImportSourceOption[];
  logs: BackupLogEntry[];
  accountSetupInProgress: boolean;
  oneDriveClearDriveIdSentinel: string;
  oneDriveDriveSelectionSourceOptionKey: string;
}

export type BackupOneDriveDriveOption = OneDriveDriveOption;
export type BackupRemoteUsage = BackupRemoteStorageUsage;
export type BackupNotarialSnapshot = NotarialSnapshot;

const BACKUP_INTERVAL_VALUE_SET = new Set(
  BACKUP_INTERVAL_OPTIONS.map((option) => option.value),
);

const SaveBackupSchema = z.object({
  enabled: z.boolean(),
  caseEnabled: z.boolean().default(true),
  notarialEnabled: z.boolean().default(false),
  selectedIntervals: z.array(z.string()).default([]),
  selectedRemoteNames: z.array(z.string()).default([]),
  notarialSelectedRemoteNames: z.array(z.string()).default([]),
  notarialSnapshotRetentionInterval: z
    .string()
    .refine((value) => BACKUP_INTERVAL_VALUE_SET.has(value as any), {
      message: "Invalid notarial snapshot retention interval",
    }),
  remotePath: z.string(),
});

const CreateRemoteSchema = z.object({
  remoteName: z.string().min(2).max(64),
  provider: z.string().min(2).max(64),
  options: z.record(z.string(), z.string()).optional().default({}),
  forceRestart: z.boolean().optional().default(false),
  remoteBasePath: z.string().optional(),
});

const ImportRemoteSchema = z.object({
  remoteName: z.string().min(1),
  source: z.string().min(1),
});

const UpdateRemoteSchema = z.object({
  currentRemoteName: z.string().min(1),
  nextRemoteName: z.string().min(1),
  provider: z.string().min(1),
  options: z.record(z.string(), z.string()).optional().default({}),
  remoteBasePath: z.string().optional(),
});

const ReLoginRemoteSchema = z.object({
  remoteName: z.string().min(1),
  forceRestart: z.boolean().optional().default(false),
});

const ListOneDriveDrivesSchema = z.object({
  remoteName: z.string().min(1),
});

const GetBackupRemoteStorageUsageSchema = z.object({
  remoteName: z.string().min(1),
});

const ListNotarialSnapshotsSchema = z.object({
  remoteName: z.string().min(1),
});

const RestoreNotarialSnapshotSchema = z.object({
  remoteName: z.string().min(1),
  snapshotId: z.string().min(1),
});

async function getDashboardData(): Promise<BackupDashboardData> {
  const overview = await getBackupOverview();

  return {
    ...overview,
    intervalOptions: [...BACKUP_INTERVAL_OPTIONS],
    oneDriveClearDriveIdSentinel: ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL,
    oneDriveDriveSelectionSourceOptionKey:
      ONEDRIVE_DRIVE_SELECTION_SOURCE_OPTION_KEY,
  };
}

export async function getBackupDashboard(): Promise<
  ActionResult<BackupDashboardData>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await startBackupScheduler();

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error loading backup dashboard:", error);
    return { success: false, error: "Failed to load backup settings" };
  }
}

export async function saveBackupConfiguration(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = SaveBackupSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid backup configuration payload" };
    }

    await startBackupScheduler();

    await updateBackupConfig({
      enabled: parsed.data.enabled,
      caseEnabled: parsed.data.caseEnabled,
      notarialEnabled: parsed.data.notarialEnabled,
      selectedIntervals: parsed.data.selectedIntervals,
      selectedRemoteNames: parsed.data.selectedRemoteNames,
      notarialSelectedRemoteNames: parsed.data.notarialSelectedRemoteNames,
      notarialSnapshotRetentionInterval:
        parsed.data.notarialSnapshotRetentionInterval,
      remotePath: parsed.data.remotePath,
    });

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error saving backup configuration:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save backup configuration",
    };
  }
}

export async function runBackupNowAction(): Promise<
  ActionResult<BackupDashboardData>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await startBackupScheduler();
    await runBackupNow();

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error running backup now:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to run backup now",
    };
  }
}

export async function importBackupFromRemoteAction(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = ImportRemoteSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid remote import payload" };
    }

    await startBackupScheduler();
    await importBackupFromRemote(parsed.data.remoteName, parsed.data.source);

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error restoring backup from remote:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to restore backup from remote",
    };
  }
}

export async function importBackupFromLocalFileAction(
  formData: FormData,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "Select a backup file to import" };
    }

    if (file.size <= 0) {
      return { success: false, error: "Selected backup file is empty" };
    }

    await startBackupScheduler();

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    await importBackupFromLocalUpload(file.name, fileBytes);

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error restoring backup from local file:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to restore backup from local file",
    };
  }
}

export async function cancelBackupNowAction(): Promise<
  ActionResult<BackupDashboardData>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await startBackupScheduler();
    await cancelRunningBackup();

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error cancelling backup:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel backup",
    };
  }
}

export async function createBackupAccount(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = CreateRemoteSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid backup account payload" };
    }

    await startBackupScheduler();
    await createBackupRemote(
      parsed.data.remoteName,
      parsed.data.provider,
      parsed.data.options,
      parsed.data.forceRestart,
      parsed.data.remoteBasePath,
    );

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error creating backup account:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create backup account",
    };
  }
}

export async function updateBackupAccount(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = UpdateRemoteSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid backup account update payload" };
    }

    await startBackupScheduler();
    await updateBackupRemote(
      parsed.data.currentRemoteName,
      parsed.data.nextRemoteName,
      parsed.data.provider,
      parsed.data.options,
      parsed.data.remoteBasePath,
    );

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error updating backup account:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update backup account",
    };
  }
}

export async function reloginBackupAccount(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = ReLoginRemoteSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid backup account re-login payload",
      };
    }

    await startBackupScheduler();
    await reloginBackupRemote(parsed.data.remoteName, parsed.data.forceRestart);

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error re-logging backup account:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to re-login backup account",
    };
  }
}

export async function deleteBackupAccount(
  remoteName: string,
  deleteBackupFiles = false,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    if (!remoteName.trim()) {
      return { success: false, error: "Remote name is required" };
    }

    if (typeof deleteBackupFiles !== "boolean") {
      return { success: false, error: "Invalid delete backup files option" };
    }

    await startBackupScheduler();
    await deleteBackupRemote(remoteName, deleteBackupFiles);

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error deleting backup account:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete backup account",
    };
  }
}

export async function clearBackupAccountFiles(
  remoteName: string,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    if (!remoteName.trim()) {
      return { success: false, error: "Remote name is required" };
    }

    await startBackupScheduler();
    await clearBackupRemoteFiles(remoteName);

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error clearing backup account files:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to clear backup account files",
    };
  }
}

export async function listOneDriveDriveOptionsAction(
  data: Record<string, unknown>,
): Promise<
  ActionResult<{
    remoteName: string;
    drives: BackupOneDriveDriveOption[];
  }>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = ListOneDriveDrivesSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid OneDrive drive list payload",
      };
    }

    await startBackupScheduler();

    const normalizedRemoteName = parsed.data.remoteName.trim();
    const drives = await listOneDriveRemoteDriveOptions(normalizedRemoteName);

    return {
      success: true,
      result: {
        remoteName: normalizedRemoteName,
        drives,
      },
    };
  } catch (error) {
    console.error("Error listing OneDrive drives:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to list OneDrive drives",
    };
  }
}

export async function getBackupRemoteUsageAction(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupRemoteUsage>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = GetBackupRemoteStorageUsageSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid backup remote usage payload",
      };
    }

    await startBackupScheduler();

    return {
      success: true,
      result: await getBackupRemoteStorageUsage(parsed.data.remoteName),
    };
  } catch (error) {
    console.error("Error loading backup remote usage:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load backup remote usage",
    };
  }
}

export async function listNotarialSnapshotsAction(
  data: Record<string, unknown>,
): Promise<
  ActionResult<{
    remoteName: string;
    snapshots: BackupNotarialSnapshot[];
  }>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = ListNotarialSnapshotsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid notarial snapshots payload",
      };
    }

    await startBackupScheduler();

    const normalizedRemoteName = parsed.data.remoteName.trim();
    const snapshots = await listNotarialSnapshots(normalizedRemoteName);

    return {
      success: true,
      result: {
        remoteName: normalizedRemoteName,
        snapshots,
      },
    };
  } catch (error) {
    console.error("Error listing notarial snapshots:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to list notarial snapshots",
    };
  }
}

export async function restoreNotarialSnapshotAction(
  data: Record<string, unknown>,
): Promise<ActionResult<BackupDashboardData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = RestoreNotarialSnapshotSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid notarial snapshot restore payload",
      };
    }

    await startBackupScheduler();
    await restoreNotarialSnapshot(
      parsed.data.remoteName.trim(),
      parsed.data.snapshotId.trim(),
    );

    return {
      success: true,
      result: await getDashboardData(),
    };
  } catch (error) {
    console.error("Error restoring notarial snapshot:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to restore notarial snapshot",
    };
  }
}
