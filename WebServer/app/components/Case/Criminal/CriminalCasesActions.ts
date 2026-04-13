"use server";

import {
  Case,
  CaseType,
  CriminalCase,
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
import {
  ActionResult,
  CriminalCaseData,
  CriminalCaseSchema,
  CriminalCasesFilterOptions,
  CriminalCaseStats,
  PaginatedResult,
} from "@rtc-database/shared";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";

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
          CaseType.CRIMINAL,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
        );

        return tx.case.create({
          data: {
            ...casePayload,
            caseType: CaseType.CRIMINAL,
            caseNumber: next.caseNumber,
            number: next.number,
            area: next.area,
            year: next.year,
            isManual: false,
            criminalCase: {
              create: detailData as Prisma.CriminalCaseCreateWithoutCaseInput,
            },
          },
        });
      }

      const createdCase = await tx.case.create({
        data: {
          ...casePayload,
          caseType: CaseType.CRIMINAL,
          caseNumber: rawCaseNumber,
          number: null,
          area: null,
          year: null,
          isManual: true,
          criminalCase: {
            create: detailData as Prisma.CriminalCaseCreateWithoutCaseInput,
          },
        },
      });

      if (parsedCaseNumber) {
        await syncCaseCounterToAtLeast(
          tx,
          CaseType.CRIMINAL,
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
    console.error("Error creating criminal case:", error);
    return { success: false, error: "Error creating criminal case" };
  }
}

export async function getCriminalCaseNumberPreview(
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

    const updatedCase = await prisma.$transaction(async (tx) => {
      const caseUpdateData: Prisma.CaseUpdateInput = {
        ...casePayload,
        caseType: CaseType.CRIMINAL,
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

      await tx.criminalCase.upsert({
        where: { baseCaseID: caseId },
        update: detailData,
        create: {
          ...(detailData as Prisma.CriminalCaseCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      });

      if (parsedCaseNumber) {
        await syncCaseCounterToAtLeast(
          tx,
          CaseType.CRIMINAL,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
          parsedCaseNumber.number,
        );
      }

      return tx.case.findUnique({
        where: { id: caseId },
        include: { criminalCase: true },
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
