"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import { EmploymentType } from "@/app/generated/prisma/enums";
import { enumToText } from "@/app/lib/utils";
import React from "react";

interface Props {
  showModal: boolean;
  isEdit: boolean;
  form: Partial<Employee>;
  errors: Record<string, string>;
  setForm: (form: Partial<Employee>) => void;
  setShowModal: (val: boolean) => void;
  handleSave: (e: React.FormEvent) => void;
}

const EmployeeModal: React.FC<Props> = ({
  showModal,
  isEdit,
  form,
  errors,
  setForm,
  setShowModal,
  handleSave,
}) => {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 flex justify-center items-center bg-black/40 z-50 px-4">
      <form
        onSubmit={handleSave}
        className="bg-base-100 w-full max-w-5xl rounded-2xl p-8 shadow-xl"
      >
        <h2 className="text-2xl font-semibold mb-6">
          {isEdit ? "Edit Employee" : "Add Employee"}
        </h2>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Employee Name */}
          <div>
            <label className="label-text font-medium">Employee Name *</label>
            <input
              className={`input input-bordered w-full ${
                errors.employeeName && "input-error"
              }`}
              value={form.employeeName || ""}
              onChange={(e) =>
                setForm({ ...form, employeeName: e.target.value })
              }
            />
            {errors.employeeName && (
              <p className="text-error text-sm mt-1">{errors.employeeName}</p>
            )}
          </div>

          {/* Employee Number */}
          <div>
            <label className="label-text font-medium">Employee Number *</label>
            <input
              className="input input-bordered w-full"
              value={form.employeeNumber || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  employeeNumber: e.target.value.replace(/\D/g, ""),
                })
              }
            />
            {errors.employeeNumber && (
              <p className="text-error text-sm mt-1">{errors.employeeNumber}</p>
            )}
          </div>

          {/* Position */}
          <div>
            <label className="label-text font-medium">Position *</label>
            <input
              className={`input input-bordered w-full ${
                errors.position && "input-error"
              }`}
              value={form.position || ""}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
            {errors.position && (
              <p className="text-error text-sm mt-1">{errors.position}</p>
            )}
          </div>

          {/* Branch */}
          <div>
            <label className="label-text font-medium">Branch / Station *</label>
            <input
              className={`input input-bordered w-full ${
                errors.branch && "input-error"
              }`}
              value={form.branch || ""}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
            />
            {errors.branch && (
              <p className="text-error text-sm mt-1">{errors.branch}</p>
            )}
          </div>

          {/* Birthday */}
          <div>
            <label className="label-text font-medium">Birthday *</label>
            <input
              type="date"
              className={`input input-bordered w-full ${
                errors.birthDate && "input-error"
              }`}
              value={
                form.birthDate
                  ? new Date(form.birthDate).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  birthDate: new Date(e.target.value + "T00:00:00"),
                })
              }
            />
            {errors.birthDate && (
              <p className="text-error text-sm mt-1">{errors.birthDate}</p>
            )}
          </div>

          {/* Date Hired */}
          <div>
            <label className="label-text font-medium">Date Hired *</label>
            <input
              type="date"
              className={`input input-bordered w-full ${
                errors.dateHired && "input-error"
              }`}
              value={
                form.dateHired
                  ? new Date(form.dateHired).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  dateHired: new Date(e.target.value + "T00:00:00"),
                })
              }
            />
            {errors.dateHired && (
              <p className="text-error text-sm mt-1">{errors.dateHired}</p>
            )}
          </div>

          {/* Employment Type */}
          <div>
            <label className="label-text font-medium">Employment Type *</label>
            <select
              className={`select select-bordered w-full ${
                errors.employmentType && "input-error"
              }`}
              value={form.employmentType || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  employmentType: e.target.value as EmploymentType,
                })
              }
            >
              <option value="">Select employment type</option>
              {Object.values(EmploymentType).map((opt) => (
                <option key={opt} value={opt}>
                  {enumToText(opt)}
                </option>
              ))}
            </select>
            {errors.employmentType && (
              <p className="text-error text-sm mt-1">{errors.employmentType}</p>
            )}
          </div>

          {/* Contact Number */}
          <div>
            <label className="label-text font-medium">Contact Number</label>
            <input
              className="input input-bordered w-full"
              value={form.contactNumber || ""}
              onChange={(e) => {
                let numbers = e.target.value.replace(/\D/g, "").slice(0, 11);

                if (numbers.length > 4 && numbers.length <= 8)
                  numbers = numbers.replace(/(\d{4})(\d+)/, "$1-$2");

                if (numbers.length > 8)
                  numbers = numbers.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");

                setForm({ ...form, contactNumber: numbers });
              }}
            />
            {errors.contactNumber && (
              <p className="text-error text-sm mt-1">{errors.contactNumber}</p>
            )}
          </div>

          {/* Email */}
          <div className="md:col-span-2">
            <label className="label-text font-medium">Email</label>
            <input
              className={`input input-bordered w-full ${
                errors.email && "input-error"
              }`}
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && (
              <p className="text-error text-sm mt-1">{errors.email}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </button>

          <button type="submit" className="btn btn-primary px-8">
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeModal;
