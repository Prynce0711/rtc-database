"use server";

import {
  Case,
  CaseType,
  CivilCase,
  LogAction,
  Prisma,
} from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import {
  buildCaseWhereForRelation,
  DEFAULT_PAGE_SIZE,
  splitCaseDataBySchema,
} from "@/app/lib/PrismaHelper";
import Roles from "@/app/lib/Roles";
import { prettifyError } from "zod";
import ActionResult from "../../ActionResult";
import { createLog } from "../../ActivityLogs/LogActions";
import { PaginatedResult } from "../../Filter/FilterTypes";
import {
  CivilCaseData,
  CivilCaseSchema,
  CivilCasesFilterOptions,
  CivilCaseStats,
} from "./schema";

export async function getCivilCases(
  options?: CivilCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<CivilCaseData>>> {
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

    const where = buildCaseWhereForRelation(
      CivilCaseSchema,
      "civilCase",
      options,
    );

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
          civilCase: true,
        },
      }),
      prisma.case.count({ where }),
    ]);

    const caseCombined: CivilCaseData[] = cases
      .filter((c): c is Case & { civilCase: CivilCase } => !!c.civilCase)
      .map((c) => ({
        ...c,
        ...c.civilCase,
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

export async function getCivilCaseStats(
  options?: CivilCasesFilterOptions,
): Promise<ActionResult<CivilCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const where = buildCaseWhereForRelation(
      CivilCaseSchema,
      "civilCase",
      options,
    );
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, reRaffleCount, remandedCount, recentCount] =
      await prisma.$transaction([
        prisma.case.count({ where }),
        prisma.case.count({
          where: {
            AND: [
              where,
              {
                civilCase: {
                  is: {
                    reRaffleDate: { not: null },
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
              {
                civilCase: {
                  is: {
                    dateRemanded: { not: null },
                  },
                },
              },
            ],
          },
        }),
        prisma.case.count({
          where: {
            AND: [where, { dateFiled: { gte: thirtyDaysAgo } }],
          },
        }),
      ]);

    return {
      success: true,
      result: {
        totalCases: total,
        reRaffledCases: reRaffleCount,
        remandedCases: remandedCount,
        recentlyFiled: recentCount,
      },
    };
  } catch (error) {
    console.error("Error fetching case stats:", error);
    return { success: false, error: "Error fetching case stats" };
  }
}

export async function createCivilCase(
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

    const caseData = CivilCaseSchema.safeParse(data);
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
        caseType: CaseType.CIVIL,
        civilCase: {
          create: detailData as Prisma.CivilCaseCreateWithoutCaseInput,
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
    console.error("Error creating civil case:", error);
    return { success: false, error: "Error creating civil case" };
  }
}

export async function updateCivilCase(
  caseId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const caseData = CivilCaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      caseData.data,
    );

    if (casePayload.caseType && casePayload.caseType !== CaseType.CIVIL) {
      throw new Error("Case type cannot be changed to non-civil");
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: { civilCase: true },
    });

    if (!originalCase) {
      throw new Error("Case not found");
    }

    if (originalCase.caseNumber !== casePayload.caseNumber) {
      throw new Error("Case number cannot be changed");
    }

    const [, , updatedCase] = await prisma.$transaction([
      prisma.case.update({
        where: { id: caseId },
        data: casePayload,
      }),
      prisma.civilCase.upsert({
        where: { caseNumber: casePayload.caseNumber },
        update: detailData as Prisma.CivilCaseUpdateWithoutCaseInput,
        create: {
          ...(detailData as Prisma.CivilCaseCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      }),
      prisma.case.findUnique({
        where: { id: caseId },
        include: { civilCase: true },
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

export async function deleteCivilCase(
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
    console.error("Error deleting civil case:", error);
    return { success: false, error: "Error deleting civil case" };
  }
}

export async function getCivilCaseById(
  id: string | number,
): Promise<ActionResult<CivilCaseData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const civilCase = await prisma.case.findUnique({
      where: { id: Number(id), civilCase: { isNot: null } },
      include: { civilCase: true },
    });

    if (!civilCase) {
      return { success: false, error: "Case not found" };
    }

    if (civilCase.caseType !== CaseType.CIVIL || !civilCase.civilCase) {
      return { success: false, error: "Case is not a civil case" };
    }

    const caseCombined: CivilCaseData = {
      ...civilCase,
      ...civilCase.civilCase,
    };

    return { success: true, result: caseCombined };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch case" };
  }
}
