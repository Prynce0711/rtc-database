import type { BaseCaseSchema as BaseCaseSchemaType } from "@rtc-database/shared";
import {
  BaseCaseSchema,
  FilterOptions,
  getSchemaFieldKeys,
} from "@rtc-database/shared";
import { Prisma } from "@rtc-database/shared/prisma/client";
import z from "zod";

export const DEFAULT_PAGE_SIZE = 25;

type CaseRelationKey =
  | "criminalCase"
  | "civilCase"
  | "petition"
  | "specialProceeding"
  | "sheriffCase";

export const buildCaseFind = <T extends z.ZodType>(
  schema: T,
  relationKey: CaseRelationKey,
  options?: FilterOptions<z.infer<T>>,
): {
  where?: Prisma.CaseWhereInput;
  orderBy?: Prisma.CaseOrderByWithRelationInput;
} => {
  const conditions: Prisma.CaseWhereInput[] = [];
  const sortBy: Prisma.CaseOrderByWithRelationInput = {};
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};

  const getSearchTokens = (value: string): string[] =>
    value
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

  type Filters = FilterOptions<z.infer<T>>["filters"];

  const baseCaseFieldKeys = getSchemaFieldKeys(BaseCaseSchema, {
    all: ["id"],
  });

  const caseFieldKeys = getSchemaFieldKeys(schema, {
    all: ["id"],
    stringKeys: [...baseCaseFieldKeys.stringKeys],
    dateKeys: [...baseCaseFieldKeys.dateKeys],
  });

  const isSortForBaseCaseField = baseCaseFieldKeys.allKeys.includes(
    options?.sortKey as string,
  );
  const isSortForRelatedCaseField = caseFieldKeys.allKeys.includes(
    options?.sortKey as string,
  );

  if (isSortForBaseCaseField) {
    sortBy[options?.sortKey as keyof Prisma.CaseOrderByWithRelationInput] =
      options?.sortOrder ?? "desc";
  } else if (isSortForRelatedCaseField) {
    sortBy[relationKey] = {
      [options?.sortKey as string]: options?.sortOrder ?? "desc",
    } as Prisma.CaseOrderByWithRelationInput[CaseRelationKey];
  }

  conditions.push({ [relationKey]: { isNot: null } });

  const addCaseStringFilter = (key: keyof Filters, value?: string) => {
    if (!value) return;
    const isExact = exactMatchMap[key] ?? false;

    if (isExact) {
      conditions.push({
        [key]: { equals: value },
      } as Prisma.CaseWhereInput);
      return;
    }

    const tokens = getSearchTokens(value);
    tokens.forEach((token) => {
      conditions.push({
        [key]: { contains: token },
      } as Prisma.CaseWhereInput);
    });
  };

  const addRelatedStringFilter = (key: keyof Filters, value?: string) => {
    if (!value) return;
    const isExact = exactMatchMap[key] ?? false;

    if (isExact) {
      conditions.push({
        [relationKey]: {
          is: {
            [key]: { equals: value },
          },
        },
      } as Prisma.CaseWhereInput);
      return;
    }

    const tokens = getSearchTokens(value);
    tokens.forEach((token) => {
      conditions.push({
        [relationKey]: {
          is: {
            [key]: { contains: token },
          },
        },
      } as Prisma.CaseWhereInput);
    });
  };

  baseCaseFieldKeys.stringKeys.forEach((field) => {
    const value = filters?.[field as keyof Filters];
    addCaseStringFilter(
      field as keyof Filters,
      typeof value === "string" ? value : undefined,
    );
  });

  caseFieldKeys.stringKeys.forEach((field) => {
    const value = filters?.[field as keyof Filters];
    addRelatedStringFilter(
      field as keyof Filters,
      typeof value === "string" ? value : undefined,
    );
  });

  baseCaseFieldKeys.enumKeys.forEach((field) => {
    const value = filters?.[field as keyof Filters];
    if (!value) return;
    conditions.push({ [field]: value } as Prisma.CaseWhereInput);
  });

  caseFieldKeys.enumKeys.forEach((field) => {
    const value = filters?.[field as keyof Filters];
    if (!value) return;
    conditions.push({
      [relationKey]: {
        is: {
          [field]: value,
        },
      },
    } as Prisma.CaseWhereInput);
  });

  caseFieldKeys.numberKeys.forEach((field) => {
    const value = filters?.[field as keyof Filters];
    if (value === undefined || value === null) return;
    conditions.push({
      [relationKey]: {
        is: {
          [field]: value,
        },
      },
    } as Prisma.CaseWhereInput);
  });

  baseCaseFieldKeys.dateKeys.forEach((field) => {
    const range = filters?.[field as keyof Filters] as
      | { start?: string; end?: string }
      | undefined;
    if (!range?.start && !range?.end) return;
    conditions.push({
      [field]: {
        gte: range.start ? new Date(range.start) : undefined,
        lte: range.end ? new Date(range.end) : undefined,
      },
    } as Prisma.CaseWhereInput);
  });

  caseFieldKeys.dateKeys.forEach((field) => {
    const range = filters?.[field as keyof Filters] as
      | { start?: string; end?: string }
      | undefined;
    if (!range?.start && !range?.end) return;
    conditions.push({
      [relationKey]: {
        is: {
          [field]: {
            not: null,
            gte: range.start ? new Date(range.start) : undefined,
            lte: range.end ? new Date(range.end) : undefined,
          },
        },
      },
    } as Prisma.CaseWhereInput);
  });

  if (conditions.length === 0) return {};
  return { where: { AND: conditions }, orderBy: sortBy };
};

type BaseCaseData = Omit<BaseCaseSchemaType, "id">;

const baseCaseFieldKeys = getSchemaFieldKeys(BaseCaseSchema, { all: ["id"] });
const baseCaseKeySet = new Set([
  ...baseCaseFieldKeys.stringKeys,
  ...baseCaseFieldKeys.dateKeys,
  ...baseCaseFieldKeys.numberKeys,
  ...baseCaseFieldKeys.enumKeys,
]);

export const splitCaseDataBySchema = <T extends Record<string, unknown>>(
  data: T,
): {
  caseData: BaseCaseData;
  detailData: Record<string, unknown>;
} => {
  const { id: _id, ...rest } = data;
  const caseData: Record<string, unknown> = {};
  const detailData: Record<string, unknown> = {};

  Object.entries(rest).forEach(([key, value]) => {
    if (baseCaseKeySet.has(key)) {
      caseData[key] = value;
    } else {
      detailData[key] = value;
    }
  });

  return {
    caseData: caseData as BaseCaseData,
    detailData,
  };
};

export function test() {
  return "Prisma helper function is working!";
}
