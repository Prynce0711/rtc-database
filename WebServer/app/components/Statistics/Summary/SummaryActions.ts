"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { prettifyError } from "zod";
import ActionResult from "../../ActionResult";
import { SummaryRow, SummaryRowArraySchema } from "./Schema";
import { computeSummaryTotal } from "./SummaryImportUtils";

const toNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

const sanitizeSummaryRow = (row: SummaryRow): SummaryRow => ({
  ...row,
  branch: row.branch.trim(),
  civilFamily: toNonNegativeInt(row.civilFamily),
  civilOrdinary: toNonNegativeInt(row.civilOrdinary),
  civilReceivedViaReraffled: toNonNegativeInt(row.civilReceivedViaReraffled),
  civilUnloaded: toNonNegativeInt(row.civilUnloaded),
  lrcPetition: toNonNegativeInt(row.lrcPetition),
  lrcSpProc: toNonNegativeInt(row.lrcSpProc),
  lrcReceivedViaReraffled: toNonNegativeInt(row.lrcReceivedViaReraffled),
  lrcUnloaded: toNonNegativeInt(row.lrcUnloaded),
  criminalFamily: toNonNegativeInt(row.criminalFamily),
  criminalDrugs: toNonNegativeInt(row.criminalDrugs),
  criminalOrdinary: toNonNegativeInt(row.criminalOrdinary),
  criminalReceivedViaReraffled: toNonNegativeInt(
    row.criminalReceivedViaReraffled,
  ),
  criminalUnloaded: toNonNegativeInt(row.criminalUnloaded),
  total: toNonNegativeInt(row.total),
});

const toDate = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
};

const toISODate = (value: Date): string => value.toISOString().slice(0, 10);

const toMonthRange = (year: number, month: string) => {
  const monthIndex = Number(month) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return { start, end };
};

export async function getSummaryStatistics(
  month?: string,
  year?: number,
  courtType?: string,
): Promise<ActionResult<SummaryRow[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const where: {
      courtType?: string;
      reportYear?: number;
      raffleDate?: { gte: Date; lt: Date };
    } = {};

    if (courtType) {
      where.courtType = courtType;
    }

    if (typeof year === "number" && Number.isFinite(year)) {
      where.reportYear = year;

      if (month && /^\d{2}$/.test(month)) {
        const { start, end } = toMonthRange(year, month);
        where.raffleDate = { gte: start, lt: end };
      }
    }

    const rows = await prisma.summaryStatistic.findMany({
      where,
      orderBy: [
        { reportYear: "desc" },
        { courtType: "asc" },
        { raffleDate: "asc" },
        { id: "asc" },
      ],
    });

    return {
      success: true,
      result: rows.map((row) => ({
        id: row.id,
        courtType: row.courtType,
        reportYear: row.reportYear,
        raffleDate: toISODate(row.raffleDate),
        branch: row.branch,
        civilFamily: row.civilFamily,
        civilOrdinary: row.civilOrdinary,
        civilReceivedViaReraffled: row.civilReceivedViaReraffled,
        civilUnloaded: row.civilUnloaded,
        lrcPetition: row.lrcPetition,
        lrcSpProc: row.lrcSpProc,
        lrcReceivedViaReraffled: row.lrcReceivedViaReraffled,
        lrcUnloaded: row.lrcUnloaded,
        criminalFamily: row.criminalFamily,
        criminalDrugs: row.criminalDrugs,
        criminalOrdinary: row.criminalOrdinary,
        criminalReceivedViaReraffled: row.criminalReceivedViaReraffled,
        criminalUnloaded: row.criminalUnloaded,
        total: row.total,
      })),
    };
  } catch (error) {
    console.error("Error fetching summary statistics:", error);
    return { success: false, error: "Failed to fetch summary statistics" };
  }
}

export async function upsertSummaryStatistics(
  rows: SummaryRow[],
): Promise<ActionResult<{ upserted: number }>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const sanitizedRows = rows.map(sanitizeSummaryRow);
    const validation = SummaryRowArraySchema.safeParse(sanitizedRows);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    let upserted = 0;

    for (const row of validation.data) {
      const raffleDate = toDate(row.raffleDate);
      const computedTotal = computeSummaryTotal(row);
      const total = row.total || computedTotal;

      await prisma.summaryStatistic.upsert({
        where: {
          courtType_branch_raffleDate: {
            courtType: row.courtType,
            branch: row.branch,
            raffleDate,
          },
        },
        update: {
          reportYear: row.reportYear,
          civilFamily: row.civilFamily,
          civilOrdinary: row.civilOrdinary,
          civilReceivedViaReraffled: row.civilReceivedViaReraffled,
          civilUnloaded: row.civilUnloaded,
          lrcPetition: row.lrcPetition,
          lrcSpProc: row.lrcSpProc,
          lrcReceivedViaReraffled: row.lrcReceivedViaReraffled,
          lrcUnloaded: row.lrcUnloaded,
          criminalFamily: row.criminalFamily,
          criminalDrugs: row.criminalDrugs,
          criminalOrdinary: row.criminalOrdinary,
          criminalReceivedViaReraffled: row.criminalReceivedViaReraffled,
          criminalUnloaded: row.criminalUnloaded,
          total,
        },
        create: {
          courtType: row.courtType,
          reportYear: row.reportYear,
          branch: row.branch,
          raffleDate,
          civilFamily: row.civilFamily,
          civilOrdinary: row.civilOrdinary,
          civilReceivedViaReraffled: row.civilReceivedViaReraffled,
          civilUnloaded: row.civilUnloaded,
          lrcPetition: row.lrcPetition,
          lrcSpProc: row.lrcSpProc,
          lrcReceivedViaReraffled: row.lrcReceivedViaReraffled,
          lrcUnloaded: row.lrcUnloaded,
          criminalFamily: row.criminalFamily,
          criminalDrugs: row.criminalDrugs,
          criminalOrdinary: row.criminalOrdinary,
          criminalReceivedViaReraffled: row.criminalReceivedViaReraffled,
          criminalUnloaded: row.criminalUnloaded,
          total,
        },
      });

      upserted += 1;
    }

    return { success: true, result: { upserted } };
  } catch (error) {
    console.error("Error saving summary statistics:", error);
    return { success: false, error: "Failed to save summary statistics" };
  }
}

export async function deleteSummaryStatistic(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    await prisma.summaryStatistic.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting summary statistic:", error);
    return { success: false, error: "Failed to delete summary statistic" };
  }
}
