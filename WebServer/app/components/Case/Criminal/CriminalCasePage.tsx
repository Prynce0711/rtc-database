"use client";

import { isTextFieldKey } from "@/app/lib/utils";
import {
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  getFilterStateFromSearchParams,
  PageListSkeleton,
  Pagination,
  Table,
  usePopup,
  useSession,
} from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
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
import CriminalCaseRow from "./CriminalCaseRow";
import {
  deleteCriminalCase,
  getCriminalCases,
  getCriminalCaseStats,
} from "./CriminalCasesActions";
import {
  calculateCriminalCaseStats,
  CriminalCaseStats,
  type CriminalCaseData,
  type CriminalCaseFilters,
  type CriminalCasesFilterOptions,
} from "./CriminalCaseSchema";
import { exportCasesExcel, uploadExcel } from "./ExcelActions";

// TODO: Move import excel here instead of server action and just call createCase
// TODO: Maybe add a reusable CasePage component that you put schema and it will make the filter and table?

type CaseFilterValues = CriminalCaseFilters;
type SortKey = NonNullable<CriminalCasesFilterOptions["sortKey"]>;
type CaseFilters = NonNullable<CriminalCasesFilterOptions["filters"]>;

const CriminalCasePage: React.FC = () => {
  const [cases, setCases] = useState<CriminalCaseData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stats, setStats] = useState<CriminalCaseStats>({
    totalCases: 0,
    detainedCases: 0,
    pendingCases: 0,
    recentlyFiled: 0,
  });

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === "admin" ||
    session?.data?.user?.role === "atty";
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

  const urlFilterState = useMemo(
    () => getFilterStateFromSearchParams(searchParams),
    [searchParams],
  );

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
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const handleToggleCaseSelection = (caseId: number, checked: boolean) => {
    setSelectedCaseIds((prev) => {
      if (checked) {
        if (prev.includes(caseId)) return prev;
        return [...prev, caseId];
      }
      return prev.filter((id) => id !== caseId);
    });
  };

  const fetchCases = useCallback(
    async (page = currentPage) => {
      try {
        const [casesRes, statsRes] = await Promise.all([
          getCriminalCases({
            page,
            pageSize,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          getCriminalCaseStats({
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

    const res = await getCriminalCases({
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

  const handleDeleteCase = async (caseId: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this case?",
      ))
    )
      return;

    const result = await deleteCriminalCase(caseId);
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
        selectedCaseIds.map((caseId) => deleteCriminalCase(caseId)),
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

      setSelectedCaseIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
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
      const result = await uploadExcel(file);
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
      const result = await exportCasesExcel();
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
      {/* Header */}
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Criminal Cases
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                <FiFileText className="shrink-0" />
                <span>Manage all criminal cases</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 flex-nowrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                {isAdminOrAtty && (
                  <>
                    <button
                      className={`btn btn-outline btn-md gap-2 ${uploading ? "loading" : ""}`}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <FiUpload className="h-5 w-5" />
                      {uploading ? "Importing..." : "Import"}
                    </button>
                    <button
                      className={`btn btn-outline btn-info btn-md gap-2 ${exporting ? "loading" : ""}`}
                      onClick={handleExportExcel}
                      disabled={exporting}
                    >
                      <FiDownload className="h-5 w-5" />
                      {exporting ? "Exporting..." : "Export"}
                    </button>
                    <button
                      className="btn btn-success btn-md gap-2"
                      onClick={() => router.push("/user/cases/criminal/add")}
                    >
                      <FiFileText className="h-5 w-5" />
                      Add Case
                    </button>
                  </>
                )}
              </div>
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
              placeholder="Search case number..."
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
            className="btn btn-md btn-outline gap-2"
            onClick={() => {
              console.log(
                "Criminal Filter button clicked, current state:",
                filterModalOpen,
              );
              setFilterModalOpen((prev) => !prev);
            }}
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
          </button>

          <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
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
        {[
          {
            label: "Total Cases",
            value: stats.totalCases ?? 0,
            subtitle: `${(stats.recentlyFiled ?? 0).toLocaleString()} filed recently`,
            icon: FiBarChart2,
          },
          {
            label: "In Detention",
            value: stats.detainedCases ?? 0,
            subtitle: `${(((stats.detainedCases ?? 0) / Math.max(1, stats.totalCases ?? 1)) * 100).toFixed(1)}% of total`,
            icon: FiLock,
          },
          {
            label: "Pending Raffle",
            value: stats.pendingCases ?? 0,
            subtitle: `Requires raffle assignment`,
            icon: FiFileText,
          },
          {
            label: "Recently Filed",
            value: stats.recentlyFiled ?? 0,
            subtitle: `Last 30 days`,
            icon: FiUsers,
          },
        ].map((card, idx) => {
          const Icon = card.icon as React.ComponentType<
            React.SVGProps<SVGSVGElement>
          >;
          return (
            <div
              key={idx}
              className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="card-body relative overflow-hidden p-4 sm:p-6">
                <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10">
                  <Icon className="h-full w-full" />
                </div>
                <div className="relative text-center">
                  <div className="mb-2">
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-base-content/50">
                      {card.label}
                    </span>
                  </div>
                  <p className="text-3xl sm:text-4xl font-black text-base-content mb-1">
                    {card.value.toLocaleString()}
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

      {/* Cases Table */}
      {/* Selected Cases Bar */}
      {isAdminOrAtty && (
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
                        `/user/cases/criminal/edit?ids=${selectedCaseIds.join(",")}`,
                      )
                    }
                  >
                    Edit Selected
                  </button>
                  <button
                    className={`btn btn-sm btn-error btn-outline ${deletingSelected ? "loading" : ""}`}
                    onClick={handleDeleteSelectedCases}
                    disabled={deletingSelected}
                  >
                    <FiTrash2 className="h-4 w-4" />
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

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <Table
          headers={[
            ...(isAdminOrAtty
              ? [
                  {
                    key: "actions",
                    label: "Actions",
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
              onToggleSelect={handleToggleCaseSelection}
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
