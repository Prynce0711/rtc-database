"use server";

import { LogAction } from "@/app/generated/prisma/browser";
import { prisma } from "@/app/lib/prisma";
import ActionResult from "../ActionResult";
import { createLog } from "../ActivityLogs/LogActions";
import { ReceiveLogSchema } from "./ReceiveSchema";

export async function getReceivingLogs(): Promise<ActionResult<any[]>> {
  try {
    const logs = await prisma.receivingLog.findMany();
    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching receiving logs:", error);
    return { success: false, error: "Error fetching receiving logs" };
  }
}

export async function createReceivingLog(
  data: Record<string, unknown>,
): Promise<ActionResult<any>> {
  try {
    const logData = ReceiveLogSchema.safeParse(data);
    if (!logData.success) {
      throw new Error(`Invalid receiving log data: ${logData.error.message}`);
    }

    const newLog = await prisma.receivingLog.create({
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

export async function updateReceivingLog(
  logId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<any>> {
  try {
    const logData = ReceiveLogSchema.safeParse(data);
    if (!logData.success) {
      throw new Error(`Invalid receiving log data: ${logData.error.message}`);
    }

    const updatedLog = await prisma.receivingLog.update({
      where: { id: logId },
      data: logData.data,
    });

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: logId,
        to: updatedLog.id,
      },
    });

    return { success: true, result: updatedLog };
  } catch (error) {
    console.error("Error updating receiving log:", error);
    return { success: false, error: "Error updating receiving log" };
  }
}

export async function deleteReceivingLog(
  logId: number,
): Promise<ActionResult<any>> {
  try {
    const deletedLog = await prisma.receivingLog.delete({
      where: { id: logId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: logId,
      },
    });

    return { success: true, result: deletedLog };
  } catch (error) {
    console.error("Error deleting receiving log:", error);
    return { success: false, error: "Error deleting receiving log" };
  }
}
