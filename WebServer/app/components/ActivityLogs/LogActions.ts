"use server";

import { Log, LogAction } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { prettifyError } from "zod";
import ActionResult from "../ActionResult";
import { CreateLogData } from "./schema";

export async function getLogs(): Promise<ActionResult<Log[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation; // Return the error from session validation
    }

    const logs = await prisma.log.findMany();
    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching logs:", error);
    return { success: false, error: "Failed to fetch logs" };
  }
}

export async function createLog(
  logData: CreateLogData,
): Promise<ActionResult<void>> {
  try {
    const isLoginAttempt =
      logData.action === LogAction.LOGIN_SUCCESS ||
      logData.action === LogAction.LOGIN_FAILED;

    if (isLoginAttempt) {
      await prisma.log.create({
        data: {
          action: logData.action,
          details: JSON.parse(JSON.stringify(logData.details)), // Ensure details is stored as JSON in the database
        },
      });
      return { success: true, result: undefined };
    }

    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation; // Return the error from session validation
    }

    const validation = CreateLogData.safeParse(logData);
    if (!validation.success) {
      throw new Error("Invalid log data: " + prettifyError(validation.error));
    }

    await prisma.log.create({
      data: {
        action: logData.action,
        userId: sessionValidation.result.id,
        details: JSON.parse(JSON.stringify(logData.details)), // Ensure details is stored as JSON in the database
      },
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error creating log:", error);
    return { success: false, error: "Failed to create log" };
  }
}
