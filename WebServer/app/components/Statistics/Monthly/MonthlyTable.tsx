"use client";

import React, { useMemo } from "react";
import type { MonthlyRow } from "./types";

interface MonthlyTableProps {
  data: MonthlyRow[];
}

const CATEGORY_BADGE: Record<string, { dot: string; bg: string }> = {
  "New Cases Filed": { dot: "bg-info", bg: "bg-info/10 text-info" },
  "Cases Disposed": { dot: "bg-success", bg: "bg-success/10 text-success" },
  "Pending Cases": { dot: "bg-warning", bg: "bg-warning/10 text-warning" },
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
    <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table table-sm w-full [&_th]:first:pl-6 [&_td]:first:pl-6">
          {/* ── Column widths ── */}
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[26%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>

          {/* ── Head ── */}
          <thead>
            <tr className="bg-base-300 text-base-content text-sm uppercase tracking-widest">
              <th className="py-4 px-5 text-left font-extrabold">Category</th>
              <th className="py-4 px-5 text-left font-extrabold">Branch</th>
              <th className="py-4 px-5 text-center font-extrabold">Criminal</th>
              <th className="py-4 px-5 text-center font-extrabold">Civil</th>
              <th className="py-4 px-5 text-center font-extrabold bg-base-content/5">
                Total
              </th>
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody className="divide-y divide-base-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-16 text-center text-base-content/40 text-base italic"
                >
                  No rows match your search.
                </td>
              </tr>
            ) : (
              Array.from(grouped.entries()).map(
                ([category, rows], groupIdx) => {
                  const badge = CATEGORY_BADGE[category] ?? {
                    dot: "bg-neutral",
                    bg: "bg-neutral/10 text-neutral",
                  };
                  return (
                    <React.Fragment key={category}>
                      {rows.map((row, rowIdx) => (
                        <tr
                          key={`${category}-${row.branch}`}
                          className={`transition-colors duration-100 hover:bg-primary/5 ${
                            groupIdx % 2 === 0
                              ? "bg-base-100"
                              : "bg-base-200/25"
                          }`}
                        >
                          {/* merged category cell */}
                          {rowIdx === 0 && (
                            <td
                              rowSpan={rows.length}
                              className="px-5 py-3 align-middle border-r border-base-200/60"
                            >
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${badge.bg}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${badge.dot}`}
                                />
                                {category}
                              </span>
                            </td>
                          )}
                          <td className="px-5 py-3 font-medium text-base text-base-content">
                            {row.branch}
                          </td>
                          <td className="px-5 py-3 text-center tabular-nums text-base">
                            {row.criminal.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-center tabular-nums text-base">
                            {row.civil.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-center tabular-nums text-base font-semibold bg-base-content/[0.02]">
                            {row.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}

                      {/* ── Category subtotal ── */}
                      <tr className="bg-base-200/60">
                        <td
                          colSpan={2}
                          className="px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-base-content/50"
                        >
                          Subtotal — {category}
                        </td>
                        <td className="px-5 py-2.5 text-center font-bold tabular-nums text-base text-base-content/80">
                          {rows
                            .reduce((s, r) => s + r.criminal, 0)
                            .toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-center font-bold tabular-nums text-base text-base-content/80">
                          {rows
                            .reduce((s, r) => s + r.civil, 0)
                            .toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-center font-extrabold tabular-nums text-base bg-base-300/40">
                          {rows
                            .reduce((s, r) => s + r.total, 0)
                            .toLocaleString()}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                },
              )
            )}

            {/* ── Grand total ── */}
            {data.length > 0 && (
              <tr className="bg-primary text-primary-content">
                <td
                  colSpan={2}
                  className="px-5 py-4 font-black text-sm uppercase tracking-widest"
                >
                  Grand Total
                </td>
                <td className="px-5 py-4 text-center font-black tabular-nums text-base">
                  {totals.criminal.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-center font-black tabular-nums text-base">
                  {totals.civil.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-center font-black tabular-nums text-base bg-primary-focus/20">
                  {totals.total.toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyTable;
