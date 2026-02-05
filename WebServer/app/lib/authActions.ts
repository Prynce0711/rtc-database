"use server";

import { headers } from "next/headers";
import ActionResult from "../components/ActionResult";
import { auth } from "./auth";

export enum Role {
  ADMIN = "admin",
  USER = "user",
}

export async function validateSession(
  role?: Role,
): Promise<ActionResult<void>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user || (role && session.user.role !== role)) {
      return { success: false, error: "Unauthorized" };
    }
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error validating session:", error);
    return { success: false, error: "Error validating session" };
  }
}

export async function signOut(): Promise<ActionResult<void>> {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error signing out:", error);
    return { success: false, error: "Error signing out" };
  }
}
