"use server";

import {
  ActionResult,
  deviceID,
  SyncState,
  UpdateSyncStatePayload,
  type DeviceID,
} from "@rtc-database/shared";
import { prettifyError } from "zod/v4/core";
import { validateSession } from "../authActions";
import { prisma } from "../prisma";

export async function getSyncStatesForUser(): Promise<
  ActionResult<SyncState[]>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const syncStates = await prisma.syncState.findMany({
      where: {
        userId: sessionResult.result.id,
      },
    });

    return {
      success: true,
      result: syncStates,
    };
  } catch (error) {
    console.error("Error resetting sync state:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to reset sync state.",
    };
  }
}

// Only one user can use device id so we just do upsert instead of create and update
export async function upsertSyncStateForDevice(
  deviceId: DeviceID,
): Promise<ActionResult<SyncState>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validation = deviceID.safeParse(deviceId);
    if (!validation.success) {
      return {
        success: false,
        error: "Invalid device ID: " + prettifyError(validation.error),
      };
    }

    const validatedDeviceId = validation.data;

    const newSyncState = await prisma.syncState.upsert({
      where: {
        deviceId: validatedDeviceId,
      },
      create: {
        deviceId: validatedDeviceId,
        userId: sessionResult.result.id,
      },
      update: {
        deviceId: validatedDeviceId,
        userId: sessionResult.result.id,
      },
    });

    return {
      success: true,
      result: newSyncState,
    };
  } catch (error) {
    console.error("Error upserting sync state:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to upsert sync state.",
    };
  }
}

export async function updateLastSyncedAtForDevice(
  payload: UpdateSyncStatePayload,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validation = UpdateSyncStatePayload.safeParse(payload);
    if (!validation.success) {
      return {
        success: false,
        error: "Invalid payload: " + prettifyError(validation.error),
      };
    }

    const device = await prisma.syncState.findFirst({
      where: {
        deviceId: validation.data.deviceId,
        userId: sessionResult.result.id,
      },
    });

    if (!device) {
      return {
        success: false,
        error: "Sync state for device not found.",
      };
    }

    await prisma.syncState.updateMany({
      where: {
        deviceId: validation.data.deviceId,
        userId: sessionResult.result.id,
      },
      data: {
        lastSyncedAt: validation.data.lastSyncedAt,
      },
    });

    return {
      success: true,
      result: undefined,
    };
  } catch (error) {
    console.error("Error updating last synced at:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to update last synced at.",
    };
  }
}

export async function resetSyncStateForAllDevices(): Promise<
  ActionResult<void>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.syncState.deleteMany({
      where: {
        userId: sessionResult.result.id,
      },
    });

    return {
      success: true,
      result: undefined,
    };
  } catch (error) {
    console.error("Error resetting sync state:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to reset sync state.",
    };
  }
}

export async function resetSyncStateForDevice(
  deviceId: DeviceID,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validation = deviceID.safeParse(deviceId);
    if (!validation.success) {
      return {
        success: false,
        error: "Invalid device ID: " + prettifyError(validation.error),
      };
    }

    const device = await prisma.syncState.findFirst({
      where: {
        deviceId,
        userId: sessionResult.result.id,
      },
    });

    if (!device) {
      return {
        success: false,
        error: "Sync state for device not found.",
      };
    }

    await prisma.syncState.deleteMany({
      where: {
        deviceId,
        userId: sessionResult.result.id,
      },
    });

    return {
      success: true,
      result: undefined,
    };
  } catch (error) {
    console.error("Error resetting sync state:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to reset sync state.",
    };
  }
}
