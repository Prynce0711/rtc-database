"use client";

import {
    ActionDropdown,
    Table,
    TipCell,
    enumToText,
    formatDate,
    getAgeFromDate,
    isRetirementEligible,
} from "@rtc-database/shared";
import type { Employee } from "@rtc-database/shared/prisma/browser";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  employees: Employee[];
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
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
  | "ageSort"
  | "yearsInServiceSort"
  | "retirementSort";

type SortOrder = "asc" | "desc";

type EmployeeRow = Employee & {
  ageSort: number;
  yearsInServiceSort: number;
  retirementSort: number;
};

// ─── Component ────────────────────────────────────────────────────────────────
const EmployeeTable: React.FC<Props> = ({
  employees,
  onEdit,
  onDelete,
  selectedIds = [],
  onToggleSelect,
}) => {
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

  const [sortKey, setSortKey] = useState<SortKey>("employeeName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const rows = useMemo<EmployeeRow[]>(
    () =>
      employees.map((employee) => ({
        ...employee,
        ageSort: getAgeFromDate(employee.birthDate) ?? -1,
        yearsInServiceSort: getYearsInService(employee.dateHired) ?? -1,
        retirementSort: isRetirementEligible(employee.birthDate) ? 1 : 0,
      })),
    [employees],
  );

  const sorted = useMemo(() => {
    const direction = sortOrder === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      if (
        sortKey === "ageSort" ||
        sortKey === "yearsInServiceSort" ||
        sortKey === "retirementSort"
      ) {
        return direction * (a[sortKey] - b[sortKey]);
      }

      if (sortKey === "birthDate" || sortKey === "dateHired") {
        const aVal = a[sortKey] ? new Date(a[sortKey]).getTime() : 0;
        const bVal = b[sortKey] ? new Date(b[sortKey]).getTime() : 0;
        return direction * (aVal - bVal);
      }

      const aVal = (a[sortKey] ?? "") as string;
      const bVal = (b[sortKey] ?? "") as string;
      return direction * aVal.localeCompare(bVal);
    });
  }, [rows, sortKey, sortOrder]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full bg-base-100 rounded-xl border border-base-200 overflow-hidden">
      <Table<EmployeeRow>
        className="border-0 rounded-none"
        headers={[
          {
            key: "select",
            label: "Select",
            align: "center",
            className: "w-14",
          },
          {
            key: "actions",
            label: "Actions",
            align: "center",
            className: "w-16",
          },
          {
            key: "branch",
            label: "Branch",
            sortable: true,
            sortKey: "branch",
            align: "left",
          },
          {
            key: "employeeName",
            label: "Full Name",
            sortable: true,
            sortKey: "employeeName",
            align: "left",
          },
          {
            key: "position",
            label: "Position",
            sortable: true,
            sortKey: "position",
            align: "left",
          },
          {
            key: "employeeNumber",
            label: "Employee Number",
            sortable: true,
            sortKey: "employeeNumber",
            align: "center",
          },
          {
            key: "contactNumber",
            label: "Contact Number",
            sortable: true,
            sortKey: "contactNumber",
            align: "center",
          },
          {
            key: "email",
            label: "Email Address",
            sortable: true,
            sortKey: "email",
            align: "left",
          },
          {
            key: "birthDate",
            label: "Birthdate",
            sortable: true,
            sortKey: "birthDate",
            align: "left",
          },
          {
            key: "ageSort",
            label: "Age",
            sortable: true,
            sortKey: "ageSort",
            align: "center",
          },
          {
            key: "dateHired",
            label: "Date Hired",
            sortable: true,
            sortKey: "dateHired",
            align: "left",
          },
          {
            key: "employmentType",
            label: "Employment",
            sortable: true,
            sortKey: "employmentType",
            align: "left",
          },
          {
            key: "yearsInServiceSort",
            label: "Years in Service",
            sortable: true,
            sortKey: "yearsInServiceSort",
            align: "center",
          },
          {
            key: "retirementSort",
            label: "Retirement Eligibility",
            sortable: true,
            sortKey: "retirementSort",
            align: "left",
          },
        ]}
        data={sorted}
        rowsPerPage={10}
        sortConfig={{ key: sortKey as keyof EmployeeRow, order: sortOrder }}
        onSort={(key) => handleSort(key as SortKey)}
        renderRow={(emp) => {
          const popoverId = `employee-actions-popover-${emp.id}`;
          const anchorName = `--employee-actions-anchor-${emp.id}`;

          const closeActionsPopover = () => {
            const popoverEl = document.getElementById(popoverId) as
              | (HTMLElement & { hidePopover?: () => void })
              | null;
            popoverEl?.hidePopover?.();
          };

          return (
            <tr
              key={emp.id}
              onClick={() => router.push(`/user/employees/${emp.id}`)}
              className="border-b border-base-200 last:border-0 hover:bg-base-200/50 transition-colors duration-100 cursor-pointer text-center"
            >
              <td
                className="py-4 px-3 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedIds.includes(emp.id)}
                  onChange={() => onToggleSelect?.(emp.id)}
                  aria-label={`Select employee ${emp.id}`}
                />
              </td>
              <td
                className="py-4 px-5 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <ActionDropdown
                  popoverId={popoverId}
                  anchorName={anchorName}
                  buttonClassName="btn btn-ghost btn-xs px-2 text-base-content/40 hover:text-base-content"
                  menuClassName="dropdown menu p-2 shadow-lg bg-base-100 rounded-xl w-44 border border-base-200"
                  iconSize={16}
                >
                  <li>
                    <button
                      className="flex items-center gap-3 text-info text-sm py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeActionsPopover();
                        router.push(`/user/employees/${emp.id}`);
                      }}
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
                        closeActionsPopover();
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
                        closeActionsPopover();
                        onDelete(emp.id);
                      }}
                    >
                      <FiTrash2 size={14} />
                      Delete
                    </button>
                  </li>
                </ActionDropdown>
              </td>

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
                value={emp.ageSort >= 0 ? emp.ageSort : undefined}
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
                value={
                  emp.yearsInServiceSort >= 0
                    ? emp.yearsInServiceSort
                    : undefined
                }
                className="py-4 px-5 text-center text-base-content/70"
                clickHint
              />
              <TipCell
                label="Retirement Eligibility"
                value={emp.retirementSort ? "Eligible" : "Not Eligible"}
                className="py-4 px-5 text-base-content/80"
                clickHint
              />
            </tr>
          );
        }}
      />
    </div>
  );
};

export default EmployeeTable;
