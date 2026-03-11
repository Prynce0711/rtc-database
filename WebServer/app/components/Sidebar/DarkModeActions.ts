"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import ActionResult from "../ActionResult";

export async function isDarkModeEnabled(): Promise<ActionResult<boolean>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionValidation.result.id },
      select: { darkMode: true },
    });

    return { success: true, result: user?.darkMode || false };
  } catch (error) {
    console.error("Error checking dark mode:", error);
    return {
      success: false,
      error: "An error occurred while checking dark mode status.",
    };
  }
}

export async function updateDarkMode(
  newTheme: "winter" | "dim",
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const darkModeEnabled = await prisma.user.findUnique({
      where: { id: sessionValidation.result.id },
      select: { darkMode: true },
    });

    await prisma.user.update({
      where: { id: sessionValidation.result.id },
      data: { darkMode: { set: newTheme === "dim" } },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error updating theme:", error);
    return {
      success: false,
      error: "An error occurred while updating theme.",
    };
  }
}
