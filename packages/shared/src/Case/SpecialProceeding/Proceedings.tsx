"use client";

import {
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  PageListSkeleton,
  Pagination,
  SpecialProceedingAdapter,
  SpecialProceedingData,
  SpecialProceedingStats,
  SpecialProceedingsFilterOptions,
  calculateSpecialProceedingStats,
  isTextFieldKey,
  usePopup,
} from "../../index";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiLock,
  FiSearch,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import SpecialProceedingRow from "./SpecialProceedingRow";

type SPFilterValues = {
  caseNumber?: string;
  raffledTo?: string;
  petitioner?: string;
  nature?: string;
  respondent?: string;
  date?: { start?: string; end?: string };
};

type SortableSPKey = NonNullable<SpecialProceedingsFilterOptions["sortKey"]>;
type SortConfig = { key: SortableSPKey; order: "asc" | "desc" };
type SPFilters = NonNullable<SpecialProceedingsFilterOptions["filters"]>;

const SP_FILTER_OPTIONS: FilterOption[] = [
  { key: "caseNumber", label: "SPC. No.", type: "text" },
  { key: "raffledTo", label: "Raffled to Branch", type: "text" },
  { key: "petitioner", label: "Petitioners", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
  { key: "respondent", label: "Respondent", type: "text" },
  { key: "date", label: "Date Filed", type: "daterange" },
];

const PAGE_SIZE = 25;

const SortTh = ({
  label,
  colKey,
  sortConfig,
  onSort,
}: {
  label: string;
  colKey: SortableSPKey;
  sortConfig: SortConfig;
  onSort: (k: SortableSPKey) => void;
}) => {
  const active = sortConfig.key === colKey;
  const ariaLabel = active
    ? `Sorted ${sortConfig.order === "asc" ? "ascending" : "descending"}`
    : "Not sorted";

  return (
    <th
      className="text-center cursor-pointer select-none hover:bg-base-200 transition-colors"
      onClick={() => onSort(colKey)}
      aria-sort={
        active
          ? sortConfig.order === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      aria-label={`${label}: ${ariaLabel}`}
    >
      {label}
      {active ? (
        <span className="ml-1 text-primary" aria-hidden>
          {sortConfig.order === "asc" ? "?" : "?"}
        </span>
      ) : (
        <span className="opacity-30 ml-1" aria-hidden>
          ?
        </span>
      )}
    </th>
  );
};

function PageButton({
  isActive,
  children,
  onClick,
  disabled = false,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`join-item btn btn-sm btn-ghost ${isActive ? "btn-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

const Proceedings: React.FC<{ adapter: SpecialProceedingAdapter }> = ({
  adapter,
}) => {
  const router = useAdaptiveNavigation();
  const popup = usePopup();
  const [cases, setCases] = useState<SpecialProceedingData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    order: "desc",
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SPFilterValues>({});
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<SpecialProceedingStats>({
    totalCases: 0,
    thisMonth: 0,
    caseTypes: 0,
    branches: 0,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const fetchCases = useCallback(
    async (page = currentPage) => {
      setError(null);

      try {
        const [listResult, statsResult] = await Promise.all([
          adapter.getSpecialProceedings({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          adapter.getSpecialProceedingStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!listResult.success) {
          popup.showError(listResult.error || "Failed to fetch cases");
          setError(listResult.error || "Failed to fetch cases");
          setCases([]);
          setTotalCount(0);
          return;
        }

        const result = listResult.result;
        setCases(result?.items || []);
        setTotalCount(result?.total ?? result?.items?.length ?? 0);
        setStats(calculateSpecialProceedingStats(result?.items || []));

        if (statsResult.success && statsResult.result) {
          setStats(statsResult.result);
        } else if (!statsResult.success) {
          console.error(
            "Failed to fetch special proceeding stats",
            statsResult.error,
          );
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch cases");
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, currentPage, exactMatchMap, popup, sortConfig],
  );

  useEffect(() => {
    void fetchCases(currentPage);
  }, [fetchCases, currentPage]);

  const handleSort = (key: SortableSPKey) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMap: ExactMatchMap,
  ) => {
    setAppliedFilters(filters as SPFilterValues);
    setExactMatchMap(exactMap);
    setCurrentPage(1);
  };

  const getSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const isTextField = isTextFieldKey(
      SP_FILTER_OPTIONS.reduce(
        (acc, opt) => {
          acc[opt.key] = opt.type;
          return acc;
        },
        {} as Record<string, string>,
      ),
      key,
    );

    if (!isTextField) return [];

    const result = await adapter.getSpecialProceedings({
      page: 1,
      pageSize: 10,
      filters: { [key]: inputValue } as SPFilters,
      exactMatchMap: { [key]: false },
      sortKey: key as SortableSPKey,
      sortOrder: "asc",
    });

    if (!result.success || !result.result) return [];

    const values = result.result.items
      .map((c) => {
        const val = c[key as keyof SpecialProceedingData];
        return val ? String(val) : "";
      })
      .filter((v) => v.length > 0);

    return Array.from(new Set(values)).sort().slice(0, 10);
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    const result = await adapter.deleteSpecialProceeding(id);
    if (!result.success) {
      popup.showError(result.error || "Failed to delete");
      return;
    }
    await fetchCases(currentPage);
    popup.showSuccess("Case deleted successfully");
  };

  const handleDeleteSelected = async () => {
    if (selectedCaseIds.length === 0) return;

    if (
      !(await popup.showConfirm(
        `Are you sure you want to delete ${selectedCaseIds.length} selected case${selectedCaseIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    popup.showLoading("Deleting selected cases...");

    try {
      const results = await Promise.allSettled(
        selectedCaseIds.map((id) => adapter.deleteSpecialProceeding(id)),
      );

      const deletedIds: number[] = [];
      const failedIds: number[] = [];

      results.forEach((result, index) => {
        const id = selectedCaseIds[index];
        if (result.status === "fulfilled" && result.value.success) {
          deletedIds.push(id);
          return;
        }
        failedIds.push(id);
      });

      setSelectedCaseIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );

      if (failedIds.length > 0) {
        popup.showError(
          `Deleted ${deletedIds.length} case(s), but failed to delete ${failedIds.length}.`,
        );
      } else {
        popup.showSuccess(
          `Deleted ${deletedIds.length} selected case${deletedIds.length > 1 ? "s" : ""}.`,
        );
      }

      await fetchCases(currentPage);
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await adapter.uploadSpecialProceedingExcel(file);
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
      popup.showError(result.error || "Upload failed");
    } else {
      if ((importPayload?.meta.importedCount ?? 0) === 0) {
        popup.showError(
          "No valid rows to import. Failed rows have been downloaded for review.",
        );
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      popup.showSuccess("Cases imported successfully");
      await fetchCases(currentPage);

      if (importPayload?.failedExcel) {
        popup.showSuccess(
          "Import complete. Failed rows have been downloaded for review.",
        );
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportExcel = async () => {
    setExporting(true);
    const result = await adapter.exportSpecialProceedingsExcel();
    if (!result.success) {
      popup.showError(result.error || "Export failed");
    } else {
      const link = document.createElement("a");
      link.href = `data:application/octet-stream;base64,${result.result.base64}`;
      link.download = result.result.fileName;
      link.click();
      popup.showSuccess("Cases exported successfully");
    }
    setExporting(false);
  };

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={7} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error min-h-screen flex items-center">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Special Proceedings Cases
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Manage all special proceedings
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
                placeholder="Search cases..."
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
              type="button"
              className={`btn btn-outline ${activeFilterCount > 0 ? "btn-primary" : ""}`}
              onClick={() => {
                console.log(
                  "SpecialProceedings Filter button clicked, current state:",
                  filterModalOpen,
                );
                setFilterModalOpen((prev) => !prev);
              }}
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
              {activeFilterCount > 0 && (
                <span className="badge badge-sm badge-primary ml-1">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Importing...
                </>
              ) : (
                <>
                  <FiUpload className="h-5 w-5 mr-2" />
                  Import Excel
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />

            <button
              className="btn btn-outline"
              onClick={handleExportExcel}
              disabled={exporting || cases.length === 0}
            >
              {exporting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Exporting...
                </>
              ) : (
                <>
                  <FiDownload className="h-5 w-5 mr-2" />
                  Export Excel
                </>
              )}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                router.push("/user/cases/proceedings/add");
              }}
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
              Add Case
            </button>
          </div>

          <FilterDropdown
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={SP_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            searchValue={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        <AnimatePresence>
          {selectedCaseIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-primary">
                  {selectedCaseIds.length} case
                  {selectedCaseIds.length > 1 ? "s" : ""} selected
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() =>
                      router.push(
                        `/user/cases/proceedings/edit?ids=${selectedCaseIds.join(",")}`,
                      )
                    }
                  >
                    Edit Selected
                  </button>
                  <button
                    className={`btn btn-sm btn-error btn-outline ${deletingSelected ? "loading" : ""}`}
                    onClick={handleDeleteSelected}
                    disabled={deletingSelected}
                  >
                    Delete Selected
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setSelectedCaseIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Cases",
              value: stats.totalCases ?? 0,
              subtitle: `${(stats.thisMonth ?? 0).toLocaleString()} this month`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "This Month",
              value: stats.thisMonth ?? 0,
              subtitle: "Last 30 days",
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "Case Types",
              value: stats.caseTypes ?? 0,
              subtitle: "Distinct types",
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "Branches",
              value: stats.branches ?? 0,
              subtitle: "Active branches",
              icon: FiLock,
              delay: 300,
            },
          ].map((card, idx) => {
            const Icon = card.icon as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >;
            return (
              <div
                key={idx}
                className="transform hover:scale-105 card surface-card-hover group"
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
                      {card.value.toLocaleString()}
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
        <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
          <table className="table table-zebra w-full text-center">
            <thead className=" bg-base-300">
              <tr className="text-center">
                <th>SELECT</th>
                <th>ACTIONS</th>
                <SortTh
                  label="SPC. NO."
                  colKey="caseNumber"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="RAFFLED TO BRANCH"
                  colKey="raffledTo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE FILED"
                  colKey="date"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="PETITIONERS"
                  colKey="petitioner"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="NATURE"
                  colKey="nature"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="RESPONDENT"
                  colKey="respondent"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                      <div className="flex items-center justify-center mb-4">
                        <FiFileText className="w-15 h-15 opacity-50" />
                      </div>
                      <p className="text-lg font-semibold text-base-content/50">
                        NO CASES FOUND
                      </p>
                      <p className="text-sm uppercase mt-1 text-base-content/35">
                        No special proceedings match your current filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <SpecialProceedingRow
                    key={c.id}
                    caseItem={c}
                    onEdit={(item) =>
                      router.push(`/user/cases/proceedings/edit?id=${item.id}`)
                    }
                    onDelete={handleDelete}
                    onRowClick={(item) =>
                      router.push(`/user/cases/proceedings/${item.id}`)
                    }
                    isSelected={selectedCaseIds.includes(c.id)}
                    onToggleSelect={(id) =>
                      setSelectedCaseIds((prev) =>
                        prev.includes(id)
                          ? prev.filter((entryId) => entryId !== id)
                          : [...prev, id],
                      )
                    }
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

export default Proceedings;
