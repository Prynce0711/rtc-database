"use client";

import React, { useMemo } from "react";
import { CATEGORY_BADGE } from "./MonthlyUtils";
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
      className={`bg-base-100 rounded-xl overflow-hidden border border-base-200${
        isSelecting
          ? selectionMode === "delete"
            ? " ring-2 ring-error/30"
            : " ring-2 ring-info/30"
          : onViewData
            ? " cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
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
        <table className="table table-fixed table-sm w-full text-center">
          {/* ── Column widths ── */}
          <colgroup>
            {isSelecting && <col className="w-[40px]" />}
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>

          {/* ── Head ── */}
          <thead>
            <tr className="bg-base-200/50 border-b border-base-200">
              {isSelecting && (
                <th className="py-3.5 px-3 text-center text">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allSelected}
                    onChange={onToggleAll}
                  />
                </th>
              )}
              <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                Category
              </th>
              <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                Branch
              </th>
              <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                Criminal
              </th>
              <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                Civil
              </th>
              <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                Total
              </th>
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={isSelecting ? 6 : 5}
                  className="py-16 text-center text-base-content/40 text-sm"
                >
                  No rows match your search.
                </td>
              </tr>
            ) : (
              Array.from(grouped.entries()).map(([category, rows]) => {
                const badge = CATEGORY_BADGE[category] ?? {
                  bg: "bg-neutral/10 text-neutral",
                  ring: "ring-neutral/20",
                };
                return (
                  <React.Fragment key={category}>
                    {rows.map((row, rowIdx) => (
                      <tr
                        key={`${category}-${row.branch}`}
                        className={`border-b border-base-200/60 transition-colors hover:bg-base-200/30${
                          isSelecting &&
                          row.id != null &&
                          selectedIds?.has(row.id)
                            ? selectionMode === "delete"
                              ? " !bg-error/10"
                              : " !bg-info/10"
                            : ""
                        }`}
                        onClick={
                          isSelecting && row.id != null
                            ? () => onToggleSelect?.(row.id!)
                            : undefined
                        }
                        style={isSelecting ? { cursor: "pointer" } : undefined}
                      >
                        {/* checkbox cell */}
                        {isSelecting && rowIdx === 0 && (
                          <td
                            rowSpan={rows.length}
                            className="px-3 py-3 align-middle text-center"
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
                        {/* category cell */}
                        {rowIdx === 0 && (
                          <td
                            rowSpan={rows.length}
                            className="px-4 py-3.5 align-middle text-center"
                          >
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wide ${badge.bg}`}
                            >
                              {category}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-center text-sm font-medium uppercase text-base-content">
                          {row.branch}
                        </td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-sm text-base-content/70">
                          {row.criminal.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-sm text-base-content/70">
                          {row.civil.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-sm font-semibold text-base-content">
                          {row.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}

                    {/* ── Category subtotal ── */}
                    <tr className="bg-base-300/60 border-y border-base-300/80">
                      <td
                        colSpan={isSelecting ? 3 : 2}
                        className="px-6 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-base-content/60"
                      >
                        Subtotal — {category} :
                      </td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-sm text-base-content/80">
                        {rows
                          .reduce((s, r) => s + r.criminal, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-sm text-base-content/80">
                        {rows.reduce((s, r) => s + r.civil, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center font-extrabold tabular-nums text-sm text-base-content">
                        {rows.reduce((s, r) => s + r.total, 0).toLocaleString()}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}

            {/* ── Grand total ── */}
            {data.length > 0 && (
              <tr className="bg-primary/80 text-primary-content">
                <td
                  colSpan={isSelecting ? 3 : 2}
                  className="px-6 py-3.5 text-left font-black text-[15px] uppercase tracking-widest"
                >
                  Grand Total :
                </td>
                <td className="px-4 py-3.5 text-center font-black tabular-nums text-lg">
                  {totals.criminal.toLocaleString()}
                </td>
                <td className="px-4 py-3.5 text-center font-black tabular-nums text-lg">
                  {totals.civil.toLocaleString()}
                </td>
                <td className="px-4 py-3.5 text-center font-black tabular-nums text-2xl">
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
