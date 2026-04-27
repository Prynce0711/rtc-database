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
  Table,
  usePopup,
} from "@rtc-database/shared";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiBarChart2,
  FiCheck,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useAdaptiveRouter } from "../../lib/nextCompat";
import StatsCard from "../../Stats/StatsCard";
import { ButtonStyles } from "../../Utils/ButtonStyles";
import {
  CASE_IMPORT_DRAFT_KEYS,
  downloadImportFailedExcel,
  previewSheriffCaseImport,
  saveCaseImportDraft,
} from "../importPreview";
import CaseSectionHeader from "../CaseSectionHeader";
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
const PAGE_SIZE = 10;

type SortConfig = { key: SortKey; order: "asc" | "desc" };

const Sherriff: React.FC<{
  role: Roles;
  adapter: SherriffCaseAdapter;
  mode?: "case" | "transmittal";
  headerNavigation?: React.ReactNode;
}> = ({ role, adapter, mode = "case", headerNavigation }) => {
  const router = useAdaptiveRouter();
  const statusPopup = usePopup();
  const [records, setRecords] = useState<SheriffCaseData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
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

  const isTransmittal = mode === "transmittal";
  const isAdminOrAtty =
    !isTransmittal && (role === "admin" || role === "atty");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const isSelecting = selectionMode !== null;

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const handleToggleRecordSelection = (id: number, checked: boolean) => {
    setSelectedRecordIds((prev) => {
      if (!isSelecting) return prev;
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const handleEditSelectedRecords = () => {
    if (selectedRecordIds.length === 0) {
      statusPopup.showError("Select at least one row to edit.");
      return;
    }

    router.push(`/user/cases/sheriff/edit?ids=${selectedRecordIds.join(",")}`);
  };

  const cancelSelectionMode = () => {
    setSelectionMode(null);
    setSelectedRecordIds([]);
  };

  const applySelectionMode = async () => {
    if (selectedRecordIds.length === 0) {
      statusPopup.showError("Select at least one case first.");
      return;
    }

    if (selectionMode === "edit") {
      handleEditSelectedRecords();
      return;
    }

    if (selectionMode === "delete") {
      await handleDeleteSelectedRecords();
    }
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
  const visibleRecordIds = records.map((record) => record.id);
  const allVisibleRecordsSelected =
    visibleRecordIds.length > 0 &&
    visibleRecordIds.every((recordId) => selectedRecordIds.includes(recordId));

  const handleToggleSelectAllVisibleRecords = (checked: boolean) => {
    if (!isSelecting) return;

    setSelectedRecordIds((prev) => {
      if (checked) {
        const next = [...prev];
        visibleRecordIds.forEach((recordId) => {
          if (!next.includes(recordId)) {
            next.push(recordId);
          }
        });
        return next;
      }

      return prev.filter((recordId) => !visibleRecordIds.includes(recordId));
    });
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

      setSelectionMode(null);
      setSelectedRecordIds([]);
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
      const result = await previewSheriffCaseImport(file);

      downloadImportFailedExcel(result.failedExcel);

      if (!result.success || result.rows.length === 0) {
        statusPopup.showError(
          result.error ||
            (result.failedExcel
              ? "No valid rows were loaded. Failed rows were downloaded for review."
              : "No valid rows were loaded."),
        );
        return;
      }

      if (!saveCaseImportDraft(CASE_IMPORT_DRAFT_KEYS.sheriff, result.rows)) {
        statusPopup.showError("Failed to stage imported rows.");
        return;
      }

      statusPopup.showSuccess(
        result.failedExcel
          ? "Excel data staged. Failed rows were downloaded for review."
          : "Excel data staged. Review and save the draft to add it to the table.",
      );
      router.push(`/user/cases/sheriff/add?importDraft=${Date.now()}`);
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
        <div className="mb-8">
          <CaseSectionHeader
            sectionLabel="Sheriff"
            title="Sheriff Cases"
            description="Manage sheriff cases and filings"
            navigation={headerNavigation}
            actions={
              isAdminOrAtty ? (
                <>
                  <button
                    className={`${ButtonStyles.info} ${exporting ? "loading" : ""}`}
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    <FiDownload className="h-5 w-5" />
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>
                  <button
                    className={ButtonStyles.primary}
                    onClick={() => router.push("/user/cases/sheriff/add")}
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
                    Add Record
                  </button>
                </>
              ) : undefined
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
          <div className="flex gap-4">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
              <input
                type="text"
                placeholder="Search by case number, sheriff name..."
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
              className={`${ButtonStyles.secondary} ${appliedFilters && Object.keys(appliedFilters).length > 0 ? "btn-primary" : ""}`}
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

            {isAdminOrAtty &&
              (isSelecting ? (
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs text-base-content/40 tabular-nums">
                    {selectedRecordIds.length} selected
                  </span>
                  <button
                    type="button"
                    className={`btn btn-md gap-2 ${selectionMode === "delete" ? "btn-error" : "btn-primary"} ${deletingSelected ? "loading" : ""}`}
                    onClick={() => void applySelectionMode()}
                    disabled={
                      selectedRecordIds.length === 0 || deletingSelected
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
                        setSelectedRecordIds([]);
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
                        setSelectedRecordIds([]);
                      }
                    }}
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Delete rows
                  </button>
                </div>
              ))}
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
          <StatsCard
            label="TOTAL CASES"
            value={(stats.totalCases ?? 0).toLocaleString()}
            subtitle="All sheriff cases"
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
            label="THIS MONTH"
            value={(stats.thisMonthCases ?? 0).toLocaleString()}
            subtitle="Cases this month"
            icon={
              FiUsers as unknown as React.ComponentType<
                React.SVGProps<SVGSVGElement>
              >
            }
            delay={200}
          />
          <StatsCard
            label="TODAY"
            value={(stats.todayCases ?? 0).toLocaleString()}
            subtitle="Cases filed today"
            icon={
              FiFileText as unknown as React.ComponentType<
                React.SVGProps<SVGSVGElement>
              >
            }
            delay={300}
          />
        </div>

        {/* Table */}
        <div className="bg-base-100 rounded-lg shadow overflow-hidden">
          <Table
            headers={[
              ...(isAdminOrAtty && isSelecting
                ? [
                    {
                      key: "select",
                      label: (
                        <label className="inline-flex items-center justify-center gap-2">
                          <span>SELECT</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={allVisibleRecordsSelected}
                            onChange={(e) =>
                              handleToggleSelectAllVisibleRecords(
                                e.target.checked,
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select all visible sheriff cases"
                            disabled={visibleRecordIds.length === 0}
                          />
                        </label>
                      ),
                      align: "center" as const,
                    },
                  ]
                : []),
              { key: "caseNumber", label: "CASE NUMBER", sortable: true },
              { key: "sheriffName", label: "SHERIFF NAME", sortable: true },
              { key: "mortgagee", label: "MORTGAGEE", sortable: true },
              { key: "mortgagor", label: "MORTGAGOR", sortable: true },
              { key: "dateFiled", label: "DATE FILED", sortable: true },
              { key: "remarks", label: "REMARKS" },
            ]}
            data={records}
            rowsPerPage={PAGE_SIZE}
            showPagination={false}
            resizableColumns
            disableCellTooltips={false}
            minColumnWidth={110}
            sortConfig={{ key: sortConfig.key, order: sortConfig.order }}
            onSort={(k) => handleSort(k as SortKey)}
            renderRow={(r) => (
              <SherriffCaseRow
                key={r.id}
                record={r}
                onRowClick={
                  isTransmittal
                    ? undefined
                    : (item) => {
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
                      }
                }
                selected={selectedRecordIds.includes(r.id)}
                isSelecting={isSelecting}
                onToggleSelect={
                  isSelecting ? handleToggleRecordSelection : undefined
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

export default Sherriff;
