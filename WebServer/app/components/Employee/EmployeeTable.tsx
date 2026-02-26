"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  employees: Employee[];
  bloodTypeMap: Record<string, string>;
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
}

type SortKey = keyof Pick<
  Employee,
  | "employeeName"
  | "employeeNumber"
  | "position"
  | "branch"
  | "contactNumber"
  | "email"
>;

type SortOrder = "asc" | "desc";

// ─── Sort Header ──────────────────────────────────────────────────────────────
const SortTh = ({
  label,
  colKey,
  sortKey,
  sortOrder,
  onSort,
  align = "center",
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSort: (k: SortKey) => void;
  align?: "left" | "center";
}) => {
  const isActive = sortKey === colKey;
  return (
    <th
      onClick={() => onSort(colKey)}
      className={[
        "py-4 px-5 text-[13px] font-bold tracking-[0.05em] text-base-content/70 uppercase bg-base-200",
        "cursor-pointer select-none hover:text-base-content/80 transition-colors whitespace-nowrap",
        "text-center",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <span className="text-primary text-xs">
            {sortOrder === "asc" ? "↑" : "↓"}
          </span>
        ) : (
          <span className="opacity-25 text-xs">↕</span>
        )}
      </span>
    </th>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const EmployeeTable: React.FC<Props> = ({ employees, onEdit, onDelete }) => {
  const router = useRouter();

  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("employeeName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const sorted = useMemo(() => {
    return [...employees].sort((a, b) => {
      const aVal = (a[sortKey] ?? "") as string;
      const bVal = (b[sortKey] ?? "") as string;
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [employees, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const paginated = useMemo(
    () =>
      sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [sorted, currentPage],
  );

  // ── Visible page numbers ───────────────────────────────────────────────────
  const visiblePages = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1, 2);
    let left = Math.max(3, currentPage - 1);
    let right = Math.min(totalPages - 2, currentPage + 1);
    if (left > 3) pages.push("...");
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < totalPages - 2) pages.push("...");
    pages.push(totalPages - 1, totalPages);
    return pages;
  }, [currentPage, totalPages]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full bg-base-100 rounded-xl border border-base-200 overflow-hidden">
      {/* ── Table ─────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* HEADER */}
          <thead className="text-sm">
            <tr className="border-b border-base-200 bg-base-100 text-center">
              {/* Actions col — no sort */}
              <th className="py-4 px-5 font-bold uppercase text-[13px] text-base-content/70 text-center w-16 bg-base-200">
                Actions
              </th>
              <SortTh
                label="Employee Name"
                colKey="employeeName"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Employee #"
                colKey="employeeNumber"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="center"
              />
              <SortTh
                label="Position"
                colKey="position"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Branch"
                colKey="branch"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Contact No"
                colKey="contactNumber"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="center"
              />
              <SortTh
                label="Email"
                colKey="email"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-16 text-base-content/30 text-sm font-medium"
                >
                  No employees found.
                </td>
              </tr>
            ) : (
              paginated.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                  className="border-b border-base-200 last:border-0 hover:bg-base-200/50 transition-colors duration-100 cursor-pointer text-center"
                >
                  {/* ACTIONS */}
                  <td
                    className="py-4 px-5 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-center">
                      <div className="dropdown dropdown-start">
                        <button
                          tabIndex={0}
                          className="btn btn-ghost btn-xs px-2 text-base-content/40 hover:text-base-content"
                          aria-label="Open actions"
                        >
                          <FiMoreHorizontal size={16} />
                        </button>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-xl w-44 border border-base-200"
                          style={{ zIndex: 9999 }}
                        >
                          <li>
                            <button
                              className="flex items-center gap-3 text-info text-sm py-2"
                              onClick={() =>
                                router.push(`/user/employees/${emp.id}`)
                              }
                            >
                              <FiEye size={14} />
                              View
                            </button>
                          </li>
                          <li>
                            <button
                              className="flex items-center gap-3 text-warning text-sm py-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(emp);
                              }}
                            >
                              <FiEdit size={14} />
                              Edit
                            </button>
                          </li>
                          <li>
                            <button
                              className="flex items-center gap-3 text-error text-sm py-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(emp.id);
                              }}
                            >
                              <FiTrash2 size={14} />
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </td>

                  {/* Data cells */}
                  <td className="py-4 px-5 font-semibold text-base-content">
                    {emp.employeeName || "—"}
                  </td>
                  <td className="py-4 px-5 text-center font-mono text-[13px] text-base-content/70">
                    {emp.employeeNumber || "—"}
                  </td>
                  <td className="py-4 px-5 text-base-content/80">
                    {emp.position || "—"}
                  </td>
                  <td className="py-4 px-5 text-base-content/80">
                    {emp.branch || "—"}
                  </td>
                  <td className="py-4 px-5 text-center text-base-content/70">
                    {emp.contactNumber || "—"}
                  </td>
                  <td className="py-4 px-5 text-base-content/60">
                    {emp.email || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-base-200">
        {/* Info */}
        <p className="text-[13px] text-base-content/40 font-medium">
          Showing{" "}
          <span className="font-semibold text-base-content/60">
            {Math.min((currentPage - 1) * rowsPerPage + 1, sorted.length)}
          </span>{" "}
          –{" "}
          <span className="font-semibold text-base-content/60">
            {Math.min(currentPage * rowsPerPage, sorted.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-base-content/60">
            {sorted.length}
          </span>
        </p>

        {/* Page buttons */}
        {totalPages > 1 && (
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-base-content/40 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              Prev
            </button>

            {visiblePages.map((p, idx) =>
              p === "..." ? (
                <span
                  key={`dots-${idx}`}
                  className="px-2 text-[13px] text-base-content/25"
                >
                  …
                </span>
              ) : (
                <button
                  key={`page-${p}`}
                  onClick={() => setCurrentPage(Number(p))}
                  className={[
                    "w-8 h-8 rounded-lg text-[13px] font-semibold transition-all",
                    currentPage === Number(p)
                      ? "bg-primary text-primary-content"
                      : "text-base-content/50 hover:text-base-content hover:bg-base-200",
                  ].join(" ")}
                >
                  {p}
                </button>
              ),
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold text-base-content/40 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default EmployeeTable;
