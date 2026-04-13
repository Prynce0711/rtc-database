"use server";

import { CaseType, Prisma, type Case } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import ActionResult from "../ActionResult";
import type { PaginatedResult } from "@rtc-database/shared";

export type UnifiedCaseData = Case & {
  displayParty: string;
  displayDetail: string;
  isDetained: boolean;
  statusText: string;
  raffleDate: Date | null;
};

export type UnifiedCaseStats = {
  totalCases: number;
  detainedCases: number;
  pendingCases: number;
  recentlyFiled: number;
};

export type UnifiedCasesOptions = {
  page?: number;
  pageSize?: number;
  sortKey?: "id" | "caseNumber" | "dateFiled" | "caseType" | "branch";
  sortOrder?: "asc" | "desc";
  caseType?: CaseType;
};

const DEFAULT_PAGE_SIZE = 25;

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
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

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
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}

export async function getCases(
  options?: UnifiedCasesOptions,
): Promise<ActionResult<PaginatedResult<UnifiedCaseData>>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

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
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}

export async function getCaseStats(
  options?: Pick<UnifiedCasesOptions, "caseType">,
): Promise<ActionResult<UnifiedCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

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
    console.error("Error fetching case stats:", error);
    return { success: false, error: "Error fetching case stats" };
  }
}
