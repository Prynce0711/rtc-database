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

const Table = <T extends Record<string, unknown>>({
  headers,
  data,
  renderRow,
  rowsPerPage = 10,
  initialPage = 1,
  showPagination = true,
  sortConfig,
  onSort,
  className,
}: TableProps<T>) => {
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
        <table className="table table-compact w-full">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`${h.className ?? ""} text-xl font-semibold ${h.align === "center" ? "text-center" : h.align === "right" ? "text-right" : "text-left"}`}
                >
                  {h.sortable ? (
                    <button
                      type="button"
                      className="flex items-center gap-2"
                      onClick={() => {
                        if (!onSort) return;
                        const key = h.sortKey ?? (h.key as keyof T);
                        onSort(key);
                      }}
                    >
                      <span>{h.label}</span>
                      {sortConfig?.key === (h.sortKey ?? h.key) ? (
                      <span className="text-xl font-semibold">{h.label}</span>
                      {sortConfig?.key === h.key ? (
                        <span>{sortConfig.order === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                    </button>
                  ) : (
                    <span className="text-xl font-semibold">{h.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-lx font-medium">
            {paginated.map((d, i) =>
              renderRow(d, (page - 1) * rowsPerPage + i),
            )}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="text-sm text-base-content/70">
            Showing{" "}
            <span className="font-semibold">
              {(page - 1) * rowsPerPage + 1}
            </span>{" "}
            -{" "}
            <span className="font-semibold">
              {Math.min(page * rowsPerPage, data.length)}
            </span>{" "}
            of <span className="font-semibold">{data.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-2">
              <button
                className="px-2 text-sm"
                onClick={() => gotoPage(page - 1)}
                disabled={page === 1}
              >
                Prev
              </button>

              {visiblePages.map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="px-2">
                    …
                  </span>
                ) : (
                  <button
                    key={`page-${p}`}
                    onClick={() => gotoPage(Number(p))}
                    className={`px-2 text-sm ${page === Number(p) ? "text-primary font-medium" : "text-primary/80 hover:underline"}`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                className="px-2 text-sm"
                onClick={() => gotoPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
