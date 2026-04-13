"use server";

import {
  Case,
  CaseType,
  CivilCase,
  LogAction,
  Prisma,
} from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  formatAutoCaseNumber,
  getNextCaseNumber,
  parseCaseNumber,
  syncCaseCounterToAtLeast,
} from "@/app/lib/caseNumbering";
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
import { PaginatedResult } from "@rtc-database/shared";
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

    const find = buildCaseFind(CivilCaseSchema, "civilCase", options);
    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : DEFAULT_PAGE_SIZE;

    const [cases, total] = await prisma.$transaction([
      prisma.case.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip,
        take,
        include: {
          civilCase: {
            // Omit the 'id' field from the included civilCase to avoid conflicts with the Case's 'id'
            omit: {
              id: true,
            },
          },
        },
      }),
      prisma.case.count({ where: find.where }),
    ]);

    const caseCombined: CivilCaseData[] = cases
      .filter((c): c is Case & { civilCase: CivilCase } => !!c.civilCase)
      .map((c) => ({
        ...c.civilCase,
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

export async function getCivilCaseStats(
  options?: CivilCasesFilterOptions,
): Promise<ActionResult<CivilCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildCaseFind(CivilCaseSchema, "civilCase", options);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, reRaffleCount, remandedCount, recentCount] =
      await prisma.$transaction([
        prisma.case.count({ where: find.where }),
        prisma.case.count({
          where: {
            AND: [
              find.where ?? {},
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
              find.where ?? {},
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
            AND: [find.where ?? {}, { dateFiled: { gte: thirtyDaysAgo } }],
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

    const requestedManual =
      typeof data.isManual === "boolean" ? data.isManual : true;

    const rawCaseNumber = String(casePayload.caseNumber ?? "").trim();
    if (!rawCaseNumber) {
      throw new Error("Case number is required");
    }

    const parsedCaseNumber = parseCaseNumber(rawCaseNumber);
    const hasManualSuffix = !!parsedCaseNumber?.tail;
    const isManual = requestedManual || hasManualSuffix;

    const newCase = await prisma.$transaction(async (tx) => {
      if (!isManual) {
        if (!parsedCaseNumber) {
          throw new Error(
            "Auto mode requires a case number pattern like M-01-2026 or 01-M-2026",
          );
        }

        const next = await getNextCaseNumber(
          tx,
          CaseType.CIVIL,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
        );

        return tx.case.create({
          data: {
            ...casePayload,
            caseType: CaseType.CIVIL,
            caseNumber: next.caseNumber,
            number: next.number,
            area: next.area,
            year: next.year,
            isManual: false,
            civilCase: {
              create: detailData as Prisma.CivilCaseCreateWithoutCaseInput,
            },
          },
        });
      }

      const createdCase = await tx.case.create({
        data: {
          ...casePayload,
          caseType: CaseType.CIVIL,
          caseNumber: rawCaseNumber,
          number: null,
          area: null,
          year: null,
          isManual: true,
          civilCase: {
            create: detailData as Prisma.CivilCaseCreateWithoutCaseInput,
          },
        },
      });

      if (parsedCaseNumber) {
        await syncCaseCounterToAtLeast(
          tx,
          CaseType.CIVIL,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
          parsedCaseNumber.number,
        );
      }

      return createdCase;
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

export async function getCivilCaseNumberPreview(
  area: string,
  year: number,
): Promise<ActionResult<{ caseNumber: string; nextNumber: number }>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const normalizedArea = area.trim().toUpperCase();
    if (!normalizedArea || !Number.isFinite(year)) {
      return { success: false, error: "Invalid area/year" };
    }

    const counter = await prisma.caseCounter.findUnique({
      where: {
        caseType_area_year: {
          caseType: CaseType.CIVIL,
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
    console.error("Error getting civil case number preview:", error);
    return { success: false, error: "Failed to get next case number" };
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

    const rawCaseNumber = String(casePayload.caseNumber ?? "").trim();
    if (!rawCaseNumber) {
      throw new Error("Case number is required");
    }

    const parsedCaseNumber = parseCaseNumber(rawCaseNumber);
    const requestedManual =
      typeof data.isManual === "boolean" ? data.isManual : undefined;
    const hasManualSuffix = !!parsedCaseNumber?.tail;
    const inferredManual = hasManualSuffix || !parsedCaseNumber;
    const isManual = requestedManual ?? inferredManual;

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

    const updatedCase = await prisma.$transaction(async (tx) => {
      const caseUpdateData: Prisma.CaseUpdateInput = {
        ...casePayload,
        caseType: CaseType.CIVIL,
      };

      if (!isManual && parsedCaseNumber) {
        caseUpdateData.caseNumber = formatAutoCaseNumber(
          parsedCaseNumber.area,
          parsedCaseNumber.number,
          parsedCaseNumber.year,
        );
        caseUpdateData.number = parsedCaseNumber.number;
        caseUpdateData.area = parsedCaseNumber.area;
        caseUpdateData.year = parsedCaseNumber.year;
        caseUpdateData.isManual = false;
      } else {
        caseUpdateData.caseNumber = rawCaseNumber;
        caseUpdateData.number = null;
        caseUpdateData.area = null;
        caseUpdateData.year = null;
        caseUpdateData.isManual = true;
      }

      await tx.case.update({
        where: { id: caseId },
        data: caseUpdateData,
      });

      await tx.civilCase.upsert({
        where: { baseCaseID: caseId },
        update: detailData,
        create: {
          ...(detailData as Prisma.CivilCaseCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      });

      if (parsedCaseNumber) {
        await syncCaseCounterToAtLeast(
          tx,
          CaseType.CIVIL,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
          parsedCaseNumber.number,
        );
      }

      return tx.case.findUnique({
        where: { id: caseId },
        include: { civilCase: true },
      });
    });

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
      include: {
        civilCase: {
          omit: {
            id: true,
          },
        },
      },
    });

    if (!civilCase) {
      return { success: false, error: "Case not found" };
    }

    if (civilCase.caseType !== CaseType.CIVIL || !civilCase.civilCase) {
      return { success: false, error: "Case is not a civil case" };
    }

    const caseCombined: CivilCaseData = {
      ...civilCase.civilCase,
      ...civilCase,
    };

    return { success: true, result: caseCombined };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch case" };
  }
}

export async function getCivilCasesByIds(
  ids: (string | number)[],
): Promise<ActionResult<CivilCaseData[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid case IDs provided" };
    }

    const cases = await prisma.case.findMany({
      where: {
        id: { in: validIds },
        civilCase: { isNot: null },
      },
      include: {
        civilCase: {
          omit: {
            id: true,
          },
        },
      },
    });

    const caseCombined: CivilCaseData[] = cases
      .filter((c): c is Case & { civilCase: CivilCase } => !!c.civilCase)
      .map((c) => ({
        ...c.civilCase,
        ...c,
      }));

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    const sortedCases = caseCombined.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (sortedCases.length !== validIds.length) {
      return { success: false, error: "One or more cases were not found" };
    }

    return { success: true, result: sortedCases };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch cases" };
  }
}
