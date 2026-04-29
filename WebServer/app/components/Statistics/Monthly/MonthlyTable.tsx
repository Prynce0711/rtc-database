"use client";

import { Pagination } from "@rtc-database/shared";
import React, { useMemo, useState } from "react";
import { CATEGORY_BADGE } from "./MonthlyUtils";
import type { MonthlyRow } from "./Schema";

const PAGE_SIZE = 10;

export type SelectionMode = "edit" | "delete" | null;

interface MonthlyTableProps {
  data: MonthlyRow[];
  selectionMode?: SelectionMode;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onToggleAll?: () => void;
}

const MonthlyTable: React.FC<MonthlyTableProps> = ({
  data,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}) => {
  const isSelecting = selectionMode != null;

  const [hoveredCell, setHoveredCell] = useState<{
    rowKey: string;
    col: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(data.length / PAGE_SIZE)),
    [data.length],
  );

  const effectiveCurrentPage = Math.min(currentPage, pageCount);

  const paginatedData = useMemo(() => {
    const start = (effectiveCurrentPage - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, effectiveCurrentPage]);

  const allSelected =
    isSelecting &&
    data.length > 0 &&
    data.every((r) => r.id != null && selectedIds?.has(r.id));

  const totals = useMemo(
    () => ({
      criminal: data.reduce((s, r) => s + r.criminal, 0),
      civil: data.reduce((s, r) => s + r.civil, 0),
      total: data.reduce((s, r) => s + r.total, 0),
    }),
    [data],
  );

  const renderTooltip = (
    label: string,
    value: React.ReactNode,
    rowKey: string,
    col: string,
    above: boolean,
  ) => {
    if (
      hoveredCell?.rowKey !== rowKey ||
      hoveredCell.col !== col ||
      isSelecting
    ) {
      return null;
    }

    return above ? (
      <div className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[min(220px,70vw)]">
        <div className="rounded-lg shadow-xl px-3 py-2.5 text-left bg-base-100 border border-base-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-0.5 truncate">
            {label}
          </p>
          <p className="text-sm font-semibold text-base-content wrap-break-word leading-snug">
            {value ?? "-"}
          </p>
          <p className="text-[11px] text-base-content/40 mt-1">
            click to view details
          </p>
        </div>
        <div
          className="mx-auto w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid var(--fallback-b1,oklch(var(--b1)))",
          }}
        />
      </div>
    ) : (
      <div className="pointer-events-none absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[min(220px,70vw)]">
        <div
          className="mx-auto w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "6px solid var(--fallback-b1,oklch(var(--b1)))",
          }}
        />
        <div className="rounded-lg shadow-xl px-3 py-2.5 text-left bg-base-100 border border-base-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-0.5 truncate">
            {label}
          </p>
          <p className="text-sm font-semibold text-base-content wrap-break-word leading-snug">
            {value ?? "-"}
          </p>
          <p className="text-[11px] text-base-content/40 mt-1">
            click to view details
          </p>
        </div>
      </div>
    );
  };

  let flatRowIdx = 0;

  return (
    <div
      className={`bg-base-100 rounded-xl overflow-hidden border border-base-200${
        isSelecting
          ? selectionMode === "delete"
            ? " ring-2 ring-error/30"
            : " ring-2 ring-info/30"
          : ""
      }`}
    >
      <div className="overflow-x-auto">
        <table className="table table-fixed table-sm w-full text-center">
          <colgroup>
            {isSelecting && <col className="w-10" />}
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>

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

          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={isSelecting ? 6 : 5}
                  className="py-16 text-center text-base-content/40 text-sm"
                >
                  No rows match your search.
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const currentFlatIdx = flatRowIdx++;
                const rowKey = `${row.category}-${row.branch}-${row.id ?? currentFlatIdx}`;
                const above = currentFlatIdx > 0;
                const badge = CATEGORY_BADGE[row.category] ?? {
                  bg: "bg-base-300/70 text-base-content/70",
                };
                return (
                  <tr
                    key={rowKey}
                    className={`border-b border-base-200/60 transition-colors hover:bg-base-200/30${
                      isSelecting && row.id != null && selectedIds?.has(row.id)
                        ? " bg-error/10!"
                        : ""
                    }`}
                    onClick={
                      isSelecting && row.id != null
                        ? () => onToggleSelect?.(row.id as number)
                        : undefined
                    }
                    style={isSelecting ? { cursor: "pointer" } : undefined}
                  >
                    {isSelecting && (
                      <td className="px-3 py-3 align-middle text-center">
                        <input
                          type="checkbox"
                          className={`checkbox checkbox-sm ${selectionMode === "delete" ? "checkbox-error" : "checkbox-info"}`}
                          checked={row.id != null && selectedIds?.has(row.id)}
                          onChange={() =>
                            row.id != null && onToggleSelect?.(row.id)
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3.5 align-middle text-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wide ${badge.bg}`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3.5 text-center text-sm font-medium uppercase text-base-content relative"
                      onMouseEnter={() =>
                        !isSelecting &&
                        setHoveredCell({ rowKey, col: "branch" })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {row.branch}
                      {renderTooltip(
                        "Branch",
                        row.branch,
                        rowKey,
                        "branch",
                        above,
                      )}
                    </td>
                    <td
                      className="px-4 py-3.5 text-center tabular-nums text-sm text-base-content/70 relative"
                      onMouseEnter={() =>
                        !isSelecting &&
                        setHoveredCell({ rowKey, col: "criminal" })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {row.criminal.toLocaleString()}
                      {renderTooltip(
                        "Criminal",
                        row.criminal.toLocaleString(),
                        rowKey,
                        "criminal",
                        above,
                      )}
                    </td>
                    <td
                      className="px-4 py-3.5 text-center tabular-nums text-sm text-base-content/70 relative"
                      onMouseEnter={() =>
                        !isSelecting && setHoveredCell({ rowKey, col: "civil" })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {row.civil.toLocaleString()}
                      {renderTooltip(
                        "Civil",
                        row.civil.toLocaleString(),
                        rowKey,
                        "civil",
                        above,
                      )}
                    </td>
                    <td
                      className="px-4 py-3.5 text-center tabular-nums text-sm font-semibold text-base-content relative"
                      onMouseEnter={() =>
                        !isSelecting && setHoveredCell({ rowKey, col: "total" })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {row.total.toLocaleString()}
                      {renderTooltip(
                        "Total",
                        row.total.toLocaleString(),
                        rowKey,
                        "total",
                        above,
                      )}
                    </td>
                  </tr>
                );
              })
            )}

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

      <div
        className="flex items-center justify-between p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-base-content/40">
          Showing page {effectiveCurrentPage} of {pageCount}
        </p>
        <Pagination
          pageCount={pageCount}
          currentPage={effectiveCurrentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
};

export default MonthlyTable;
