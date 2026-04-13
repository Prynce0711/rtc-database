"use server";

import {
  Case,
  CaseType,
  LogAction,
  Petition,
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
import { ActionResult, PaginatedResult } from "@rtc-database/shared";
import { prettifyError } from "zod";
import { createLog } from "../../ActivityLogs/LogActions";
import {
  PetitionCaseData,
  PetitionCasesFilterOptions,
  PetitionSchema,
} from "./schema";

export async function getPetitions(
  options?: PetitionCasesFilterOptions,
): Promise<ActionResult<PaginatedResult<PetitionCaseData>>> {
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

    const find = buildCaseFind(PetitionSchema, "petition", options);
    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : DEFAULT_PAGE_SIZE;

    const [cases, total] = await prisma.$transaction([
      prisma.case.findMany({
        where: find.where,
        orderBy: find.orderBy,
        skip,
        take,
        include: {
          petition: {
            // Omit the 'id' field from the included petition to avoid conflicts with the Case's 'id'
            omit: {
              id: true,
            },
          },
        },
      }),
      prisma.case.count({ where: find.where }),
    ]);

    const petitionCases: PetitionCaseData[] = cases
      .filter((c): c is Case & { petition: Petition } => !!c.petition)
      .map((c) => ({
        ...c.petition,
        ...c,
      }));

    return {
      success: true,
      result: {
        items: petitionCases,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching petitions:", error);
    return { success: false, error: "Error fetching petitions" };
  }
}

export async function createPetition(
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (data.id) {
      throw new Error("New petition case data should not include an id");
    }

    const normalized = {
      ...data,
      caseType: CaseType.PETITION,
      dateFiled: data.dateFiled ?? data.date ?? null,
      branch: data.branch ?? data.raffledTo ?? null,
      assistantBranch:
        data.assistantBranch ?? data.raffledToBranch ?? data.raffledTo ?? null,
    };

    const petitionData = PetitionSchema.safeParse(normalized);
    if (!petitionData.success) {
      throw new Error(
        `Invalid petition data: ${prettifyError(petitionData.error)}`,
      );
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      petitionData.data,
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
          CaseType.PETITION,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
        );

        return tx.case.create({
          data: {
            ...casePayload,
            caseType: CaseType.PETITION,
            caseNumber: next.caseNumber,
            number: next.number,
            area: next.area,
            year: next.year,
            isManual: false,
            petition: {
              create: detailData as Prisma.PetitionCreateWithoutCaseInput,
            },
          },
        });
      }

      const createdCase = await tx.case.create({
        data: {
          ...casePayload,
          caseType: CaseType.PETITION,
          caseNumber: rawCaseNumber,
          number: null,
          area: null,
          year: null,
          isManual: true,
          petition: {
            create: detailData as Prisma.PetitionCreateWithoutCaseInput,
          },
        },
      });

      if (parsedCaseNumber) {
        await syncCaseCounterToAtLeast(
          tx,
          CaseType.PETITION,
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
    console.error("Error creating petition:", error);
    return { success: false, error: "Error creating petition" };
  }
}

export async function getPetitionCaseNumberPreview(
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
          caseType: CaseType.PETITION,
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
    console.error("Error getting petition case number preview:", error);
    return { success: false, error: "Failed to get next case number" };
  }
}

export async function updatePetition(
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
      caseType: CaseType.PETITION,
      dateFiled: data.dateFiled ?? data.date ?? null,
      branch: data.branch ?? data.raffledTo ?? null,
      assistantBranch:
        data.assistantBranch ?? data.raffledToBranch ?? data.raffledTo ?? null,
    };

    const petitionData = PetitionSchema.safeParse(normalized);
    if (!petitionData.success) {
      throw new Error(
        `Invalid petition data: ${prettifyError(petitionData.error)}`,
      );
    }

    const { caseData: casePayload, detailData } = splitCaseDataBySchema(
      petitionData.data,
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

    if (casePayload.caseType && casePayload.caseType !== CaseType.PETITION) {
      throw new Error("Case type cannot be changed to non-petition");
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: { petition: true },
    });

    if (!originalCase || !originalCase.petition) {
      throw new Error("Petition not found");
    }

    const updatedCase = await prisma.$transaction(async (tx) => {
      const caseUpdateData: Prisma.CaseUpdateInput = {
        ...casePayload,
        caseType: CaseType.PETITION,
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

      await tx.petition.upsert({
        where: { baseCaseID: caseId },
        update: detailData,
        create: {
          ...(detailData as Prisma.PetitionCreateWithoutCaseInput),
          case: { connect: { id: caseId } },
        },
      });

      if (parsedCaseNumber) {
        await syncCaseCounterToAtLeast(
          tx,
          CaseType.PETITION,
          parsedCaseNumber.area,
          parsedCaseNumber.year,
          parsedCaseNumber.number,
        );
      }

      return tx.case.findUnique({
        where: { id: caseId },
        include: { petition: true },
      });
    });

    if (!updatedCase) {
      throw new Error("Failed to update petition");
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
    console.error("Error updating petition:", error);
    return { success: false, error: "Error updating petition" };
  }
}

export async function deletePetition(
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
    console.error("Error deleting petition:", error);
    return { success: false, error: "Error deleting petition" };
  }
}

export async function getPetitionById(
  id: number | string,
): Promise<ActionResult<PetitionCaseData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const result = await prisma.case.findUnique({
      where: { id: Number(id), petition: { isNot: null } },
      include: { petition: true },
    });

    if (!result || !result.petition) {
      return { success: false, error: "Petition not found" };
    }

    if (result.caseType !== CaseType.PETITION) {
      return { success: false, error: "Case is not a petition case" };
    }

    return {
      success: true,
      result: {
        ...result.petition,
        ...result,
      },
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch petition" };
  }
}

export async function getPetitionsByIds(
  ids: Array<number | string>,
): Promise<ActionResult<PetitionCaseData[]>> {
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

    const results = await prisma.case.findMany({
      where: {
        id: { in: validIds },
        petition: { isNot: null },
      },
      include: { petition: true },
    });

    const petitionCases: PetitionCaseData[] = results
      .filter((c): c is Case & { petition: Petition } => !!c.petition)
      .map((c) => ({
        ...c.petition,
        ...c,
      }));

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    petitionCases.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (petitionCases.length !== validIds.length) {
      return { success: false, error: "One or more petitions were not found" };
    }

    return { success: true, result: petitionCases };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch petitions" };
  }
}

export async function getPetitionByCaseNumber(
  caseNumber: string,
): Promise<ActionResult<PetitionCaseData>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await prisma.case.findFirst({
      where: { caseNumber, petition: { isNot: null } },
      orderBy: { id: "desc" },
      include: { petition: true },
    });

    if (!result || !result.petition) {
      return { success: false, error: "Petition not found" };
    }

    if (result.caseType !== CaseType.PETITION) {
      return { success: false, error: "Case is not a petition case" };
    }

    return {
      success: true,
      result: {
        ...result.petition,
        ...result,
      },
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch petition" };
  }
}
