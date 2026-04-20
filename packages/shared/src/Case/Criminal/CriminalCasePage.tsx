"use client";

import {
  calculateCriminalCaseStats,
  CriminalCaseAdapter,
  CriminalCaseStats,
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  getFilterStateFromSearchParams,
  isTextFieldKey,
  PageListSkeleton,
  Pagination,
  Roles,
  Table,
  usePopup,
  type CriminalCaseData,
  type CriminalCaseFilters,
  type CriminalCasesFilterOptions,
} from "@rtc-database/shared";
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
  FiUpload,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  useAdaptiveNavigation,
  useAdaptivePathname,
} from "../../lib/nextCompat";
import StatsCard from "../../Stats/StatsCard";
import { ButtonStyles } from "../../Utils/ButtonStyles";
import CriminalCaseRow from "./CriminalCaseRow";

// TODO: Move import excel here instead of server action and just call createCase
// TODO: Maybe add a reusable CasePage component that you put schema and it will make the filter and table?

type CaseFilterValues = CriminalCaseFilters;
type SortKey = NonNullable<CriminalCasesFilterOptions["sortKey"]>;
type CaseFilters = NonNullable<CriminalCasesFilterOptions["filters"]>;

const CriminalCasePage: React.FC<{
  role: Roles;
  adapter: CriminalCaseAdapter;
}> = ({ role, adapter }) => {
  const [cases, setCases] = useState<CriminalCaseData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = useAdaptivePathname();
  const router = useAdaptiveNavigation();
  const [searchParams, setSearchParams] = useState<URLSearchParams>(
    () => new URLSearchParams(),
  );
  const [stats, setStats] = useState<CriminalCaseStats>({
    totalCases: 0,
    detainedCases: 0,
    pendingCases: 0,
    recentlyFiled: 0,
  });

  const isAdminOrAtty = role === "admin" || role === "atty";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const statusPopup = usePopup();

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    order: "asc" | "desc";
  }>({ key: "dateFiled", order: "desc" });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<CaseFilterValues>({});
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
  const isSelecting = selectionMode !== null;

  const urlFilterState = useMemo(
    () => getFilterStateFromSearchParams(searchParams),
    [searchParams],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateSearchParams = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };

    updateSearchParams();
    window.addEventListener("popstate", updateSearchParams);
    window.addEventListener("hashchange", updateSearchParams);

    return () => {
      window.removeEventListener("popstate", updateSearchParams);
      window.removeEventListener("hashchange", updateSearchParams);
    };
  }, [pathname]);

  useEffect(() => {
    const nextFilters = urlFilterState.filters as CaseFilterValues;
    const nextExactMatchMap = urlFilterState.exactMatchMap;

    setAppliedFilters((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(nextFilters)) return prev;
      return nextFilters;
    });

    setExactMatchMap((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(nextExactMatchMap)) {
        return prev;
      }
      return nextExactMatchMap;
    });
  }, [urlFilterState]);

  const caseFilterOptions: FilterOption[] = [
    { key: "branch", label: "Branch", type: "text" },
    { key: "assistantBranch", label: "Assistant Branch", type: "text" },
    { key: "caseNumber", label: "Case Number", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "charge", label: "Charge", type: "text" },
    { key: "infoSheet", label: "Info Sheet", type: "text" },
    { key: "court", label: "Court", type: "text" },
    { key: "consolidation", label: "Consolidation", type: "text" },
    { key: "eqcNumber", label: "EQC Number", type: "number" },
    { key: "detained", label: "Detained", type: "text" },
    { key: "dateFiled", label: "Date Filed", type: "daterange" },
    { key: "raffleDate", label: "Raffle Date", type: "daterange" },
    { key: "committee1", label: "Committee 1", type: "text" },
    { key: "committee2", label: "Committee 2", type: "text" },
    { key: "judge", label: "Judge", type: "text" },
    { key: "ao", label: "AO", type: "text" },
    { key: "complainant", label: "Complainant", type: "text" },
    { key: "houseNo", label: "House No", type: "text" },
    { key: "street", label: "Street", type: "text" },
    { key: "barangay", label: "Barangay", type: "text" },
    { key: "municipality", label: "Municipality", type: "text" },
    { key: "province", label: "Province", type: "text" },
    { key: "counts", label: "Counts", type: "number" },
    { key: "jdf", label: "JDF", type: "number" },
    { key: "sajj", label: "SAJJ", type: "number" },
    { key: "sajj2", label: "SAJJ2", type: "number" },
    { key: "mf", label: "MF", type: "number" },
    { key: "stf", label: "STF", type: "number" },
    { key: "lrf", label: "LRF", type: "number" },
    { key: "vcf", label: "VCF", type: "number" },
    { key: "total", label: "Total", type: "number" },
    { key: "amountInvolved", label: "Amount Involved", type: "number" },
  ];

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

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

  const cancelSelectionMode = () => {
    setSelectionMode(null);
    setSelectedCaseIds([]);
  };

  const fetchCases = useCallback(
    async (page = currentPage) => {
      try {
        const [casesRes, statsRes] = await Promise.all([
          adapter.getCriminalCases({
            page,
            pageSize,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          adapter.getCriminalCaseStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!casesRes.success) {
          statusPopup.showError(casesRes.error || "Failed to fetch cases");
          return;
        }

        const result = casesRes.result;
        setCases(result.items);
        setTotalCount(result.total ?? result.items.length);
        setStats(calculateCriminalCaseStats(result.items));

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
      pageSize,
      sortConfig,
      statusPopup,
    ],
  );

  useEffect(() => {
    fetchCases(currentPage);
  }, [fetchCases, currentPage]);

  const totalItems = totalCount;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
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

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const getCaseSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const isTextField = isTextFieldKey(
      caseFilterOptions.reduce(
        (acc, opt) => {
          acc[opt.key] = opt.type;
          return acc;
        },
        {} as Record<string, string>,
      ),
      key,
    );

    if (!isTextField) return [];

    const res = await adapter.getCriminalCases({
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
      : (res.result.items as CriminalCaseData[]);

    const values = items
      .map(
        (c) =>
          (c[key as keyof CriminalCaseData] as string | null | undefined) || "",
      )
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

  const handleEditSelectedCases = () => {
    if (selectedCaseIds.length === 0) {
      statusPopup.showError("Select at least one row to edit.");
      return;
    }

    router.push(`/user/cases/criminal/edit?ids=${selectedCaseIds.join(",")}`);
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

  const handleDeleteCase = async (caseId: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this case?",
      ))
    )
      return;

    const result = await adapter.deleteCriminalCase(caseId);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete case");
      return;
    }

    statusPopup.showSuccess("Case deleted successfully");
    await fetchCases();
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
    statusPopup.showLoading("Deleting selected cases...");

    try {
      const results = await Promise.allSettled(
        selectedCaseIds.map((caseId) => adapter.deleteCriminalCase(caseId)),
      );

      const failedIds: number[] = [];
      const deletedIds: number[] = [];

      results.forEach((result, index) => {
        const caseId = selectedCaseIds[index];
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
      setSelectedCaseIds([]);
      await fetchCases();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await adapter.uploadExcel(file);
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

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const result = await adapter.exportCasesExcel();
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to export cases");
        return;
      }

      if (!result.result) {
        statusPopup.showError("No data to export");
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

  const activeFilterCount = useMemo(
    () => Object.keys(appliedFilters ?? {}).length,
    [appliedFilters],
  );

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={10} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
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
                <span className="text-base-content/70 font-medium">
                  Criminal
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Criminal Cases
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/50">
                <FiCalendar className="shrink-0" />
                <span>Manage criminal cases and filings</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isAdminOrAtty && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportExcel}
                  />
                  <button
                    className={`${ButtonStyles.info} ${uploading ? "loading" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <FiUpload className="h-5 w-5" />
                    {uploading ? "Importing..." : "Import Excel"}
                  </button>
                </>
              )}

              <button
                className={`${ButtonStyles.info} ${exporting ? "loading" : ""}`}
                onClick={handleExportExcel}
                disabled={exporting}
              >
                <FiDownload className="h-5 w-5" />
                {exporting ? "Exporting..." : "Export Excel"}
              </button>

              {isAdminOrAtty && (
                <button
                  className={ButtonStyles.primary}
                  onClick={() => router.push("/user/cases/criminal/add")}
                >
                  <FiFileText className="h-5 w-5" />
                  Add Record
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filter Toolbar */}
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

          {isAdminOrAtty &&
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
          options={caseFilterOptions}
          onApply={handleApplyFilters}
          searchValue={appliedFilters}
          getSuggestions={getCaseSuggestions}
        />
      </div>

      {/* Stats Cards (KPI style) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          label="TOTAL CASES"
          value={(stats.totalCases ?? 0).toLocaleString()}
          subtitle="All criminal cases"
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
          label="IN DETENTION"
          value={(stats.detainedCases ?? 0).toLocaleString()}
          subtitle="Cases currently detained"
          icon={
            FiLock as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={200}
        />
        <StatsCard
          label="PENDING RAFFLE"
          value={(stats.pendingCases ?? 0).toLocaleString()}
          subtitle="Waiting raffle assignment"
          icon={
            FiUsers as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={300}
        />
      </div>

      {/* Cases Table */}
      {/* Selected Cases Bar */}
      {isAdminOrAtty && isSelecting && (
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
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setSelectedCaseIds([])}
                >
                  Clear Selection
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <Table
          headers={[
            ...(isAdminOrAtty && isSelecting
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
                          aria-label="Select all visible criminal cases"
                          disabled={visibleCaseIds.length === 0}
                        />
                      </label>
                    ),
                    align: "center" as const,
                  },
                ]
              : []),
            { key: "caseNumber", label: "Case Number", sortable: true },
            {
              key: "branch",
              label: "Branch",
              sortable: true,
            },
            {
              key: "assistantBranch",
              label: "Assistant Branch",
              sortable: true,
            },
            { key: "dateFiled", label: "Date Filed", sortable: true },
            { key: "caseType", label: "Case Type", sortable: true },
            { key: "name", label: "Name", sortable: true },
            { key: "charge", label: "Charge", sortable: true },
            { key: "infoSheet", label: "Info Sheet", sortable: true },
            { key: "court", label: "Court", sortable: true },
            {
              key: "detained",
              label: "Detained",
              sortable: true,
              align: "center",
            },
            { key: "consolidation", label: "Consolidation", sortable: true },
            { key: "eqcNumber", label: "EQC Number", sortable: true },
            { key: "bond", label: "Bond", sortable: true },
            { key: "raffleDate", label: "Raffle Date", sortable: true },
            { key: "committee1", label: "Committee 1", sortable: true },
            { key: "committee2", label: "Committee 2", sortable: true },
            { key: "judge", label: "Judge", sortable: true },
            { key: "ao", label: "AO", sortable: true },
            { key: "complainant", label: "Complainant", sortable: true },
            { key: "houseNo", label: "House No.", sortable: true },
            { key: "street", label: "Street", sortable: true },
            { key: "barangay", label: "Barangay", sortable: true },
            { key: "municipality", label: "Municipality", sortable: true },
            { key: "province", label: "Province", sortable: true },
            { key: "counts", label: "Counts", sortable: true },
            { key: "jdf", label: "JDF", sortable: true },
            { key: "sajj", label: "SAJJ", sortable: true },
            { key: "sajj2", label: "SAJJ2", sortable: true },
            { key: "mf", label: "MF", sortable: true },
            { key: "stf", label: "STF", sortable: true },
            { key: "lrf", label: "LRF", sortable: true },
            { key: "vcf", label: "VCF", sortable: true },
            { key: "total", label: "Total", sortable: true },
            {
              key: "amountInvolved",
              label: "Amount Involved",
              sortable: true,
            },
          ]}
          data={cases}
          rowsPerPage={pageSize}
          showPagination={false}
          sortConfig={{ key: sortConfig.key, order: sortConfig.order }}
          onSort={(k) => handleSort(k as SortKey)}
          renderRow={(caseItem) => (
            <CriminalCaseRow
              key={caseItem.id}
              caseItem={caseItem}
              handleDeleteCase={handleDeleteCase}
              onEdit={(item) => {
                router.push(`/user/cases/criminal/edit?id=${item.id}`);
              }}
              selected={selectedCaseIds.includes(caseItem.id)}
              isSelecting={isSelecting}
              onToggleSelect={
                isSelecting ? handleToggleCaseSelection : undefined
              }
              role={role}
            />
          )}
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-base-content/40">
          Showing page {currentPage} of {pageCount}
        </p>
        <Pagination
          pageCount={pageCount}
          currentPage={currentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
};

export default CriminalCasePage;
