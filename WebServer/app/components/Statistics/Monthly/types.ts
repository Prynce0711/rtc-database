export type MonthlyRow = {
  category: string;
  branch: string;
  criminal: number;
  civil: number;
  total: number;
};

export const SAMPLE_DATA: MonthlyRow[] = [
  {
    category: "New Cases Filed",
    branch: "RTC 1",
    criminal: 45,
    civil: 32,
    total: 77,
  },
  {
    category: "New Cases Filed",
    branch: "RTC 2",
    criminal: 38,
    civil: 28,
    total: 66,
  },
  {
    category: "New Cases Filed",
    branch: "RTC 3",
    criminal: 52,
    civil: 35,
    total: 87,
  },
  {
    category: "Cases Disposed",
    branch: "RTC 1",
    criminal: 40,
    civil: 30,
    total: 70,
  },
  {
    category: "Cases Disposed",
    branch: "RTC 2",
    criminal: 35,
    civil: 25,
    total: 60,
  },
  {
    category: "Cases Disposed",
    branch: "RTC 3",
    criminal: 48,
    civil: 32,
    total: 80,
  },
  {
    category: "Pending Cases",
    branch: "RTC 1",
    criminal: 125,
    civil: 98,
    total: 223,
  },
  {
    category: "Pending Cases",
    branch: "RTC 2",
    criminal: 110,
    civil: 85,
    total: 195,
  },
  {
    category: "Pending Cases",
    branch: "RTC 3",
    criminal: 142,
    civil: 105,
    total: 247,
  },
];
