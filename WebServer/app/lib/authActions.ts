"use server";

import { headers } from "next/headers";
import ActionResult from "../components/ActionResult";
import { auth } from "./auth";

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
