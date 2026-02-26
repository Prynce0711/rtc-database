"use client";

import React, { useMemo, useState } from "react";

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
}: TableProps<T>) {
  const [page, setPage] = useState(initialPage);

  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));

  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return data.slice(start, start + rowsPerPage);
  }, [data, page, rowsPerPage]);

  const gotoPage = (n: number) => {
    const p = Math.max(1, Math.min(totalPages, n));
    setPage(p);
  };

  const visiblePages = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    pages.push(2);
    let left = page - 1;
    let right = page + 1;
    if (left <= 2) left = 3;
    if (right >= totalPages - 1) right = totalPages - 2;
    if (left > 3) pages.push("...");
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < totalPages - 2) pages.push("...");
    pages.push(totalPages - 1);
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="table table-compact uppercase table-zebra w-full text-center">
          <thead className="text-sm bg-base-300 rounded-lg shadow text-sm">
            <tr>
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
                    className={`${h.className ?? ""} ${alignClass} ${h.sortable ? "cursor-pointer select-none hover:bg-base-200 transition-colors" : ""}`}
                    onClick={() => {
                      if (!h.sortable || !onSort) return;
                      const key = h.sortKey ?? (h.key as keyof T);
                      onSort(key);
                    }}
                  >
                    <div
                      className={`flex w-full items-center ${h.align === "center" ? "justify-center" : h.align === "right" ? "justify-end" : "justify-start"}`}
                    >
                      <span className="font-bold text-sm">{h.label}</span>
                      {h.sortable &&
                        (isActive ? (
                          <span className="ml-1 text-primary">
                            {sortConfig?.order === "asc" ? "↑" : "↓"}
                          </span>
                        ) : (
                          <span className="opacity-30 ml-1">↕</span>
                        ))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* BODY */}
          <tbody className="text-sm [&_td]:py-2 [&_td]:text-sm">
            {paginated.map((d, i) =>
              renderRow(d, (page - 1) * rowsPerPage + i),
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
          <nav className="flex items-center gap-1">
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => gotoPage(page - 1)}
              disabled={page === 1}
            >
              Prev
            </button>

            {visiblePages.map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-2 text-sm opacity-50">
                  …
                </span>
              ) : (
                <button
                  key={`page-${p}`}
                  onClick={() => gotoPage(Number(p))}
                  className={`btn btn-xs ${
                    page === Number(p) ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {p}
                </button>
              ),
            )}

            <button
              className="btn btn-xs btn-ghost"
              onClick={() => gotoPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

export default Table;
