"use server";

import { Case, LogAction } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../ActionResult";
import { createLog } from "../ActivityLogs/LogActions";
import { CaseSchema } from "./schema";

export async function getCases(): Promise<ActionResult<Case[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const cases = await prisma.case.findMany({
      orderBy: { dateFiled: "desc" },
    });

    return {
      success: true,
      result: cases.map((c) => ({
        ...c,
        dateFiled: c.dateFiled,
        raffleDate: c.raffleDate ? c.raffleDate : null,
      })),
    };
  } catch (error) {
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}

export async function createCase(
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const caseData = CaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const newCase = await prisma.case.create({
      data: caseData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newCase.id,
      },
    });

    return { success: true, result: newCase };
  } catch (error) {
    console.error("Error creating case:", error);
    return { success: false, error: "Error creating case" };
  }
}

export async function updateCase(
  caseId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const caseData = CaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!originalCase) {
      throw new Error("Case not found");
    }
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: caseData.data,
    });
    if (!updatedCase) {
      throw new Error("Failed to update case");
    }

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: originalCase,
        to: updatedCase,
      },
    });

    return { success: true, result: updatedCase };
  } catch (error) {
    console.error("Error updating case:", error);
    return { success: false, error: "Error updating case" };
  }
}

export async function deleteCase(caseId: number): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.case.delete({
      where: { id: caseId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: caseId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting case:", error);
    return { success: false, error: "Error deleting case" };
  }
}
export async function getCaseById(id: number) {
  try {
    const result = await prisma.case.findUnique({
      where: { id },
    });

    if (!result) {
      return { success: false, error: "Case not found" };
    }

    return { success: true, result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch case" };
  }
}
