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
  FiCalendar,
  FiCheck,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiLock,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
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
  Table,
  usePopup,
} from "../../index";
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import StatsCard from "../../Stats/StatsCard";
import { ButtonStyles } from "../../Utils/ButtonStyles";
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

const PAGE_SIZE = 10;

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
  const [selectionMode, setSelectionMode] = useState<"delete" | "edit" | null>(
    null,
  );
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
  const isSelecting = canManage && selectionMode !== null;
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
  const visibleCaseIds = cases.map((caseItem) => caseItem.id);
  const allVisibleCasesSelected =
    visibleCaseIds.length > 0 &&
    visibleCaseIds.every((caseId) => selectedCaseIds.includes(caseId));

  const handleToggleSelectAllVisibleCases = (checked: boolean) => {
    if (!isSelecting) return;

    setSelectedCaseIds((prev) => {
      if (checked) {
        const next = [...prev];
        visibleCaseIds.forEach((caseId) => {
          if (!next.includes(caseId)) {
            next.push(caseId);
          }
        });
        return next;
      }

      return prev.filter((caseId) => !visibleCaseIds.includes(caseId));
    });
  };

  const handleToggleCaseSelection = useCallback(
    (id: number, checked: boolean) => {
      setSelectedCaseIds((prev) => {
        if (checked) {
          if (prev.includes(id)) return prev;
          return [...prev, id];
        }
        return prev.filter((entryId) => entryId !== id);
      });
    },
    [],
  );

  const cancelSelectionMode = useCallback(() => {
    setSelectionMode(null);
    setSelectedCaseIds([]);
  }, []);

  const handleEditSelectedCases = () => {
    if (selectedCaseIds.length === 0) return;
    router.push(`/user/cases/civil/edit?ids=${selectedCaseIds.join(",")}`);
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

      setSelectionMode(null);
      setSelectedCaseIds([]);
      await fetchCases();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleApplySelectionMode = async () => {
    if (selectedCaseIds.length === 0) {
      statusPopup.showError("Select at least one case first.");
      return;
    }

    if (selectionMode === "edit") {
      handleEditSelectedCases();
      return;
    }

    if (selectionMode === "delete") {
      await handleDeleteSelectedCases();
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await adapter.uploadExcel(file);
      const importPayload = result.success ? result.result : result.errorResult;

      if (importPayload?.failedExcel) {
        const failedFileLink = document.createElement("a");
        failedFileLink.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${importPayload.failedExcel.base64}`;
        failedFileLink.download = importPayload.failedExcel.fileName;
        failedFileLink.click();
      }

      if (!result.success || !result.result) {
        statusPopup.showError(
          !result.success ? result.error || "Upload failed" : "Upload failed",
        );
        return;
      }

      if ((result.result.meta?.importedCount ?? 0) === 0) {
        statusPopup.showError(
          importPayload?.failedExcel
            ? "No valid rows were imported. Failed rows were downloaded for review."
            : "No valid rows were imported.",
        );
        return;
      }

      statusPopup.showSuccess(
        importPayload?.failedExcel
          ? "Import complete. Failed rows were downloaded for review."
          : "Excel upload completed.",
      );
      await fetchCases();
    } finally {
      setUploading(false);
    }
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
              <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                <span>Cases</span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">Civil</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Civil Cases
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/50">
                <FiCalendar className="shrink-0" />
                <span>Manage civil cases and filings</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                className={`${ButtonStyles.info} ${exporting ? "loading" : ""}`}
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                <FiDownload className="h-5 w-5" />
                {exporting ? "Exporting..." : "Export Excel"}
              </button>

              {canManage && (
                <button
                  className={ButtonStyles.primary}
                  onClick={() => router.push("/user/cases/civil/add")}
                >
                  <FiFileText className="h-5 w-5" />
                  Add Record
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
              disabled={isSelecting}
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
            className={`${ButtonStyles.secondary} ${activeFilterCount > 0 ? "btn-primary" : ""}`}
            onClick={() => setFilterModalOpen((prev) => !prev)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
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

          {canManage &&
            (isSelecting ? (
              <div className="flex items-center gap-2 sm:ml-3">
                <span className="text-sm text-base-content/60 whitespace-nowrap">
                  {selectedCaseIds.length} selected
                </span>
                <button
                  className={`btn btn-md gap-2 ${selectionMode === "delete" ? "btn-error" : "btn-primary"} ${deletingSelected ? "loading" : ""}`}
                  onClick={() => void handleApplySelectionMode()}
                  disabled={
                    selectedCaseIds.length === 0 ||
                    (selectionMode === "delete" && deletingSelected)
                  }
                >
                  <FiCheck className="h-4 w-4" />
                  <span>
                    {selectionMode === "edit"
                      ? "Edit Selected"
                      : "Delete Selected"}
                  </span>
                </button>
                <button
                  className="btn btn-md btn-ghost text-base-content/50"
                  onClick={cancelSelectionMode}
                  title="Cancel selection"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:ml-3">
                <button
                  className="btn btn-md btn-outline gap-2"
                  onClick={() => {
                    setSelectionMode("edit");
                    setSelectedCaseIds([]);
                  }}
                  disabled={totalCount === 0}
                >
                  <FiEdit2 className="h-4 w-4" />
                  <span>Edit Rows</span>
                </button>
                <button
                  className="btn btn-md btn-outline btn-error gap-2"
                  onClick={() => {
                    setSelectionMode("delete");
                    setSelectedCaseIds([]);
                  }}
                  disabled={totalCount === 0}
                >
                  <FiTrash2 className="h-4 w-4" />
                  <span>Delete Rows</span>
                </button>
              </div>
            ))}

          <span className="sm:ml-auto text-sm text-base-content/50 tabular-nums font-medium">
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

      {canManage && isSelecting && (
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
                  {selectedCaseIds.length > 1 ? "s" : ""} selected for{" "}
                  {selectionMode === "edit" ? "editing" : "deletion"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setSelectedCaseIds([])}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          label="TOTAL CASES"
          value={(stats.totalCases ?? 0).toLocaleString()}
          subtitle="All civil cases"
          icon={
            FiBarChart2 as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={0}
        />
        <StatsCard
          label="RECENTLY FILED"
          value={(stats.recentlyFiled ?? 0).toLocaleString()}
          subtitle="Filed in the last 30 days"
          icon={
            FiFileText as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={100}
        />
        <StatsCard
          label="RE-RAFFLED"
          value={(stats.reRaffledCases ?? 0).toLocaleString()}
          subtitle="Re-raffled cases"
          icon={
            FiUsers as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={200}
        />
        <StatsCard
          label="REMANDED"
          value={(stats.remandedCases ?? 0).toLocaleString()}
          subtitle="Cases remanded"
          icon={
            FiLock as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={300}
        />
      </div>

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <Table
          headers={[
            ...(isSelecting
              ? [
                  {
                    key: "select",
                    label: (
                      <label className="inline-flex items-center justify-center gap-2">
                        <span>Select</span>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={allVisibleCasesSelected}
                          onChange={(e) =>
                            handleToggleSelectAllVisibleCases(e.target.checked)
                          }
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select all visible civil cases"
                          disabled={visibleCaseIds.length === 0}
                        />
                      </label>
                    ),
                    align: "center" as const,
                  },
                ]
              : []),
            { key: "caseNumber", label: "Case Number", sortable: true },
            { key: "branch", label: "Branch", sortable: true },
            { key: "petitioners", label: "Petitioner/s", sortable: true },
            { key: "defendants", label: "Defendant/s", sortable: true },
            { key: "dateFiled", label: "Date Filed", sortable: true },
            { key: "notes", label: "Notes/Appealed", sortable: true },
            { key: "nature", label: "Nature", sortable: true },
          ]}
          data={cases}
          rowsPerPage={PAGE_SIZE}
          showPagination={false}
          resizableColumns
          minColumnWidth={110}
          sortConfig={{ key: sortConfig.key, order: sortConfig.order }}
          onSort={(k) => handleSort(k as SortKey)}
          renderRow={(caseItem) => (
            <CivilCaseRow
              key={caseItem.id}
              caseItem={caseItem}
              onView={(item) => router.push(`/user/cases/civil/${item.id}`)}
              selected={selectedCaseIds.includes(caseItem.id)}
              isSelecting={isSelecting}
              onToggleSelect={
                isSelecting ? handleToggleCaseSelection : undefined
              }
            />
          )}
        />
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
