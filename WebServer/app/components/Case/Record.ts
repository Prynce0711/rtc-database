import type { CriminalCaseData } from "./schema";

export interface CaseStats {
  totalCases: number;
  detainedCases: number;
  pendingCases: number;
  recentlyFiled: number;
}

export const calculateCaseStats = (cases: CriminalCaseData[]): CaseStats => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    totalCases: cases.length,
    detainedCases: cases.filter((c) => c.detained).length,
    pendingCases: cases.filter((c) => !c.raffleDate).length,
    recentlyFiled: cases.filter(
      (c) => c.dateFiled && new Date(c.dateFiled) >= thirtyDaysAgo,
    ).length,
  };
};

export const formatCaseForDisplay = (caseItem: CriminalCaseData) => {
  return {
    ...caseItem,
    dateFiled: caseItem.dateFiled
      ? new Date(caseItem.dateFiled).toLocaleDateString()
      : "—",
    raffleDate: caseItem.raffleDate
      ? new Date(caseItem.raffleDate).toLocaleDateString()
      : "Not scheduled",
    bond: caseItem.bond || "—",
    detained: caseItem.detained ? "Yes" : "No",
  };
};

export const sortCases = (
  cases: CriminalCaseData[],
  sortBy: keyof CriminalCaseData,
  order: "asc" | "desc",
): CriminalCaseData[] => {
  return [...cases].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
};
