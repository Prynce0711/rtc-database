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
        <table className="table w-full text-center">
          <thead className="bg-base-300 text-base">
            <tr>
              <th className="font-bold">Actions</th>
              <th className="font-bold">Employee Name</th>
              <th className="font-bold">Employee #</th>
              <th className="font-bold">Position</th>
              <th className="font-bold">Branch / Station</th>
              <th className="font-bold">TIN</th>
              <th className="font-bold">GSIS</th>
              <th className="font-bold">PhilHealth</th>
              <th className="font-bold">Pag-IBIG</th>
              <th className="font-bold">Birthday</th>
              <th className="font-bold">Blood Type</th>
              <th className="font-bold">Allergies</th>
              <th className="font-bold">Height</th>
              <th className="font-bold">Weight</th>
              <th className="font-bold">Contact Person</th>
              <th className="font-bold">Contact Number</th>
              <th className="font-bold">Email</th>
            </tr>
          </thead>

          <tbody>
            {paginatedEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-base-200 text-base">
                <td>
                  <div className="flex gap-2 justify-center">
                    <button
                      className="btn btn-ghost btn-sm text-primary"
                      onClick={() => onEdit(emp)}
                    >
                      <FiEdit size={18} />
                    </button>

                    <button
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => onDelete(emp.id)}
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </td>

                <td className="font-semibold">{emp.employeeName || "—"}</td>
                <td>{emp.employeeNumber || "—"}</td>
                <td>{emp.position || "—"}</td>
                <td>{emp.branch || "—"}</td>
                <td>{emp.tinNumber || "—"}</td>
                <td>{emp.gsisNumber || "—"}</td>
                <td>{emp.philHealthNumber || "—"}</td>
                <td>{emp.pagIbigNumber || "—"}</td>

                <td>
                  {emp.birthDate
                    ? new Date(emp.birthDate).toLocaleDateString()
                    : "—"}
                </td>

                <td>{emp.bloodType ? bloodTypeMap[emp.bloodType] : "—"}</td>

                <td>
                  {emp.allergies &&
                  emp.allergies.trim() !== "" &&
                  emp.allergies.toLowerCase() !== "n/a"
                    ? emp.allergies
                    : "N/A"}
                </td>

                <td>{emp.height ?? "—"}</td>
                <td>{emp.weight ?? "—"}</td>
                <td>{emp.contactPerson || "—"}</td>
                <td>{emp.contactNumber || "—"}</td>
                <td>{emp.email || "—"}</td>
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
