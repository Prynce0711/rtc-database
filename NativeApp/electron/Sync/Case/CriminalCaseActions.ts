"use server";

import {
  ActionResult,
  buildCaseFind,
  Case,
  CaseType,
  CriminalCase,
  CriminalCaseData,
  CriminalCaseSchema,
  CriminalCasesFilterOptions,
  CriminalCaseStats,
  DEFAULT_PAGE_SIZE,
  PaginatedResult,
} from "@rtc-database/shared";
import { formatAutoCaseNumber } from "@rtc-database/shared/lib/caseNumbering";
import { prisma } from "../../prisma";

export async function getCriminalCases(
  options?: CriminalCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<CriminalCaseData>>> {
  try {
    const shouldPaginate = !!options;
    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0
        ? options.pageSize
        : DEFAULT_PAGE_SIZE;

    const find = buildCaseFind(CriminalCaseSchema, "criminalCase", options);
    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : DEFAULT_PAGE_SIZE;

    const [cases, total] = await prisma.$transaction([
      prisma.case.findMany({
        skip,
        take,
        include: {
          criminalCase: {
            // Omit the 'id' field from the included criminalCase to avoid conflicts with the Case's 'id'
            omit: {
              id: true,
            },
          },
        },
        where: find.where,
        orderBy: find.orderBy,
      }),
      prisma.case.count({ where: find.where }),
    ]);

    const caseCombined: CriminalCaseData[] = cases
      .filter(
        (c): c is Case & { criminalCase: CriminalCase } => !!c.criminalCase,
      )
      .map((c) => ({
        // BaseCase must come second to ensure id and caseNumber from Case are used instead of any potential fields in CriminalCase
        ...c.criminalCase,
        ...c,
      }));

    return {
      success: true,
      result: {
        items: caseCombined,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}

export async function getCriminalCaseStats(
  options?: CriminalCasesFilterOptions,
): Promise<ActionResult<CriminalCaseStats>> {
  try {
    const find = buildCaseFind(CriminalCaseSchema, "criminalCase", options);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, detainedCount, pendingCount, recentCount] =
      await prisma.$transaction([
        prisma.case.count({ where: find.where }),
        prisma.case.count({
          where: {
            AND: [
              find.where ?? {},
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
              find.where ?? {},
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
        prisma.case.count({
          where: {
            AND: [find.where ?? {}, { dateFiled: { gte: thirtyDaysAgo } }],
          },
        }),
      ]);

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

export async function getCriminalCaseNumberPreview(
  area: string,
  year: number,
): Promise<ActionResult<{ caseNumber: string; nextNumber: number }>> {
  try {
    const normalizedArea = area.trim().toUpperCase();
    if (!normalizedArea || !Number.isFinite(year)) {
      return { success: false, error: "Invalid area/year" };
    }

    const counter = await prisma.caseCounter.findUnique({
      where: {
        caseType_area_year: {
          caseType: CaseType.CRIMINAL,
          area: normalizedArea,
          year,
        },
      },
    });

    const nextNumber = (counter?.last ?? 0) + 1;
    const caseNumber = formatAutoCaseNumber(normalizedArea, nextNumber, year);

    return {
      success: true,
      result: {
        caseNumber,
        nextNumber,
      },
    };
  } catch (error) {
    console.error("Error getting criminal case number preview:", error);
    return { success: false, error: "Failed to get next case number" };
  }
}

export async function getCriminalCaseById(
  id: string | number,
): Promise<ActionResult<CriminalCaseData>> {
  try {
    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const criminalCase = await prisma.case.findUnique({
      where: { id: Number(id), criminalCase: { isNot: null } },
      include: {
        criminalCase: {
          omit: {
            id: true,
          },
        },
      },
    });

    if (!criminalCase) {
      return { success: false, error: "Case not found" };
    }

    if (
      criminalCase.caseType !== CaseType.CRIMINAL ||
      !criminalCase.criminalCase
    ) {
      console.error(
        `Case with ID ${id} is not a criminal case or missing criminal case details`,
      );
      return { success: false, error: "Case is not a criminal case" };
    }

    const caseCombined: CriminalCaseData = {
      ...criminalCase.criminalCase,
      ...criminalCase,
    };

    return { success: true, result: caseCombined };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch case" };
  }
}

export async function getCriminalCasesByIds(
  ids: (string | number)[],
): Promise<ActionResult<CriminalCaseData[]>> {
  try {
    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid case IDs provided" };
    }

    const cases = await prisma.case.findMany({
      where: {
        id: { in: validIds },
        criminalCase: { isNot: null },
      },
      include: {
        criminalCase: {
          omit: {
            id: true,
          },
        },
      },
    });

    const caseCombined: CriminalCaseData[] = cases
      .filter(
        (c): c is Case & { criminalCase: CriminalCase } => !!c.criminalCase,
      )
      .map((c) => ({
        ...c.criminalCase,
        ...c,
      }));

    return { success: true, result: caseCombined };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch cases" };
  }
}
