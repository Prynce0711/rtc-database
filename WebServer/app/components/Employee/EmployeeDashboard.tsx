"use client";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/app/components/Employee/EmployeeActions";

import React, { useMemo, useState, useEffect } from "react";

import {
  FiPlus,
  FiTrash2,
  FiUsers,
  FiMapPin,
  FiBriefcase,
  FiMail,
  FiHeart,
  FiChevronRight,
  FiChevronLeft,
  FiUpload,
  FiDownload,
  FiEdit,
  FiSearch,
  FiX,
} from "react-icons/fi";
import EmployeeTable from "./EmployeeTable";
import EmployeeModal from "./EmployeeModal";

import type { Employee } from "@/app/generated/prisma/browser";

interface KpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, title, value }) => (
  <div className="stat bg-base-100 rounded-lg shadow hover:shadow-lg transition-shadow">
    <div className="stat-figure text-black">{icon}</div>
    <div className="stat-title text-black font-medium">{title}</div>
    <div className="stat-value text-black font-medium">{value}</div>
  </div>
);

const emptyEmployee = (): Partial<Employee> => ({
  employeeName: "",
  employeeNumber: "",
  position: "",
  branch: "",
  contactPerson: "",
});

const EmployeeDashboard: React.FC = () => {
  const [isEdit, setIsEdit] = useState(false);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);

        if (!Array.isArray(importedData)) {
          alert("Invalid file format");
          return;
        }

        setEmployees(
          importedData.map((e: any) => ({
            ...e,
            birthDate: e.birthDate ? new Date(e.birthDate) : undefined,
            height: Number.isNaN(e.height) ? undefined : e.height,
            weight: Number.isNaN(e.weight) ? undefined : e.weight,
          })),
        );
      } catch {
        alert("Error reading file");
      }
    };

    reader.readAsText(file);
  }
  function handleExport() {
    const dataStr = JSON.stringify(employees, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    async function loadEmployees() {
      const res = await getEmployees();

      if (!res.success) {
        alert(res.error ?? "Failed to load employees");
        return;
      }

      setEmployees(res.result);
    }

    loadEmployees();
  }, []);
  const bloodTypeMap: Record<string, string> = {
    A_Positive: "A+",
    A_Negative: "A-",
    B_Positive: "B+",
    B_Negative: "B-",
    AB_Positive: "AB+",
    AB_Negative: "AB-",
    O_Positive: "O+",
    O_Negative: "O-",
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>(emptyEmployee());

  function handleEdit(emp: Employee) {
    setForm({ ...emp });

    setIsEdit(true);
    setShowModal(true);
  }

  /* ================= KPI ANALYTICS ================= */
  const analytics = useMemo(() => {
    const totalEmployees = employees.length;

    const totalBranches = new Set(employees.map((e) => e.branch)).size;

    /* MOST COMMON POSITION */
    const positionCount: Record<string, number> = {};
    employees.forEach((emp) => {
      if (!emp.position) return;
      positionCount[emp.position] = (positionCount[emp.position] || 0) + 1;
    });

    const mostCommonPosition =
      Object.entries(positionCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "N/A";

    /* WITH MEDICAL INFO */
    const withMedical = employees.filter(
      (e) =>
        e.bloodType ||
        (e.allergies &&
          e.allergies.trim() !== "" &&
          e.allergies.toLowerCase() !== "n/a"),
    ).length;

    /* UPCOMING BIRTHDAYS THIS MONTH */
    const currentMonth = new Date().getMonth();

    const birthdayThisMonth = employees.filter((emp) => {
      if (!emp.birthDate) return false;
      return new Date(emp.birthDate).getMonth() === currentMonth;
    }).length;

    /* MISSING EMAIL */
    const missingEmail = employees.filter((e) => !e.email).length;

    return {
      totalEmployees,
      totalBranches,
      mostCommonPosition,
      withMedical,
      birthdayThisMonth,
      missingEmail,
    };
  }, [employees]);

  /* ================= SEARCH ================= */

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;

    const q = search.toLowerCase();

    return employees.filter((e) =>
      [
        e.employeeName,
        e.employeeNumber,
        e.position,
        e.branch,
        e.tinNumber,
        e.gsisNumber,
        e.philHealthNumber,
        e.pagIbigNumber,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [employees, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const visiblePages = (() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    pages.push(2);

    let left = currentPage - 1;
    let right = currentPage + 1;

    if (left <= 2) left = 3;
    if (right >= totalPages - 1) right = totalPages - 2;

    if (left > 3) pages.push("...");

    for (let p = left; p <= right; p++) {
      pages.push(p);
    }

    if (right < totalPages - 2) pages.push("...");

    pages.push(totalPages - 1);
    pages.push(totalPages);

    return pages;
  })();

  const getNextPage = () => {
    for (let p = currentPage + 1; p <= totalPages; p++) {
      const start = (p - 1) * rowsPerPage;
      if (filtered.slice(start, start + rowsPerPage).length > 0) return p;
    }
    return currentPage;
  };

  /* ================= FUNCTIONS ================= */

  function openAdd() {
    setForm(emptyEmployee());
    setIsEdit(false);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!form.employeeName?.trim())
      newErrors.employeeName = "Employee name is required";

    if (!form.employeeNumber?.trim())
      newErrors.employeeNumber = "Employee number is required";
    if (!form.position?.trim()) newErrors.position = "Position is required";
    if (!form.branch?.trim()) newErrors.branch = "Branch is required";
    if (!form.birthDate) newErrors.birthDate = "Birth date is required";

    if (!form.contactPerson?.trim())
      newErrors.contactPerson = "Contact person is required";
    if (
      form.contactNumber &&
      form.contactNumber.replace(/\D/g, "").length !== 11
    )
      newErrors.contactNumber = "Contact number must be 11 digits";

    if (form.email && !/^[^@]+@[^@]+$/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      if (isEdit && form.id) {
        const sanitizedForm = {
          ...form,
          allergies:
            form.allergies?.trim() === "" ||
            form.allergies?.toLowerCase() === "n/a"
              ? undefined
              : form.allergies,

          height:
            typeof form.height === "number" && !Number.isNaN(form.height)
              ? form.height
              : undefined,

          weight:
            typeof form.weight === "number" && !Number.isNaN(form.weight)
              ? form.weight
              : undefined,

          email: form.email?.trim() === "" ? undefined : form.email?.trim(),
        };

        const res = await updateEmployee(
          Number(form.id),
          sanitizedForm as Record<string, unknown>,
        );

        if (!res.success) {
          throw new Error(res.error);
        }

        if (!res.result) {
          throw new Error("No result returned");
        }

        setEmployees((prev) =>
          prev.map((emp) => (emp.id === form.id ? res.result! : emp)),
        );
      } else {
        const sanitizedForm = {
          ...form,
          birthDate: form.birthDate ? new Date(form.birthDate) : undefined,
          height:
            typeof form.height === "number" && !Number.isNaN(form.height)
              ? form.height
              : undefined,

          weight:
            typeof form.weight === "number" && !Number.isNaN(form.weight)
              ? form.weight
              : undefined,

          email: form.email?.trim() === "" ? undefined : form.email?.trim(),
          allergies:
            form.allergies?.trim() === "" ||
            form.allergies?.toLowerCase() === "n/a"
              ? undefined
              : form.allergies,
        };

        const res = await createEmployee(
          sanitizedForm as Record<string, unknown>,
        );

        if (!res.success) {
          throw new Error(res.error);
        }

        if (!res.result) {
          throw new Error("No result returned");
        }

        setEmployees((prev) => [res.result!, ...prev]);
      }

      setShowModal(false);
      setIsEdit(false);
      setForm(emptyEmployee());
      setErrors({});
    } catch (error: any) {
      alert(error.message || "Error saving employee");
    }
  }

  async function handleDelete(employeeNumber: string) {
    if (!confirm("Delete employee?")) return;

    try {
      const res = await deleteEmployee(employeeNumber);

      if (!res.success) throw new Error(res.error);

      setEmployees((prev) =>
        prev.filter((emp) => emp.employeeNumber !== employeeNumber),
      );
    } catch (error: any) {
      alert(error.message);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <main className="flex-1 flex flex-col w-full max-w-[1700px] mx-auto px-6 py-8">
        {/* ===== HEADER ===== */}
        <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-4xl font-bold text-base-content">
              Employee Management
            </h1>
            <p className="text-base text-base-content/70 mt-1">
              Employee analytics and records
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative w-full sm:w-[320px] md:w-[420px]">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/60 pointer-events-none">
                <FiSearch size={20} />
              </span>
              <input
                className="input input-bordered w-full pl-12 pr-4 py-3 text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Search Name, Employee #, Position, Branch, TIN, GSIS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <label className="btn btn-outline btn-md gap-2 rounded-lg">
              <FiUpload size={18} />
              Import
              <input
                type="file"
                accept=".json"
                hidden
                onChange={handleImport}
              />
            </label>

            <button
              className="btn btn-outline btn-md gap-2 rounded-lg"
              onClick={handleExport}
            >
              <FiDownload size={18} />
              Export
            </button>

            <button
              className="btn btn-primary btn-md gap-2 rounded-lg"
              onClick={openAdd}
            >
              <FiPlus size={18} />
              Add Employee
            </button>
          </div>
        </div>

        {/* ===== KPI CARDS ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <KpiCard
            icon={<FiUsers />}
            title="Total Employees"
            value={analytics.totalEmployees}
          />
          <KpiCard
            icon={<FiMapPin />}
            title="Branches"
            value={analytics.totalBranches}
          />
          <KpiCard
            icon={<FiBriefcase />}
            title="Most Common Position"
            value={analytics.mostCommonPosition}
          />
          <KpiCard
            icon={<FiHeart />}
            title="Medical Records"
            value={analytics.withMedical}
          />
          <KpiCard
            icon={<FiUsers />}
            title="Birthdays This Month"
            value={analytics.birthdayThisMonth}
          />
          <KpiCard
            icon={<FiMail />}
            title="Missing Email"
            value={analytics.missingEmail}
          />
        </div>

        {/* ===== FULL TABLE ===== */}
        <div className="flex-1 overflow-x-auto bg-base-100 rounded-xl shadow-lg border border-base-300">
          <table className="table w-full text-sm">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">
                  Employee Name
                </th>
                <th className="font-semibold text-base-content">Employee #</th>
                <th className="font-semibold text-base-content">Position</th>
                <th className="font-semibold text-base-content">
                  Branch / Station
                </th>
                <th className="font-semibold text-base-content">TIN</th>
                <th className="font-semibold text-base-content">GSIS</th>
                <th className="font-semibold text-base-content">PhilHealth</th>
                <th className="font-semibold text-base-content">Pag-IBIG</th>
                <th className="font-semibold text-base-content">Birthday</th>
                <th className="font-semibold text-base-content">Blood Type</th>
                <th className="font-semibold text-base-content">Allergies</th>
                <th className="font-semibold text-base-content">Height</th>
                <th className="font-semibold text-base-content">Weight</th>
                <th className="font-semibold text-base-content">
                  Contact Person
                </th>
                <th className="font-semibold text-base-content">
                  Contact Number
                </th>
                <th className="font-semibold text-base-content">Email</th>
                <th className="font-semibold text-base-content text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((emp, index) => (
                <tr
                  key={emp.id}
                  className={index % 2 === 0 ? "bg-base-100" : "bg-base-50"}
                >
                  <td className="font-medium text-base-content">
                    {emp.employeeName || "—"}
                  </td>
                  <td className="text-base-content">
                    {emp.employeeNumber || "—"}
                  </td>
                  <td className="text-base-content">{emp.position || "—"}</td>
                  <td className="text-base-content">{emp.branch || "—"}</td>
                  <td className="text-base-content">{emp.tinNumber || "—"}</td>
                  <td className="text-base-content">{emp.gsisNumber || "—"}</td>
                  <td className="text-base-content">
                    {emp.philHealthNumber || "—"}
                  </td>
                  <td className="text-base-content">
                    {emp.pagIbigNumber || "—"}
                  </td>
                  <td className="text-base-content">
                    {emp.birthDate
                      ? new Date(emp.birthDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="text-base-content">
                    {emp.bloodType ? bloodTypeMap[emp.bloodType] : "—"}
                  </td>
                  <td className="text-base-content">
                    {emp.allergies &&
                    emp.allergies.trim() !== "" &&
                    emp.allergies.toLowerCase() !== "n/a"
                      ? emp.allergies
                      : "N/A"}
                  </td>
                  <td className="text-base-content">{emp.height ?? "—"}</td>
                  <td className="text-base-content">{emp.weight ?? "—"}</td>
                  <td className="text-base-content">
                    {emp.contactPerson || "—"}
                  </td>
                  <td className="text-base-content">
                    {emp.contactNumber || "—"}
                  </td>
                  <td className="text-base-content">{emp.email || "—"}</td>
                  <td className="text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        className="btn btn-ghost btn-sm text-primary hover:bg-primary/10 rounded-lg"
                        onClick={() => handleEdit(emp)}
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-error hover:bg-error/10 rounded-lg"
                        onClick={() => handleDelete(emp.employeeNumber)}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== PAGINATION ===== */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8 p-4 bg-base-100 rounded-xl shadow border border-base-300">
          <div className="text-sm md:text-base font-medium text-base-content/70">
            Showing{" "}
            <span className="font-bold text-base-content">
              {(currentPage - 1) * rowsPerPage + 1}
            </span>{" "}
            -
            <span className="font-bold text-base-content">
              {Math.min(currentPage * rowsPerPage, filtered.length)}
            </span>{" "}
            of{" "}
            <span className="font-bold text-base-content">
              {filtered.length}
            </span>{" "}
            employees
          </div>

          <div className="flex items-center gap-2 text-sm">
            <nav className="flex items-center gap-2">
              {visiblePages.map((p, idx) => {
                if (p === "...") {
                  return (
                    <span
                      key={`dots-${idx}`}
                      className="text-base-content/60 px-2"
                    >
                      …
                    </span>
                  );
                }

                const page = Number(p);
                const start = (page - 1) * rowsPerPage;
                const hasData =
                  filtered.slice(start, start + rowsPerPage).length > 0;
                if (!hasData) return null;

                return (
                  <button
                    key={`page-${page}`}
                    onClick={() => setCurrentPage(page)}
                    className={`px-1 ${
                      currentPage === page
                        ? "text-primary font-medium"
                        : "text-primary/80 hover:underline"
                    }`}
                    aria-current={currentPage === page ? "page" : undefined}
                  >
                    {page}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => setCurrentPage(getNextPage())}
              className="text-sm text-primary/90 hover:underline disabled:text-base-content/40"
              disabled={getNextPage() === currentPage}
            >
              Next
            </button>
          </div>
        </div>

        {/* ===== MODAL ===== */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
            <div className="bg-base-100 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 bg-base-100 border-b border-base-300 px-8 py-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-base-content">
                  {isEdit ? "Edit Employee" : "Add New Employee"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setForm(emptyEmployee());
                    setErrors({});
                  }}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                {/* Employee Name */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Employee Name *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.employeeName || ""}
                    onChange={(e) =>
                      setForm({ ...form, employeeName: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="John Doe"
                  />
                  {errors.employeeName && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.employeeName}
                      </span>
                    </label>
                  )}
                </div>

                {/* Employee Number */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Employee Number *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.employeeNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, employeeNumber: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="EMP001"
                    disabled={isEdit}
                  />
                  {errors.employeeNumber && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.employeeNumber}
                      </span>
                    </label>
                  )}
                </div>

                {/* Position */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Position *</span>
                  </label>
                  <input
                    type="text"
                    value={form.position || ""}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="Judge"
                  />
                  {errors.position && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.position}
                      </span>
                    </label>
                  )}
                </div>

                {/* Branch */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Branch / Station *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.branch || ""}
                    onChange={(e) =>
                      setForm({ ...form, branch: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="Manila"
                  />
                  {errors.branch && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.branch}
                      </span>
                    </label>
                  )}
                </div>

                {/* Birth Date */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Birth Date *
                    </span>
                  </label>
                  <input
                    type="date"
                    value={
                      form.birthDate
                        ? new Date(form.birthDate).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        birthDate: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      })
                    }
                    className="input input-bordered w-full"
                  />
                  {errors.birthDate && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.birthDate}
                      </span>
                    </label>
                  )}
                </div>

                {/* Contact Person */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Contact Person *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.contactPerson || ""}
                    onChange={(e) =>
                      setForm({ ...form, contactPerson: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="Contact name"
                  />
                  {errors.contactPerson && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.contactPerson}
                      </span>
                    </label>
                  )}
                </div>

                {/* Contact Number */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Contact Number
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={form.contactNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, contactNumber: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="09123456789"
                  />
                  {errors.contactNumber && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.contactNumber}
                      </span>
                    </label>
                  )}
                </div>

                {/* Email */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Email</span>
                  </label>
                  <input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="employee@rtc.gov.ph"
                  />
                  {errors.email && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.email}
                      </span>
                    </label>
                  )}
                </div>

                {/* Additional Info */}
                <div className="divider">Additional Information</div>

                {/* TIN */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">TIN</span>
                  </label>
                  <input
                    type="text"
                    value={form.tinNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, tinNumber: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="TIN number"
                  />
                </div>

                {/* GSIS */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">GSIS</span>
                  </label>
                  <input
                    type="text"
                    value={form.gsisNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, gsisNumber: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="GSIS number"
                  />
                </div>

                {/* PhilHealth */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">PhilHealth</span>
                  </label>
                  <input
                    type="text"
                    value={form.philHealthNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, philHealthNumber: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="PhilHealth number"
                  />
                </div>

                {/* Pag-IBIG */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Pag-IBIG</span>
                  </label>
                  <input
                    type="text"
                    value={form.pagIbigNumber || ""}
                    onChange={(e) =>
                      setForm({ ...form, pagIbigNumber: e.target.value })
                    }
                    className="input input-bordered w-full"
                    placeholder="Pag-IBIG number"
                  />
                </div>

                {/* Medical Info */}
                <div className="divider">Medical Information</div>

                {/* Blood Type */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Blood Type</span>
                  </label>
                  <select
                    value={form.bloodType || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bloodType: (e.target.value as any) || undefined,
                      })
                    }
                    className="select select-bordered w-full"
                  >
                    <option value="">Select blood type</option>
                    <option value="A_Positive">A+</option>
                    <option value="A_Negative">A-</option>
                    <option value="B_Positive">B+</option>
                    <option value="B_Negative">B-</option>
                    <option value="AB_Positive">AB+</option>
                    <option value="AB_Negative">AB-</option>
                    <option value="O_Positive">O+</option>
                    <option value="O_Negative">O-</option>
                  </select>
                </div>

                {/* Allergies */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Allergies</span>
                  </label>
                  <textarea
                    value={form.allergies || ""}
                    onChange={(e) =>
                      setForm({ ...form, allergies: e.target.value })
                    }
                    className="textarea textarea-bordered w-full"
                    placeholder="List any allergies (N/A if none)"
                    rows={3}
                  />
                </div>

                {/* Height */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Height (cm)
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form.height ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        height: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="input input-bordered w-full"
                    placeholder="170"
                  />
                </div>

                {/* Weight */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      Weight (kg)
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form.weight ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weight: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="input input-bordered w-full"
                    placeholder="70"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setForm(emptyEmployee());
                      setErrors({});
                    }}
                    className="btn btn-ghost flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {isEdit ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeDashboard;
