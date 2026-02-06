"use client";

import React, { useMemo, useState } from "react";
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
} from "react-icons/fi";

type Employee = {
  id: string;
  name: string;
  employeeNumber: string;
  position: string;
  branch: string;
  vatGstId?: string;
  tin?: string;
  gsis?: string;
  philhealth?: string;
  pagibig?: string;
  birthday?: string;
  bloodType?: string;
  allergies?: string;
  height?: string;
  weight?: string;
  contactPerson?: string;
  contactNumber?: string;
  email?: string;
};

const emptyEmployee = (): Employee => ({
  id: String(Date.now()),
  name: "",
  employeeNumber: "",
  position: "",
  branch: "",
  vatGstId: "",
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

        setEmployees(importedData);
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
  const [employees, setEmployees] = useState<Employee[]>([
    ...Array.from({ length: 15 }, (_, i) => ({
      id: String(i + 1),
      name: `Employee ${i + 1}`,
      employeeNumber: `EMP-${String(i + 1).padStart(3, "0")}`,
      position: i % 2 === 0 ? "Clerk" : "Staff",
      branch: ["Manila", "Cebu", "Davao"][i % 3],
      tin: `000-000-${i + 1}`,
      gsis: `GSIS-${i + 1}`,
      philhealth: `PH-${i + 1}`,
      pagibig: `PB-${i + 1}`,
      birthday: "1995-05-10",
      bloodType: "O+",
      allergies: "None",
      height: "165 cm",
      weight: "60 kg",
      contactPerson: "Emergency Contact",
      contactNumber: "09171234567",
      email: `employee${i + 1}@example.com`,
    })),
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Employee>(emptyEmployee());
  function handleEdit(emp: Employee) {
    setForm(emp);
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
      (e) => e.bloodType || e.allergies,
    ).length;

    /* UPCOMING BIRTHDAYS THIS MONTH */
    const currentMonth = new Date().getMonth();

    const birthdayThisMonth = employees.filter((emp) => {
      if (!emp.birthday) return false;
      return new Date(emp.birthday).getMonth() === currentMonth;
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
      Object.values(e)
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [employees, search]);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  /* ================= FUNCTIONS ================= */

  function openAdd() {
    setForm(emptyEmployee());
    setIsEdit(false);
    setShowModal(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!form.name) newErrors.name = "Employee name is required";
    if (!form.employeeNumber)
      newErrors.employeeNumber = "Employee number is required";
    if (!form.position) newErrors.position = "Position is required";
    if (!form.branch) newErrors.branch = "Branch is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (isEdit) {
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === form.id ? form : emp)),
      );
    } else {
      setEmployees((s) => [form, ...s]);
    }

    setShowModal(false);
    setIsEdit(false);
    setForm(emptyEmployee());
    setErrors({});
  }

  function handleDelete(id: string) {
    if (!confirm("Delete employee?")) return;
    setEmployees((s) => s.filter((x) => x.id !== id));
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
            {/* Import Button */}
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
                  <td className="font-semibold">{emp.name || "—"}</td>
                  <td>{emp.employeeNumber || "—"}</td>
                  <td>{emp.position || "—"}</td>
                  <td>{emp.branch || "—"}</td>
                  <td>{emp.tin || "—"}</td>
                  <td>{emp.gsis || "—"}</td>
                  <td>{emp.philhealth || "—"}</td>
                  <td>{emp.pagibig || "—"}</td>
                  <td>{emp.birthday || "—"}</td>
                  <td>{emp.bloodType || "—"}</td>
                  <td>{emp.allergies || "—"}</td>
                  <td>{emp.height || "—"}</td>
                  <td>{emp.weight || "—"}</td>
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
                      onClick={() => handleDelete(emp.id)}
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
              <h2 className="text-2xl font-semibold mb-6">Add Employee</h2>

              <div className="grid md:grid-cols-2 gap-5">
                {/* Employee Name */}
                <div>
                  <label className="label-text font-medium">
                    Employee Name *
                  </label>
                  <input
                    className={`input input-bordered w-full ${errors.name && "input-error"}`}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  {errors.name && (
                    <p className="text-error text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Employee Number */}
                <div>
                  <label className="label-text font-medium">
                    Employee Number *
                  </label>
                  <input
                    className={`input input-bordered w-full ${errors.employeeNumber && "input-error"}`}
                    value={form.employeeNumber}
                    onChange={(e) =>
                      setForm({ ...form, employeeNumber: e.target.value })
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
                    value={form.tin || ""}
                    onChange={(e) => setForm({ ...form, tin: e.target.value })}
                  />
                </div>

                {/* GSIS */}
                <div>
                  <label className="label-text font-medium">GSIS</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.gsis || ""}
                    onChange={(e) => setForm({ ...form, gsis: e.target.value })}
                  />
                </div>

                {/* PhilHealth */}
                <div>
                  <label className="label-text font-medium">PhilHealth</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.philhealth || ""}
                    onChange={(e) =>
                      setForm({ ...form, philhealth: e.target.value })
                    }
                  />
                </div>

                {/* Pag-IBIG */}
                <div>
                  <label className="label-text font-medium">Pag-IBIG</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.pagibig || ""}
                    onChange={(e) =>
                      setForm({ ...form, pagibig: e.target.value })
                    }
                  />
                </div>

                {/* Birthday */}
                <div>
                  <label className="label-text font-medium">Birthday</label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={form.birthday || ""}
                    onChange={(e) =>
                      setForm({ ...form, birthday: e.target.value })
                    }
                  />
                </div>

                {/* Blood Type */}
                <div>
                  <label className="label-text font-medium">Blood Type</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.bloodType || ""}
                    onChange={(e) =>
                      setForm({ ...form, bloodType: e.target.value })
                    }
                  />
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
                  <input
                    className="input input-bordered w-full"
                    value={form.height || ""}
                    onChange={(e) =>
                      setForm({ ...form, height: e.target.value })
                    }
                  />
                </div>

                {/* Weight */}
                <div>
                  <label className="label-text font-medium">Weight</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.weight || ""}
                    onChange={(e) =>
                      setForm({ ...form, weight: e.target.value })
                    }
                  />
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
                    onChange={(e) =>
                      setForm({ ...form, contactNumber: e.target.value })
                    }
                  />
                </div>

                {/* Email */}
                <div className="md:col-span-2">
                  <label className="label-text font-medium">Email</label>
                  <input
                    className="input input-bordered w-full"
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
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
                  Create
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
