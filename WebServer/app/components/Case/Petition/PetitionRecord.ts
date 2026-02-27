import { Petition } from "@/app/generated/prisma/client";

export interface PetitionStats {
  total: number;
  today: number;
  thisMonth: number;
  branches: number;
}

export const calculatePetitionStats = (
  petitions: Petition[],
): PetitionStats => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const toDateStr = (d: Date | string | null | undefined): string => {
    if (!d) return "";
    return typeof d === "string" ? d : d.toISOString();
  };

  return {
    total: petitions.length,
    today: petitions.filter((p) => {
      const dateStr = toDateStr(p.date);
      return dateStr.slice(0, 10) === today;
    }).length,
    thisMonth: petitions.filter((p) => {
      const dateStr = toDateStr(p.date);
      return dateStr.startsWith(thisMonth);
    }).length,
    branches: new Set(
      petitions.map((p) => p.raffledTo).filter((b) => b !== null),
    ).size,
  };
};

export const sortPetitions = (
  petitions: Petition[],
  sortBy: keyof Petition,
  order: "asc" | "desc",
): Petition[] => {
  return [...petitions].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
};
