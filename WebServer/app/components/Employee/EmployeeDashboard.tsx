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

import React, { useEffect, useMemo, useState } from "react";

import {
  FiDownload,
  FiFilter,
  FiPlus,
  FiSearch,
  FiUpload,
} from "react-icons/fi";

import FilterModal from "@/app/components/Filter/FilterModal";
import type { Employee } from "@/app/generated/prisma/browser";
import { FilterOption, FilterValues } from "../Filter/FilterTypes";
import EmployeeModal from "./EmployeeModal";
import EmployeeTable from "./EmployeeTable";
import KpiCard from "./KpiCard";

const emptyEmployee = (): Partial<Employee> => ({
  employeeName: "",
  employeeNumber: "",
  position: "",
  branch: "",
  contactPerson: "",
});

const EmployeeDashboard: React.FC = () => {
  const [isEdit, setIsEdit] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({});
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<Employee[]>([]);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    (async () => {
      try {
        const res = await uploadEmployeeExcel(file);
        if (!res.success) {
          alert(res.error ?? "Failed to import employees");
          return;
        }

        const refreshed = await getEmployees();
        if (!refreshed.success) {
          alert(refreshed.error ?? "Failed to reload employees");
          return;
        }

        setEmployees(refreshed.result);
        alert("Employees imported successfully");
      } catch (err: any) {
        alert(err?.message ?? "Error importing employees");
      } finally {
        e.target.value = "";
      }
    })();
  }

  function handleExport() {
    (async () => {
      try {
        const result = await exportEmployeesExcel();
        if (!result.success) {
          alert(result.error ?? "Failed to export employees");
          return;
        }
        if (!result.result) {
          alert("No data to export");
          return;
        }

        const { base64, fileName } = result.result;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(url);
      } catch (err: any) {
        alert(err?.message ?? "Error exporting employees");
      }
    })();
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

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>(emptyEmployee());

  const employeeFilterOptions: FilterOption[] = [
    { key: "employeeName", label: "Employee Name", type: "text" },
    { key: "employeeNumber", label: "Employee Number", type: "text" },
    { key: "position", label: "Position", type: "text" },
    { key: "branch", label: "Branch/Station", type: "text" },
    { key: "tinNumber", label: "TIN", type: "text" },
    { key: "gsisNumber", label: "GSIS", type: "text" },
    { key: "philHealthNumber", label: "PHILHEALTH", type: "text" },
    { key: "pagIbigNumber", label: "PAG-IBIG", type: "text" },
    { key: "hasMedicalInfo", label: "Has Medical Info", type: "checkbox" },
    { key: "hasEmail", label: "Has Email", type: "checkbox" },
  ];

  function handleEdit(emp: Employee) {
    setForm({ ...emp });
    setIsEdit(true);
    setShowModal(true);
  }

  /* ================= ANALYTICS ================= */
  const analytics = useMemo(() => {
    const totalEmployees = employees.length;
    const totalBranches = new Set(employees.map((e) => e.branch)).size;

    const withMedical = employees.filter(
      (e) =>
        e.bloodType ||
        (e.allergies &&
          e.allergies.trim() !== "" &&
          e.allergies.toLowerCase() !== "n/a"),
    ).length;

    const missingEmail = employees.filter((e) => !e.email).length;

    return {
      totalEmployees,
      totalBranches,
      withMedical,
      missingEmail,
    };
  }, [employees]);

  /* ================= SEARCH ================= */
  const filtered = useMemo(() => {
    const baseList =
      Object.keys(appliedFilters).length > 0 ? filteredByAdvanced : employees;

    if (!search.trim()) return baseList;

    const q = search.toLowerCase();

    return baseList.filter((e) =>
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
  }, [employees, search, appliedFilters, filteredByAdvanced]);

  const getEmployeeSuggestions = (
    key: string,
    inputValue: string,
  ): string[] => {
    const textFields = [
      "employeeName",
      "employeeNumber",
      "position",
      "branch",
      "tinNumber",
      "gsisNumber",
      "philHealthNumber",
      "pagIbigNumber",
    ];

    if (!textFields.includes(key)) return [];

    const values = employees
      .map((e) => (e as any)[key] as string | null | undefined)
      .filter((v): v is string => !!v && v.length > 0);

    const unique = Array.from(new Set(values)).sort();

    if (!inputValue) return unique;

    const lower = inputValue.toLowerCase();
    return unique.filter((v) => v.toLowerCase().includes(lower));
  };

  const applyEmployeeFilters = (
    filters: FilterValues,
    list: Employee[],
  ): Employee[] => {
    return list.filter((e) => {
      if (
        typeof filters.employeeName === "string" &&
        filters.employeeName.trim() !== "" &&
        !e.employeeName
          .toLowerCase()
          .includes(filters.employeeName.toLowerCase())
      ) {
        return false;
      }

      if (
        typeof filters.employeeNumber === "string" &&
        filters.employeeNumber.trim() !== "" &&
        (e.employeeNumber || "")
          .toLowerCase()
          .includes(filters.employeeNumber.toLowerCase()) === false
      ) {
        return false;
      }

      if (
        typeof filters.position === "string" &&
        filters.position.trim() !== "" &&
        !e.position.toLowerCase().includes(filters.position.toLowerCase())
      ) {
        return false;
      }

      if (
        typeof filters.branch === "string" &&
        filters.branch.trim() !== "" &&
        !e.branch.toLowerCase().includes(filters.branch.toLowerCase())
      ) {
        return false;
      }

      if (
        typeof filters.tinNumber === "string" &&
        filters.tinNumber.trim() !== "" &&
        (e.tinNumber || "")
          .toLowerCase()
          .includes(filters.tinNumber.toLowerCase()) === false
      ) {
        return false;
      }

      if (
        typeof filters.gsisNumber === "string" &&
        filters.gsisNumber.trim() !== "" &&
        (e.gsisNumber || "")
          .toLowerCase()
          .includes(filters.gsisNumber.toLowerCase()) === false
      ) {
        return false;
      }

      if (
        typeof filters.philHealthNumber === "string" &&
        filters.philHealthNumber.trim() !== "" &&
        (e.philHealthNumber || "")
          .toLowerCase()
          .includes(filters.philHealthNumber.toLowerCase()) === false
      ) {
        return false;
      }

      if (
        typeof filters.pagIbigNumber === "string" &&
        filters.pagIbigNumber.trim() !== "" &&
        (e.pagIbigNumber || "")
          .toLowerCase()
          .includes(filters.pagIbigNumber.toLowerCase()) === false
      ) {
        return false;
      }

      if (typeof filters.hasMedicalInfo === "boolean") {
        const hasMedical =
          !!e.bloodType ||
          (!!e.allergies &&
            e.allergies.trim() !== "" &&
            e.allergies.toLowerCase() !== "n/a");
        if (filters.hasMedicalInfo !== hasMedical) {
          return false;
        }
      }

      if (typeof filters.hasEmail === "boolean") {
        const hasEmail = !!e.email && e.email.trim() !== "";
        if (filters.hasEmail !== hasEmail) {
          return false;
        }
      }

      return true;
    });
  };

  const handleApplyEmployeeFilters = (filters: FilterValues) => {
    const filtered = applyEmployeeFilters(filters, employees);
    setAppliedFilters(filters);
    setFilteredByAdvanced(filtered);
  };

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

  async function handleDelete(id: number) {
    if (!confirm("Delete employee?")) return;

    try {
      const res = await deleteEmployee(id);

      if (!res.success) throw new Error(res.error);

      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
    } catch (error: any) {
      alert(error.message);
    }
  }

  return (
    <div className="min-h-screen  bg-base-100 from-base-200 via-base-100 to-base-200 ">
      <div className="w-full max-w-[2000px] mx-auto ">
        {/* ===== HEADER ===== */}
        <div className="mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Employee Management
          </h1>
          <p className="text-xl text-base-content/70">
            Manage and track your organization's workforce
          </p>
        </div>

        {/* ===== ACTION BAR ===== */}
        <div className="mb-8 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
            <input
              className="input input-bordered input-lg w-full pl-12  text-base"
              placeholder="Search by name, employee #, position, branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              className={`btn btn-lg btn-outline ${Object.keys(appliedFilters).length > 0 ? "btn-active" : ""}`}
              onClick={() => setFilterModalOpen(true)}
            >
              <FiFilter size={20} />
              <span className="text-base">Filters</span>
            </button>

            <label className="btn btn-lg btn-outline">
              <FiUpload size={20} />
              <span className="text-base">Import</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={handleImport}
              />
            </label>

            <button className="btn btn-lg btn-outline" onClick={handleExport}>
              <FiDownload size={20} />
              <span className="text-base">Export</span>
            </button>

            <button className="btn btn-lg btn-primary" onClick={openAdd}>
              <FiPlus size={20} />
              <span className="text-base">Add Employee</span>
            </button>
          </div>
        </div>

        <div className="xl:col-span-9 space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 ">
            <KpiCard title="Total Employees" value={analytics.totalEmployees} />
            <KpiCard title="Branches" value={analytics.totalBranches} />
            <KpiCard title="Complete Profiles" value={analytics.withMedical} />
            <KpiCard title="Pending" value={analytics.missingEmail} />
          </div>

          {/* TABLE */}
          <div className="rounded-2xl shadow-lg border border-base-100  overflow-hidden">
            <EmployeeTable
              employees={filtered}
              bloodTypeMap={bloodTypeMap}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {/* MODAL */}
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

        <FilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          options={employeeFilterOptions}
          onApply={handleApplyEmployeeFilters}
          initialValues={appliedFilters}
          getSuggestions={getEmployeeSuggestions}
        />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
