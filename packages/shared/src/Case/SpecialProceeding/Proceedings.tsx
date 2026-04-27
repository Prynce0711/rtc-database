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
  Table,
  calculateSpecialProceedingStats,
  isTextFieldKey,
  usePopup,
} from "../../index";

import React, { useCallback, useEffect, useState } from "react";
import {
  FiBarChart2,
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
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import StatsCard from "../../Stats/StatsCard";
import { ButtonStyles } from "../../Utils/ButtonStyles";
import {
  CASE_IMPORT_DRAFT_KEYS,
  downloadImportFailedExcel,
  previewSpecialProceedingImport,
  saveCaseImportDraft,
} from "../importPreview";
import CaseSectionHeader from "../CaseSectionHeader";
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
  { key: "raffledTo", label: "Branch", type: "text" },
  { key: "petitioner", label: "Petitioners", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
  { key: "respondent", label: "Respondent", type: "text" },
  { key: "date", label: "Date Filed", type: "daterange" },
];

const PAGE_SIZE = 10;

const Proceedings: React.FC<{
  adapter: SpecialProceedingAdapter;
  mode?: "case" | "transmittal";
  headerNavigation?: React.ReactNode;
}> = ({ adapter, mode = "case", headerNavigation }) => {
  const router = useAdaptiveNavigation();
  const popup = usePopup();
  const isTransmittal = mode === "transmittal";
  const canManage = !isTransmittal;
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
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isSelecting = canManage && selectionMode !== null;
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

  const handleToggleCaseSelection = (caseId: number, checked: boolean) => {
    setSelectedCaseIds((prev) => {
      if (!isSelecting) return prev;
      if (checked) {
        if (prev.includes(caseId)) return prev;
        return [...prev, caseId];
      }
      return prev.filter((id) => id !== caseId);
    });
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

  const activeFilterCount = Object.keys(appliedFilters).length;

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

      if (failedIds.length > 0) {
        popup.showError(
          `Deleted ${deletedIds.length} case(s), but failed to delete ${failedIds.length}.`,
        );
      } else {
        popup.showSuccess(
          `Deleted ${deletedIds.length} selected case${deletedIds.length > 1 ? "s" : ""}.`,
        );
      }

      setSelectionMode(null);
      setSelectedCaseIds([]);
      await fetchCases(currentPage);
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleEditSelected = () => {
    if (selectedCaseIds.length === 0) {
      popup.showError("Select at least one row to edit.");
      return;
    }

    router.push(
      `/user/cases/proceedings/edit?ids=${selectedCaseIds.join(",")}`,
    );
  };

  const cancelSelectionMode = () => {
    setSelectionMode(null);
    setSelectedCaseIds([]);
  };

  const applySelectionMode = async () => {
    if (selectedCaseIds.length === 0) {
      popup.showError("Select at least one case first.");
      return;
    }

    if (selectionMode === "edit") {
      handleEditSelected();
      return;
    }

    if (selectionMode === "delete") {
      await handleDeleteSelected();
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await previewSpecialProceedingImport(file);

      downloadImportFailedExcel(result.failedExcel);

      if (!result.success || result.rows.length === 0) {
        popup.showError(
          result.error ||
            (result.failedExcel
              ? "No valid rows were loaded. Failed rows were downloaded for review."
              : "No valid rows were loaded."),
        );
        return;
      }

      if (
        !saveCaseImportDraft(
          CASE_IMPORT_DRAFT_KEYS.specialProceeding,
          result.rows,
        )
      ) {
        popup.showError("Failed to stage imported rows.");
        return;
      }

      popup.showSuccess(
        result.failedExcel
          ? "Excel data staged. Failed rows were downloaded for review."
          : "Excel data staged. Review and save the draft to add it to the table.",
      );
      router.push(`/user/cases/proceedings/add?importDraft=${Date.now()}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        <div className="mb-8">
          <CaseSectionHeader
            sectionLabel="Special Proceedings"
            title="Special Proceedings Cases"
            description="Manage all special proceedings and case filings"
            navigation={headerNavigation}
            actions={
              <>
                <button
                  className={ButtonStyles.info}
                  onClick={handleExportExcel}
                  disabled={exporting || cases.length === 0}
                  aria-busy={exporting}
                  aria-label="Export data to Excel"
                >
                  {exporting ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FiDownload className="h-5 w-5" />
                      Export Excel
                    </>
                  )}
                </button>
                {canManage && (
                  <button
                    className={ButtonStyles.primary}
                    onClick={() => {
                      router.push("/user/cases/proceedings/add");
                    }}
                    aria-label="Add new special proceedings case"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
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
                )}
              </>
            }
            footer={
              <div className="inline-flex items-center gap-2 rounded-lg border border-info/20 bg-info/10 px-3 py-1.5 text-xs font-medium text-info select-none">
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
            }
          />
        </div>

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-lg z-10" />
              <input
                type="text"
                placeholder="Search cases..."
                className="input input-bordered input-lg w-full pl-12 text-base"
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
              onClick={() => {
                setFilterModalOpen((prev) => !prev);
              }}
              aria-label={`Filter (${activeFilterCount} active)`}
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

            {canManage ? (isSelecting ? (
              <div className="flex items-center gap-2 ml-3">
                <span className="text-xs text-base-content/40 tabular-nums">
                  {selectedCaseIds.length} selected
                </span>
                <button
                  type="button"
                  className={`btn btn-md gap-2 ${selectionMode === "delete" ? "btn-error" : "btn-primary"} ${deletingSelected ? "loading" : ""}`}
                  onClick={() => void applySelectionMode()}
                  disabled={selectedCaseIds.length === 0 || deletingSelected}
                >
                  <FiCheck className="h-4 w-4" />
                  <span>
                    {selectionMode === "edit"
                      ? "Edit Selected"
                      : "Delete Selected"}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-md btn-ghost text-base-content/50"
                  onClick={cancelSelectionMode}
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 ml-3">
                <button
                  type="button"
                  className="btn btn-md btn-outline gap-2"
                  onClick={() => {
                    if (totalCount > 0) {
                      setSelectionMode("edit");
                      setSelectedCaseIds([]);
                    }
                  }}
                >
                  <FiEdit2 className="h-4 w-4" />
                  Edit rows
                </button>
                <button
                  type="button"
                  className="btn btn-md btn-outline gap-2 text-error hover:bg-error/10"
                  onClick={() => {
                    if (totalCount > 0) {
                      setSelectionMode("delete");
                      setSelectedCaseIds([]);
                    }
                  }}
                >
                  <FiTrash2 className="h-4 w-4" />
                  Delete rows
                </button>
              </div>
            )) : null}
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

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatsCard
            label="Total Cases"
            value={stats.totalCases ?? 0}
            subtitle={`${(stats.thisMonth ?? 0).toLocaleString()} this month`}
            icon={FiBarChart2}
            delay={0}
            isHighlight={false}
          />
          <StatsCard
            label="This Month"
            value={stats.thisMonth ?? 0}
            subtitle="Last 30 days"
            icon={FiFileText}
            delay={100}
          />
          <StatsCard
            label="Case Types"
            value={stats.caseTypes ?? 0}
            subtitle="Distinct types"
            icon={FiUsers}
            delay={200}
          />
          <StatsCard
            label="Branches"
            value={stats.branches ?? 0}
            subtitle="Active branches"
            icon={FiLock}
            delay={300}
          />
        </div>

        {/* Table */}
        <div className="bg-base-100 rounded-lg shadow overflow-hidden">
          <Table
            headers={[
              ...(canManage && isSelecting
                ? [
                    {
                      key: "select",
                      label: (
                        <label className="inline-flex items-center justify-center gap-2">
                          <span>SELECT</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={allVisibleCasesSelected}
                            onChange={(e) =>
                              handleToggleSelectAllVisibleCases(
                                e.target.checked,
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select all visible special proceeding cases"
                            disabled={visibleCaseIds.length === 0}
                          />
                        </label>
                      ),
                      align: "center" as const,
                    },
                  ]
                : []),
              { key: "caseNumber", label: "SPC. NO.", sortable: true },
              {
                key: "raffledTo",
                label: "BRANCH",
                sortable: true,
              },
              { key: "date", label: "DATE FILED", sortable: true },
              { key: "petitioner", label: "PETITIONERS", sortable: true },
              { key: "nature", label: "NATURE", sortable: true },
              { key: "respondent", label: "RESPONDENT", sortable: true },
            ]}
            data={cases}
            rowsPerPage={PAGE_SIZE}
            showPagination={false}
            resizableColumns
            disableCellTooltips={false}
            minColumnWidth={110}
            sortConfig={{ key: sortConfig.key, order: sortConfig.order }}
            onSort={(k) => handleSort(k as SortableSPKey)}
            renderRow={(c) => (
              <SpecialProceedingRow
                key={c.id}
                caseItem={c}
                onRowClick={
                  isTransmittal
                    ? undefined
                    : (item) => router.push(`/user/cases/proceedings/${item.id}`)
                }
                isSelected={selectedCaseIds.includes(c.id)}
                isSelecting={isSelecting}
                onToggleSelect={
                  isSelecting ? handleToggleCaseSelection : undefined
                }
              />
            )}
          />
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
