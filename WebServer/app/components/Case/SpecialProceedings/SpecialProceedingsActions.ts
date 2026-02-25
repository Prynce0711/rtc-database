"use server";

import { LogAction, SpecialProceeding } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../../ActionResult";
import { createLog } from "../../ActivityLogs/LogActions";
import { SpecialProceedingSchema } from "./schema";

export async function getSpecialProceedings(): Promise<
  ActionResult<SpecialProceeding[]>
> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const specialProceedings = await prisma.specialProceeding.findMany({
      orderBy: { date: "desc" },
    });

    return {
      success: true,
      result: specialProceedings,
    };
  } catch (error) {
    console.error("Error fetching special proceedings:", error);
    return { success: false, error: "Error fetching special proceedings" };
  }
}

export async function createSpecialProceeding(
  data: Record<string, unknown>,
): Promise<ActionResult<SpecialProceeding>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const specialProceedingData = SpecialProceedingSchema.safeParse(data);
    if (!specialProceedingData.success) {
      throw new Error(
        `Invalid special proceeding data: ${specialProceedingData.error.message}`,
      );
    }

    const newSpecialProceeding = await prisma.specialProceeding.create({
      data: specialProceedingData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newSpecialProceeding.id,
      },
    });

    return { success: true, result: newSpecialProceeding };
  } catch (error) {
    console.error("Error creating special proceeding:", error);
    return { success: false, error: "Error creating special proceeding" };
  }
}

export async function updateSpecialProceeding(
  specialProceedingId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<SpecialProceeding>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const specialProceedingData = SpecialProceedingSchema.safeParse(data);
    if (!specialProceedingData.success) {
      throw new Error(
        `Invalid special proceeding data: ${specialProceedingData.error.message}`,
      );
    }

    const originalSpecialProceeding = await prisma.specialProceeding.findUnique(
      {
        where: { id: specialProceedingId },
      },
    );

    if (!originalSpecialProceeding) {
      throw new Error("Special proceeding not found");
    }

    const updatedSpecialProceeding = await prisma.specialProceeding.update({
      where: { id: specialProceedingId },
      data: specialProceedingData.data,
    });

    if (!updatedSpecialProceeding) {
      throw new Error("Failed to update special proceeding");
    }

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: originalSpecialProceeding,
        to: updatedSpecialProceeding,
      },
    });

    return { success: true, result: updatedSpecialProceeding };
  } catch (error) {
    console.error("Error updating special proceeding:", error);
    return { success: false, error: "Error updating special proceeding" };
  }
}

export async function deleteSpecialProceeding(
  specialProceedingId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.specialProceeding.delete({
      where: { id: specialProceedingId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: specialProceedingId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting special proceeding:", error);
    return { success: false, error: "Error deleting special proceeding" };
  }
}

export async function getSpecialProceedingById(
  id: number,
): Promise<ActionResult<SpecialProceeding>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await prisma.specialProceeding.findUnique({
      where: { id },
    });

    if (!result) {
      return { success: false, error: "Special proceeding not found" };
    }

    return { success: true, result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch special proceeding" };
  }
}

export async function getSpecialProceedingByCaseNumber(
  caseNumber: string,
): Promise<ActionResult<SpecialProceeding>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await prisma.specialProceeding.findUnique({
      where: { caseNumber },
    });

    if (!result) {
      return { success: false, error: "Special proceeding not found" };
    }

    return { success: true, result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch special proceeding" };
  }
}
