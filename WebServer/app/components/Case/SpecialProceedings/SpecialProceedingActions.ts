"use server";

import {
  Case,
  CaseType,
  LogAction,
  Prisma,
  SpecialProceeding,
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
  SpecialProceedingData,
  SpecialProceedingSchema,
  SpecialProceedingsFilterOptions,
  SpecialProceedingStats,
} from "./schema";

export async function getSpecialProceedings(
  options?: SpecialProceedingsFilterOptions,
): Promise<ActionResult<PaginatedResult<SpecialProceedingData>>> {
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

    const find = buildCaseFind(
      SpecialProceedingSchema,
      "specialProceeding",
      options,
    );
    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : DEFAULT_PAGE_SIZE;

    const [cases, total] = await prisma.$transaction([
      prisma.case.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip,
        take,
        include: {
          specialProceeding: {
            // Omit the 'id' field from the included specialProceeding to avoid conflicts with the Case's 'id'
            omit: {
              id: true,
            },
          },
        },
      }),
      prisma.case.count({ where: find.where }),
    ]);

    const specialProceedings: SpecialProceedingData[] = cases
      .filter(
        (c): c is Case & { specialProceeding: SpecialProceeding } =>
          !!c.specialProceeding,
      )
      .map((c) => ({
        // BaseCase must come second to ensure id and caseNumber from Case are used instead of any potential fields in SpecialProceeding
        ...c.specialProceeding,
        ...c,
      }));

    return {
      success: true,
      result: {
        items: specialProceedings,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching special proceedings:", error);
    return { success: false, error: "Error fetching special proceedings" };
  }
}

export async function getSpecialProceedingStats(
  options?: SpecialProceedingsFilterOptions,
): Promise<ActionResult<SpecialProceedingStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildCaseFind(
      SpecialProceedingSchema,
      "specialProceeding",
      options,
    );

    const [totalCases, thisMonth, distinctNatures, distinctBranches] =
      await prisma.$transaction([
        prisma.case.count({ where: find.where }),
        prisma.case.count({
          where: {
            AND: [
              find.where ?? {},
              {
                specialProceeding: {
                  is: {
                    date: {
                      gte: new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1,
                      ),
                    },
                  },
                },
              },
            ],
          },
        }),
        prisma.specialProceeding.findMany({
          where: {
            case: find.where,
          },
          select: {
            nature: true,
          },
          distinct: ["nature"],
        }),
        prisma.specialProceeding.findMany({
          where: {
            case: find.where,
          },
          select: {
            raffledTo: true,
          },
          distinct: ["raffledTo"],
        }),
      ]);

    return {
      success: true,
      result: {
        totalCases,
        thisMonth,
        caseTypes: distinctNatures.length,
        branches: distinctBranches.length,
      },
    };
  } catch (error) {
    console.error("Error fetching special proceeding stats:", error);
    return { success: false, error: "Error fetching special proceeding stats" };
  }
}

export async function createSpecialProceeding(
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (data.id) {
      throw new Error(
        "New special proceeding case data should not include an id",
      );
    }

    const normalized = {
      ...data,
      caseType: CaseType.SCA,
      dateFiled: data.dateFiled ?? data.date ?? null,
      branch: data.branch ?? data.raffledTo ?? null,
      assistantBranch:
        data.assistantBranch ?? data.raffledToBranch ?? data.raffledTo ?? null,
    };

    const specialProceedingData = SpecialProceedingSchema.safeParse(normalized);
    if (!specialProceedingData.success) {
      throw new Error(
        `Invalid special proceeding data: ${prettifyError(specialProceedingData.error)}`,
      );
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      specialProceedingData.data,
    );

    const newCase = await prisma.case.create({
      data: {
        ...casePayload,
        caseType: CaseType.SCA,
        specialProceeding: {
          create: detailData as Prisma.SpecialProceedingCreateWithoutCaseInput,
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
    console.error("Error creating special proceeding:", error);
    return { success: false, error: "Error creating special proceeding" };
  }
}

export async function updateSpecialProceeding(
  caseId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const normalized = {
      ...data,
      caseType: CaseType.SCA,
      dateFiled: data.dateFiled ?? data.date ?? null,
      branch: data.branch ?? data.raffledTo ?? null,
      assistantBranch:
        data.assistantBranch ?? data.raffledToBranch ?? data.raffledTo ?? null,
    };

    const specialProceedingData = SpecialProceedingSchema.safeParse(normalized);
    if (!specialProceedingData.success) {
      throw new Error(
        `Invalid special proceeding data: ${prettifyError(specialProceedingData.error)}`,
      );
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      specialProceedingData.data,
    );

    if (casePayload.caseType && casePayload.caseType !== CaseType.SCA) {
      throw new Error("Case type cannot be changed to non-special proceeding");
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: { specialProceeding: true },
    });

    if (!originalCase || !originalCase.specialProceeding) {
      throw new Error("Special proceeding not found");
    }

    const [, , updatedCase] = await prisma.$transaction([
      prisma.case.update({
        where: { id: caseId },
        data: {
          ...casePayload,
          caseType: CaseType.SCA,
        },
      }),
      prisma.specialProceeding.upsert({
        where: { baseCaseID: caseId },
        update: detailData,
        create: {
          ...(detailData as Prisma.SpecialProceedingCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      }),
      prisma.case.findUnique({
        where: { id: caseId },
        include: { specialProceeding: true },
      }),
    ]);

    if (!updatedCase) {
      throw new Error("Failed to update special proceeding");
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
    console.error("Error updating special proceeding:", error);
    return { success: false, error: "Error updating special proceeding" };
  }
}

export async function deleteSpecialProceeding(
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
    console.error("Error deleting special proceeding:", error);
    return { success: false, error: "Error deleting special proceeding" };
  }
}

export async function getSpecialProceedingById(
  id: string | number,
): Promise<ActionResult<SpecialProceedingData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const result = await prisma.case.findUnique({
      where: { id: Number(id), specialProceeding: { isNot: null } },
      include: { specialProceeding: true },
    });

    if (!result || !result.specialProceeding) {
      return { success: false, error: "Special proceeding not found" };
    }

    if (result.caseType !== CaseType.SCA) {
      return { success: false, error: "Case is not a special proceeding case" };
    }

    return {
      success: true,
      result: {
        ...result.specialProceeding,
        ...result,
      },
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch special proceeding" };
  }
}

export async function getSpecialProceedingByCaseNumber(
  caseNumber: string,
): Promise<ActionResult<SpecialProceedingData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await prisma.case.findFirst({
      where: { caseNumber, specialProceeding: { isNot: null } },
      orderBy: { id: "desc" },
      include: { specialProceeding: true },
    });

    if (!result || !result.specialProceeding) {
      return { success: false, error: "Special proceeding not found" };
    }

    if (result.caseType !== CaseType.SCA) {
      return { success: false, error: "Case is not a special proceeding case" };
    }

    return {
      success: true,
      result: {
        ...result.specialProceeding,
        ...result,
      },
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch special proceeding" };
  }
}
