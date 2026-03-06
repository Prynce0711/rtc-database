"server-only";

import z from "zod";
import type {
  BaseCaseSchema as BaseCaseSchemaType,
  CriminalCaseSchema as CriminalCaseSchemaType,
} from "../components/Case/schema";
import { BaseCaseSchema } from "../components/Case/schema";
import { FilterOptions } from "../components/Filter/FilterUtils";
import { Prisma } from "../generated/prisma/client";
import { getSchemaFieldKeys } from "./utils";

export const DEFAULT_PAGE_SIZE = 25;

export const buildCaseWhere = <T extends z.ZodType>(
  schema: T,
  options?: FilterOptions<z.infer<T>>,
): Prisma.CaseWhereInput => {
  const conditions: Prisma.CaseWhereInput[] = [];
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};

  type Filters = FilterOptions<z.infer<T>>["filters"];

  const baseCaseFieldKeys = getSchemaFieldKeys(BaseCaseSchema, {
    all: ["id"],
  });

  const caseFieldKeys = getSchemaFieldKeys(schema, {
    all: ["id"],
    stringKeys: [...baseCaseFieldKeys.stringKeys],
    dateKeys: [...baseCaseFieldKeys.dateKeys],
  });

  conditions.push({ criminalCase: { isNot: null } });

  const addCaseStringFilter = (key: keyof Filters, value?: string) => {
    if (!value) return;
    const isExact = exactMatchMap[key] ?? true;
    const filter: Prisma.StringNullableFilter = {
      [isExact ? "equals" : "contains"]: value,
    };
    conditions.push({ [key]: filter } as Prisma.CaseWhereInput);
  };

  const addCriminalStringFilter = (key: keyof Filters, value?: string) => {
    if (!value) return;
    const isExact = exactMatchMap[key] ?? true;
    const filter: Prisma.StringNullableFilter = {
      [isExact ? "equals" : "contains"]: value,
    };
    conditions.push({
      criminalCase: {
        is: {
          [key]: filter,
        },
      },
    } as Prisma.CaseWhereInput);
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
    addCriminalStringFilter(
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
      criminalCase: {
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
      criminalCase: {
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
      criminalCase: {
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

  if (options?.searchTerm) {
    const search = options.searchTerm.trim();
    if (search.length > 0) {
      const orConditions: Prisma.CaseWhereInput[] = [
        ...baseCaseFieldKeys.stringKeys.map((field) => ({
          [field]: { contains: search },
        })),
        ...caseFieldKeys.stringKeys.map((field) => ({
          criminalCase: {
            is: {
              [field]: { contains: search },
            },
          },
        })),
      ];
      const asNumber = Number(search);
      if (!Number.isNaN(asNumber)) {
        orConditions.push({
          criminalCase: {
            is: {
              eqcNumber: asNumber,
            },
          },
        });
      }
      conditions.push({ OR: orConditions });
    }
  }

  if (conditions.length === 0) return {};
  return { AND: conditions };
};

type BaseCaseData = Omit<BaseCaseSchemaType, "id">;
type CriminalData = Prisma.CriminalCaseCreateWithoutCaseInput;

const baseCaseFieldKeys = getSchemaFieldKeys(BaseCaseSchema, { all: ["id"] });
const baseCaseKeySet = new Set([
  ...baseCaseFieldKeys.stringKeys,
  ...baseCaseFieldKeys.dateKeys,
  ...baseCaseFieldKeys.numberKeys,
  ...baseCaseFieldKeys.enumKeys,
]);

export const splitCaseData = <T>(
  data: CriminalCaseSchemaType,
): {
  caseData: BaseCaseData;
  criminalData: CriminalData;
} => {
  const { id: _id, ...rest } = data;
  const caseData: Record<string, unknown> = {};
  const criminalData: Record<string, unknown> = {};

  Object.entries(rest).forEach(([key, value]) => {
    if (baseCaseKeySet.has(key)) {
      caseData[key] = value;
    } else {
      criminalData[key] = value;
    }
  });

  return {
    caseData: caseData as BaseCaseData,
    criminalData: criminalData as CriminalData,
  };
};
