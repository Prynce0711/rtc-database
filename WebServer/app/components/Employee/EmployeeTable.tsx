"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

interface Props {
  employees: Employee[];
  bloodTypeMap: Record<string, string>;
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
}

const EmployeeTable: React.FC<Props> = ({
  employees,
  bloodTypeMap,
  onEdit,
  onDelete,
}) => {
  const router = useRouter();
  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(employees.length / rowsPerPage));

  const paginatedEmployees = employees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  return (
    <div className="w-full bg-base-100">
      {/* TABLE SCROLL */}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="table w-full border-separate border-spacing-y-2">
          {/* HEADER */}
          <thead className="bg-base-200">
            <tr className="text-md font-semibold  tracking-wide text-base-content/70">
              <th className="text-center py-4 uppercase">Actions</th>
              <th className="py-4">Employee Name</th>
              <th className="text-center py-4">Employee #</th>
              <th className="py-4">Position</th>
              <th className="py-4">Branch</th>
              <th className="text-center py-4">Contact No</th>
              <th className="py-4">Email</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody className="text-sm">
            {paginatedEmployees.map((emp) => (
              <tr
                key={emp.id}
                className="bg-base-100 hover:bg-base-200 transition shadow-sm"
              >
                {/* ACTIONS */}
                <td onClick={(e) => e.stopPropagation()} className="relative">
                  <div className="flex justify-center">
                    <div className="dropdown dropdown-end">
                      <button
                        tabIndex={0}
                        className="btn btn-ghost btn-sm px-2"
                        aria-label="Open actions"
                      >
                        <FiMoreHorizontal size={18} />
                      </button>

                      <ul
                        tabIndex={0}
                        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-200"
                        style={{ zIndex: 9999 }}
                      >
                        <li>
                          <button
                            className="flex items-center gap-3 text-info"
                            onClick={() =>
                              router.push(`/user/employees/${emp.id}`)
                            }
                          >
                            <FiEye size={16} />
                            <span>View</span>
                          </button>
                        </li>

                        <li>
                          <button
                            className="flex items-center gap-3 text-warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(emp);
                            }}
                          >
                            <FiEdit size={16} />
                            <span>Edit</span>
                          </button>
                        </li>

                        <li>
                          <button
                            className="flex items-center gap-3 text-error"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(emp.id);
                            }}
                          >
                            <FiTrash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </td>

                <td
                  className="font-semibold cursor-pointer"
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                >
                  {emp.employeeName || "—"}
                </td>
                <td
                  className="text-center cursor-pointer"
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                >
                  {emp.employeeNumber || "—"}
                </td>
                <td
                  className="cursor-pointer"
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                >
                  {emp.position || "—"}
                </td>
                <td
                  className="cursor-pointer"
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                >
                  {emp.branch || "—"}
                </td>
                <td
                  className="text-center cursor-pointer"
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                >
                  {emp.contactNumber || "—"}
                </td>
                <td
                  className="text-base-content/80 cursor-pointer"
                  onClick={() => router.push(`/user/employees/${emp.id}`)}
                >
                  {emp.email || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center px-6 py-4 border-t border-base-200">
        <span className="text-sm text-base-content/70">
          Page {currentPage} of {totalPages}
        </span>

        <div className="join">
          <button
            className="join-item btn btn-sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Prev
          </button>

          <button
            className="join-item btn btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeTable;
