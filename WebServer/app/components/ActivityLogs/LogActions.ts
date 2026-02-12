"use server";

import { LogAction } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { prettifyError } from "zod";
import ActionResult from "../ActionResult";
import { BaseLogData, CompleteLogData, CreateLogData } from "./schema";

export async function getLogs(): Promise<ActionResult<CompleteLogData[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation; // Return the error from session validation
    }

    const logs = await prisma.log.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // const parsedLogs = LogData.array().safeParse(logs);
    // if (!parsedLogs.success) {
    //   throw new Error(
    //     "Failed to parse logs: " + prettifyError(parsedLogs.error),
    //   );
    // }

    const parsedLogs = logs.map((log) => {
      const createData = CreateLogData.safeParse({
        action: log.action,
        details: log.details,
      });
      const baseData = BaseLogData.safeParse(log);

      if (!createData.success) {
        console.error(
          "Failed to parse log details for log ID " +
            log.id +
            ": " +
            prettifyError(createData.error),
        );
        return null; // Skip this log entry if details parsing fails
      }

      if (!baseData.success) {
        console.error(
          "Failed to parse base log data for log ID " +
            log.id +
            ": " +
            prettifyError(baseData.error),
        );
        return null; // Skip this log entry if base data parsing fails
      }

      const completeData: CompleteLogData = {
        ...baseData.data,
        ...createData.data,
      };

      return completeData;
    });

    return {
      success: true,
      result: parsedLogs.filter((log) => log !== null) as CompleteLogData[],
    };
  } catch (error) {
    console.error("Error fetching logs:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch logs",
    };
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
          userId:
            logData.action === LogAction.LOGIN_SUCCESS
              ? logData.details.id
              : undefined,
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
