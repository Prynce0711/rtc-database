"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import React from "react";

interface Props {
  show: boolean;
  employee: Partial<Employee> | null;
  bloodTypeMap: Record<string, string>;
  onClose: () => void;
}

const EmployeeViewModal: React.FC<Props> = ({
  show,
  employee,
  bloodTypeMap,
  onClose,
}) => {
  if (!show || !employee) return null;

  return (
    <div className="fixed inset-0 flex justify-center items-center bg-black/40 z-50 px-4">
      <div className="bg-base-100 w-full max-w-4xl rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-semibold">Employee Details</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm text-base-content/80">
          <div>
            <p className="font-medium text-base-content mb-1">Employee Name</p>
            <p>{employee.employeeName || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Employee #</p>
            <p>{employee.employeeNumber || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Position</p>
            <p>{employee.position || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Branch</p>
            <p>{employee.branch || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">TIN</p>
            <p>{employee.tinNumber || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">GSIS</p>
            <p>{employee.gsisNumber || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">PhilHealth</p>
            <p>{employee.philHealthNumber || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Pag-IBIG</p>
            <p>{employee.pagIbigNumber || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Birthday</p>
            <p>
              {employee.birthDate
                ? new Date(employee.birthDate).toLocaleDateString()
                : "—"}
            </p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Blood Type</p>
            <p>{employee.bloodType ? bloodTypeMap[employee.bloodType] : "—"}</p>
          </div>

          <div className="sm:col-span-2">
            <p className="font-medium text-base-content mb-1">Allergies</p>
            <p>
              {employee.allergies &&
              employee.allergies.trim() !== "" &&
              employee.allergies.toLowerCase() !== "n/a"
                ? employee.allergies
                : "N/A"}
            </p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Height</p>
            <p>{employee.height ?? "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Weight</p>
            <p>{employee.weight ?? "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Contact Person</p>
            <p>{employee.contactPerson || "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Contact Number</p>
            <p>{employee.contactNumber || "—"}</p>
          </div>

          <div className="sm:col-span-2">
            <p className="font-medium text-base-content mb-1">Email</p>
            <p>{employee.email || "—"}</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeViewModal;
