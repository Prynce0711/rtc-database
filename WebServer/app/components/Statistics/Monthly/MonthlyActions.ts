"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { ActionResult } from "@rtc-database/shared";
import { prettifyError, z } from "zod";
import { MonthlyRow, MonthlyRowSchema } from "./Schema";

// ─── Get ────────────────────────────────────────────────────────────────────

export async function getMonthlyStatistics(
  month?: string,
): Promise<ActionResult<MonthlyRow[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const orderBy = month
      ? [{ id: "asc" as const }]
      : [{ month: "desc" as const }, { id: "asc" as const }];

    const rows = await prisma.monthlyStatistics.findMany({
      where: month ? { month } : undefined,
      orderBy,
    });

    return {
      success: true,
      result: rows.map((r) => ({
        id: r.id,
        month: r.month,
        category: r.category,
        branch: r.branch,
        criminal: r.criminal,
        civil: r.civil,
        total: r.total,
      })),
    };
  } catch (error) {
    console.error("Error fetching monthly statistics:", error);
    return { success: false, error: "Failed to fetch monthly statistics" };
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createMonthlyStatistic(
  data: MonthlyRow,
): Promise<ActionResult<MonthlyRow>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = MonthlyRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.monthlyStatistics.create({
      data: {
        month: validation.data.month,
        category: validation.data.category,
        branch: validation.data.branch,
        criminal: validation.data.criminal,
        civil: validation.data.civil,
        total: validation.data.total,
      },
    });

    return { success: true, result: record };
  } catch (error) {
    console.error("Error creating monthly statistic:", error);
    return { success: false, error: "Failed to create monthly statistic" };
  }
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateMonthlyStatistic(
  id: number,
  data: MonthlyRow,
): Promise<ActionResult<MonthlyRow>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = MonthlyRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.monthlyStatistics.update({
      where: { id },
      data: {
        month: validation.data.month,
        category: validation.data.category,
        branch: validation.data.branch,
        criminal: validation.data.criminal,
        civil: validation.data.civil,
        total: validation.data.total,
      },
    });

    return { success: true, result: record };
  } catch (error) {
    console.error("Error updating monthly statistic:", error);
    return { success: false, error: "Failed to update monthly statistic" };
  }
}

// ─── Delete (single row by id) ───────────────────────────────────────────────

export async function deleteMonthlyStatistic(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    await prisma.monthlyStatistics.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting monthly statistic:", error);
    return { success: false, error: "Failed to delete monthly statistic" };
  }
}

// ─── Upsert (bulk, used by import / AddReportPage) ──────────────────────────

export async function upsertMonthlyStatistics(
  rows: MonthlyRow[],
): Promise<ActionResult<{ upserted: number }>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = z.array(MonthlyRowSchema).safeParse(rows);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const results: MonthlyRow[] = [];

    // Run upserts sequentially so new records keep the same order as the
    // submitted rows from AddReport preview/import.
    for (const r of validation.data) {
      const saved = await prisma.monthlyStatistics.upsert({
        where: {
          month_category_branch: {
            month: r.month,
            category: r.category,
            branch: r.branch,
          },
        },
        update: { criminal: r.criminal, civil: r.civil, total: r.total },
        create: {
          month: r.month,
          category: r.category,
          branch: r.branch,
          criminal: r.criminal,
          civil: r.civil,
          total: r.total,
        },
      });

      results.push({
        id: saved.id,
        month: saved.month,
        category: saved.category,
        branch: saved.branch,
        criminal: saved.criminal,
        civil: saved.civil,
        total: saved.total,
      });
    }

    return { success: true, result: { upserted: results.length } };
  } catch (error) {
    console.error("Error upserting monthly statistics:", error);
    return { success: false, error: "Failed to save monthly statistics" };
  }
}

// ─── Clear (delete by month or all) ─────────────────────────────────────────

export async function clearMonthlyStatistics(
  month?: string,
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const { count } = await prisma.monthlyStatistics.deleteMany({
      where: month ? { month } : undefined,
    });

    return { success: true, result: { deleted: count } };
  } catch (error) {
    console.error("Error clearing monthly statistics:", error);
    return { success: false, error: "Failed to clear monthly statistics" };
  }
}
