"use client";

import {
  calculateSheriffCaseStats,
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  isTextFieldKey,
  PageListSkeleton,
  Pagination,
  Roles,
  SheriffCaseData,
  SheriffCaseFilters,
  SheriffCasesFilterOptions,
  SheriffCaseStats,
  SherriffCaseAdapter,
  usePopup,
} from "@rtc-database/shared";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { useAdaptiveRouter } from "../../lib/nextCompat";
import SherriffCaseRow from "./SherriffCaseRow";

type CaseFilterValues = SheriffCaseFilters;
type SortKey = NonNullable<SheriffCasesFilterOptions["sortKey"]>;
type CaseFilters = NonNullable<SheriffCasesFilterOptions["filters"]>;

const CASE_FILTER_OPTIONS: FilterOption[] = [
  { key: "caseNumber", label: "Case Number", type: "text" },
  { key: "sheriffName", label: "Sheriff Name", type: "text" },
  { key: "mortgagee", label: "Mortgagee", type: "text" },
  { key: "mortgagor", label: "Mortgagor", type: "text" },
  { key: "dateFiled", label: "Date Filed", type: "daterange" },
  { key: "remarks", label: "Remarks", type: "text" },
];
const PAGE_SIZE = 15;

type SortConfig = { key: SortKey; order: "asc" | "desc" };

const SortTh = ({
  label,
  colKey,
  sortConfig,
  onSort,
}: {
  label: string;
  colKey: SortKey;
  sortConfig: SortConfig;
  onSort: (k: SortKey) => void;
}) => (
  <th
    className="text-center cursor-pointer select-none hover:bg-base-200 transition-colors"
    onClick={() => onSort(colKey)}
  >
    {label}
    {sortConfig.key === colKey ? (
      <span className="ml-1 text-primary">
        {sortConfig.order === "asc" ? "↑" : "↓"}
      </span>
    ) : (
      <span className="opacity-30 ml-1">↕</span>
    )}
  </th>
);

const Sherriff: React.FC<{
  role: Roles;
  adapter: SherriffCaseAdapter;
}> = ({ role, adapter }) => {
  const router = useAdaptiveRouter();
  const statusPopup = usePopup();
  const [records, setRecords] = useState<SheriffCaseData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [stats, setStats] = useState<SheriffCaseStats>({
    totalCases: 0,
    thisMonthCases: 0,
    todayCases: 0,
    recentlyFiled: 0,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "dateFiled",
    order: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<CaseFilterValues>({});
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});

  const isAdminOrAtty = role === "admin" || role === "atty";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const handleToggleRecordSelection = (id: number, checked: boolean) => {
    setSelectedRecordIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const fetchCases = useCallback(
    async (page = currentPage) => {
      try {
        const [casesRes, statsRes] = await Promise.all([
          adapter.getSheriffCases({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          adapter.getSheriffCaseStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!casesRes.success) {
          statusPopup.showError(casesRes.error || "Failed to fetch cases");
          return;
        }

        if (!casesRes.result) {
          statusPopup.showError("Failed to fetch cases");
          return;
        }

        const result = casesRes.result;
        setRecords(result.items);
        setTotalCount(result.total ?? result.items.length);
        setStats(calculateSheriffCaseStats(result.items));

        if (statsRes.success && statsRes.result) {
          setStats(statsRes.result);
        } else if (!statsRes.success) {
          console.error("Failed to fetch case stats", statsRes.error);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch cases");
        console.error("Error fetching cases:", err);
      } finally {
        setLoading(false);
      }
    },
    [
      appliedFilters,
      currentPage,
      exactMatchMap,
      sortConfig.key,
      sortConfig.order,
      statusPopup,
    ],
  );

  useEffect(() => {
    fetchCases(currentPage);
  }, [fetchCases, currentPage]);

  const getCaseSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const isTextField = isTextFieldKey(
      CASE_FILTER_OPTIONS.reduce(
        (acc, opt) => {
          acc[opt.key] = opt.type;
          return acc;
        },
        {} as Record<string, string>,
      ),
      key,
    );

    if (!isTextField) return [];

    const res = await adapter.getSheriffCases({
      page: 1,
      pageSize: 10,
      filters: { [key]: inputValue } as CaseFilters,
      exactMatchMap: { [key]: false },
      sortKey: key as SortKey,
      sortOrder: "asc",
    });

    if (!res.success || !res.result) return [];
    const items = Array.isArray(res.result)
      ? res.result
      : (res.result.items as SheriffCaseData[]);

    const values = items
      .map((c) => (c[key as keyof SheriffCaseData] as string | null) || "")
      .filter((v) => v.length > 0);

    return Array.from(new Set(values)).sort().slice(0, 10);
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    const typed = filters as CaseFilterValues;
    setAppliedFilters(typed);
    setExactMatchMap(exactMatchMapParam);
    setCurrentPage(1);
  };

  const totalItems = totalCount;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const handleDelete = async (id: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this case?",
      ))
    )
      return;

    const result = await adapter.deleteSheriffCase(id);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete case");
      return;
    }

    statusPopup.showSuccess("Case deleted successfully");
    await fetchCases();
  };

  const handleDeleteSelectedRecords = async () => {
    if (selectedRecordIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Are you sure you want to delete ${selectedRecordIds.length} selected case${selectedRecordIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    statusPopup.showLoading("Deleting selected cases...");

    try {
      const results = await Promise.allSettled(
        selectedRecordIds.map((id) => adapter.deleteSheriffCase(id)),
      );

      const failedIds: number[] = [];
      const deletedIds: number[] = [];

      results.forEach((result, index) => {
        const caseId = selectedRecordIds[index];
        if (result.status === "fulfilled" && result.value.success) {
          deletedIds.push(caseId);
          return;
        }
        failedIds.push(caseId);
      });

      if (failedIds.length > 0) {
        statusPopup.showError(
          `Deleted ${deletedIds.length} case(s), but failed to delete ${failedIds.length}.`,
        );
      } else {
        statusPopup.showSuccess(
          `Deleted ${deletedIds.length} selected case${deletedIds.length > 1 ? "s" : ""}.`,
        );
      }

      setSelectedRecordIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
      await fetchCases();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await adapter.uploadSheriffExcel(file);
      const importPayload = result.success ? result.result : result.errorResult;

      if (importPayload?.failedExcel) {
        const { fileName, base64 } = importPayload.failedExcel;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
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
      }

      if (!result.success) {
        statusPopup.showError(result.error || "Failed to import cases");
      } else {
        if ((importPayload?.meta.importedCount ?? 0) === 0) {
          statusPopup.showError(
            "No valid rows to import. Failed rows have been downloaded for review.",
          );
          return;
        }

        statusPopup.showSuccess("Cases imported successfully");
        await fetchCases();

        if (importPayload?.failedExcel) {
          statusPopup.showSuccess(
            "Import complete. Failed rows have been downloaded for review.",
          );
        }
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await adapter.exportSheriffExcel();
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to export cases");
        return;
      }

      if (!result.result) {
        statusPopup.showError("No export data available");
        return;
      }

      const { fileName, base64 } = result.result;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
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
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={8} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <FiAlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Sheriff Cases
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Manage sheriff cases and filings
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-info/10 border border-info/20 text-info text-xs font-medium select-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Hover over table cells to see full details</span>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
              <input
                type="text"
                placeholder="Search by case number, sheriff name..."
                className="input input-bordered input-lg w-full pl-12 text-base"
                value={appliedFilters?.caseNumber || ""}
                onChange={(e) =>
                  setAppliedFilters((prev) => ({
                    ...prev,
                    caseNumber: e.target.value,
                  }))
                }
              />
            </div>

            <button
              className={`btn btn-outline ${appliedFilters && Object.keys(appliedFilters).length > 0 ? "btn-primary" : ""}`}
              onClick={() => setFilterModalOpen((prev) => !prev)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                  clipRule="evenodd"
                />
              </svg>
              Filter
              {appliedFilters && Object.keys(appliedFilters).length > 0 && (
                <span className="badge badge-sm badge-primary ml-1">
                  {Object.keys(appliedFilters).length}
                </span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />

            {isAdminOrAtty && (
              <button
                className={`btn btn-outline ${uploading ? "loading" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <FiUpload className="h-5 w-5" />
                {uploading ? "Importing..." : "Import Excel"}
              </button>
            )}
            {isAdminOrAtty && (
              <button
                className={`btn btn-outline ${exporting ? "loading" : ""}`}
                onClick={handleExport}
                disabled={exporting}
              >
                <FiDownload className="h-5 w-5" />
                {exporting ? "Exporting..." : "Export Excel"}
              </button>
            )}
            {isAdminOrAtty && (
              <button
                className="btn btn-primary"
                onClick={() => router.push("/user/cases/sheriff/add")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Add Record
              </button>
            )}
          </div>

          <FilterDropdown
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={CASE_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            searchValue={appliedFilters}
            getSuggestions={getCaseSuggestions}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "TOTAL CASES",
              value: (stats.totalCases ?? 0).toLocaleString(),
              subtitle: "All sheriff cases",
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "RECENTLY FILED",
              value: (stats.recentlyFiled ?? 0).toLocaleString(),
              subtitle: "Filed in the last 30 days",
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "THIS MONTH",
              value: (stats.thisMonthCases ?? 0).toLocaleString(),
              subtitle: "Cases this month",
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "TODAY",
              value: (stats.todayCases ?? 0).toLocaleString(),
              subtitle: "Cases filed today",
              icon: FiFileText,
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

        {/* Table */}
        {isAdminOrAtty && (
          <AnimatePresence>
            {selectedRecordIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mb-4 overflow-hidden"
              >
                <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-primary">
                    {selectedRecordIds.length} case
                    {selectedRecordIds.length > 1 ? "s" : ""} selected
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        router.push(
                          `/user/cases/sheriff/edit?ids=${selectedRecordIds.join(",")}`,
                        )
                      }
                    >
                      Edit Selected
                    </button>
                    <button
                      className={`btn btn-sm btn-error btn-outline ${deletingSelected ? "loading" : ""}`}
                      onClick={handleDeleteSelectedRecords}
                      disabled={deletingSelected}
                    >
                      <FiTrash2 className="h-4 w-4" />
                      Delete Selected
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setSelectedRecordIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
          <table className="table table-zebra w-full text-center">
            <thead className="bg-base-300">
              <tr className="text-center">
                {isAdminOrAtty && <th>ACTIONS</th>}
                <SortTh
                  label="CASE NUMBER"
                  colKey="caseNumber"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="SHERIFF NAME"
                  colKey="sheriffName"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="MORTGAGEE"
                  colKey="mortgagee"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="MORTGAGOR"
                  colKey="mortgagor"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE FILED"
                  colKey="dateFiled"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrAtty ? 8 : 7}>
                    <div className="flex flex-col items-center justify-center py-20 text-base-content/40 min-h-55">
                      <div className="flex items-center justify-center mb-4">
                        <FiFileText className="w-15 h-15 opacity-50" />
                      </div>
                      <p className="text-lg uppercase font-semibold text-base-content/50">
                        No records found
                      </p>
                      <p className="text-sm mt-1 uppercase text-base-content/35">
                        No sheriff cases match your current filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <SherriffCaseRow
                    key={r.id}
                    record={r}
                    onEdit={(item) => {
                      router.push(`/user/cases/sheriff/edit?id=${item.id}`);
                    }}
                    onDelete={handleDelete}
                    onRowClick={(item) => {
                      try {
                        localStorage.setItem(
                          "__temp_case",
                          JSON.stringify(item),
                        );
                        localStorage.setItem(
                          "__temp_cases",
                          JSON.stringify(records || []),
                        );
                      } catch (e) {
                        // ignore
                      }
                      router.push(`/user/cases/sheriff/${item.id}`);
                    }}
                    selected={selectedRecordIds.includes(r.id)}
                    onToggleSelect={handleToggleRecordSelection}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex justify-end">
          <Pagination
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </main>
    </div>
  );
};

export default Sherriff;
