"use server";

import {
  defaultSystemSettings,
  SystemSettingsSchema,
  type SystemSettingsSchema as SystemSettingsData,
} from "@/app/components/Settings/schema";
import { prisma } from "@/app/lib/prisma";

const normalizeSettingsRecord = (
  data: Partial<SystemSettingsData>,
): SystemSettingsData => ({
  ...defaultSystemSettings,
  ...data,
});

export async function loadSystemSettings(): Promise<SystemSettingsData> {
  const settings = await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const parsed = SystemSettingsSchema.safeParse(
    normalizeSettingsRecord(settings),
  );
  if (!parsed.success) {
    throw new Error("Invalid system settings data");
  }

  return parsed.data;
}
