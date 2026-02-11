"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import React, { useState } from "react";
import { FiEdit, FiTrash2 } from "react-icons/fi";

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
      <div className="overflow-x-auto">
        <table className="table w-full border-separate border-spacing-y-2">
          {/* HEADER */}
          <thead className="bg-base-200">
            <tr className="text-md font-semibold  tracking-wide text-base-content/70">
              <th className="text-center py-4 uppercase">Actions</th>
              <th className="py-4">Employee Name</th>
              <th className="text-center py-4">Employee #</th>
              <th className="py-4">Position</th>
              <th className="py-4">Branch / Station</th>
              <th className="text-center py-4">TIN</th>
              <th className="text-center py-4">GSIS</th>
              <th className="text-center py-4">PhilHealth</th>
              <th className="text-center py-4">Pag-IBIG</th>
              <th className="text-center py-4">Birthday</th>
              <th className="text-center py-4">Blood Type</th>
              <th className="py-4">Allergies</th>
              <th className="text-center py-4">Height</th>
              <th className="text-center py-4">Weight</th>
              <th className="py-4">Contact Person</th>
              <th className="text-center py-4">Contact Number</th>
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
                <td>
                  <div className="flex justify-center gap-1">
                    <button
                      className="btn btn-xs btn-ghost text-info hover:bg-info/10"
                      onClick={() => onEdit(emp)}
                    >
                      <FiEdit size={16} />
                    </button>

                    <button
                      className="btn btn-xs btn-ghost text-error hover:bg-error/10"
                      onClick={() => onDelete(emp.id)}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>

                <td className="font-semibold">{emp.employeeName || "—"}</td>
                <td className="text-center">{emp.employeeNumber || "—"}</td>
                <td>{emp.position || "—"}</td>
                <td>{emp.branch || "—"}</td>

                <td className="text-center">{emp.tinNumber || "—"}</td>
                <td className="text-center">{emp.gsisNumber || "—"}</td>
                <td className="text-center">{emp.philHealthNumber || "—"}</td>
                <td className="text-center">{emp.pagIbigNumber || "—"}</td>

                <td className="text-center text-base-content/70">
                  {emp.birthDate
                    ? new Date(emp.birthDate).toLocaleDateString()
                    : "—"}
                </td>

                <td className="text-center">
                  {emp.bloodType ? bloodTypeMap[emp.bloodType] : "—"}
                </td>

                <td className="text-base-content/80">
                  {emp.allergies &&
                  emp.allergies.trim() !== "" &&
                  emp.allergies.toLowerCase() !== "n/a"
                    ? emp.allergies
                    : "N/A"}
                </td>

                <td className="text-center">{emp.height ?? "—"}</td>
                <td className="text-center">{emp.weight ?? "—"}</td>
                <td>{emp.contactPerson || "—"}</td>
                <td className="text-center">{emp.contactNumber || "—"}</td>
                <td className="text-base-content/80">{emp.email || "—"}</td>
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
