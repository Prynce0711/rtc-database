"use client";

import React, { useMemo } from "react";
import type { MonthlyRow } from "./types";

interface MonthlyTableProps {
  data: MonthlyRow[];
}

const CATEGORY_DOT_COLOR: Record<string, string> = {
  "New Cases Filed": "bg-info",
  "Cases Disposed": "bg-success",
  "Pending Cases": "bg-warning",
};

const MonthlyTable: React.FC<MonthlyTableProps> = ({ data }) => {
  const grouped = useMemo(() => {
    const map = new Map<string, MonthlyRow[]>();
    data.forEach((r) => {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    });
    return map;
  }, [data]);

  const totals = useMemo(
    () => ({
      criminal: data.reduce((s, r) => s + r.criminal, 0),
      civil: data.reduce((s, r) => s + r.civil, 0),
      total: data.reduce((s, r) => s + r.total, 0),
    }),
    [data],
  );

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* head */}
            <thead>
              <tr className="bg-primary text-primary-content text-xs uppercase tracking-wider">
                <th className="border border-primary/30 px-4 py-3.5 text-left font-bold">
                  Category
                </th>
                <th className="border border-primary/30 px-4 py-3.5 text-left font-bold">
                  Branch
                </th>
                <th className="border border-primary/30 px-4 py-3.5 text-center font-bold">
                  Criminal
                </th>
                <th className="border border-primary/30 px-4 py-3.5 text-center font-bold">
                  Civil
                </th>
                <th className="border border-primary/30 px-4 py-3.5 text-center font-bold bg-primary-focus/30">
                  Total
                </th>
              </tr>
            </thead>

            {/* body – grouped by category */}
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-base-content/50"
                  >
                    No rows match your search.
                  </td>
                </tr>
              ) : (
                Array.from(grouped.entries()).map(
                  ([category, rows], groupIdx) => (
                    <React.Fragment key={category}>
                      {rows.map((row, rowIdx) => (
                        <tr
                          key={`${category}-${row.branch}`}
                          className={`transition-colors hover:bg-base-200/70 ${
                            groupIdx % 2 === 0
                              ? "bg-base-100"
                              : "bg-base-200/30"
                          }`}
                        >
                          {/* merged category cell */}
                          {rowIdx === 0 && (
                            <td
                              rowSpan={rows.length}
                              className="border border-base-300 px-4 py-3 font-semibold text-base-content align-middle"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                    CATEGORY_DOT_COLOR[category] ?? "bg-neutral"
                                  }`}
                                />
                                {category}
                              </div>
                            </td>
                          )}
                          <td className="border border-base-300 px-4 py-2.5 font-medium">
                            {row.branch}
                          </td>
                          <td className="border border-base-300 px-4 py-2.5 text-center tabular-nums">
                            {row.criminal.toLocaleString()}
                          </td>
                          <td className="border border-base-300 px-4 py-2.5 text-center tabular-nums">
                            {row.civil.toLocaleString()}
                          </td>
                          <td className="border border-base-300 px-4 py-2.5 text-center tabular-nums font-semibold bg-base-200/50">
                            {row.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {/* category subtotal */}
                      <tr className="bg-base-300/60">
                        <td
                          colSpan={2}
                          className="border border-base-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-base-content/60"
                        >
                          Subtotal — {category}
                        </td>
                        <td className="border border-base-300 px-4 py-2 text-center font-bold tabular-nums text-sm">
                          {rows
                            .reduce((s, r) => s + r.criminal, 0)
                            .toLocaleString()}
                        </td>
                        <td className="border border-base-300 px-4 py-2 text-center font-bold tabular-nums text-sm">
                          {rows
                            .reduce((s, r) => s + r.civil, 0)
                            .toLocaleString()}
                        </td>
                        <td className="border border-base-300 px-4 py-2 text-center font-black tabular-nums text-sm bg-base-300/80">
                          {rows
                            .reduce((s, r) => s + r.total, 0)
                            .toLocaleString()}
                        </td>
                      </tr>
                    </React.Fragment>
                  ),
                )
              )}

              {/* grand total */}
              {data.length > 0 && (
                <tr className="bg-primary/10">
                  <td
                    colSpan={2}
                    className="border border-base-300 px-4 py-3.5 font-black text-base-content uppercase tracking-wide"
                  >
                    Grand Total
                  </td>
                  <td className="border border-base-300 px-4 py-3.5 text-center font-black tabular-nums text-base">
                    {totals.criminal.toLocaleString()}
                  </td>
                  <td className="border border-base-300 px-4 py-3.5 text-center font-black tabular-nums text-base">
                    {totals.civil.toLocaleString()}
                  </td>
                  <td className="border border-base-300 px-4 py-3.5 text-center font-black tabular-nums text-base bg-primary/20">
                    {totals.total.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyTable;
