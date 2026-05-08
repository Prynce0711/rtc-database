"use server";

import type {
  ActionResult,
  CivilCaseData,
  CriminalCaseData,
} from "@rtc-database/shared";
import { getCivilCases } from "../../Case/Civil/CivilActions";
import { getCriminalCases } from "../../Case/Criminal/CriminalCasesActions";
import type { MonthlyRow } from "./Schema";

type MonthlyCategory =
  | "New Cases Filed"
  | "Cases Disposed"
  | "Pending Cases";

type CountedCaseKind = "criminal" | "civil";
type PreviousRaffleDateSource = {
  previousRaffleDate?: Date | string | null;
};

const MONTHLY_CASE_PAGE_SIZE = 100000;
const CATEGORY_ORDER: MonthlyCategory[] = [
  "New Cases Filed",
  "Cases Disposed",
  "Pending Cases",
];

const isMonthValue = (month: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

const toMonthValue = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const parseMonthEnd = (month: string): Date => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new Error("Month must be in YYYY-MM format");
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;

  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    throw new Error("Invalid month");
  }

  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
};

const asDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeBranch = (value: unknown): string =>
  String(value ?? "").trim();

const getPreviousRaffleDate = (
  caseItem: unknown,
): Date | string | null | undefined =>
  (caseItem as PreviousRaffleDateSource).previousRaffleDate;

const compareBranch = (a: string, b: string): number => {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return a.localeCompare(b, undefined, { numeric: true });
};

const getCategoriesForCase = ({
  currentDate,
  dateFiled,
  previousRaffleDate,
  updatedRaffleDate,
  branch,
}: {
  currentDate: Date;
  dateFiled?: Date | string | null;
  previousRaffleDate?: Date | string | null;
  updatedRaffleDate?: Date | string | null;
  branch?: string | null;
}): MonthlyCategory[] => {
  const filed = asDate(dateFiled);
  if (filed && filed.getTime() > currentDate.getTime()) {
    return [];
  }

  const original =
    asDate(previousRaffleDate) ?? asDate(updatedRaffleDate) ?? filed;
  if (!original) {
    return [];
  }

  const updated = asDate(updatedRaffleDate) ?? original;
  const hasBranch = Boolean(normalizeBranch(branch));
  const currentTime = currentDate.getTime();
  const originalTime = original.getTime();
  const updatedTime = updated.getTime();
  const categories: MonthlyCategory[] = [];

  if (currentTime <= originalTime && !hasBranch) {
    categories.push("New Cases Filed");
  }

  if (
    (currentTime > originalTime && !hasBranch) ||
    (currentTime <= updatedTime && !hasBranch)
  ) {
    categories.push("Pending Cases");
  }

  if (
    (currentTime > originalTime && hasBranch) ||
    (currentTime > updatedTime && hasBranch)
  ) {
    categories.push("Cases Disposed");
  }

  return categories;
};

const buildLiveMonthlyRows = (
  month: string,
  criminalCases: CriminalCaseData[],
  civilCases: CivilCaseData[],
): Omit<MonthlyRow, "id">[] => {
  const currentDate = parseMonthEnd(month);
  const rowsByKey = new Map<string, Omit<MonthlyRow, "id">>();
  const countedCaseKeys = new Set<string>();

  const addCount = (
    category: MonthlyCategory,
    branch: string,
    kind: CountedCaseKind,
    caseId: string | number,
  ) => {
    const branchLabel = branch || "Unassigned";
    const countedKey = `${category}|${branchLabel}|${kind}|${caseId}`;
    if (countedCaseKeys.has(countedKey)) return;
    countedCaseKeys.add(countedKey);

    const key = `${category}|${branchLabel}`;
    const existing =
      rowsByKey.get(key) ??
      ({
        month,
        category,
        branch: branchLabel,
        criminal: 0,
        civil: 0,
        total: 0,
      } satisfies Omit<MonthlyRow, "id">);

    existing[kind] += 1;
    existing.total = existing.criminal + existing.civil;
    rowsByKey.set(key, existing);
  };

  criminalCases.forEach((caseItem) => {
    const branch = normalizeBranch(caseItem.branch);
    const categories = getCategoriesForCase({
      currentDate,
      dateFiled: caseItem.dateFiled,
      previousRaffleDate: getPreviousRaffleDate(caseItem),
      updatedRaffleDate: caseItem.raffleDate,
      branch,
    });

    categories.forEach((category) =>
      addCount(category, branch, "criminal", caseItem.id),
    );
  });

  civilCases.forEach((caseItem) => {
    const branch = normalizeBranch(caseItem.branch);
    const categories = getCategoriesForCase({
      currentDate,
      dateFiled: caseItem.dateFiled,
      previousRaffleDate: getPreviousRaffleDate(caseItem),
      updatedRaffleDate: caseItem.reRaffleDate,
      branch,
    });

    categories.forEach((category) =>
      addCount(category, branch, "civil", caseItem.id),
    );
  });

  return Array.from(rowsByKey.values()).sort((a, b) => {
    const categoryDiff =
      CATEGORY_ORDER.indexOf(a.category as MonthlyCategory) -
      CATEGORY_ORDER.indexOf(b.category as MonthlyCategory);
    return categoryDiff || compareBranch(a.branch, b.branch);
  });
};

const withRowIds = (rows: Omit<MonthlyRow, "id">[]): MonthlyRow[] =>
  rows.map((row, index) => ({
    id: index + 1,
    ...row,
  }));

const getMonthRangeFromCases = (
  criminalCases: CriminalCaseData[],
  civilCases: CivilCaseData[],
): string[] => {
  const now = new Date();
  const nowTime = now.getTime();
  let earliestTime: number | null = null;

  const collect = (value: Date | string | null | undefined) => {
    const date = asDate(value);
    if (!date) return;

    const time = date.getTime();
    if (time > nowTime) return;

    if (earliestTime === null || time < earliestTime) {
      earliestTime = time;
    }
  };

  criminalCases.forEach((caseItem) => {
    collect(caseItem.dateFiled);
    collect(getPreviousRaffleDate(caseItem));
    collect(caseItem.raffleDate);
  });

  civilCases.forEach((caseItem) => {
    collect(caseItem.dateFiled);
    collect(getPreviousRaffleDate(caseItem));
    collect(caseItem.reRaffleDate);
  });

  if (earliestTime === null) {
    return [toMonthValue(now)];
  }

  const months: string[] = [];
  const earliest = new Date(earliestTime);
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor.getTime() <= end.getTime()) {
    months.push(toMonthValue(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

const getMonthlyCases = async (): Promise<
  ActionResult<{
    criminalCases: CriminalCaseData[];
    civilCases: CivilCaseData[];
  }>
> => {
  const [criminalResult, civilResult] = await Promise.all([
    getCriminalCases({
      page: 1,
      pageSize: MONTHLY_CASE_PAGE_SIZE,
      sortKey: "dateFiled",
      sortOrder: "asc",
    }),
    getCivilCases({
      page: 1,
      pageSize: MONTHLY_CASE_PAGE_SIZE,
      sortKey: "dateFiled",
      sortOrder: "asc",
    }),
  ]);

  if (!criminalResult.success) {
    return { success: false, error: criminalResult.error };
  }

  if (!civilResult.success) {
    return { success: false, error: civilResult.error };
  }

  return {
    success: true,
    result: {
      criminalCases: criminalResult.result.items,
      civilCases: civilResult.result.items,
    },
  };
};

export async function getLiveMonthlyCaseStatistics(
  month: string,
): Promise<ActionResult<MonthlyRow[]>> {
  return getMonthlyStatistics(month);
}

export async function getMonthlyStatistics(
  month?: string,
): Promise<ActionResult<MonthlyRow[]>> {
  try {
    if (month && !isMonthValue(month)) {
      return { success: true, result: [] };
    }

    const casesResult = await getMonthlyCases();
    if (!casesResult.success) {
      return casesResult;
    }

    const { criminalCases, civilCases } = casesResult.result;
    const months = month
      ? [month]
      : getMonthRangeFromCases(criminalCases, civilCases).reverse();

    return {
      success: true,
      result: withRowIds(
        months.flatMap((monthValue) =>
          buildLiveMonthlyRows(monthValue, criminalCases, civilCases),
        ),
      ),
    };
  } catch (error) {
    console.error("Error calculating monthly statistics:", error);
    return {
      success: false,
      error: "Failed to calculate monthly statistics",
    };
  }
}
