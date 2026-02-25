// Shared utility functions for all Annual table variants

export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
};

export const extractTime = (date: Date | string | null | undefined): string => {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export function sortRecords<T extends Record<string, unknown>>(
  records: T[],
  key: keyof T,
  order: "asc" | "desc",
): T[] {
  return [...records].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

export interface AnnualStats {
  total: number;
  today: number;
  thisMonth: number;
}

export function calcStats(
  records: Record<string, unknown>[],
  dateKey: string,
): AnnualStats {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  return {
    total: records.length,
    today: records.filter((r) => {
      const d = r[dateKey];
      return d != null && String(d).slice(0, 10) === today;
    }).length,
    thisMonth: records.filter((r) => {
      const d = r[dateKey];
      return d != null && String(d).startsWith(thisMonth);
    }).length,
  };
}
