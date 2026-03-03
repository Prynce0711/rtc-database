import React from "react";
import type { MonthlyRow } from "./Schema";

const asMonthly = (r: Record<string, unknown>) => r as unknown as MonthlyRow;

import { CATEGORY_BADGE } from "./MonthlyUtils";

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render: (row: Record<string, unknown>) => React.ReactNode;
}

export const monthlyColumns: ColumnDef[] = [
  {
    key: "category",
    label: "Category",
    sortable: true,
    align: "left",
    render: (r) => {
      const category = asMonthly(r).category;
      const badge = CATEGORY_BADGE[category] ?? {
        dot: "bg-neutral",
        bg: "bg-neutral/10 text-neutral",
      };
      return (
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${badge.bg}`}
        >
          <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
          {category || "—"}
        </span>
      );
    },
  },
  {
    key: "branch",
    label: "Branch",
    sortable: true,
    align: "left",
    render: (r) => asMonthly(r).branch || "—",
  },
  {
    key: "criminal",
    label: "Criminal",
    sortable: true,
    align: "center",
    render: (r) => asMonthly(r).criminal.toLocaleString(),
  },
  {
    key: "civil",
    label: "Civil",
    sortable: true,
    align: "center",
    render: (r) => asMonthly(r).civil.toLocaleString(),
  },
  {
    key: "total",
    label: "Total",
    sortable: true,
    align: "center",
    render: (r) => {
      const row = asMonthly(r);
      return (
        <span className="font-semibold">{row.total.toLocaleString()}</span>
      );
    },
  },
];
