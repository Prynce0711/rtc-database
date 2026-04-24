"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { FiInbox } from "react-icons/fi";
import Pagination from "./Pagination";
import { TableInteractionContext } from "./TableContext";

type Header<T extends Record<string, unknown>> = {
  key: string;
  label: React.ReactNode;
  sortable?: boolean;
  sortKey?: keyof T;
  className?: string;
  align?: "left" | "center" | "right";
};

type SortConfig<T extends Record<string, unknown>> = {
  key: keyof T;
  order: "asc" | "desc";
} | null;

type TableProps<T extends Record<string, unknown>> = {
  headers: Header<T>[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  rowsPerPage?: number;
  initialPage?: number;
  showPagination?: boolean;
  sortConfig?: SortConfig<T>;
  onSort?: (key: keyof T) => void;
  className?: string;
  resizableColumns?: boolean;
  minColumnWidth?: number;
  disableCellTooltips?: boolean;
};

type ActiveResizeState = {
  key: string;
  startX: number;
  startWidth: number;
};

function Table<T extends Record<string, unknown>>({
  headers,
  data,
  renderRow,
  rowsPerPage = 10,
  initialPage = 1,
  showPagination = true,
  sortConfig,
  onSort,
  className,
  resizableColumns = true,
  minColumnWidth = 120,
  disableCellTooltips,
}: TableProps<T>) {
  const [page, setPage] = useState(initialPage);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(
    null,
  );
  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const tableRef = useRef<HTMLTableElement | null>(null);
  const activeResizeRef = useRef<ActiveResizeState | null>(null);
  const liveResizeWidthRef = useRef<number | null>(null);
  const effectiveMinColumnWidth = Math.max(72, minColumnWidth);
  const effectiveDisableCellTooltips = disableCellTooltips ?? resizableColumns;
  const hasAllColumnWidths = useMemo(
    () => headers.every((h) => typeof columnWidths[h.key] === "number"),
    [columnWidths, headers],
  );

  useEffect(() => {
    if (!resizableColumns) return;

    const missingHeaders = headers.filter((h) => typeof columnWidths[h.key] !== "number");
    if (missingHeaders.length === 0) return;

    const measuredWidths: Record<string, number> = {};
    let hasMeasurements = false;

    const tableEl = tableRef.current;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (typeof columnWidths[header.key] === "number") continue;

      const headerCell = headerRefs.current[header.key];
      let best = 0;

      if (headerCell) {
        best = Math.round(headerCell.getBoundingClientRect().width);
      }

      if (tableEl) {
        const bodyRows = tableEl.querySelectorAll("tbody tr");
        for (const row of Array.from(bodyRows)) {
          const tds = row.querySelectorAll("td");
          const td = tds[i] as HTMLTableCellElement | undefined;
          if (!td || td.colSpan > 1) continue;
          const w = Math.round(td.getBoundingClientRect().width);
          if (w > best) best = w;
        }
      }

      if (best > 0) {
        measuredWidths[header.key] = Math.max(effectiveMinColumnWidth, best);
        hasMeasurements = true;
      }
    }

    if (!hasMeasurements) return;

    setColumnWidths((prev) => ({ ...prev, ...measuredWidths }));
  }, [columnWidths, effectiveMinColumnWidth, headers, resizableColumns]);

  const startResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, key: string) => {
      if (!resizableColumns) return;

      event.preventDefault();
      event.stopPropagation();

      const headerCell = headerRefs.current[key];
      if (!headerCell) return;

      activeResizeRef.current = {
        key,
        startX: event.clientX,
        startWidth: headerCell.getBoundingClientRect().width,
      };
      liveResizeWidthRef.current = null;

      setResizingColumnKey(key);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [resizableColumns],
  );

  useEffect(() => {
    if (!resizableColumns) return;

    const handleMouseMove = (event: MouseEvent) => {
      const active = activeResizeRef.current;
      if (!active) return;

      const nextWidth = Math.max(
        effectiveMinColumnWidth,
        Math.round(active.startWidth + (event.clientX - active.startX)),
      );

      liveResizeWidthRef.current = nextWidth;

      const headerCell = headerRefs.current[active.key];
      if (headerCell) {
        headerCell.style.width = `${nextWidth}px`;
      }

      const colCell = colRefs.current[active.key];
      if (colCell) {
        colCell.style.width = `${nextWidth}px`;
      }
    };

    const endResize = () => {
      const active = activeResizeRef.current;
      if (!active) return;

      const finalWidth = liveResizeWidthRef.current;
      if (finalWidth != null) {
        setColumnWidths((prev) =>
          prev[active.key] === finalWidth
            ? prev
            : { ...prev, [active.key]: finalWidth },
        );
      }

      activeResizeRef.current = null;
      liveResizeWidthRef.current = null;
      setResizingColumnKey(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [effectiveMinColumnWidth, resizableColumns]);

  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));

  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return data.slice(start, start + rowsPerPage);
  }, [data, page, rowsPerPage]);

  const gotoPage = (n: number) => {
    const p = Math.max(1, Math.min(totalPages, n));
    setPage(p);
  };

  return (
    <TableInteractionContext.Provider
      value={{ disableCellTooltips: effectiveDisableCellTooltips }}
    >
      <div className={`rounded-lg overflow-hidden ${className ?? ""}`}>
        <div className="overflow-x-auto overflow-y-visible">
          <table
            ref={(node) => {
              tableRef.current = node;
            }}
            data-rtc-system-table="true"
            className="table table-compact table-sm uppercase w-full text-center rtc-unified-table"
            style={
              resizableColumns
                ? hasAllColumnWidths
                  ? { tableLayout: "fixed" }
                  : undefined
                : undefined
            }
          >
            {resizableColumns && (
              <colgroup>
                {headers.map((h) => (
                  <col
                    key={h.key}
                    ref={(node) => {
                      colRefs.current[h.key] = node;
                    }}
                    style={
                      typeof columnWidths[h.key] === "number"
                        ? {
                            width: `${columnWidths[h.key]}px`,
                          }
                        : undefined
                    }
                  />
                ))}
              </colgroup>
            )}

            <thead className="text-sm">
              <tr className="bg-base-200/50 border-b border-base-200">
                {headers.map((h) => {
                  const alignClass =
                    h.align === "center"
                      ? "text-center"
                      : h.align === "right"
                        ? "text-right"
                        : "text-left";
                  const isActive =
                    !!sortConfig &&
                    sortConfig.key === (h.sortKey ?? (h.key as keyof T));

                  return (
                    <th
                      key={h.key}
                      ref={(node) => {
                        headerRefs.current[h.key] = node;
                      }}
                      style={
                        resizableColumns
                          ? {
                              width: columnWidths[h.key]
                                ? `${columnWidths[h.key]}px`
                                : undefined,
                              maxWidth: columnWidths[h.key]
                                ? `${columnWidths[h.key]}px`
                                : undefined,
                              minWidth: `${effectiveMinColumnWidth}px`,
                              overflow: "hidden",
                            }
                          : undefined
                      }
                      className={`py-4 px-4 ${resizableColumns ? "relative overflow-hidden" : ""} ${h.className ?? ""} ${alignClass} text-sm font-bold uppercase tracking-wider text-base-content/50 ${h.sortable ? "cursor-pointer select-none hover:bg-base-200/50 transition-colors" : ""}`}
                      onClick={() => {
                        if (!h.sortable || !onSort) return;
                        const key = h.sortKey ?? (h.key as keyof T);
                        onSort(key);
                      }}
                    >
                      <div
                        className={`flex w-full min-w-0 items-center gap-1 ${h.align === "center" ? "justify-center" : h.align === "right" ? "justify-end" : "justify-start"}`}
                      >
                        {typeof h.label === "string" ? (
                          <span className="font-bold text-sm min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">
                            {h.label}
                          </span>
                        ) : (
                          <span className="min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">
                            {h.label}
                          </span>
                        )}
                        {h.sortable &&
                          (isActive ? (
                            <span className="ml-1 shrink-0 text-primary">
                              {sortConfig?.order === "asc" ? "↑" : "↓"}
                            </span>
                          ) : (
                            <span className="opacity-30 ml-1 shrink-0">↕</span>
                          ))}
                      </div>

                      {resizableColumns && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          className={`absolute right-0 top-0 h-full w-5 cursor-col-resize select-none touch-none ${resizingColumnKey === h.key ? "bg-primary/10" : "hover:bg-primary/5"}`}
                          onMouseDown={(event) => startResize(event, h.key)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span
                            className={`absolute left-1/2 top-1/2 h-6 -translate-x-1/2 -translate-y-1/2 border-r ${resizingColumnKey === h.key ? "border-primary" : "border-base-content/25"}`}
                          />
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* BODY */}
            <tbody className="text-sm [&_td]:py-2 [&_td]:text-sm">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="py-16">
                    <div className="flex flex-col items-center justify-center py-12 text-base-content/40">
                      <FiInbox className="w-16 h-16 opacity-20 mb-4" />
                      <p className="text-lg font-semibold text-base-content/50 uppercase tracking-wide">
                        No records found
                      </p>
                      <p className="text-sm mt-2 text-base-content/35">
                        There are no entries to display yet.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((d, i) =>
                  renderRow(d, (page - 1) * rowsPerPage + i),
                )
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {showPagination && totalPages > 1 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-6">
            {/* Info */}
            <div className="text-sm text-base-content/70">
              Showing{" "}
              <span className="font-semibold">
                {(page - 1) * rowsPerPage + 1}
              </span>{" "}
              –{" "}
              <span className="font-semibold">
                {Math.min(page * rowsPerPage, data.length)}
              </span>{" "}
              of <span className="font-semibold">{data.length}</span>
            </div>

            {/* Controls */}
            <Pagination
              pageCount={totalPages}
              currentPage={page}
              onPageChange={gotoPage}
            />
          </div>
        )}
      </div>
    </TableInteractionContext.Provider>
  );
}

export default Table;
