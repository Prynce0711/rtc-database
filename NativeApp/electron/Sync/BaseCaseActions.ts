"use server";

import type {
  PaginatedResult,
  UnifiedCaseData,
  UnifiedCasesOptions,
  UnifiedCaseStats,
} from "@rtc-database/shared";
import { ActionResult, DEFAULT_PAGE_SIZE } from "@rtc-database/shared";
import { CaseType, Prisma } from "@rtc-database/shared/prisma/client";
import { prisma } from "../prisma";
import { logError } from "../utils";

const toUnifiedCase = (
  c: Prisma.CaseGetPayload<{
    include: {
      criminalCase: true;
      civilCase: true;
      petition: true;
      specialProceeding: true;
    };
  }>,
): UnifiedCaseData => {
  const criminal = c.criminalCase;
  const civil = c.civilCase;
  const petition = c.petition;
  const specialProceeding = c.specialProceeding;

  if (criminal) {
    return {
      ...c,
      displayParty: criminal.name,
      displayDetail: criminal.charge ?? "Criminal case",
      isDetained: !!criminal.detained,
      statusText: criminal.detained ? "Detained" : "Free",
      raffleDate: criminal.raffleDate,
    };
  }

  if (civil) {
    return {
      ...c,
      displayParty: civil.petitioners ?? civil.defendants ?? "Civil case",
      displayDetail: civil.nature ?? "Civil case",
      isDetained: false,
      statusText: "N/A",
      raffleDate: civil.reRaffleDate,
    };
  }

  if (petition) {
    return {
      ...c,
      displayParty: petition.petitioner ?? "Petition",
      displayDetail: petition.nature ?? "Petition case",
      isDetained: false,
      statusText: "N/A",
      raffleDate: petition.date,
    };
  }

  if (specialProceeding) {
    return {
      ...c,
      displayParty:
        specialProceeding.petitioner ??
        specialProceeding.respondent ??
        "Special proceeding",
      displayDetail: specialProceeding.nature ?? "Special proceeding",
      isDetained: false,
      statusText: "N/A",
      raffleDate: specialProceeding.date,
    };
  }

  return {
    ...c,
    displayParty: "Unknown",
    displayDetail: "No case details",
    isDetained: false,
    statusText: "N/A",
    raffleDate: null,
  };
};

export async function doesCaseExist(
  caseNumbers: string[],
  caseType: CaseType,
): Promise<ActionResult<string[]>> {
  try {
    const cases = await prisma.case.findMany({
      where: {
        caseNumber: { in: caseNumbers },
        caseType,
      },
      select: {
        caseNumber: true,
      },
    });

    const existingCaseNumbers = cases.map((c) => c.caseNumber);
    return { success: true, result: existingCaseNumbers };
  } catch (error) {
    return {
      success: false,
      error: logError("[cases] Failed to fetch existing case numbers", error),
    };
  }
}

export async function getCases(
  options?: UnifiedCasesOptions,
): Promise<ActionResult<PaginatedResult<UnifiedCaseData>>> {
  try {
    const shouldPaginate = !!options;
    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0
        ? options.pageSize
        : DEFAULT_PAGE_SIZE;

    const where: Prisma.CaseWhereInput = options?.caseType
      ? { caseType: options.caseType }
      : {};

    const orderBy: Prisma.CaseOrderByWithRelationInput = {
      [options?.sortKey ?? "dateFiled"]: options?.sortOrder ?? "desc",
    } as Prisma.CaseOrderByWithRelationInput;

    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : DEFAULT_PAGE_SIZE;

    const [cases, total] = await prisma.$transaction([
      prisma.case.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          criminalCase: true,
          civilCase: true,
          petition: true,
          specialProceeding: true,
        },
      }),
      prisma.case.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items: cases.map(toUnifiedCase),
        total,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: logError("[cases] Failed to fetch cases", error),
    };
  }
}

export async function getCaseStats(
  options?: Pick<UnifiedCasesOptions, "caseType">,
): Promise<ActionResult<UnifiedCaseStats>> {
  try {
    const where: Prisma.CaseWhereInput = options?.caseType
      ? { caseType: options.caseType }
      : {};
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const includeCriminalStats =
      !options?.caseType || options.caseType === "CRIMINAL";

    const [total, recentCount] = await prisma.$transaction([
      prisma.case.count({ where }),
      prisma.case.count({
        where: {
          AND: [where, { dateFiled: { gte: thirtyDaysAgo } }],
        },
      }),
    ]);

    let detainedCount = 0;
    let pendingCount = 0;

    if (includeCriminalStats) {
      [detainedCount, pendingCount] = await prisma.$transaction([
        prisma.case.count({
          where: {
            AND: [
              where,
              { caseType: "CRIMINAL" },
              {
                criminalCase: {
                  is: {
                    detained: { not: null },
                  },
                },
              },
              {
                criminalCase: {
                  is: {
                    detained: { not: "" },
                  },
                },
              },
            ],
          },
        }),
        prisma.case.count({
          where: {
            AND: [
              where,
              { caseType: "CRIMINAL" },
              {
                criminalCase: {
                  is: {
                    raffleDate: null,
                  },
                },
              },
            ],
          },
        }),
      ]);
    }

    return {
      success: true,
      result: {
        totalCases: total,
        detainedCases: detainedCount,
        pendingCases: pendingCount,
        recentlyFiled: recentCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: logError("[cases] Failed to fetch case stats", error),
    };
  }
}
