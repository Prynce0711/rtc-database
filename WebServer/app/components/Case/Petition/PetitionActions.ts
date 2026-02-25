"use server";

import { LogAction, Petition } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../../ActionResult";
import { createLog } from "../../ActivityLogs/LogActions";
import { PetitionSchema } from "./schema";

export async function getPetitions(): Promise<ActionResult<Petition[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const petitions = await prisma.petition.findMany({
      orderBy: { date: "desc" },
    });

    return {
      success: true,
      result: petitions,
    };
  } catch (error) {
    console.error("Error fetching petitions:", error);
    return { success: false, error: "Error fetching petitions" };
  }
}

export async function createPetition(
  data: Record<string, unknown>,
): Promise<ActionResult<Petition>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const petitionData = PetitionSchema.safeParse(data);
    if (!petitionData.success) {
      throw new Error(`Invalid petition data: ${petitionData.error.message}`);
    }

    const newPetition = await prisma.petition.create({
      data: petitionData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newPetition.id,
      },
    });

    return { success: true, result: newPetition };
  } catch (error) {
    console.error("Error creating petition:", error);
    return { success: false, error: "Error creating petition" };
  }
}

export async function updatePetition(
  petitionId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Petition>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const petitionData = PetitionSchema.safeParse(data);
    if (!petitionData.success) {
      throw new Error(`Invalid petition data: ${petitionData.error.message}`);
    }

    const originalPetition = await prisma.petition.findUnique({
      where: { id: petitionId },
    });

    if (!originalPetition) {
      throw new Error("Petition not found");
    }

    const updatedPetition = await prisma.petition.update({
      where: { id: petitionId },
      data: petitionData.data,
    });

    if (!updatedPetition) {
      throw new Error("Failed to update petition");
    }

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: originalPetition,
        to: updatedPetition,
      },
    });

    return { success: true, result: updatedPetition };
  } catch (error) {
    console.error("Error updating petition:", error);
    return { success: false, error: "Error updating petition" };
  }
}

export async function deletePetition(
  petitionId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.petition.delete({
      where: { id: petitionId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: petitionId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting petition:", error);
    return { success: false, error: "Error deleting petition" };
  }
}

export async function getPetitionById(
  id: number,
): Promise<ActionResult<Petition>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await prisma.petition.findUnique({
      where: { id },
    });

    if (!result) {
      return { success: false, error: "Petition not found" };
    }

    return { success: true, result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch petition" };
  }
}

export async function getPetitionByCaseNumber(
  caseNumber: string,
): Promise<ActionResult<Petition>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await prisma.petition.findUnique({
      where: { caseNumber },
    });

    if (!result) {
      return { success: false, error: "Petition not found" };
    }

    return { success: true, result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch petition" };
  }
}
