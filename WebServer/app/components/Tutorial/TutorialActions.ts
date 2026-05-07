"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { ActionResult } from "@rtc-database/shared";
import { LogAction } from "@rtc-database/shared/prisma/enums";
import { createLog } from "../ActivityLogs/LogActions";

export type TutorialStatus = "PENDING" | "COMPLETED" | "SKIPPED";

export interface TutorialProgress {
  status: TutorialStatus;
  completedAt: string | null;
  skippedAt: string | null;
  lastStartedAt: string | null;
}

const serializeDate = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const toTutorialProgress = (user: {
  tutorialStatus: TutorialStatus;
  tutorialCompletedAt: Date | null;
  tutorialSkippedAt: Date | null;
  tutorialLastStartedAt: Date | null;
}): TutorialProgress => ({
  status: user.tutorialStatus,
  completedAt: serializeDate(user.tutorialCompletedAt),
  skippedAt: serializeDate(user.tutorialSkippedAt),
  lastStartedAt: serializeDate(user.tutorialLastStartedAt),
});

export async function getTutorialProgress(): Promise<
  ActionResult<TutorialProgress>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionValidation.result.id },
      select: {
        tutorialStatus: true,
        tutorialCompletedAt: true,
        tutorialSkippedAt: true,
        tutorialLastStartedAt: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return { success: true, result: toTutorialProgress(user) };
  } catch (error) {
    console.error("Error fetching tutorial progress:", error);
    return { success: false, error: "Failed to fetch tutorial progress" };
  }
}

export async function startTutorial(): Promise<ActionResult<TutorialProgress>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const updated = await prisma.user.update({
      where: { id: sessionValidation.result.id },
      data: {
        tutorialStatus: "PENDING",
        tutorialCompletedAt: null,
        tutorialSkippedAt: null,
        tutorialLastStartedAt: new Date(),
      },
      select: {
        tutorialStatus: true,
        tutorialCompletedAt: true,
        tutorialSkippedAt: true,
        tutorialLastStartedAt: true,
      },
    });

    await createLog({
      action: LogAction.UPDATE_TUTORIAL,
      details: { id: sessionValidation.result.id, status: "PENDING" },
    });

    return { success: true, result: toTutorialProgress(updated) };
  } catch (error) {
    console.error("Error starting tutorial:", error);
    return { success: false, error: "Failed to start tutorial" };
  }
}

export async function completeTutorial(): Promise<ActionResult<TutorialProgress>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const updated = await prisma.user.update({
      where: { id: sessionValidation.result.id },
      data: {
        tutorialStatus: "COMPLETED",
        tutorialCompletedAt: new Date(),
      },
      select: {
        tutorialStatus: true,
        tutorialCompletedAt: true,
        tutorialSkippedAt: true,
        tutorialLastStartedAt: true,
      },
    });

    await createLog({
      action: LogAction.UPDATE_TUTORIAL,
      details: { id: sessionValidation.result.id, status: "COMPLETED" },
    });

    return { success: true, result: toTutorialProgress(updated) };
  } catch (error) {
    console.error("Error completing tutorial:", error);
    return { success: false, error: "Failed to complete tutorial" };
  }
}

export async function skipTutorial(): Promise<ActionResult<TutorialProgress>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const updated = await prisma.user.update({
      where: { id: sessionValidation.result.id },
      data: {
        tutorialStatus: "SKIPPED",
        tutorialSkippedAt: new Date(),
      },
      select: {
        tutorialStatus: true,
        tutorialCompletedAt: true,
        tutorialSkippedAt: true,
        tutorialLastStartedAt: true,
      },
    });

    await createLog({
      action: LogAction.UPDATE_TUTORIAL,
      details: { id: sessionValidation.result.id, status: "SKIPPED" },
    });

    return { success: true, result: toTutorialProgress(updated) };
  } catch (error) {
    console.error("Error skipping tutorial:", error);
    return { success: false, error: "Failed to skip tutorial" };
  }
}
