"use client";

import { CaseType } from "@/app/generated/prisma/enums";
import { isTextFieldKey } from "@/app/lib/utils";
import {
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  PageListSkeleton,
  usePopup,
} from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiLock,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  deleteCivilCase,
  getCivilCases,
  getCivilCaseStats,
} from "./CivilActions";
import CivilCaseRow from "./CivilCaseRow";
import { caseToRecord, type NotarialRecord } from "./CivilTypes";
import { exportCasesExcel, uploadExcel } from "./ExcelActions";
import {
  calculateCivilCaseStats,
  type CivilCaseData,
  type CivilCaseFilters,
  type CivilCasesFilterOptions,
  type CivilCaseStats,
} from "./schema";
import { useSession } from "@/app/lib/authClient";

type CaseFilterValues = CivilCaseFilters;
type SortKey = NonNullable<CivilCasesFilterOptions["sortKey"]>;
type CaseFilters = NonNullable<CivilCasesFilterOptions["filters"]>;

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
// ─── Sort TH ─────────────────────────────────────────────────────────────────

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

// ─── Pagination ───────────────────────────────────────────────────────────────

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

const Pagination: React.FC<{
  pageCount: number;
  currentPage: number;
  onPageChange?: (page: number) => void;
}> = ({ pageCount, currentPage, onPageChange }) => {
  const [activeEllipsis, setActiveEllipsis] = useState<number | null>(null);
  const [ellipsisValue, setEllipsisValue] = useState<string>("");

  const getPages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const delta = 1;
    if (pageCount <= 1) return [1];
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(pageCount - 1, currentPage + delta);
    pages.push(1);
    if (rangeStart > 2) pages.push("...");
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < pageCount - 1) pages.push("...");
    if (pageCount > 1) pages.push(pageCount);
    return pages;
  };

  const submitEllipsis = (val?: string) => {
    const n = Number((val ?? ellipsisValue).trim());
    if (!Number.isNaN(n) && n >= 1 && n <= pageCount) onPageChange?.(n);
    setActiveEllipsis(null);
    setEllipsisValue("");
  };
  const pages = getPages();

  return (
    <div className="w-full flex justify-center py-4">
      <div className="join shadow-sm bg-base-100 rounded-lg p-1">
        {currentPage > 1 && (
          <button
            className="join-item btn btn-sm btn-ghost"
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
          >
            <GrFormPrevious className="w-5 h-5" />
          </button>
        )}

        {pages.map((page, index) => {
          if (page === "...") {
            if (activeEllipsis === index) {
              return (
                <div key={`ell-${index}`} className="join-item">
                  <input
                    autoFocus
                    className="input input-sm w-20 text-center"
                    value={ellipsisValue}
                    onChange={(e) => setEllipsisValue(e.target.value)}
                    onBlur={() => submitEllipsis()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEllipsis();
                      if (e.key === "Escape") {
                        setActiveEllipsis(null);
                        setEllipsisValue("");
                      }
                    }}
                  />
                </div>
              );
            }
            return (
              <button
                key={`ell-btn-${index}`}
                className="join-item btn btn-sm btn-ghost"
                onClick={() => {
                  setActiveEllipsis(index);
                  setEllipsisValue("");
                }}
              >
                ...
              </button>
            );
          }
          return (
            <PageButton
              key={page}
              isActive={currentPage === page}
              onClick={() => onPageChange?.(page as number)}
            >
              {page}
            </PageButton>
          );
        })}

        <button
          className="join-item btn btn-sm btn-ghost"
          onClick={() => onPageChange?.(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage >= pageCount}
        >
          <GrFormNext className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Civil: React.FC = () => {
  const router = useRouter();
  const statusPopup = usePopup();
  const [records, setRecords] = useState<NotarialRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
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

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === "admin" ||
    session?.data?.user?.role === "atty";
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
          getCivilCases({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          getCivilCaseStats({
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
        setRecords(result.items.map(caseToRecord));
        setTotalCount(result.total ?? result.items.length);
        setStats(calculateCivilCaseStats(result.items));

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

    const res = await getCivilCases({
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
      : (res.result.items as CivilCaseData[]);

    const values = items
      .map((c) => (c[key as keyof CivilCaseData] as string | null) || "")
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

    const result = await deleteCivilCase(id);
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
        selectedRecordIds.map((id) => deleteCivilCase(id)),
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
      const result = await uploadExcel(file, CaseType.CIVIL);
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
      const result = await exportCasesExcel();
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
    return <PageListSkeleton statCards={4} tableColumns={7} tableRows={8} />;
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Civil Cases
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                <FiFileText className="shrink-0" />
                <span>Manage civil cases and filings</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 flex-nowrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImport}
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
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      <FiDownload className="h-5 w-5" />
                      {exporting ? "Exporting..." : "Export"}
                    </button>
                    <button
                      className="btn btn-success btn-md gap-2"
                      onClick={() => router.push("/user/cases/civil/add")}
                    >
                      <FiFileText className="h-5 w-5" />
                      Add Record
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
              placeholder="Search case number, branch..."
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
            className={`btn btn-md btn-outline gap-2 ${appliedFilters && Object.keys(appliedFilters).length > 0 ? "btn-primary" : ""}`}
            onClick={() => {
              console.log(
                "Civil Filter button clicked, current state:",
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
            {appliedFilters && Object.keys(appliedFilters).length > 0 && (
              <span className="badge badge-sm badge-primary ml-1">
                {Object.keys(appliedFilters).length}
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "TOTAL CASES",
            value: (stats.totalCases ?? 0).toLocaleString(),
            subtitle: "All civil cases",
            icon: FiBarChart2,
          },
          {
            label: "RECENTLY FILED",
            value: (stats.recentlyFiled ?? 0).toLocaleString(),
            subtitle: "Filed in the last 30 days",
            icon: FiFileText,
          },
          {
            label: "RE-RAFFLED",
            value: (stats.reRaffledCases ?? 0).toLocaleString(),
            subtitle: "Re-raffled cases",
            icon: FiUsers,
          },
          {
            label: "REMANDED",
            value: (stats.remandedCases ?? 0).toLocaleString(),
            subtitle: "Cases remanded",
            icon: FiLock,
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
                    {card.value}
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

      {/* Selected Records Bar */}
      {isAdminOrAtty && (
        <AnimatePresence>
          {selectedRecordIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
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
                        `/user/cases/civil/edit?ids=${selectedRecordIds.join(",")}`,
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

      {/* Table */}
      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <div className="overflow-x-auto">
          <table className="table table-sm w-full text-center">
            <thead>
              <tr className="bg-base-200/50 border-b border-base-200">
                {isAdminOrAtty && (
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
                <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                  Notes/Appealed
                </th>
                <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                  Nature of Petition
                </th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdminOrAtty ? 8 : 7}
                    className="py-16 text-center text-base-content/40"
                  >
                    <div className="flex flex-col items-center justify-center py-12">
                      <FiFileText className="w-16 h-16 opacity-20 mb-4" />
                      <p className="text-lg font-semibold text-base-content/50 uppercase tracking-wide">
                        No records found
                      </p>
                      <p className="text-sm mt-2 text-base-content/35">
                        No civil cases match your current filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <CivilCaseRow
                    key={r.id}
                    record={r}
                    onEdit={(item) => {
                      router.push(`/user/cases/civil/edit?id=${item.id}`);
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
                      router.push(`/user/cases/civil/${item.id}`);
                    }}
                    selected={selectedRecordIds.includes(r.id)}
                    onToggleSelect={handleToggleRecordSelection}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
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

export default Civil;
