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
} from "react-icons/fi";

import type { Employee } from "@/app/generated/prisma/browser";

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
      <main className="flex-1 flex flex-col w-full max-w-[1700px] mx-auto px-4 py-8">
        {/* ===== HEADER ===== */}

        <div className="mb-6 flex justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold">Employee Management</h2>
            <p className="opacity-70">Employee analytics and records</p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative w-[320px] md:w-[420px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/80 pointer-events-none">
                <FiSearch size={18} />
              </span>

              <input
                className="input input-bordered w-full pl-10"
                placeholder="Search Name, Employee #, Position, Branch, TIN, GSIS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <label className="btn btn-outline">
              <span className="mr-2">
                <FiUpload size={18} />
              </span>
              Import
              <input
                type="file"
                accept=".json"
                hidden
                onChange={handleImport}
              />
            </label>

            {/* Export Button */}
            <button className="btn btn-outline" onClick={handleExport}>
              <span className="mr-2">
                <FiDownload size={18} />
              </span>
              Export
            </button>

            {/* Add Employee */}
            <button className="btn btn-primary" onClick={openAdd}>
              <span className="mr-2">
                <FiPlus size={18} />
              </span>
              Add Employee
            </button>
          </div>
        </div>
        {/* ===== KPI CARDS ===== */}

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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
        <div className="flex-1 overflow-x-auto bg-base-100 rounded-xl shadow">
          <table className="table w-full text-sm h-full">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Employee #</th>
                <th>Position</th>
                <th>Branch / Station</th>
                <th>TIN</th>
                <th>GSIS</th>
                <th>PhilHealth</th>
                <th>Pag-IBIG</th>
                <th>Birthday</th>
                <th>Blood Type</th>
                <th>Allergies</th>
                <th>Height</th>
                <th>Weight</th>
                <th>Contact Person</th>
                <th>Contact Number</th>
                <th>Email</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id}>
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

                  <td className="text-center flex gap-2 justify-center">
                    <button
                      className="btn btn-ghost btn-sm text-primary"
                      onClick={() => handleEdit(emp)}
                    >
                      <FiEdit />
                    </button>

                    <button
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => handleDelete(emp.employeeNumber)}
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6 p-5 ">
          {/* Page Info */}
          <div className="text-sm md:text-base font-medium opacity-70">
            Showing{" "}
            <span className="font-bold">
              {(currentPage - 1) * rowsPerPage + 1}
            </span>{" "}
            -
            <span className="font-bold">
              {Math.min(currentPage * rowsPerPage, filtered.length)}
            </span>{" "}
            of <span className="font-bold">{filtered.length}</span> employees
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              className="btn btn-md btn-circle shadow"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <FiChevronLeft size={20} />
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className={`btn btn-md min-w-[45px] font-semibold transition-all
          ${
            currentPage === i + 1
              ? "btn-primary scale-105 shadow-md"
              : "btn-ghost hover:bg-base-200"
          }
        `}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}

            {/* Next Button */}
            <button
              className="btn btn-md btn-circle shadow"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <FiChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* ===== MODAL ===== */}
        {showModal && (
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
                  <label className="label-text font-medium">
                    Employee Name *
                  </label>
                  <input
                    className={`input input-bordered w-full ${errors.employeeName && "input-error"}`}
                    value={form.employeeName || ""}
                    onChange={(e) =>
                      setForm({ ...form, employeeName: e.target.value })
                    }
                  />
                  {errors.employeeName && (
                    <p className="text-error text-sm mt-1">
                      {errors.employeeName}
                    </p>
                  )}
                </div>

                {/* Employee Number */}
                <div>
                  <label className="label-text font-medium">
                    Employee Number *
                  </label>
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
                    <p className="text-error text-sm mt-1">
                      {errors.employeeNumber}
                    </p>
                  )}
                </div>

                {/* Position */}
                <div>
                  <label className="label-text font-medium">Position *</label>
                  <input
                    className={`input input-bordered w-full ${errors.position && "input-error"}`}
                    value={form.position}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
                    }
                  />
                  {errors.position && (
                    <p className="text-error text-sm mt-1">{errors.position}</p>
                  )}
                </div>

                {/* Branch */}
                <div>
                  <label className="label-text font-medium">
                    Branch / Station *
                  </label>
                  <input
                    className={`input input-bordered w-full ${errors.branch && "input-error"}`}
                    value={form.branch}
                    onChange={(e) =>
                      setForm({ ...form, branch: e.target.value })
                    }
                  />
                  {errors.branch && (
                    <p className="text-error text-sm mt-1">{errors.branch}</p>
                  )}
                </div>

                {/* TIN */}
                <div>
                  <label className="label-text font-medium">TIN</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.tinNumber || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tinNumber: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>

                {/* GSIS */}
                <div>
                  <label className="label-text font-medium">GSIS</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.gsisNumber || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gsisNumber: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>

                {/* PhilHealth */}
                <div>
                  <label className="label-text font-medium">PhilHealth</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.philHealthNumber || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        philHealthNumber: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>

                {/* Pag-IBIG */}
                <div>
                  <label className="label-text font-medium">Pag-IBIG</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.pagIbigNumber || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pagIbigNumber: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>

                {/* Birthday */}
                <div>
                  <label className="label-text font-medium">Birthday</label>
                  <input
                    type="date"
                    className={`input input-bordered w-full ${errors.birthDate && "input-error"}`}
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
                    <p className="text-error text-sm mt-1">
                      {errors.birthDate}
                    </p>
                  )}
                </div>

                {/* Blood Type */}
                <div>
                  <label className="label-text font-medium">Blood Type</label>
                  <select
                    className="select select-bordered w-full"
                    value={form.bloodType || ""}
                    onChange={(e) =>
                      setForm({ ...form, bloodType: e.target.value as any })
                    }
                  >
                    <option value="">Select Blood Type</option>

                    {Object.entries(bloodTypeMap).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Allergies */}
                <div>
                  <label className="label-text font-medium">Allergies</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.allergies || ""}
                    onChange={(e) =>
                      setForm({ ...form, allergies: e.target.value })
                    }
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="label-text font-medium">Height</label>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      className="input input-bordered w-full"
                      value={form.height ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          height: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />

                    <select className="select select-bordered">
                      <option>cm</option>
                      <option>ft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text font-medium">Weight</label>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      className="input input-bordered w-full"
                      value={form.weight ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          weight: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />

                    <select className="select select-bordered">
                      <option>kg</option>
                      <option>lbs</option>
                    </select>
                  </div>
                </div>

                {/* Contact Person */}
                <div>
                  <label className="label-text font-medium">
                    Contact Person
                  </label>
                  <input
                    className="input input-bordered w-full"
                    value={form.contactPerson || ""}
                    onChange={(e) =>
                      setForm({ ...form, contactPerson: e.target.value })
                    }
                  />
                </div>

                {/* Contact Number */}
                <div>
                  <label className="label-text font-medium">
                    Contact Number
                  </label>
                  <input
                    className="input input-bordered w-full"
                    value={form.contactNumber || ""}
                    onChange={(e) => {
                      let numbers = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);

                      if (numbers.length > 4 && numbers.length <= 8)
                        numbers = numbers.replace(/(\d{4})(\d+)/, "$1-$2");

                      if (numbers.length > 8)
                        numbers = numbers.replace(
                          /(\d{4})(\d{4})(\d+)/,
                          "$1-$2-$3",
                        );

                      setForm({ ...form, contactNumber: numbers });
                    }}
                  />
                  {errors.contactNumber && (
                    <p className="text-error text-sm mt-1">
                      {errors.contactNumber}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label className="label-text font-medium">Email</label>
                  <input
                    className={`input input-bordered w-full ${errors.email && "input-error"}`}
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />

                  {errors.email && (
                    <p className="text-error text-sm mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Buttons */}
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
        )}
      </main>
    </div>
  );
};

/* ===== KPI CARD ===== */

const KpiCard = ({ icon, title, value }: any) => (
  <div className="bg-base-100 p-4 rounded-xl shadow flex gap-4 items-center">
    <div className="text-primary text-2xl">{icon}</div>
    <div>
      <p className="text-sm opacity-60">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

export default EmployeeDashboard;
