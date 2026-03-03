export const CATEGORY_BADGE: Record<
  string,
  { dot: string; bg: string; ring?: string }
> = {
  "New Cases Filed": {
    dot: "bg-info",
    bg: "bg-info/10 text-info",
    ring: "ring-info/20",
  },
  "Cases Disposed": {
    dot: "bg-success",
    bg: "bg-success/10 text-success",
    ring: "ring-success/20",
  },
  "Pending Cases": {
    dot: "bg-warning",
    bg: "bg-warning/10 text-warning",
    ring: "ring-warning/20",
  },
};

export const toNumber = (v: unknown) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const sum = <T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T | string,
) => rows.reduce((s, r) => s + toNumber(r[key as keyof T]), 0);

export type MonthlyUtilsType = {
  CATEGORY_BADGE: typeof CATEGORY_BADGE;
  toNumber: (v: unknown) => number;
  sum: <T extends Record<string, unknown>>(
    rows: T[],
    key: keyof T | string,
  ) => number;
};

export const MonthlyUtils: MonthlyUtilsType = {
  CATEGORY_BADGE,
  toNumber,
  sum,
};

export default MonthlyUtils;
