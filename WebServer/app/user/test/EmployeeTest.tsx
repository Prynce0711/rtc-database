"use client";

import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from "@/app/components/Employee/EmployeeActions";
import {
  exportEmployeesExcel,
  uploadEmployeeExcel,
} from "@/app/components/Employee/ExcelActions";
import type { Employee } from "@rtc-database/shared/prisma/browser";
import { EmploymentType } from "@rtc-database/shared/prisma/enums";
import { useEffect, useMemo, useState } from "react";

type EmployeeFormData = {
  employeeName: string;
  employeeNumber: string;
  position: string;
  branch: string;
  birthDate: Date;
  dateHired: Date;
  employmentType: EmploymentType;
  contactNumber: string;
  email: string;
};

const toDate = (value: string | Date | null | undefined): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const createInitialFormData = (): EmployeeFormData => ({
  employeeName: "",
  employeeNumber: "",
  position: "",
  branch: "",
  birthDate: new Date(),
  dateHired: new Date(),
  employmentType: EmploymentType.CASUAL,
  contactNumber: "",
  email: "",
});

export default function EmployeeTest() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState<EmployeeFormData>(
    createInitialFormData(),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const employmentTypes = useMemo(() => Object.values(EmploymentType), []);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const result = await getEmployees();
    if (result.success) {
      setEmployees(result.result);
      setMessage({ type: "success", text: "Employees loaded successfully" });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to load employees",
      });
    }
    setLoading(false);
  };

  const handleInputChange = <K extends keyof EmployeeFormData>(
    field: K,
    value: EmployeeFormData[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        employeeName: formData.employeeName,
        employeeNumber: formData.employeeNumber || null,
        position: formData.position,
        branch: formData.branch,
        birthDate: formData.birthDate,
        dateHired: formData.dateHired,
        employmentType: formData.employmentType,
        contactNumber: formData.contactNumber || null,
        email: formData.email,
      };

      let result;
      if (isEditing && editingId) {
        result = await updateEmployee(editingId, payload);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Employee updated successfully",
          });
        }
      } else {
        result = await createEmployee(payload);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Employee created successfully",
          });
        }
      }

      if (!result.success) {
        setMessage({
          type: "error",
          text: result.error || "Operation failed",
        });
      } else {
        setFormData(createInitialFormData());
        setIsEditing(false);
        setEditingId(null);
        await loadEmployees();
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    }

    setLoading(false);
  };

  const handleEdit = (employee: Employee) => {
    setFormData({
      employeeName: employee.employeeName ?? "",
      employeeNumber: employee.employeeNumber ?? "",
      position: employee.position ?? "",
      branch: employee.branch ?? "",
      birthDate: toDate(employee.birthDate as unknown as string | Date),
      dateHired: toDate(employee.dateHired as unknown as string | Date),
      employmentType: employee.employmentType as EmploymentType,
      contactNumber: employee.contactNumber ?? "",
      email: employee.email ?? "",
    });
    setIsEditing(true);
    setEditingId(employee.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;

    setLoading(true);
    const result = await deleteEmployee(id);
    if (result.success) {
      setMessage({ type: "success", text: "Employee deleted successfully" });
      await loadEmployees();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete employee",
      });
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setFormData(createInitialFormData());
    setIsEditing(false);
    setEditingId(null);
  };

  const handleExport = async () => {
    setLoading(true);
    const result = await exportEmployeesExcel();
    if (result.success) {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
      link.download = result.result.fileName;
      link.click();
      setMessage({
        type: "success",
        text: "Employees exported to Excel successfully",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to export employees",
      });
    }
    setLoading(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const result = await uploadEmployeeExcel(file);
    if (result.success) {
      setMessage({
        type: "success",
        text: "Employees imported from Excel successfully",
      });
      await loadEmployees();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to import employees",
      });
    }

    if (result.success && result.result?.failedExcel) {
      const { fileName, base64 } = result.result.failedExcel;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: "Import complete. Failed rows have been downloaded for review.",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Employee Tester</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              message.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8 max-h-screen overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {isEditing ? "Edit Employee" : "Add Employee"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3 text-sm">
                <div>
                  <label className="block font-medium mb-1">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    value={formData.employeeName}
                    onChange={(e) =>
                      handleInputChange("employeeName", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Employee Number
                  </label>
                  <input
                    type="text"
                    value={formData.employeeNumber}
                    onChange={(e) =>
                      handleInputChange("employeeNumber", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Position *</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      handleInputChange("position", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Branch *</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) =>
                      handleInputChange("branch", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Birth Date *</label>
                  <input
                    type="date"
                    value={formData.birthDate.toISOString().split("T")[0]}
                    onChange={(e) =>
                      handleInputChange(
                        "birthDate",
                        e.target.value ? new Date(e.target.value) : new Date(),
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Date Hired *</label>
                  <input
                    type="date"
                    value={formData.dateHired.toISOString().split("T")[0]}
                    onChange={(e) =>
                      handleInputChange(
                        "dateHired",
                        e.target.value ? new Date(e.target.value) : new Date(),
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Employment Type *
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) =>
                      handleInputChange(
                        "employmentType",
                        e.target.value as EmploymentType,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  >
                    {employmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) =>
                      handleInputChange("contactNumber", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                  >
                    {isEditing ? "Update" : "Add"}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={loadEmployees}
                  disabled={loading}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
                >
                  Export Excel
                </button>
                <label className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 cursor-pointer">
                  Import Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      <th className="px-4 py-2 text-left">Employee Name</th>
                      <th className="px-4 py-2 text-left">Employee No</th>
                      <th className="px-4 py-2 text-left">Position</th>
                      <th className="px-4 py-2 text-left">Branch</th>
                      <th className="px-4 py-2 text-left">Employment Type</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          No employees found
                        </td>
                      </tr>
                    ) : (
                      employees.map((employee) => (
                        <tr
                          key={employee.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-4 py-2">{employee.id}</td>
                          <td className="px-4 py-2">{employee.employeeName}</td>
                          <td className="px-4 py-2">
                            {employee.employeeNumber}
                          </td>
                          <td className="px-4 py-2">{employee.position}</td>
                          <td className="px-4 py-2">{employee.branch}</td>
                          <td className="px-4 py-2">
                            {employee.employmentType}
                          </td>
                          <td className="px-4 py-2">{employee.email}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(employee)}
                                className="bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(employee.id)}
                                className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
