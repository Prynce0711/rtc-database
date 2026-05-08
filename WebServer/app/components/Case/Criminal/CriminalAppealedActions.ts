"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import type {
  ActionResult,
  CriminalAppealedCaseData,
  CriminalAppealedCaseInput,
} from "@rtc-database/shared";
import type { Prisma } from "@rtc-database/shared/prisma/client";

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

const serializeAppealedCase = (record: {
  id: number;
  date: Date | null;
  referenceToBranch: string | null;
  mtcCaseNo: string | null;
  raffleDate: Date | null;
  fromMtcRtcJudge: string | null;
  orderDate: Date | null;
  branch: string | null;
  caseNo: string | null;
  dateFiled: Date | null;
  accused: string | null;
  charge: string | null;
  ao: string | null;
  appealedId: string | null;
  name1: string | null;
  address1: string | null;
  name2: string | null;
  address2: string | null;
  name3: string | null;
  address3: string | null;
  name4: string | null;
  address4: string | null;
  name5: string | null;
  address5: string | null;
  name6: string | null;
  address6: string | null;
  name7: string | null;
  address7: string | null;
  name8: string | null;
  address8: string | null;
  name9: string | null;
  address9: string | null;
  name10: string | null;
  address10: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}): CriminalAppealedCaseData => ({
  id: record.id,
  date: toIso(record.date),
  referenceToBranch: record.referenceToBranch,
  mtcCaseNo: record.mtcCaseNo,
  raffleDate: toIso(record.raffleDate),
  fromMtcRtcJudge: record.fromMtcRtcJudge,
  orderDate: toIso(record.orderDate),
  branch: record.branch,
  caseNo: record.caseNo,
  dateFiled: toIso(record.dateFiled),
  accused: record.accused,
  charge: record.charge,
  ao: record.ao,
  appealedId: record.appealedId,
  name1: record.name1,
  address1: record.address1,
  name2: record.name2,
  address2: record.address2,
  name3: record.name3,
  address3: record.address3,
  name4: record.name4,
  address4: record.address4,
  name5: record.name5,
  address5: record.address5,
  name6: record.name6,
  address6: record.address6,
  name7: record.name7,
  address7: record.address7,
  name8: record.name8,
  address8: record.address8,
  name9: record.name9,
  address9: record.address9,
  name10: record.name10,
  address10: record.address10,
  createdAt: toIso(record.createdAt) ?? "",
  updatedAt: toIso(record.updatedAt),
});

const toPayload = (
  data: Partial<CriminalAppealedCaseInput>,
): Prisma.CriminalAppealedCaseCreateInput => ({
  date: parseDate(data.date),
  referenceToBranch: textOrNull(data.referenceToBranch),
  mtcCaseNo: textOrNull(data.mtcCaseNo),
  raffleDate: parseDate(data.raffleDate),
  fromMtcRtcJudge: textOrNull(data.fromMtcRtcJudge),
  orderDate: parseDate(data.orderDate),
  branch: textOrNull(data.branch),
  caseNo: textOrNull(data.caseNo),
  dateFiled: parseDate(data.dateFiled),
  accused: textOrNull(data.accused),
  charge: textOrNull(data.charge),
  ao: textOrNull(data.ao),
  appealedId: textOrNull(data.appealedId),
  name1: textOrNull(data.name1),
  address1: textOrNull(data.address1),
  name2: textOrNull(data.name2),
  address2: textOrNull(data.address2),
  name3: textOrNull(data.name3),
  address3: textOrNull(data.address3),
  name4: textOrNull(data.name4),
  address4: textOrNull(data.address4),
  name5: textOrNull(data.name5),
  address5: textOrNull(data.address5),
  name6: textOrNull(data.name6),
  address6: textOrNull(data.address6),
  name7: textOrNull(data.name7),
  address7: textOrNull(data.address7),
  name8: textOrNull(data.name8),
  address8: textOrNull(data.address8),
  name9: textOrNull(data.name9),
  address9: textOrNull(data.address9),
  name10: textOrNull(data.name10),
  address10: textOrNull(data.address10),
});

export async function getCriminalAppealedCases(): Promise<
  ActionResult<CriminalAppealedCaseData[]>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) return sessionResult;

    const records = await prisma.criminalAppealedCase.findMany({
      orderBy: [{ dateFiled: "desc" }, { id: "desc" }],
    });

    return { success: true, result: records.map(serializeAppealedCase) };
  } catch (error) {
    if (isMissingTableError(error)) return { success: true, result: [] };
    console.error("Error fetching appealed criminal cases:", error);
    return { success: false, error: "Failed to fetch appealed criminal cases" };
  }
}

export async function getCriminalAppealedCaseById(
  id: string | number,
): Promise<ActionResult<CriminalAppealedCaseData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.criminalAppealedCase.findUnique({
      where: { id: Number(id) },
    });

    if (!record) return { success: false, error: "Record not found" };
    return { success: true, result: serializeAppealedCase(record) };
  } catch (error) {
    console.error("Error fetching appealed criminal case:", error);
    return { success: false, error: "Failed to fetch appealed criminal case" };
  }
}

export async function createCriminalAppealedCase(
  data: Partial<CriminalAppealedCaseInput>,
): Promise<ActionResult<CriminalAppealedCaseData>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.criminalAppealedCase.create({
      data: toPayload(data),
    });

    return { success: true, result: serializeAppealedCase(record) };
  } catch (error) {
    console.error("Error creating appealed criminal case:", error);
    return { success: false, error: "Failed to create appealed criminal case" };
  }
}

export async function createCriminalAppealedCases(
  rows: Partial<CriminalAppealedCaseInput>[],
): Promise<ActionResult<CriminalAppealedCaseData[]>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const records = await prisma.$transaction(
      rows.map((data) =>
        prisma.criminalAppealedCase.create({
          data: toPayload(data),
        }),
      ),
    );

    return { success: true, result: records.map(serializeAppealedCase) };
  } catch (error) {
    console.error("Error creating appealed criminal cases:", error);
    return { success: false, error: "Failed to create appealed criminal cases" };
  }
}

export async function updateCriminalAppealedCase(
  id: number,
  data: Partial<CriminalAppealedCaseInput>,
): Promise<ActionResult<CriminalAppealedCaseData>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    const record = await prisma.criminalAppealedCase.update({
      where: { id },
      data: toPayload(data),
    });

    return { success: true, result: serializeAppealedCase(record) };
  } catch (error) {
    console.error("Error updating appealed criminal case:", error);
    return { success: false, error: "Failed to update appealed criminal case" };
  }
}

export async function deleteCriminalAppealedCase(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.CRIMINAL, Roles.ADMIN]);
    if (!sessionResult.success) return sessionResult;

    await prisma.criminalAppealedCase.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting appealed criminal case:", error);
    return { success: false, error: "Failed to delete appealed criminal case" };
  }
}
