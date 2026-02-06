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
import EmployeeTable from "./EmployeeTable";
import EmployeeModal from "./EmployeeModal";

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

        <EmployeeTable
          employees={paginatedEmployees}
          bloodTypeMap={bloodTypeMap}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

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
        <EmployeeModal
          showModal={showModal}
          isEdit={isEdit}
          form={form}
          errors={errors}
          bloodTypeMap={bloodTypeMap}
          setForm={setForm}
          setShowModal={setShowModal}
          handleSave={handleSave}
        />
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
