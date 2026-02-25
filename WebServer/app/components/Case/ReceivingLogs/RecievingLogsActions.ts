"use server";

import { LogAction, RecievingLog } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../../ActionResult";
import { ReceivingLogSchema } from "./schema";
import { createLog } from "../../ActivityLogs/LogActions";

export async function getRecievingLogs(): Promise<
  ActionResult<RecievingLog[]>
> {
  try {
    const sessionValidation = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const logs = await prisma.recievingLog.findMany({
      orderBy: {
        dateRecieved: "desc",
      },
    });

    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching receiving logs:", error);
    return { success: false, error: "Failed to fetch receiving logs" };
  }
}

export async function createRecievingLog(
  data: Record<string, unknown>,
): Promise<ActionResult<RecievingLog>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const logData = ReceivingLogSchema.safeParse(data);
    if (!logData.success) {
      throw new Error(`Invalid receiving log data: ${logData.error.message}`);
    }

    const newLog = await prisma.recievingLog.create({
      data: logData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newLog.id,
      },
    });

    return { success: true, result: newLog };
  } catch (error) {
    console.error("Error creating receiving log:", error);
    return { success: false, error: "Error creating receiving log" };
  }
}

export async function updateRecievingLog(
  logId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<RecievingLog>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const logData = ReceivingLogSchema.safeParse(data);
    if (!logData.success) {
      throw new Error(`Invalid receiving log data: ${logData.error.message}`);
    }

    const oldLog = await prisma.recievingLog.findUnique({
      where: { id: logId },
    });

    if (!oldLog) {
      throw new Error("Receiving log not found");
    }

    const updatedLog = await prisma.recievingLog.update({
      where: { id: logId },
      data: logData.data,
    });

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: oldLog,
        to: updatedLog,
      },
    });

    return { success: true, result: updatedLog };
  } catch (error) {
    console.error("Error updating receiving log:", error);
    return { success: false, error: "Error updating receiving log" };
  }
}

export async function deleteRecievingLog(
  logId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!logId) {
      throw new Error("Log ID is required for deletion");
    }

    const logToDelete = await prisma.recievingLog.findUnique({
      where: { id: logId },
    });

    if (!logToDelete) {
      throw new Error("Receiving log not found");
    }

    await prisma.recievingLog.delete({
      where: { id: logId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: logId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting receiving log:", error);
    return { success: false, error: "Error deleting receiving log" };
  }
}
