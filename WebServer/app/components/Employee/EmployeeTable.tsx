"use client";

import Pagination from "@/app/components/Pagination/Pagination";
import TipCell from "@/app/components/Table/TipCell";
import type { Employee } from "@/app/generated/prisma/browser";
import {
  enumToText,
  formatDate,
  getAgeFromDate,
  isRetirementEligible,
} from "@/app/lib/utils";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import {
  FiEdit,
  FiEye,
  FiMoreHorizontal,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  employees: Employee[];
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
}

type SortKey =
  | keyof Pick<
      Employee,
      | "employeeName"
      | "employeeNumber"
      | "position"
      | "branch"
      | "birthDate"
      | "dateHired"
      | "employmentType"
      | "contactNumber"
      | "email"
    >
  | "age"
  | "yearsInService"
  | "retirementEligibility";

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
        "py-4 px-5 text-[13px] font-bold tracking-[0.05em] text-base-content/70 uppercase",
        "cursor-pointer select-none hover:text-base-content/80 transition-colors whitespace-nowrap",
        align === "left" ? "text-left" : "text-center",
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

  const getYearsInService = (
    dateHired?: Date | string | null,
  ): number | null => {
    if (!dateHired) return null;
    const hiredDate = new Date(dateHired);
    if (Number.isNaN(hiredDate.getTime())) return null;

    const today = new Date();
    let years = today.getFullYear() - hiredDate.getFullYear();
    const hasReachedHireAnniversary =
      today.getMonth() > hiredDate.getMonth() ||
      (today.getMonth() === hiredDate.getMonth() &&
        today.getDate() >= hiredDate.getDate());

    if (!hasReachedHireAnniversary) years -= 1;
    return Math.max(0, years);
  };

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
      if (sortKey === "age") {
        const aVal = getAgeFromDate(a.birthDate) ?? -1;
        const bVal = getAgeFromDate(b.birthDate) ?? -1;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortKey === "yearsInService") {
        const aVal = getYearsInService(a.dateHired) ?? -1;
        const bVal = getYearsInService(b.dateHired) ?? -1;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortKey === "retirementEligibility") {
        const aVal = isRetirementEligible(a.birthDate) ? 1 : 0;
        const bVal = isRetirementEligible(b.birthDate) ? 1 : 0;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortKey === "birthDate" || sortKey === "dateHired") {
        const aVal = a[sortKey] ? new Date(a[sortKey]).getTime() : 0;
        const bVal = b[sortKey] ? new Date(b[sortKey]).getTime() : 0;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aVal = (a[sortKey] ?? "") as string;
      const bVal = (b[sortKey] ?? "") as string;
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [employees, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));

  const page = Math.min(currentPage, totalPages);

  const paginated = useMemo(
    () => sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage),
    [sorted, page],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full bg-base-100 rounded-xl border border-base-200 overflow-hidden">
      {/* ── Table ─────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* HEADER */}
          <thead className="text-sm">
            <tr className="border-b border-base-200 bg-[#e6eef5] text-center">
              {/* Actions col — no sort */}
              <th className="py-4 px-5 font-bold uppercase text-[13px] text-base-content/70 text-center w-16">
                Actions
              </th>
              <SortTh
                label="Branch"
                colKey="branch"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Full Name"
                colKey="employeeName"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Position"
                colKey="position"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Employee Number"
                colKey="employeeNumber"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="center"
              />
              <SortTh
                label="Contact Number"
                colKey="contactNumber"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="center"
              />
              <SortTh
                label="Email Address"
                colKey="email"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Birthdate"
                colKey="birthDate"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Age"
                colKey="age"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="center"
              />
              <SortTh
                label="Date Hired"
                colKey="dateHired"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Employment"
                colKey="employmentType"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortTh
                label="Years in Service"
                colKey="yearsInService"
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="center"
              />
              <SortTh
                label="Retirement Eligibility"
                colKey="retirementEligibility"
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
                  colSpan={13}
                  className="text-center py-16 text-base-content/30 text-sm font-medium"
                >
                  <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                    <div className="flex items-center justify-center mb-4">
                      <FiUsers size={60} className="text-base-content/40" />
                    </div>
                    <p className="text-lg uppercase font-semibold text-base-content/50">
                      No employees found
                    </p>
                    <p className="text-sm uppercase mt-1 text-base-content/35">
                      There are no entries to display yet.
                    </p>
                  </div>
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

                  {/* Data cells with hover tooltip */}
                  <TipCell
                    label="Branch"
                    value={emp.branch}
                    className="py-4 px-5 text-base-content/80"
                    clickHint
                  />
                  <TipCell
                    label="Full Name"
                    value={emp.employeeName}
                    className="py-4 px-5 font-semibold text-base-content"
                    clickHint
                  />
                  <TipCell
                    label="Position"
                    value={emp.position}
                    className="py-4 px-5 text-base-content/80"
                    clickHint
                  />
                  <TipCell
                    label="Employee Number"
                    value={emp.employeeNumber}
                    className="py-4 px-5 text-center font-mono text-[13px] text-base-content/70"
                    clickHint
                  />
                  <TipCell
                    label="Contact Number"
                    value={emp.contactNumber}
                    className="py-4 px-5 text-center text-base-content/70"
                    clickHint
                  />
                  <TipCell
                    label="Email Address"
                    value={emp.email}
                    className="py-4 px-5 text-base-content/60"
                    truncate
                    clickHint
                  />
                  <TipCell
                    label="Birthdate"
                    value={formatDate(emp.birthDate)}
                    className="py-4 px-5 text-base-content/70"
                    clickHint
                  />
                  <TipCell
                    label="Age"
                    value={getAgeFromDate(emp.birthDate)}
                    className="py-4 px-5 text-center text-base-content/70"
                    clickHint
                  />
                  <TipCell
                    label="Date Hired"
                    value={formatDate(emp.dateHired)}
                    className="py-4 px-5 text-base-content/70"
                    clickHint
                  />
                  <TipCell
                    label="Employment"
                    value={
                      emp.employmentType
                        ? enumToText(emp.employmentType)
                        : undefined
                    }
                    className="py-4 px-5 text-base-content/80"
                    clickHint
                  />
                  <TipCell
                    label="Years in Service"
                    value={getYearsInService(emp.dateHired)}
                    className="py-4 px-5 text-center text-base-content/70"
                    clickHint
                  />
                  <TipCell
                    label="Retirement Eligibility"
                    value={
                      isRetirementEligible(emp.birthDate)
                        ? "Eligible"
                        : "Not Eligible"
                    }
                    className="py-4 px-5 text-base-content/80"
                    clickHint
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-3 px-5 py-4 border-t border-base-200">
        {/* Info */}

        {/* Page buttons (shared design) */}
        {totalPages > 1 && (
          <Pagination
            pageCount={totalPages}
            currentPage={page}
            onPageChange={setCurrentPage}
            className="w-full md:w-auto flex justify-center md:justify-end py-0"
          />
        )}
      </div>
    </div>
  );
};

export default EmployeeTable;
