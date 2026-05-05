"use client";

import { Pagination } from "@rtc-database/shared";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_BADGE } from "./MonthlyUtils";
import type { MonthlyRow } from "./Schema";

const PAGE_SIZE = 10;

const COL_KEYS = ["category", "branch", "criminal", "civil", "total"] as const;

const DEFAULT_WIDTHS: Record<string, number> = {
  category: 160,
  branch: 140,
  criminal: 120,
  civil: 120,
  total: 120,
};

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
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    DEFAULT_WIDTHS,
  );
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const activeResize = useRef<{
    key: string;
    startX: number;
    startW: number;
    moved: boolean;
  } | null>(null);

  const MIN_COL_WIDTH = 64;

  const startResize = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = thRefs.current[key];
    if (!th) return;
    activeResize.current = {
      key,
      startX: e.clientX,
      startW: th.getBoundingClientRect().width,
      moved: false,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const active = activeResize.current;
      if (!active) return;
      const delta = e.clientX - active.startX;
      if (Math.abs(delta) < 2) return;
      active.moved = true;
      const next = Math.max(MIN_COL_WIDTH, Math.round(active.startW + delta));
      const th = thRefs.current[active.key];
      if (th) th.style.width = `${next}px`;
      const col = colRefs.current[active.key];
      if (col) col.style.width = `${next}px`;
    };
    const onUp = (e: MouseEvent) => {
      const active = activeResize.current;
      if (!active) return;
      if (!active.moved) {
        activeResize.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        return;
      }
      const delta = e.clientX - active.startX;
      const next = Math.max(MIN_COL_WIDTH, Math.round(active.startW + delta));
      setColWidths((prev) => ({ ...prev, [active.key]: next }));
      activeResize.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

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
        <table className="table table-fixed table-sm w-max min-w-full text-center">
          <colgroup>
            {isSelecting && <col style={{ width: 44 }} />}
            {COL_KEYS.map((key) => (
              <col
                key={key}
                ref={(node) => {
                  colRefs.current[key] = node;
                }}
                style={{ width: colWidths[key] }}
              />
            ))}
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
              <th
                className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 overflow-hidden relative"
                ref={(node) => {
                  thRefs.current["category"] = node;
                }}
                style={{ width: colWidths["category"] }}
              >
                <span className="block truncate">Category</span>
                <div
                  className="absolute right-0 top-0 h-full w-5 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "category")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
              <th
                className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 overflow-hidden relative"
                ref={(node) => {
                  thRefs.current["branch"] = node;
                }}
                style={{ width: colWidths["branch"] }}
              >
                <span className="block truncate">Branch</span>
                <div
                  className="absolute right-0 top-0 h-full w-5 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "branch")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
              <th
                className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 overflow-hidden relative"
                ref={(node) => {
                  thRefs.current["criminal"] = node;
                }}
                style={{ width: colWidths["criminal"] }}
              >
                <span className="block truncate">Criminal</span>
                <div
                  className="absolute right-0 top-0 h-full w-5 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "criminal")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
              <th
                className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 overflow-hidden relative"
                ref={(node) => {
                  thRefs.current["civil"] = node;
                }}
                style={{ width: colWidths["civil"] }}
              >
                <span className="block truncate">Civil</span>
                <div
                  className="absolute right-0 top-0 h-full w-5 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "civil")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
              <th
                className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 overflow-hidden relative"
                ref={(node) => {
                  thRefs.current["total"] = node;
                }}
                style={{ width: colWidths["total"] }}
              >
                <span className="block truncate">Total</span>
                <div
                  className="absolute right-0 top-0 h-full w-5 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "total")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
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
