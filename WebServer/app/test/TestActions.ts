"use server";

import ActionResult from "../components/ActionResult";
import { validateSession } from "../lib/authActions";
import { prisma } from "../lib/prisma";
import Roles from "../lib/Roles";

export async function deleteAllCases(): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await prisma.case.deleteMany({});

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting cases:", error);
    return { success: false, error: "Error deleting cases" };
  }
}
