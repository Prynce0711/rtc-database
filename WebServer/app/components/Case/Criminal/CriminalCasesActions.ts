"use server";

import {
  Case,
  CaseType,
  CriminalCase,
  LogAction,
  Prisma,
} from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import {
  buildCaseFind,
  DEFAULT_PAGE_SIZE,
  splitCaseDataBySchema,
} from "@/app/lib/PrismaHelper";
import Roles from "@/app/lib/Roles";
import { prettifyError } from "zod";
import ActionResult from "../../ActionResult";
import { createLog } from "../../ActivityLogs/LogActions";
import { PaginatedResult } from "../../Filter/FilterTypes";
import {
  CriminalCaseData,
  CriminalCaseSchema,
  CriminalCasesFilterOptions,
  CriminalCaseStats,
} from "./schema";

export async function getCriminalCases(
  options?: CriminalCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<CriminalCaseData>>> {
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
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

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

export async function createCriminalCase(
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (data.id) {
      throw new Error("New case data should not include an id");
    }

    const caseData = CriminalCaseSchema.safeParse(data);
    if (!caseData.success) {
      console.log(`Invalid case data: ${prettifyError(caseData.error)}`);
      throw new Error(`Invalid case data: ${prettifyError(caseData.error)}`);
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      caseData.data,
    );

    const newCase = await prisma.case.create({
      data: {
        ...casePayload,
        caseType: CaseType.CRIMINAL,
        criminalCase: {
          create: detailData as Prisma.CriminalCaseCreateWithoutCaseInput,
        },
      },
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newCase.id,
      },
    });

    return { success: true, result: newCase };
  } catch (error) {
    console.error("Error creating criminal case:", error);
    return { success: false, error: "Error creating criminal case" };
  }
}

export async function updateCriminalCase(
  caseId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const caseData = CriminalCaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      caseData.data,
    );

    if (casePayload.caseType && casePayload.caseType !== CaseType.CRIMINAL) {
      throw new Error("Case type cannot be changed to non-criminal");
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: { criminalCase: true },
    });

    if (!originalCase) {
      throw new Error("Case not found");
    }

    const [, , updatedCase] = await prisma.$transaction([
      prisma.case.update({
        where: { id: caseId },
        data: casePayload,
      }),
      prisma.criminalCase.upsert({
        where: { baseCaseID: caseId },
        update: detailData,
        create: {
          ...(detailData as Prisma.CriminalCaseCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      }),
      prisma.case.findUnique({
        where: { id: caseId },
        include: { criminalCase: true },
      }),
    ]);

    if (!updatedCase) {
      throw new Error("Failed to update case");
    }

    await createLog({
      action: LogAction.UPDATE_CASE,
      details: {
        from: originalCase,
        to: updatedCase,
      },
    });

    return { success: true, result: updatedCase };
  } catch (error) {
    console.error("Error updating case:", error);
    return { success: false, error: "Error updating case" };
  }
}

export async function deleteCriminalCase(
  caseId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.case.delete({
      where: { id: caseId },
    });

    await createLog({
      action: LogAction.DELETE_CASE,
      details: {
        id: caseId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting  criminal case:", error);
    return { success: false, error: "Error deleting criminal case" };
  }
}

export async function getCriminalCaseById(
  id: string | number,
): Promise<ActionResult<CriminalCaseData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const criminalCase = await prisma.case.findUnique({
      where: { id: Number(id), criminalCase: { isNot: null } },
      include: { criminalCase: true },
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
      ...criminalCase,
      ...criminalCase.criminalCase,
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
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

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
      include: { criminalCase: true },
    });

    const caseCombined: CriminalCaseData[] = cases
      .filter(
        (c): c is Case & { criminalCase: CriminalCase } => !!c.criminalCase,
      )
      .map((c) => ({
        ...c,
        ...c.criminalCase,
      }));

    return { success: true, result: caseCombined };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch cases" };
  }
}
