"use client";
import {
  deleteEmployee,
  getEmployees,
} from "@/app/components/Employee/EmployeeActions";

import {
  exportEmployeesExcel,
  uploadEmployeeExcel,
} from "@/app/components/Employee/ExcelActions";

import React, { useEffect, useMemo, useState } from "react";

import {
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiFilter,
  FiLock,
  FiPlus,
  FiSearch,
  FiUpload,
  FiUsers,
} from "react-icons/fi";

import FilterDropdown from "@/app/components/Filter/FilterDropdown";
import type { Employee } from "@/app/generated/prisma/browser";
import { isRetirementEligible } from "@/app/lib/utils";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../Filter/FilterTypes";
import { usePopup } from "../Popup/PopupProvider";
import { PageListSkeleton } from "../Skeleton/SkeletonTable";
import EmployeeDrawer, { EmployeeDrawerType } from "./EmployeeDrawer";
import EmployeeTable from "./EmployeeTable";

const EmployeeDashboard: React.FC = () => {
  const statusPopup = usePopup();

  // ── Drawer state — same pattern as CasePage ──────────────────
  const [drawerType, setDrawerType] = useState<EmployeeDrawerType | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({});
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<Employee[]>([]);
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await getEmployees();
      if (!res.success) {
        statusPopup.showError(res.error ?? "Failed to load employees");
        setError(res.error ?? "Failed to load employees");
        return;
      }
      setEmployees(res.result);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    (async () => {
      try {
        const res = await uploadEmployeeExcel(file);
        if (!res.success) {
          statusPopup.showError(res.error ?? "Failed to import employees");
          return;
        }
        await fetchEmployees();
        statusPopup.showSuccess("Employees imported successfully");
      } catch (err: any) {
        statusPopup.showError(err?.message ?? "Error importing employees");
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
          statusPopup.showError(result.error ?? "Failed to export employees");
          return;
        }
        if (!result.result) {
          statusPopup.showError("No data to export");
          return;
        }
        const { base64, fileName } = result.result;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1)
          bytes[i] = binary.charCodeAt(i);
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
        statusPopup.showError(err?.message ?? "Error exporting employees");
      }
    })();
  }

  function handleEdit(emp: Employee) {
    setSelectedEmployee(emp);
    setDrawerType(EmployeeDrawerType.EDIT);
  }

  async function handleDelete(id: number) {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this employee?",
      ))
    )
      return;
    try {
      const res = await deleteEmployee(id);
      if (!res.success) throw new Error(res.error);
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      statusPopup.showSuccess("Employee deleted successfully");
    } catch (error: any) {
      statusPopup.showError(error.message);
    }
  }

  const analytics = useMemo(() => {
    const totalEmployees = employees.length;
    const totalBranches = new Set(employees.map((e) => e.branch)).size;
    const missingEmail = employees.filter((e) => !e.email).length;
    const retirementEligible = employees.filter((e) =>
      isRetirementEligible(e.birthDate),
    ).length;
    return {
      totalEmployees,
      totalBranches,
      missingEmail,
      retirementEligible,
    };
  }, [employees]);

  const employeeFilterOptions: FilterOption[] = [
    { key: "employeeName", label: "Employee Name", type: "text" },
    { key: "employeeNumber", label: "Employee Number", type: "text" },
    { key: "position", label: "Position", type: "text" },
    { key: "branch", label: "Branch/Station", type: "text" },
    { key: "employmentType", label: "Employment Type", type: "text" },
    {
      key: "retirementEligible",
      label: "Retirement Eligible",
      type: "checkbox",
    },
    { key: "hasEmail", label: "Has Email", type: "checkbox" },
  ];

  const applyEmployeeFilters = (
    filters: FilterValues,
    list: Employee[],
    exactMap: ExactMatchMap = {},
  ): Employee[] => {
    return list.filter((e) => {
      const matchesText = (
        itemValue: string | null | undefined,
        filterValue: string,
        key: string,
      ): boolean => {
        if (!itemValue) return false;
        const isExact = exactMap[key] ?? true;
        return isExact
          ? itemValue.toLowerCase() === filterValue.toLowerCase()
          : itemValue.toLowerCase().includes(filterValue.toLowerCase());
      };

      if (
        typeof filters.employeeName === "string" &&
        filters.employeeName.trim() !== "" &&
        !matchesText(e.employeeName, filters.employeeName, "employeeName")
      )
        return false;
      if (
        typeof filters.employeeNumber === "string" &&
        filters.employeeNumber.trim() !== "" &&
        !matchesText(e.employeeNumber, filters.employeeNumber, "employeeNumber")
      )
        return false;
      if (
        typeof filters.position === "string" &&
        filters.position.trim() !== "" &&
        !matchesText(e.position, filters.position, "position")
      )
        return false;
      if (
        typeof filters.branch === "string" &&
        filters.branch.trim() !== "" &&
        !matchesText(e.branch, filters.branch, "branch")
      )
        return false;
      if (
        typeof filters.employmentType === "string" &&
        filters.employmentType.trim() !== "" &&
        !matchesText(e.employmentType, filters.employmentType, "employmentType")
      )
        return false;
      if (typeof filters.retirementEligible === "boolean") {
        const eligible = isRetirementEligible(e.birthDate);
        if (filters.retirementEligible !== eligible) return false;
      }
      if (typeof filters.hasEmail === "boolean") {
        const hasEmail = !!e.email && e.email.trim() !== "";
        if (filters.hasEmail !== hasEmail) return false;
      }
      return true;
    });
  };

  const handleApplyEmployeeFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    setAppliedFilters(filters);
    setFilteredByAdvanced(
      applyEmployeeFilters(filters, employees, exactMatchMapParam),
    );
    setExactMatchMap(exactMatchMapParam);
  };

  const getEmployeeSuggestions = (
    key: string,
    inputValue: string,
  ): string[] => {
    const textFields = [
      "employeeName",
      "employeeNumber",
      "position",
      "branch",
      "employmentType",
    ];
    if (!textFields.includes(key)) return [];
    const values = employees
      .map((e) => (e as any)[key] as string | null | undefined)
      .filter((v): v is string => !!v && v.length > 0);
    const unique = Array.from(new Set(values)).sort();
    if (!inputValue) return unique;
    return unique.filter((v) =>
      v.toLowerCase().includes(inputValue.toLowerCase()),
    );
  };

  const filtered = useMemo(() => {
    const baseList =
      Object.keys(appliedFilters).length > 0 ? filteredByAdvanced : employees;
    if (!search.trim()) return baseList;
    const q = search.toLowerCase();
    return baseList.filter((e) =>
      [e.employeeName, e.employeeNumber, e.position, e.branch, e.employmentType]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [employees, search, appliedFilters, filteredByAdvanced]);

  // ── Loading / Error ──────────────────────────────────────────
  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={13} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  // ── Full-page drawer — replaces entire page (same as CasePage) ──
  if (drawerType) {
    return (
      <EmployeeDrawer
        type={drawerType}
        onClose={() => {
          setDrawerType(null);
          setSelectedEmployee(null);
          fetchEmployees();
        }}
        selectedEmployee={selectedEmployee}
        onCreate={(newEmp) => {
          setEmployees((prev) => [newEmp, ...prev]);
        }}
        onUpdate={(updatedEmp) => {
          setEmployees((prev) =>
            prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)),
          );
        }}
      />
    );
  }

  // ── Main Dashboard ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100">
      <div className="w-full max-w-500 mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Employee Management
          </h1>
          <p className="text-lg text-base-content/50 mt-2">
            Manage and track your organization's workforce
          </p>
        </div>

        {/* ACTION BAR */}
        <div className="relative mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
              <input
                className="input input-bordered input-lg w-full pl-14 text-base rounded-lg shadow-sm"
                placeholder="Search by name, employee #, position, branch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`btn btn-md btn-outline flex items-center gap-2 ${Object.keys(appliedFilters).length > 0 ? "btn-active" : ""}`}
                onClick={() => setFilterModalOpen(true)}
              >
                <FiFilter size={18} />
                <span className="hidden sm:inline">Filters</span>
              </button>

              <label className="btn btn-md btn-outline flex items-center gap-2">
                <FiUpload size={18} />
                <span className="hidden sm:inline">Import</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={handleImport}
                />
              </label>

              <button
                className="btn btn-md btn-outline flex items-center gap-2"
                onClick={handleExport}
              >
                <FiDownload size={18} />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                className="btn btn-md btn-primary flex items-center gap-2"
                onClick={() => {
                  setSelectedEmployee(null);
                  setDrawerType(EmployeeDrawerType.ADD);
                }}
              >
                <FiPlus size={18} />
                <span className="hidden sm:inline">Add Employee</span>
              </button>
            </div>
          </div>

          <FilterDropdown
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={employeeFilterOptions}
            onApply={handleApplyEmployeeFilters}
            searchValue={appliedFilters}
            getSuggestions={getEmployeeSuggestions}
          />
        </div>

        <div className="space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              {
                label: "Total Employees",
                value: analytics.totalEmployees,
                subtitle: `${analytics.totalBranches} branches`,
                icon: FiBarChart2,
                delay: 0,
              },
              {
                label: "Branches",
                value: analytics.totalBranches,
                subtitle: `${analytics.retirementEligible} retirement eligible`,
                icon: FiFileText,
                delay: 100,
              },
              {
                label: "Retirement Eligible",
                value: analytics.retirementEligible,
                subtitle: `${analytics.missingEmail} missing email`,
                icon: FiLock,
                delay: 200,
              },
              {
                label: "Missing Emails",
                value: analytics.missingEmail,
                subtitle: `Profiles missing email`,
                icon: FiUsers,
                delay: 300,
              },
            ].map((card, idx) => {
              const Icon = card.icon as React.ComponentType<
                React.SVGProps<SVGSVGElement>
              >;
              return (
                <div
                  key={idx}
                  className={`transform hover:scale-105 card surface-card-hover group`}
                  style={{
                    transitionDelay: `${card.delay}ms`,
                    transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  <div
                    className="card-body relative overflow-hidden"
                    style={{ padding: "var(--space-card-padding)" }}
                  >
                    <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                      <Icon className="h-full w-full" />
                    </div>
                    <div className="relative text-center">
                      <div className="mb-3">
                        <span className="text-sm font-semibold text-muted">
                          {card.label}
                        </span>
                      </div>
                      <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                        {card.value}
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-muted">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TABLE */}
          <div className="rounded-2xl shadow-lg border border-base-100 overflow-visible">
            <EmployeeTable
              employees={filtered}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
