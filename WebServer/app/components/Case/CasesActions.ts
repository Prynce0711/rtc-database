"use server";

import { Case, LogAction, Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../ActionResult";
import { createLog } from "../ActivityLogs/LogActions";
import { PaginatedResult } from "../Filter/FilterTypes";
import { CaseSchema } from "./schema";

export type CaseFilters = {
  branch?: string;
  assistantBranch?: string;
  caseNumber?: string;
  caseType?: string;
  name?: string;
  charge?: string;
  infoSheet?: string;
  court?: string;
  detained?: string;
  consolidation?: string;
  eqcNumber?: number;
  bond?: string;
  raffleDate?: { start?: string; end?: string };
  dateFiled?: { start?: string; end?: string };
  committee1?: string;
  committee2?: string;
  judge?: string;
  ao?: string;
  complainant?: string;
  houseNo?: string;
  street?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  counts?: string;
  jdf?: string;
  sajj?: string;
  sajj2?: string;
  mf?: string;
  stf?: string;
  lrf?: string;
  vcf?: string;
  total?: string;
  amountInvolved?: string;
};

export type CaseStats = {
  totalCases: number;
  detainedCases: number;
  pendingCases: number;
  recentlyFiled: number;
};

export type GetCasesOptions = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  filters?: CaseFilters;
  sortKey?: keyof Case;
  sortOrder?: "asc" | "desc";
  exactMatchMap?: Record<string, boolean>;
};

const DEFAULT_PAGE_SIZE = 25;

const stringFilterFields: (keyof CaseFilters)[] = [
  "branch",
  "assistantBranch",
  "caseNumber",
  "caseType",
  "name",
  "charge",
  "infoSheet",
  "court",
  "detained",
  "consolidation",
  "bond",
  "committee1",
  "committee2",
  "judge",
  "ao",
  "complainant",
  "houseNo",
  "street",
  "barangay",
  "municipality",
  "province",
  "counts",
  "jdf",
  "sajj",
  "sajj2",
  "mf",
  "stf",
  "lrf",
  "vcf",
  "total",
  "amountInvolved",
];

const searchableFields = [
  "branch",
  "assistantBranch",
  "caseNumber",
  "caseType",
  "name",
  "charge",
  "infoSheet",
  "court",
  "detained",
  "consolidation",
  "committee1",
  "committee2",
  "judge",
  "ao",
  "complainant",
  "houseNo",
  "street",
  "barangay",
  "municipality",
  "province",
  "counts",
  "jdf",
  "sajj",
  "sajj2",
  "mf",
  "stf",
  "lrf",
  "vcf",
  "total",
  "amountInvolved",
] as const;

const buildCaseWhere = (options?: GetCasesOptions): Prisma.CaseWhereInput => {
  const conditions: Prisma.CaseWhereInput[] = [];
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};

  const addStringFilter = (key: keyof CaseFilters, value?: string) => {
    if (!value) return;
    const isExact = exactMatchMap[key] ?? true;
    const filter: Prisma.StringNullableFilter = {
      [isExact ? "equals" : "contains"]: value,
    };
    conditions.push({ [key]: filter } as Prisma.CaseWhereInput);
  };

  stringFilterFields.forEach((field) => {
    const value = filters?.[field];
    addStringFilter(field, typeof value === "string" ? value : undefined);
  });

  if (filters?.eqcNumber !== undefined) {
    conditions.push({ eqcNumber: filters.eqcNumber } as Prisma.CaseWhereInput);
  }

  if (filters?.dateFiled?.start || filters?.dateFiled?.end) {
    conditions.push({
      dateFiled: {
        gte: filters.dateFiled.start
          ? new Date(filters.dateFiled.start)
          : undefined,
        lte: filters.dateFiled.end
          ? new Date(filters.dateFiled.end)
          : undefined,
      },
    });
  }

  if (filters?.raffleDate?.start || filters?.raffleDate?.end) {
    conditions.push({
      raffleDate: {
        not: null,
        gte: filters.raffleDate.start
          ? new Date(filters.raffleDate.start)
          : undefined,
        lte: filters.raffleDate.end
          ? new Date(filters.raffleDate.end)
          : undefined,
      },
    });
  }

  if (options?.searchTerm) {
    const search = options.searchTerm.trim();
    if (search.length > 0) {
      const orConditions = searchableFields.map((field) => ({
        [field]: { contains: search },
      })) as Prisma.CaseWhereInput[];
      const asNumber = Number(search);
      if (!Number.isNaN(asNumber)) {
        orConditions.push({ eqcNumber: asNumber });
      }
      conditions.push({ OR: orConditions });
    }
  }

  if (conditions.length === 0) return {};
  return { AND: conditions };
};

const normalizeCases = (cases: Case[]): Case[] => {
  return cases.map((c) => ({
    ...c,
    dateFiled: c.dateFiled,
    raffleDate: c.raffleDate ? c.raffleDate : null,
  }));
};

export async function getCases(
  options?: GetCasesOptions,
): Promise<ActionResult<PaginatedResult<Case>>> {
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

    const where = buildCaseWhere(options);

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
      }),
      prisma.case.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items: normalizeCases(cases),
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}

export async function getCaseStats(
  options?: GetCasesOptions,
): Promise<ActionResult<CaseStats>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const where = buildCaseWhere(options);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, detainedCount, pendingCount, recentCount] =
      await prisma.$transaction([
        prisma.case.count({ where }),
        prisma.case.count({
          where: {
            AND: [
              where,
              { detained: { not: null } },
              { detained: { not: "" } },
            ],
          },
        }),
        prisma.case.count({
          where: {
            AND: [where, { raffleDate: null }],
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

export async function createCase(
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

    const caseData = CaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const newCase = await prisma.case.create({
      data: caseData.data,
    });

    await createLog({
      action: LogAction.CREATE_CASE,
      details: {
        id: newCase.id,
      },
    });

    return { success: true, result: newCase };
  } catch (error) {
    console.error("Error creating case:", error);
    return { success: false, error: "Error creating case" };
  }
}

export async function updateCase(
  caseId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession([Roles.ATTY, Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const caseData = CaseSchema.safeParse(data);
    if (!caseData.success) {
      throw new Error(`Invalid case data: ${caseData.error.message}`);
    }

    const originalCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!originalCase) {
      throw new Error("Case not found");
    }
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: caseData.data,
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

export async function deleteCase(caseId: number): Promise<ActionResult<void>> {
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
    console.error("Error deleting case:", error);
    return { success: false, error: "Error deleting case" };
  }
}

export async function getCaseById(
  id: string | number,
): Promise<ActionResult<Case>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (isNaN(Number(id))) {
      return { success: false, error: "Invalid case ID" };
    }

    const result = await prisma.case.findUnique({
      where: { id: Number(id) },
    });

    if (!result) {
      return { success: false, error: "Case not found" };
    }

    return { success: true, result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Failed to fetch case" };
  }
}
