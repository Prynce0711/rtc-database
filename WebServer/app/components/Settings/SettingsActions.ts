"use server";

import { validateSession } from "@/app/lib/authActions";
import { syncNotarialRemote } from "@/app/lib/backup/backupScheduler";
import { getInfo, type GarageInfo } from "@/app/lib/garage";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../ActionResult";
import {
  defaultSystemSettings,
  SystemSettingsSchema,
  type SystemSettingsSchema as SystemSettingsData,
} from "./schema";

const normalizeSettingsRecord = (
  data: Partial<SystemSettingsData>,
): SystemSettingsData => ({
  ...defaultSystemSettings,
  ...data,
});

export async function getSystemSettings(): Promise<
  ActionResult<SystemSettingsData>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
      },
    });

    const parsed = SystemSettingsSchema.safeParse(
      normalizeSettingsRecord(settings),
    );
    if (!parsed.success) {
      return { success: false, error: "Invalid system settings data" };
    }

    return { success: true, result: parsed.data };
  } catch (error) {
    console.error("Error fetching system settings:", error);
    return { success: false, error: "Failed to fetch system settings" };
  }
}

export async function updateSystemSettings(
  data: Record<string, unknown>,
): Promise<ActionResult<SystemSettingsData>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const partialSchema = SystemSettingsSchema.partial();
    const parsedPatch = partialSchema.safeParse(data);
    if (!parsedPatch.success) {
      return { success: false, error: "Invalid system settings payload" };
    }

    const existing = await prisma.systemSettings.findUnique({
      where: { id: 1 },
    });
    const mergedCandidate = normalizeSettingsRecord({
      ...(existing ?? {}),
      ...parsedPatch.data,
    });

    const parsedFull = SystemSettingsSchema.safeParse(mergedCandidate);
    if (!parsedFull.success) {
      return {
        success: false,
        error: "Invalid merged system settings payload",
      };
    }

    const updated = await prisma.systemSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...parsedFull.data,
      },
      update: parsedFull.data,
    });

    const normalized = normalizeSettingsRecord(updated);

    // Keep notarial remote in lockstep with Garage settings.
    await syncNotarialRemote();

    return { success: true, result: normalized };
  } catch (error) {
    console.error("Error updating system settings:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update system settings",
    };
  }
}

export async function getGarageInfo(): Promise<ActionResult<GarageInfo>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    return {
      success: true,
      result: await getInfo(),
    };
  } catch (error) {
    console.error("Error fetching Garage info:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch Garage metrics",
    };
  }
}
