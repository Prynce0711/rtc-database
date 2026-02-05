"use server";

import { Case } from "@/app/generated/prisma/client";
import { Role, validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import ActionResult from "../ActionResult";
import { CaseSchema } from "./schema";

export async function getCases(): Promise<ActionResult<Case[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const cases = await prisma.case.findMany();
    return { success: true, result: cases };
  } catch (error) {
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}

export async function createCase(
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession(Role.ADMIN);
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
    const sessionResult = await validateSession(Role.ADMIN);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const caseData = CaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: caseData.data,
    });
    return { success: true, result: updatedCase };
  } catch (error) {
    console.error("Error updating case:", error);
    return { success: false, error: "Error updating case" };
  }
}

export async function deleteCase(
  caseNumber: string,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession(Role.ADMIN);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.case.delete({
      where: { caseNumber },
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting case:", error);
    return { success: false, error: "Error deleting case" };
  }
}
