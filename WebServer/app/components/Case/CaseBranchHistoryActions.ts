"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import type { ActionResult, CaseBranchHistoryData } from "@rtc-database/shared";
import {
  recordCaseBranchHistory,
  recordInitialCaseBranchHistory,
} from "./CaseBranchHistoryUtils";

async function backfillCaseBranchHistory(caseId: number) {
  const baseCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      criminalCase: true,
      civilCase: true,
      unloadedCase: true,
      consolidatedCase: true,
      reraffledCase: true,
    },
  });

  if (!baseCase) return;

  await prisma.$transaction(async (tx) => {
    const originalRaffleDate =
      baseCase.criminalCase?.previousRaffleDate ??
      baseCase.criminalCase?.raffleDate ??
      baseCase.civilCase?.previousRaffleDate ??
      baseCase.civilCase?.reRaffleDate ??
      baseCase.dateFiled;

    await recordInitialCaseBranchHistory(tx, {
      caseId,
      branch: baseCase.branch,
      raffleDate: originalRaffleDate,
      source: "backfill",
    });

    if (baseCase.civilCase?.reRaffleBranch || baseCase.civilCase?.reRaffleDate) {
      await recordCaseBranchHistory(tx, {
        caseId,
        eventType: "RERAFFLE",
        fromBranch: baseCase.branch,
        toBranch: baseCase.civilCase.reRaffleBranch ?? baseCase.branch,
        raffleDate: baseCase.civilCase.reRaffleDate,
        source: "backfill",
      });
    }

    if (
      baseCase.civilCase?.consolidationBranch ||
      baseCase.civilCase?.consolitationDate
    ) {
      await recordCaseBranchHistory(tx, {
        caseId,
        eventType: "CONSOLIDATED",
        fromBranch: baseCase.civilCase.reRaffleBranch ?? baseCase.branch,
        toBranch: baseCase.civilCase.consolidationBranch ?? baseCase.branch,
        raffleDate: baseCase.civilCase.consolitationDate,
        source: "backfill",
      });
    }

    for (const unloaded of baseCase.unloadedCase) {
      await recordCaseBranchHistory(tx, {
        caseId,
        eventType: "UNLOADED",
        fromBranch: unloaded.fromBranch ?? baseCase.branch,
        toBranch: unloaded.toBranch,
        raffleDate: unloaded.dateTransmitted,
        source: "legacy",
      });
    }

    for (const reraffled of baseCase.reraffledCase) {
      await recordCaseBranchHistory(tx, {
        caseId,
        eventType: "RERAFFLE",
        fromBranch: reraffled.fromBranch ?? baseCase.branch,
        toBranch: reraffled.toBranch,
        raffleDate: reraffled.dateTransmitted,
        source: "legacy",
      });
    }

    for (const consolidated of baseCase.consolidatedCase) {
      await recordCaseBranchHistory(tx, {
        caseId,
        eventType: "CONSOLIDATED",
        fromBranch: consolidated.fromBranch ?? baseCase.branch,
        toBranch: consolidated.toBranch,
        raffleDate: consolidated.dateTransmitted,
        source: "legacy",
      });
    }
  });
}

export async function getCaseBranchHistory(
  caseId: string | number,
): Promise<ActionResult<CaseBranchHistoryData[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const id = Number(caseId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: "Invalid case ID" };
    }

    await backfillCaseBranchHistory(id);

    const history = await prisma.caseBranchHistory.findMany({
      where: { baseCaseID: id },
      orderBy: [{ raffleDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return { success: true, result: history };
  } catch (error) {
    console.error("Error fetching case branch history:", error);
    return { success: false, error: "Failed to fetch case branch history" };
  }
}
