"use server";

import { Log } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../ActionResult";

export async function getLogs(): Promise<ActionResult<Log[]>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }
    const logs = await prisma.log.findMany({
      orderBy: { timestamp: "desc" },
    });
    return { success: true, result: logs };
  } catch (error) {
    console.error("Error fetching logs:", error);
    return { success: false, error: "Error fetching logs" };
  }
}
