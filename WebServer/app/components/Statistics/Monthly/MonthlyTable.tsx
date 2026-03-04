"use client";

import React, { useMemo } from "react";
import type { MonthlyRow } from "./Schema";

export type SelectionMode = "edit" | "delete" | null;

interface MonthlyTableProps {
  data: MonthlyRow[];
  onViewData?: () => void;
  selectionMode?: SelectionMode;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onToggleAll?: () => void;
}

import { CATEGORY_BADGE } from "./MonthlyUtils";

const MonthlyTable: React.FC<MonthlyTableProps> = ({
  data,
  onViewData,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}) => {
  const isSelecting = selectionMode != null;
  const allSelected =
    isSelecting &&
    data.length > 0 &&
    data.every((r) => r.id != null && selectedIds?.has(r.id));
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
    <div
      className={`bg-base-100 rounded-xl shadow-lg border border-base-300/50 overflow-hidden${
        isSelecting
          ? selectionMode === "delete"
            ? " ring-2 ring-error/30"
            : " ring-2 ring-info/30"
          : onViewData
            ? " cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            : ""
      }`}
      onClick={isSelecting ? undefined : onViewData}
      title={
        isSelecting
          ? undefined
          : onViewData
            ? "Click to view detailed report"
            : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="table table-sm w-full [&_th]:first:pl-6 [&_td]:first:pl-6">
          {/* ── Column widths ── */}
          <colgroup>
            {isSelecting && <col className="w-[40px]" />}
            <col className={isSelecting ? "w-[22%]" : "w-[24%]"} />
            <col className={isSelecting ? "w-[24%]" : "w-[26%]"} />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>

          {/* ── Head ── */}
          <thead>
            <tr className="bg-base-300 text-base-content text-sm uppercase tracking-widest">
              {isSelecting && (
                <th className="py-4 px-2 text-center">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allSelected}
                    onChange={onToggleAll}
                  />
                </th>
              )}
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
                  colSpan={isSelecting ? 6 : 5}
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
                          }${isSelecting && row.id != null && selectedIds?.has(row.id) ? (selectionMode === "delete" ? " !bg-error/10" : " !bg-info/10") : ""}`}
                          onClick={
                            isSelecting && row.id != null
                              ? () => onToggleSelect?.(row.id!)
                              : undefined
                          }
                          style={
                            isSelecting ? { cursor: "pointer" } : undefined
                          }
                        >
                          {/* checkbox cell */}
                          {isSelecting && rowIdx === 0 && (
                            <td
                              rowSpan={rows.length}
                              className="px-2 py-3 align-middle text-center"
                            >
                              {rows.map((r) => (
                                <div key={r.id ?? r.branch} className="py-1">
                                  <input
                                    type="checkbox"
                                    className={`checkbox checkbox-sm ${selectionMode === "delete" ? "checkbox-error" : "checkbox-info"}`}
                                    checked={
                                      r.id != null && selectedIds?.has(r.id)
                                    }
                                    onChange={() =>
                                      r.id != null && onToggleSelect?.(r.id)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              ))}
                            </td>
                          )}
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
                          <td className="px-5 py-3 text-center tabular-nums text-base font-semibold bg-base-content/2">
                            {row.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}

                      {/* ── Category subtotal ── */}
                      <tr className="bg-base-200/60">
                        <td
                          colSpan={isSelecting ? 3 : 2}
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
                  colSpan={isSelecting ? 3 : 2}
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
