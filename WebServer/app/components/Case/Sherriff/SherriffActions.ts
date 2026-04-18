"use server";

import { validateSession } from "@/app/lib/authActions";
import {
  formatSheriffCaseNumber,
  getNextSheriffCaseNumber,
  parseSheriffCaseNumber,
  syncSheriffCaseCounterToAtLeast,
} from "@/app/lib/caseNumbering";
import { prisma } from "@/app/lib/prisma";
import {
  ActionResult,
  buildCaseFind,
  Case,
  CaseType,
  DEFAULT_PAGE_SIZE,
  LogAction,
  PaginatedResult,
  Prisma,
  SheriffCase,
  SheriffCaseData,
  SheriffCaseSchema,
  SheriffCasesFilterOptions,
  SheriffCaseStats,
  splitCaseDataBySchema,
} from "@rtc-database/shared";
import Roles from "@/app/lib/Roles";

import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";

export async function getSheriffCases(
  options?: SheriffCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<SheriffCaseData>>> {
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

    const find = buildCaseFind(SheriffCaseSchema, "sheriffCase", options);
    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : DEFAULT_PAGE_SIZE;

    const [cases, total] = await prisma.$transaction([
      prisma.case.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip,
        take,
        include: {
          sheriffCase: {
            omit: {
              id: true,
            },
          },
        },
      }),
      prisma.case.count({ where: find.where }),
    ]);

    const caseCombined: SheriffCaseData[] = cases
      .filter((c): c is Case & { sheriffCase: SheriffCase } => !!c.sheriffCase)
      .map((c) => ({
        ...c.sheriffCase,
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
    console.error("Error fetching sheriff cases:", error);
    return { success: false, error: "Error fetching sheriff cases" };
  }
}

export async function getSheriffCaseStats(
  options?: SheriffCasesFilterOptions,
): Promise<ActionResult<SheriffCaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const find = buildCaseFind(SheriffCaseSchema, "sheriffCase", options);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonthCount, todayCount, recentCount] =
      await prisma.$transaction([
        prisma.case.count({ where: find.where }),
        prisma.case.count({
          where: {
            AND: [find.where ?? {}, { dateFiled: { gte: monthStart } }],
          },
        }),
        prisma.case.count({
          where: {
            AND: [find.where ?? {}, { dateFiled: { gte: todayStart } }],
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
        thisMonthCases: thisMonthCount,
        todayCases: todayCount,
        recentlyFiled: recentCount,
      },
    };
  } catch (error) {
    console.error("Error fetching sheriff case stats:", error);
    return { success: false, error: "Error fetching sheriff case stats" };
  }
}

export async function createSheriffCase(
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

    // Strip branch fields - Sheriff cases do not have branches
    const { branch: _b, assistantBranch: _ab, ...cleanData } = data;

    const caseData = SheriffCaseSchema.safeParse(cleanData);
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

    const parsedCaseNumber = parseSheriffCaseNumber(rawCaseNumber);
    const hasManualSuffix = !!parsedCaseNumber?.tail;
    const isManual = requestedManual || hasManualSuffix;

    const newCase = await prisma.$transaction(async (tx) => {
      if (!isManual) {
        if (!parsedCaseNumber) {
          throw new Error(
            "Auto mode requires a case number pattern like 01-2026",
          );
        }

        const next = await getNextSheriffCaseNumber(tx, parsedCaseNumber.year);

        return tx.case.create({
          data: {
            ...casePayload,
            caseType: CaseType.SHERRIFF,
            caseNumber: next.caseNumber,
            number: next.number,
            area: null,
            year: next.year,
            isManual: false,
            sheriffCase: {
              create: detailData as Prisma.SheriffCaseCreateWithoutCaseInput,
            },
          },
        });
      }

      const createdCase = await tx.case.create({
        data: {
          ...casePayload,
          caseType: CaseType.SHERRIFF,
          caseNumber: rawCaseNumber,
          number: null,
          area: null,
          year: null,
          isManual: true,
          sheriffCase: {
            create: detailData as Prisma.SheriffCaseCreateWithoutCaseInput,
          },
        },
      });

      if (parsedCaseNumber) {
        await syncSheriffCaseCounterToAtLeast(
          tx,
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
    console.error("Error creating sheriff case:", error);
    return { success: false, error: "Error creating sheriff case" };
  }
}

export async function getSheriffCaseNumberPreview(
  year: number,
): Promise<ActionResult<{ caseNumber: string; nextNumber: number }>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!Number.isFinite(year)) {
      return { success: false, error: "Invalid year" };
    }

    const counter = await prisma.caseCounter.findUnique({
      where: {
        caseType_area_year: {
          caseType: CaseType.SHERRIFF,
          area: "",
          year,
        },
      },
    });

    const nextNumber = (counter?.last ?? 0) + 1;
    const caseNumber = formatSheriffCaseNumber(nextNumber, year);

    return {
      success: true,
      result: {
        caseNumber,
        nextNumber,
      },
    };
  } catch (error) {
    console.error("Error getting sheriff case number preview:", error);
    return { success: false, error: "Failed to get next case number" };
  }
}

export async function updateSheriffCase(
  caseId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    // Strip branch fields - Sheriff cases do not have branches
    const { branch: _b, assistantBranch: _ab, ...cleanData } = data;

    const caseData = SheriffCaseSchema.safeParse(cleanData);
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

    const parsedCaseNumber = parseSheriffCaseNumber(rawCaseNumber);
    const requestedManual =
      typeof cleanData.isManual === "boolean" ? cleanData.isManual : undefined;
    const hasManualSuffix = !!parsedCaseNumber?.tail;
    const inferredManual = hasManualSuffix || !parsedCaseNumber;
    const isManual = requestedManual ?? inferredManual;

    if (casePayload.caseType && casePayload.caseType !== CaseType.SHERRIFF) {
      throw new Error("Case type cannot be changed to non-sheriff");
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: { sheriffCase: true },
    });

    if (!originalCase) {
      throw new Error("Case not found");
    }

    const updatedCase = await prisma.$transaction(async (tx) => {
      const caseUpdateData: Prisma.CaseUpdateInput = {
        ...casePayload,
        caseType: CaseType.SHERRIFF,
      };

      if (!isManual && parsedCaseNumber) {
        caseUpdateData.caseNumber = formatSheriffCaseNumber(
          parsedCaseNumber.number,
          parsedCaseNumber.year,
        );
        caseUpdateData.number = parsedCaseNumber.number;
        caseUpdateData.area = null;
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

      await tx.sheriffCase.upsert({
        where: { baseCaseID: caseId },
        update: detailData,
        create: {
          ...(detailData as Prisma.SheriffCaseCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      });

      if (parsedCaseNumber) {
        await syncSheriffCaseCounterToAtLeast(
          tx,
          parsedCaseNumber.year,
          parsedCaseNumber.number,
        );
      }

      return tx.case.findUnique({
        where: { id: caseId },
        include: { sheriffCase: true },
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
    console.error("Error updating sheriff case:", error);
    return { success: false, error: "Error updating sheriff case" };
  }
}

export async function deleteSheriffCase(
  caseId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ARCHIVE, Roles.ADMIN]);
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
    console.error("Error deleting sheriff case:", error);
    return { success: false, error: "Error deleting sheriff case" };
  }
}

export async function getSheriffCaseById(
  id: string | number,
): Promise<ActionResult<SheriffCaseData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const sheriffCase = await prisma.case.findUnique({
      where: { id: Number(id), sheriffCase: { isNot: null } },
      include: {
        sheriffCase: {
          omit: {
            id: true,
          },
        },
      },
    });

    if (!sheriffCase) {
      return { success: false, error: "Case not found" };
    }

    if (
      sheriffCase.caseType !== CaseType.SHERRIFF ||
      !sheriffCase.sheriffCase
    ) {
      return { success: false, error: "Case is not a sheriff case" };
    }

    const caseCombined: SheriffCaseData = {
      ...sheriffCase.sheriffCase,
      ...sheriffCase,
    };

    return { success: true, result: caseCombined };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch case" };
  }
}

export async function getSheriffCasesByIds(
  ids: (string | number)[],
): Promise<ActionResult<SheriffCaseData[]>> {
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
        sheriffCase: { isNot: null },
      },
      include: {
        sheriffCase: {
          omit: {
            id: true,
          },
        },
      },
    });

    const caseCombined: SheriffCaseData[] = cases
      .filter((c): c is Case & { sheriffCase: SheriffCase } => !!c.sheriffCase)
      .map((c) => ({
        ...c.sheriffCase,
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
