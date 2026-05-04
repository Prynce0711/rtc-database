"use client";

import {
  FileViewerModal,
  Table,
  TipCell,
  enumToText,
  formatDate,
  getAgeFromDate,
  isRetirementEligible,
} from "@rtc-database/shared";
import { buildGarageProxyUrl } from "@/app/lib/garageProxy";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import type { EmployeeRecord } from "./schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  employees: EmployeeRecord[];
  onEdit: (emp: EmployeeRecord) => void;
  onDelete: (id: number) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
}

type SortKey =
  | keyof Pick<
      EmployeeRecord,
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

type EmployeeRow = EmployeeRecord & {
  ageSort: number;
  yearsInServiceSort: number;
  retirementSort: number;
};

type EmployeeContextMenuState = {
  x: number;
  y: number;
  employee: EmployeeRecord;
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
  const [contextMenu, setContextMenu] =
    useState<EmployeeContextMenuState | null>(null);
  const [imageViewer, setImageViewer] = useState({
    open: false,
    url: "",
    title: "",
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    const closeMenu = () => setContextMenu(null);

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

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

  const handleContextMenu = (
    event: React.MouseEvent,
    employee: EmployeeRecord,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      employee,
    });
  };

  const openImageViewer = (employee: EmployeeRecord) => {
    if (!employee.imageFile?.key) return;

    setImageViewer({
      open: true,
      url: buildGarageProxyUrl({
        bucket: "rtc-bucket",
        key: employee.imageFile.key,
        fileName: employee.imageFile.fileName,
        inline: true,
        contentType: employee.imageFile.mimeType,
      }),
      title: employee.employeeName || "Employee Photo",
    });
  };

  const closeImageViewer = () => {
    setImageViewer({ open: false, url: "", title: "" });
  };

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
            key: "branch",
            label: "Branch",
            sortable: true,
            sortKey: "branch",
            align: "left",
          },
          {
            key: "photo",
            label: "Photo",
            align: "center",
            className: "w-24",
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
          return (
            <tr
              key={emp.id}
              onClick={() => router.push(`/user/employees/${emp.id}`)}
              onContextMenu={(event) => handleContextMenu(event, emp)}
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

              <TipCell
                label="Branch"
                value={emp.branch}
                className="py-4 px-5 text-base-content/80"
                clickHint
              />
              <td
                className="py-4 px-3 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                {emp.imageFile?.key ? (
                  <button
                    type="button"
                    className="mx-auto h-11 w-11 rounded-xl border border-base-300 overflow-hidden cursor-zoom-in"
                    onClick={(event) => {
                      event.stopPropagation();
                      openImageViewer(emp);
                    }}
                    aria-label={`View photo of ${emp.employeeName || "employee"}`}
                  >
                    <img
                      src={buildGarageProxyUrl({
                        bucket: "rtc-bucket",
                        key: emp.imageFile.key,
                        fileName: emp.imageFile.fileName,
                        inline: true,
                        contentType: emp.imageFile.mimeType,
                      })}
                      alt={emp.employeeName || "Employee"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <span className="text-xs text-base-content/35">No image</span>
                )}
              </td>
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
      <FileViewerModal
        open={imageViewer.open}
        loading={false}
        url={imageViewer.url}
        type="image"
        title={imageViewer.title}
        error=""
        onClose={closeImageViewer}
      />
      {contextMenu && (
        <div
          className="fixed z-[90] w-44 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-2xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-info"
            onClick={() => {
              const target = contextMenu.employee;
              setContextMenu(null);
              router.push(`/user/employees/${target.id}`);
            }}
          >
            <FiEye className="h-4 w-4" />
            View
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-warning"
            onClick={() => {
              const target = contextMenu.employee;
              setContextMenu(null);
              onEdit(target);
            }}
          >
            <FiEdit className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-error"
            onClick={() => {
              const target = contextMenu.employee;
              setContextMenu(null);
              onDelete(target.id);
            }}
          >
            <FiTrash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default EmployeeTable;
