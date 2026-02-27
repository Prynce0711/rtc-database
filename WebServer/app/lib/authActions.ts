"use server";

import { User } from "better-auth";
import { headers } from "next/headers";
import ActionResult from "../components/ActionResult";
import { createLog } from "../components/ActivityLogs/LogActions";
import { LogAction } from "../generated/prisma/enums";
import { auth } from "./auth";
import Roles from "./Roles";

export async function validateSession(
  role?: Roles[],
): Promise<ActionResult<User>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (
      !session?.user ||
      (role && !role.includes(session.user.role as Roles)) ||
      session.user.banned
    ) {
      throw new Error(
        "Unauthorized: Invalid session or insufficient permissions",
      );
    }

    return { success: true, result: session.user };
  } catch (error) {
    console.error("Error validating session:", error);
    return { success: false, error: "Error validating session" };
  }
}

export async function signOut(): Promise<ActionResult<void>> {
  try {
    await createLog({
      action: LogAction.LOGOUT,
      details: null,
    });

    await auth.api.signOut({
      headers: await headers(),
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error signing out:", error);
    return { success: false, error: "Error signing out" };
  }
}
