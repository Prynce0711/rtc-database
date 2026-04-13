"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import {
  enumToText,
  getAgeFromDate,
  isRetirementEligible,
} from "@rtc-database/shared";
import React from "react";

interface Props {
  show: boolean;
  employee: Partial<Employee> | null;
  onClose: () => void;
}

const EmployeeViewModal: React.FC<Props> = ({ show, employee, onClose }) => {
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
            <p className="font-medium text-base-content mb-1">Birthday</p>
            <p>
              {employee.birthDate
                ? new Date(employee.birthDate).toLocaleDateString()
                : "—"}
            </p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Age</p>
            <p>{getAgeFromDate(employee.birthDate) ?? "—"}</p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">Date Hired</p>
            <p>
              {employee.dateHired
                ? new Date(employee.dateHired).toLocaleDateString()
                : "—"}
            </p>
          </div>

          <div className="sm:col-span-2">
            <p className="font-medium text-base-content mb-1">
              Employment Type
            </p>
            <p>
              {employee.employmentType
                ? enumToText(employee.employmentType)
                : "—"}
            </p>
          </div>

          <div>
            <p className="font-medium text-base-content mb-1">
              Retirement Eligible
            </p>
            <p>{isRetirementEligible(employee.birthDate) ? "Yes" : "No"}</p>
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
