"use server";

import { ActionResult } from "@rtc-database/shared";
import { CaseType } from "@rtc-database/shared/prisma/client";
import { validateSession } from "../../lib/authActions";
import { deleteGarageFile } from "../../lib/garageActions";
import { prisma } from "../../lib/prisma";
import Roles from "../../lib/Roles";

export async function deleteAllCases(
  caseType: CaseType,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await prisma.case.deleteMany({
      where: {
        caseType,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting cases:", error);
    return { success: false, error: "Error deleting cases" };
  }
}

export async function deleteAllNotarial(): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const filesToCheck = await prisma.notarial.findMany({
      where: {
        fileId: {
          not: null,
        },
      },
      select: {
        fileId: true,
        file: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });

    await prisma.notarial.deleteMany({});

    const uniqueFiles = new Map<number, string>();
    for (const entry of filesToCheck) {
      if (entry.fileId && entry.file) {
        uniqueFiles.set(entry.fileId, entry.file.key);
      }
    }

    for (const [fileId, key] of uniqueFiles) {
      const [notarialCountRaw, chatMessageCountRaw] = await Promise.all([
        prisma.notarial.count({ where: { fileId } }),
        prisma.chatMessage.count({ where: { fileId } }),
      ]);

      const notarialCount =
        typeof notarialCountRaw === "bigint"
          ? Number(notarialCountRaw)
          : notarialCountRaw;
      const chatMessageCount =
        typeof chatMessageCountRaw === "bigint"
          ? Number(chatMessageCountRaw)
          : chatMessageCountRaw;

      if (notarialCount === 0 && chatMessageCount === 0) {
        await deleteGarageFile(key);
      }
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting notarial entries:", error);
    return { success: false, error: "Error deleting notarial entries" };
  }
}

export async function deleteAllSpecialProceedings(): Promise<
  ActionResult<void>
> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await prisma.case.deleteMany({
      where: {
        caseType: CaseType.SCA,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting special proceedings:", error);
    return { success: false, error: "Error deleting special proceedings" };
  }
}
