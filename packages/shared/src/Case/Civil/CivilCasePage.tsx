"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiLock,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import {
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  isTextFieldKey,
  PageListSkeleton,
  Pagination,
  Roles,
  usePopup,
} from "../../index";
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import type { CivilCaseAdapter } from "./CivilCaseAdapter";
import CivilCaseRow from "./CivilCaseRow";
import {
  calculateCivilCaseStats,
  CivilCaseData,
  CivilCaseFilters,
  CivilCasesFilterOptions,
  CivilCaseStats,
} from "./CivilCaseSchema";

type CaseFilterValues = CivilCaseFilters;
type SortKey = NonNullable<CivilCasesFilterOptions["sortKey"]>;
type SortConfig = { key: SortKey; order: "asc" | "desc" };

const CASE_FILTER_OPTIONS: FilterOption[] = [
  { key: "branch", label: "Branch", type: "text" },
  { key: "assistantBranch", label: "Assistant Branch", type: "text" },
  { key: "caseNumber", label: "Case Number", type: "text" },
  { key: "petitioners", label: "Petitioner/s", type: "text" },
  { key: "defendants", label: "Defendant/s", type: "text" },
  { key: "dateFiled", label: "Date Filed", type: "daterange" },
  { key: "notes", label: "Notes", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
];

const PAGE_SIZE = 15;

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
    className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 cursor-pointer select-none hover:bg-base-200/50 transition-colors"
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

const CivilCasePage: React.FC<{ role: Roles; adapter: CivilCaseAdapter }> = ({
  role,
  adapter,
}) => {
  const router = useAdaptiveNavigation();
  const statusPopup = usePopup();

  const [cases, setCases] = useState<CivilCaseData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [stats, setStats] = useState<CivilCaseStats>({
    totalCases: 0,
    reRaffledCases: 0,
    remandedCases: 0,
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

  const canManage = role === Roles.ADMIN || role === Roles.ATTY;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

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
          adapter.getCivilCases({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          adapter.getCivilCaseStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!casesRes.success || !casesRes.result) {
          statusPopup.showError(
            !casesRes.success
              ? casesRes.error || "Failed to fetch cases"
              : "Failed to fetch cases",
          );
          return;
        }

        setCases(casesRes.result.items);
        setTotalCount(casesRes.result.total ?? casesRes.result.items.length);
        setStats(calculateCivilCaseStats(casesRes.result.items));

        if (statsRes.success && statsRes.result) {
          setStats(statsRes.result);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch cases");
      } finally {
        setLoading(false);
      }
    },
    [
      adapter,
      appliedFilters,
      currentPage,
      exactMatchMap,
      sortConfig,
      statusPopup,
    ],
  );

  useEffect(() => {
    void fetchCases(currentPage);
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

    const res = await adapter.getCivilCases({
      page: 1,
      pageSize: 10,
      filters: { [key]: inputValue } as CaseFilterValues,
      exactMatchMap: { [key]: false },
      sortKey: key as SortKey,
      sortOrder: "asc",
    });

    if (!res.success || !res.result) return [];

    const values = res.result.items
      .map((c) => (c[key as keyof CivilCaseData] as string | null) || "")
      .filter((v) => v.length > 0);

    return Array.from(new Set(values)).sort().slice(0, 10);
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    setAppliedFilters(filters as CaseFilterValues);
    setExactMatchMap(exactMatchMapParam);
    setCurrentPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleDeleteCase = async (caseId: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this case?",
      ))
    ) {
      return;
    }

    const result = await adapter.deleteCivilCase(caseId);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete case");
      return;
    }

    await fetchCases();
    setSelectedCaseIds((prev) => prev.filter((id) => id !== caseId));
  };

  const handleDeleteSelectedCases = async () => {
    if (selectedCaseIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Are you sure you want to delete ${selectedCaseIds.length} selected case${selectedCaseIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    try {
      const results = await Promise.allSettled(
        selectedCaseIds.map((id) => adapter.deleteCivilCase(id)),
      );
      const failed = results.filter(
        (r) => r.status !== "fulfilled" || !r.value.success,
      ).length;

      if (failed > 0) {
        statusPopup.showError(
          `Deleted ${selectedCaseIds.length - failed} case(s), failed ${failed}.`,
        );
      } else {
        statusPopup.showSuccess(
          `Deleted ${selectedCaseIds.length} selected case${selectedCaseIds.length > 1 ? "s" : ""}.`,
        );
      }

      setSelectedCaseIds([]);
      await fetchCases();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const result = await adapter.uploadExcel(file);
    setUploading(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Upload failed");
      return;
    }

    statusPopup.showSuccess("Excel upload completed.");
    await fetchCases();
  };

  const handleExport = async () => {
    setExporting(true);
    const result = await adapter.exportCasesExcel();
    setExporting(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Export failed");
      return;
    }

    const a = document.createElement("a");
    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
    a.download = result.result.fileName;
    a.click();
  };

  const activeFilterCount = useMemo(
    () => Object.keys(appliedFilters ?? {}).length,
    [appliedFilters],
  );

  if (loading) {
    return <PageListSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Civil Case Records
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                <FiFileText className="shrink-0" />
                <span>Manage civil case reports and filings</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {canManage && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleUpload(file);
                      }
                      if (e.target) e.target.value = "";
                    }}
                  />
                  <button
                    className={`btn btn-outline btn-info btn-md gap-2 ${uploading ? "loading" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <FiUpload className="h-5 w-5" />
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </>
              )}

              <button
                className={`btn btn-outline btn-info btn-md gap-2 ${exporting ? "loading" : ""}`}
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                <FiDownload className="h-5 w-5" />
                {exporting ? "Exporting..." : "Export"}
              </button>

              {canManage && (
                <button
                  className="btn btn-success btn-md gap-2"
                  onClick={() => router.push("/user/cases/civil/add")}
                >
                  <FiFileText className="h-5 w-5" />
                  Add Case
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
            <input
              type="text"
              placeholder="Search by case number..."
              className="input input-bordered w-full pl-11"
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
            className={`btn btn-md btn-outline gap-2 ${activeFilterCount > 0 ? "btn-primary" : ""}`}
            onClick={() => setFilterModalOpen((prev) => !prev)}
          >
            Filter
            {activeFilterCount > 0 && (
              <span className="badge badge-sm badge-primary ml-1">
                {activeFilterCount}
              </span>
            )}
          </button>

          <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
            {totalCount} case{totalCount !== 1 && "s"}
          </span>
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

      {canManage && (
        <AnimatePresence>
          {selectedCaseIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
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
                        `/user/cases/civil/edit?ids=${selectedCaseIds.join(",")}`,
                      )
                    }
                  >
                    Edit Selected
                  </button>
                  <button
                    className={`btn btn-sm btn-error btn-outline ${deletingSelected ? "loading" : ""}`}
                    onClick={() => void handleDeleteSelectedCases()}
                    disabled={deletingSelected}
                  >
                    <FiTrash2 size={14} />
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Cases",
            value: stats.totalCases,
            subtitle: "Total civil caseload",
            icon: FiBarChart2,
          },
          {
            label: "Re-Raffled",
            value: stats.reRaffledCases,
            subtitle: "Cases with re-raffle date",
            icon: FiUsers,
          },
          {
            label: "Remanded",
            value: stats.remandedCases,
            subtitle: "Cases marked remanded",
            icon: FiLock,
          },
          {
            label: "Recently Filed",
            value: stats.recentlyFiled,
            subtitle: "Filed in last 30 days",
            icon: FiFileText,
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="card-body relative overflow-hidden p-4 sm:p-6">
                <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5">
                  <Icon className="h-full w-full" />
                </div>
                <div className="relative text-center">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-base-content/50">
                    {card.label}
                  </span>
                  <p className="text-3xl sm:text-4xl font-black text-base-content mb-1">
                    {(card.value ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-base-content/60">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <div className="overflow-x-auto">
          <table className="table table-sm w-full text-center">
            <thead>
              <tr className="bg-base-200/50 border-b border-base-200">
                {canManage && (
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Actions
                  </th>
                )}
                <SortTh
                  label="Case Number"
                  colKey="caseNumber"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="Branch"
                  colKey="branch"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="Petitioner/s"
                  colKey="petitioners"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="Defendant/s"
                  colKey="defendants"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="Date Filed"
                  colKey="dateFiled"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="Notes/Appealed"
                  colKey="notes"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="Nature"
                  colKey="nature"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="py-16">
                    <div className="flex flex-col items-center justify-center py-12 text-base-content/40">
                      <FiFileText className="w-16 h-16 opacity-20 mb-4" />
                      <p className="text-lg font-semibold text-base-content/50 uppercase tracking-wide">
                        No records found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                cases.map((caseItem) => (
                  <CivilCaseRow
                    key={caseItem.id}
                    caseItem={caseItem}
                    onEdit={(item) =>
                      router.push(`/user/cases/civil/edit?id=${item.id}`)
                    }
                    onDelete={handleDeleteCase}
                    onView={(item) =>
                      router.push(`/user/cases/civil/${item.id}`)
                    }
                    selected={selectedCaseIds.includes(caseItem.id)}
                    onToggleSelect={(id, checked) =>
                      setSelectedCaseIds((prev) => {
                        if (checked) {
                          if (prev.includes(id)) return prev;
                          return [...prev, id];
                        }
                        return prev.filter((entryId) => entryId !== id);
                      })
                    }
                    canManage={canManage}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-base-content/40">
          Showing page {currentPage} of {pageCount}
        </p>
        <Pagination
          pageCount={pageCount}
          currentPage={currentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
      </div>
    </div>
  );
};

export default CivilCasePage;
