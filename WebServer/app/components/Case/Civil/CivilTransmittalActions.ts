"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import type { ActionResult } from "@rtc-database/shared";
import type { Prisma } from "@rtc-database/shared/prisma/client";
import type {
  CivilCifTransmittalInput,
  CivilCifTransmittalRecordData,
  CivilTransmittalInput,
  CivilTransmittalRecordData,
} from "./CivilTransmittalFields";

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseDate = (value: unknown): Date | null => {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const textOrNull = (value: unknown): string | null => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const isMissingTableError = (error: unknown): boolean =>
  error instanceof Error && error.message.toLowerCase().includes("no such table");

const serializeCif = (record: {
  id: number;
  caseNumber: string | null;
  branchJudge: string | null;
  date: Date | null;
  plaintiffs: string | null;
  defendants: string | null;
  status: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}): CivilCifTransmittalRecordData => ({
  id: record.id,
  caseNumber: record.caseNumber,
  branchJudge: record.branchJudge,
  date: toIso(record.date),
  plaintiffs: record.plaintiffs,
  defendants: record.defendants,
  status: record.status,
  note: record.note,
  createdAt: toIso(record.createdAt) ?? "",
  updatedAt: toIso(record.updatedAt),
});

const serializeTransmittal = (record: {
  id: number;
  caseNumber: string | null;
  transmittedRaffledToBranch: string | null;
  dateReceived: Date | null;
  petitioners: string | null;
  defendants: string | null;
  issuedTransmittedByBranch: string | null;
  toBeRaffledOn: Date | null;
  natureOfTransmittal: string | null;
  orderResolutionDated: Date | null;
  attorney1: string | null;
  officeAddress1: string | null;
  attorney2: string | null;
  officeAddress2: string | null;
  attorney3: string | null;
  officeAddress3: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}): CivilTransmittalRecordData => ({
  id: record.id,
  caseNumber: record.caseNumber,
  transmittedRaffledToBranch: record.transmittedRaffledToBranch,
  dateReceived: toIso(record.dateReceived),
  petitioners: record.petitioners,
  defendants: record.defendants,
  issuedTransmittedByBranch: record.issuedTransmittedByBranch,
  toBeRaffledOn: toIso(record.toBeRaffledOn),
  natureOfTransmittal: record.natureOfTransmittal,
  orderResolutionDated: toIso(record.orderResolutionDated),
  attorney1: record.attorney1,
  officeAddress1: record.officeAddress1,
  attorney2: record.attorney2,
  officeAddress2: record.officeAddress2,
  attorney3: record.attorney3,
  officeAddress3: record.officeAddress3,
  createdAt: toIso(record.createdAt) ?? "",
  updatedAt: toIso(record.updatedAt),
});

const toCifPayload = (
  data: Partial<CivilCifTransmittalInput>,
): Prisma.CivilCourtOfFirstInstanceTransmittalCreateInput => ({
  caseNumber: textOrNull(data.caseNumber),
  branchJudge: textOrNull(data.branchJudge),
  date: parseDate(data.date),
  plaintiffs: textOrNull(data.plaintiffs),
  defendants: textOrNull(data.defendants),
  status: textOrNull(data.status),
  note: textOrNull(data.note),
});

const toTransmittalPayload = (
  data: Partial<CivilTransmittalInput>,
): Prisma.CivilTransmittalRecordCreateInput => ({
  caseNumber: textOrNull(data.caseNumber),
  transmittedRaffledToBranch: textOrNull(data.transmittedRaffledToBranch),
  dateReceived: parseDate(data.dateReceived),
  petitioners: textOrNull(data.petitioners),
  defendants: textOrNull(data.defendants),
  issuedTransmittedByBranch: textOrNull(data.issuedTransmittedByBranch),
  toBeRaffledOn: parseDate(data.toBeRaffledOn),
  natureOfTransmittal: textOrNull(data.natureOfTransmittal),
  orderResolutionDated: parseDate(data.orderResolutionDated),
  attorney1: textOrNull(data.attorney1),
  officeAddress1: textOrNull(data.officeAddress1),
  attorney2: textOrNull(data.attorney2),
  officeAddress2: textOrNull(data.officeAddress2),
  attorney3: textOrNull(data.attorney3),
  officeAddress3: textOrNull(data.officeAddress3),
});

export async function getCivilCifTransmittalRecords(): Promise<
  ActionResult<CivilCifTransmittalRecordData[]>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) return sessionResult;

    const records = await prisma.civilCourtOfFirstInstanceTransmittal.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });

    return { success: true, result: records.map(serializeCif) };
  } catch (error) {
    if (isMissingTableError(error)) return { success: true, result: [] };
    console.error("Error fetching CFI transmittal records:", error);
    return { success: false, error: "Failed to fetch CFI transmittal records" };
  }
}

export async function getCivilCifTransmittalRecordById(
  id: string | number,
): Promise<ActionResult<CivilCifTransmittalRecordData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.civilCourtOfFirstInstanceTransmittal.findUnique({
      where: { id: Number(id) },
    });

    if (!record) return { success: false, error: "Record not found" };
    return { success: true, result: serializeCif(record) };
  } catch (error) {
    console.error("Error fetching CFI transmittal record:", error);
    return { success: false, error: "Failed to fetch CFI transmittal record" };
  }
}

export async function createCivilCifTransmittalRecord(
  data: Partial<CivilCifTransmittalInput>,
): Promise<ActionResult<CivilCifTransmittalRecordData>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.civilCourtOfFirstInstanceTransmittal.create({
      data: toCifPayload(data),
    });

    return { success: true, result: serializeCif(record) };
  } catch (error) {
    console.error("Error creating CFI transmittal record:", error);
    return { success: false, error: "Failed to create CFI transmittal record" };
  }
}

export async function updateCivilCifTransmittalRecord(
  id: number,
  data: Partial<CivilCifTransmittalInput>,
): Promise<ActionResult<CivilCifTransmittalRecordData>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.civilCourtOfFirstInstanceTransmittal.update({
      where: { id },
      data: toCifPayload(data),
    });

    return { success: true, result: serializeCif(record) };
  } catch (error) {
    console.error("Error updating CFI transmittal record:", error);
    return { success: false, error: "Failed to update CFI transmittal record" };
  }
}

export async function deleteCivilCifTransmittalRecord(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    await prisma.civilCourtOfFirstInstanceTransmittal.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting CFI transmittal record:", error);
    return { success: false, error: "Failed to delete CFI transmittal record" };
  }
}

export async function getCivilTransmittalRecords(): Promise<
  ActionResult<CivilTransmittalRecordData[]>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) return sessionResult;

    const records = await prisma.civilTransmittalRecord.findMany({
      orderBy: [{ dateReceived: "desc" }, { id: "desc" }],
    });

    return { success: true, result: records.map(serializeTransmittal) };
  } catch (error) {
    if (isMissingTableError(error)) return { success: true, result: [] };
    console.error("Error fetching civil transmittal records:", error);
    return { success: false, error: "Failed to fetch civil transmittal records" };
  }
}

export async function getCivilTransmittalRecordById(
  id: string | number,
): Promise<ActionResult<CivilTransmittalRecordData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.civilTransmittalRecord.findUnique({
      where: { id: Number(id) },
    });

    if (!record) return { success: false, error: "Record not found" };
    return { success: true, result: serializeTransmittal(record) };
  } catch (error) {
    console.error("Error fetching civil transmittal record:", error);
    return { success: false, error: "Failed to fetch civil transmittal record" };
  }
}

export async function createCivilTransmittalRecord(
  data: Partial<CivilTransmittalInput>,
): Promise<ActionResult<CivilTransmittalRecordData>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.civilTransmittalRecord.create({
      data: toTransmittalPayload(data),
    });

    return { success: true, result: serializeTransmittal(record) };
  } catch (error) {
    console.error("Error creating civil transmittal record:", error);
    return { success: false, error: "Failed to create civil transmittal record" };
  }
}

export async function updateCivilTransmittalRecord(
  id: number,
  data: Partial<CivilTransmittalInput>,
): Promise<ActionResult<CivilTransmittalRecordData>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.civilTransmittalRecord.update({
      where: { id },
      data: toTransmittalPayload(data),
    });

    return { success: true, result: serializeTransmittal(record) };
  } catch (error) {
    console.error("Error updating civil transmittal record:", error);
    return { success: false, error: "Failed to update civil transmittal record" };
  }
}

export async function deleteCivilTransmittalRecord(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    await prisma.civilTransmittalRecord.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting civil transmittal record:", error);
    return { success: false, error: "Failed to delete civil transmittal record" };
  }
}
