export type MonthlyRow = {
  /** Year-month string, e.g. "2026-02" */
  month: string;
  category: string;
  branch: string;
  criminal: number;
  civil: number;
  total: number;
};

/** Helper to get current month as YYYY-MM */
const currentMonth = new Date().toISOString().slice(0, 7);

/** Helper to get previous month as YYYY-MM */
function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

const prev = prevMonth(currentMonth);

export const SAMPLE_DATA: MonthlyRow[] = [
  // ── Current month ──
  {
    month: currentMonth,
    category: "New Cases Filed",
    branch: "RTC 1",
    criminal: 45,
    civil: 32,
    total: 77,
  },
  {
    month: currentMonth,
    category: "New Cases Filed",
    branch: "RTC 2",
    criminal: 38,
    civil: 28,
    total: 66,
  },
  {
    month: currentMonth,
    category: "New Cases Filed",
    branch: "RTC 3",
    criminal: 52,
    civil: 35,
    total: 87,
  },
  {
    month: currentMonth,
    category: "Cases Disposed",
    branch: "RTC 1",
    criminal: 40,
    civil: 30,
    total: 70,
  },
  {
    month: currentMonth,
    category: "Cases Disposed",
    branch: "RTC 2",
    criminal: 35,
    civil: 25,
    total: 60,
  },
  {
    month: currentMonth,
    category: "Cases Disposed",
    branch: "RTC 3",
    criminal: 48,
    civil: 32,
    total: 80,
  },
  {
    month: currentMonth,
    category: "Pending Cases",
    branch: "RTC 1",
    criminal: 125,
    civil: 98,
    total: 223,
  },
  {
    month: currentMonth,
    category: "Pending Cases",
    branch: "RTC 2",
    criminal: 110,
    civil: 85,
    total: 195,
  },
  {
    month: currentMonth,
    category: "Pending Cases",
    branch: "RTC 3",
    criminal: 142,
    civil: 105,
    total: 247,
  },

  // ── Previous month ──
  {
    month: prev,
    category: "New Cases Filed",
    branch: "RTC 1",
    criminal: 39,
    civil: 27,
    total: 66,
  },
  {
    month: prev,
    category: "New Cases Filed",
    branch: "RTC 2",
    criminal: 42,
    civil: 31,
    total: 73,
  },
  {
    month: prev,
    category: "New Cases Filed",
    branch: "RTC 3",
    criminal: 47,
    civil: 30,
    total: 77,
  },
  {
    month: prev,
    category: "Cases Disposed",
    branch: "RTC 1",
    criminal: 36,
    civil: 28,
    total: 64,
  },
  {
    month: prev,
    category: "Cases Disposed",
    branch: "RTC 2",
    criminal: 30,
    civil: 22,
    total: 52,
  },
  {
    month: prev,
    category: "Cases Disposed",
    branch: "RTC 3",
    criminal: 44,
    civil: 29,
    total: 73,
  },
  {
    month: prev,
    category: "Pending Cases",
    branch: "RTC 1",
    criminal: 130,
    civil: 100,
    total: 230,
  },
  {
    month: prev,
    category: "Pending Cases",
    branch: "RTC 2",
    criminal: 115,
    civil: 88,
    total: 203,
  },
  {
    month: prev,
    category: "Pending Cases",
    branch: "RTC 3",
    criminal: 148,
    civil: 110,
    total: 258,
  },
];
