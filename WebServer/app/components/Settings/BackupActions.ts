"use server";

import { validateSession } from "@/app/lib/authActions";
import {
  BACKUP_INTERVAL_OPTIONS,
  cancelRunningBackup,
  createBackupRemote,
  deleteBackupRemote,
  getBackupOverview,
  runBackupNow,
  startBackupScheduler,
  updateBackupConfig,
  type BackupConfig,
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
  intervalOptions: number[];
  logs: BackupLogEntry[];
  accountSetupInProgress: boolean;
}

const SaveBackupSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.coerce.number().int(),
  nextRunAt: z.string().nullable(),
  remoteName: z.string(),
  remotePath: z.string(),
});

const CreateRemoteSchema = z.object({
  remoteName: z.string().min(2).max(64),
  provider: z.string().min(2).max(64),
  options: z.record(z.string(), z.string()).optional().default({}),
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
      intervalMinutes: parsed.data.intervalMinutes,
      nextRunAt: parsed.data.nextRunAt,
      remoteName: parsed.data.remoteName,
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
