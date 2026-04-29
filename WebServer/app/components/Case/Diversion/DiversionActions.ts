"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import {
  type ActionResult,
  type CivilCaseData,
  type CriminalCaseData,
  type Prisma,
  type RecievingLog,
  type SheriffCaseData,
  type SpecialProceedingData,
} from "@rtc-database/shared";

export type DiversionView =
  | "criminal"
  | "civil"
  | "receiving"
  | "sheriff"
  | "proceedings";

export type DiversionDashboardData = {
  criminal: CriminalCaseData[];
  civil: CivilCaseData[];
  receiving: RecievingLog[];
  sheriff: SheriffCaseData[];
  proceedings: SpecialProceedingData[];
};

const emptyDashboardData = (): DiversionDashboardData => ({
  criminal: [],
  civil: [],
  receiving: [],
  sheriff: [],
  proceedings: [],
});

type DiversionPayloadRow = {
  sourceRecordId: number;
  payload: unknown;
};

const coerceJsonValue = (value: unknown): Prisma.JsonValue | null => {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Prisma.JsonValue;
    } catch {
      return value;
    }
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    typeof value === "object"
  ) {
    return value as Prisma.JsonValue;
  }

  return null;
};

const isJsonObject = (
  value: Prisma.JsonValue,
): value is Record<string, Prisma.JsonValue> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const withSourceId = <T extends { id?: unknown }>(
  rawPayload: unknown,
  sourceRecordId: number,
) => {
  const payload = coerceJsonValue(rawPayload);
  if (!isJsonObject(payload)) {
    return null;
  }

  return {
    ...payload,
    id:
      typeof payload.id === "number" && Number.isFinite(payload.id)
        ? payload.id
        : sourceRecordId,
  } as T;
};

export async function getDiversionDashboardData(): Promise<
  ActionResult<DiversionDashboardData>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const grouped = emptyDashboardData();
    const [
      criminalRecords,
      civilRecords,
      receivingRecords,
      sheriffRecords,
      proceedingRecords,
    ] = await Promise.all([
      prisma.criminalTransmittal.findMany({
        select: { sourceRecordId: true, payload: true },
        orderBy: { transmittedAt: "desc" },
      }),
      prisma.civilTransmittal.findMany({
        select: { sourceRecordId: true, payload: true },
        orderBy: { transmittedAt: "desc" },
      }),
      prisma.recievingLogTransmittal.findMany({
        select: { sourceRecordId: true, payload: true },
        orderBy: { transmittedAt: "desc" },
      }),
      prisma.sheriffTransmittal.findMany({
        select: { sourceRecordId: true, payload: true },
        orderBy: { transmittedAt: "desc" },
      }),
      prisma.specialProceedingTransmittal.findMany({
        select: { sourceRecordId: true, payload: true },
        orderBy: { transmittedAt: "desc" },
      }),
    ]);

    const pushRecords = <T extends { id?: unknown }>(
      records: DiversionPayloadRow[],
      target: T[],
    ) => {
      for (const record of records) {
        const item = withSourceId<T>(record.payload, record.sourceRecordId);
        if (item) target.push(item);
      }
    };

    pushRecords<CriminalCaseData>(criminalRecords, grouped.criminal);
    pushRecords<CivilCaseData>(civilRecords, grouped.civil);
    pushRecords<RecievingLog>(receivingRecords, grouped.receiving);
    pushRecords<SheriffCaseData>(sheriffRecords, grouped.sheriff);
    pushRecords<SpecialProceedingData>(proceedingRecords, grouped.proceedings);

    return {
      success: true,
      result: grouped,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("no such table")
    ) {
      return {
        success: true,
        result: emptyDashboardData(),
      };
    }

    console.error("Error fetching diversion dashboard data:", error);
    return { success: false, error: "Failed to fetch diversion records" };
  }
}
