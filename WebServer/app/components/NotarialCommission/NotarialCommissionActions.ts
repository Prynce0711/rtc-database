"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import type { NotarialCommission } from "@rtc-database/shared/prisma/browser";
import {
  buildNotarialCommissionKey,
  extractCommissionYears,
  normalizePetitionNumber,
  NotarialCommissionSchema,
} from "./schema";
import type { NotarialCommissionKeyFields } from "./schema";

const NOTARIAL_COMMISSION_ROLES = [Roles.ADMIN, Roles.NOTARIAL] as const;

const normalizeCommissionData = (data: Record<string, unknown>) => {
  const parsedData = NotarialCommissionSchema.safeParse(data);
  if (!parsedData.success) {
    throw new Error(
      `Invalid notarial commission data: ${parsedData.error.message}`,
    );
  }

  const { termStartYear, termEndYear } = parsedData.data;
  const values = {
    petition: normalizePetitionNumber(parsedData.data.petition),
    name: parsedData.data.name,
    termOfCommission: parsedData.data.termOfCommission,
    address: parsedData.data.address,
  };
  const detectedYears = extractCommissionYears(values.termOfCommission);

  return {
    ...values,
    termStartYear: detectedYears.termStartYear ?? termStartYear ?? null,
    termEndYear: detectedYears.termEndYear ?? termEndYear ?? null,
  };
};

export async function doesNotarialCommissionExist(
  records: NotarialCommissionKeyFields[],
): Promise<ActionResult<string[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const normalizedRecords = records
      .map((record) => ({
        petition: normalizePetitionNumber(record.petition),
        name: String(record.name ?? "").trim(),
        termOfCommission: String(record.termOfCommission ?? "").trim(),
        address: String(record.address ?? "").trim(),
      }))
      .filter(
        (record) =>
          record.name.length > 0 &&
          record.termOfCommission.length > 0 &&
          record.address.length > 0,
      );

    if (normalizedRecords.length === 0) {
      return { success: true, result: [] };
    }

    const existingRecords = await prisma.notarialCommission.findMany({
      where: {
        OR: normalizedRecords.map((record) => ({
          petition: record.petition,
          name: record.name,
          termOfCommission: record.termOfCommission,
          address: record.address,
        })),
      },
      select: {
        petition: true,
        name: true,
        termOfCommission: true,
        address: true,
      },
    });

    return {
      success: true,
      result: existingRecords.map(buildNotarialCommissionKey),
    };
  } catch (error) {
    console.error("Error checking notarial commission existence:", error);
    return {
      success: false,
      error: "Error checking notarial commission existence",
    };
  }
}

export async function getNotarialCommissions(): Promise<
  ActionResult<NotarialCommission[]>
> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const records = await prisma.notarialCommission.findMany({
      orderBy: [{ termStartYear: "desc" }, { id: "desc" }],
    });

    return { success: true, result: records };
  } catch (error) {
    console.error("Error fetching notarial commissions:", error);
    return { success: false, error: "Error fetching notarial commissions" };
  }
}

export async function getNotarialCommissionById(
  id: number,
): Promise<ActionResult<NotarialCommission>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const record = await prisma.notarialCommission.findUnique({
      where: { id },
    });

    if (!record) {
      return { success: false, error: "Notarial commission not found" };
    }

    return { success: true, result: record };
  } catch (error) {
    console.error("Error fetching notarial commission by id:", error);
    return { success: false, error: "Error fetching notarial commission" };
  }
}

export async function getNotarialCommissionsByIds(
  ids: Array<number | string>,
): Promise<ActionResult<NotarialCommission[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid record IDs provided" };
    }

    const records = await prisma.notarialCommission.findMany({
      where: { id: { in: validIds } },
    });

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    records.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (records.length !== validIds.length) {
      return { success: false, error: "One or more records were not found" };
    }

    return { success: true, result: records };
  } catch (error) {
    console.error("Error fetching notarial commissions by ids:", error);
    return { success: false, error: "Error fetching notarial commissions" };
  }
}

export async function createNotarialCommission(
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialCommission>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const recordData = normalizeCommissionData(data);
    const record = await prisma.notarialCommission.create({
      data: recordData,
    });

    return { success: true, result: record };
  } catch (error) {
    console.error("Error creating notarial commission:", error);
    return { success: false, error: "Error creating notarial commission" };
  }
}

export async function updateNotarialCommission(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialCommission>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const existing = await prisma.notarialCommission.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, error: "Notarial commission not found" };
    }

    const recordData = normalizeCommissionData(data);
    const record = await prisma.notarialCommission.update({
      where: { id },
      data: recordData,
    });

    return { success: true, result: record };
  } catch (error) {
    console.error("Error updating notarial commission:", error);
    return { success: false, error: "Error updating notarial commission" };
  }
}

export async function deleteNotarialCommission(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const existing = await prisma.notarialCommission.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, error: "Notarial commission not found" };
    }

    await prisma.notarialCommission.delete({ where: { id } });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting notarial commission:", error);
    return { success: false, error: "Error deleting notarial commission" };
  }
}
