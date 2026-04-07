"use server";

import { validateSession } from "@/app/lib/authActions";
import {
  BACKUP_INTERVAL_OPTIONS,
  cancelRunningBackup,
  createBackupRemote,
  deleteBackupRemote,
  getBackupOverview,
  importBackupFromLocalUpload,
  importBackupFromRemote,
  reloginBackupRemote,
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
} from "@/app/lib/backupScheduler";
import Roles from "@/app/lib/Roles";
import { z } from "zod";
import ActionResult from "../ActionResult";

export interface BackupDashboardData {
  config: BackupConfig;
  remotes: BackupRemote[];
  providers: BackupProviderOption[];
  intervalOptions: BackupIntervalOption[];
  importSourceOptions: BackupImportSourceOption[];
  logs: BackupLogEntry[];
  accountSetupInProgress: boolean;
}

const SaveBackupSchema = z.object({
  enabled: z.boolean(),
  selectedIntervals: z.array(z.string()).default([]),
  selectedRemoteNames: z.array(z.string()).default([]),
  remotePath: z.string(),
});

const CreateRemoteSchema = z.object({
  remoteName: z.string().min(2).max(64),
  provider: z.string().min(2).max(64),
  options: z.record(z.string(), z.string()).optional().default({}),
  forceRestart: z.boolean().optional().default(false),
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
});

const ReLoginRemoteSchema = z.object({
  remoteName: z.string().min(1),
  forceRestart: z.boolean().optional().default(false),
});

async function getDashboardData(): Promise<BackupDashboardData> {
  const overview = await getBackupOverview();

  return {
    ...overview,
    intervalOptions: [...BACKUP_INTERVAL_OPTIONS],
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
      selectedIntervals: parsed.data.selectedIntervals,
      selectedRemoteNames: parsed.data.selectedRemoteNames,
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
    console.error("Error importing backup from remote:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to import backup from remote",
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
    console.error("Error importing backup from local file:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to import backup from local file",
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
    await deleteBackupRemote(remoteName);

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
