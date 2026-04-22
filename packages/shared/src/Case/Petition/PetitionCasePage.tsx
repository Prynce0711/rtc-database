"use client";

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
import type { PetitionCaseAdapter } from "./PetitionCaseAdapter";
import PetitionCaseRow from "./PetitionCaseRow";
import type {
  PetitionCaseData,
  PetitionCaseFilters,
  PetitionCasesFilterOptions,
  PetitionCaseStats,
} from "./PetitionCaseSchema";

type CaseFilterValues = PetitionCaseFilters;
type SortKey = NonNullable<PetitionCasesFilterOptions["sortKey"]>;
type SortConfig = { key: SortKey; order: "asc" | "desc" };

const PETITION_FILTER_OPTIONS: FilterOption[] = [
  { key: "caseNumber", label: "Case Number", type: "text" },
  { key: "petitioner", label: "Petitioner", type: "text" },
  { key: "raffledTo", label: "Raffled To", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
  { key: "date", label: "Date", type: "daterange" },
];

const PAGE_SIZE = 10;

const PetitionCasePage: React.FC<{
  role: Roles;
  adapter: PetitionCaseAdapter;
}> = ({ role, adapter }) => {
  const router = useAdaptiveNavigation();
  const statusPopup = usePopup();

  const [cases, setCases] = useState<PetitionCaseData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
  const [stats, setStats] = useState<PetitionCaseStats>({
    totalEntries: 0,
    todayEntries: 0,
    thisMonthEntries: 0,
    distinctBranches: 0,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
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
  const isSelecting = selectionMode !== null;

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
          adapter.getPetitions({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          adapter.getPetitionStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!casesRes.success || !casesRes.result) {
          statusPopup.showError(
            !casesRes.success
              ? casesRes.error || "Failed to fetch petitions"
              : "Failed to fetch petitions",
          );
          return;
        }

        setCases(casesRes.result.items);
        setTotalCount(casesRes.result.total ?? casesRes.result.items.length);

        if (statsRes.success && statsRes.result) {
          setStats(statsRes.result);
        }

        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch petitions",
        );
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

  const getSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const isTextField = isTextFieldKey(
      PETITION_FILTER_OPTIONS.reduce(
        (acc, option) => {
          acc[option.key] = option.type;
          return acc;
        },
        {} as Record<string, string>,
      ),
      key,
    );

    if (!isTextField) return [];

    const response = await adapter.getPetitions({
      page: 1,
      pageSize: 10,
      filters: { [key]: inputValue } as CaseFilterValues,
      exactMatchMap: { [key]: false },
      sortKey: key as SortKey,
      sortOrder: "asc",
    });

    if (!response.success || !response.result) return [];

    const values = response.result.items
      .map(
        (item) => (item[key as keyof PetitionCaseData] as string | null) || "",
      )
      .filter((value) => value.length > 0);

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

  const handleDeleteSelectedCases = async () => {
    if (selectedCaseIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Are you sure you want to delete ${selectedCaseIds.length} selected petition${selectedCaseIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    try {
      const results = await Promise.allSettled(
        selectedCaseIds.map((id) => adapter.deletePetition(id)),
      );
      const failed = results.filter(
        (result) => result.status !== "fulfilled" || !result.value.success,
      ).length;

      if (failed > 0) {
        statusPopup.showError(
          `Deleted ${selectedCaseIds.length - failed} petition(s), failed ${failed}.`,
        );
      } else {
        statusPopup.showSuccess(
          `Deleted ${selectedCaseIds.length} selected petition${selectedCaseIds.length > 1 ? "s" : ""}.`,
        );
      }

      setSelectionMode(null);
      setSelectedCaseIds([]);
      await fetchCases();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleEditSelectedCases = () => {
    if (selectedCaseIds.length === 0) {
      statusPopup.showError("Select at least one row to edit.");
      return;
    }

    router.push(`/user/cases/petition/edit?ids=${selectedCaseIds.join(",")}`);
  };

  const cancelSelectionMode = () => {
    setSelectionMode(null);
    setSelectedCaseIds([]);
  };

  const handleApplySelectionMode = async () => {
    if (selectedCaseIds.length === 0) {
      statusPopup.showError("Select at least one petition first.");
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
    const result = await adapter.uploadPetitionExcel(file);
    setUploading(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Upload failed");
      return;
    }

    statusPopup.showSuccess("Excel upload completed.");

    if (result.result?.failedExcel) {
      const { fileName, base64 } = result.result.failedExcel;
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

    await fetchCases();
  };

  const handleExport = async () => {
    setExporting(true);
    const result = await adapter.exportPetitionsExcel();
    setExporting(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Export failed");
      return;
    }

    const link = document.createElement("a");
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
    link.download = result.result.fileName;
    link.click();
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
                <span className="text-base-content/70 font-medium">
                  Petition
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Petition Cases
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                <FiCalendar className="shrink-0" />
                <span>Track all petition entries and case filings</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                className={`${ButtonStyles.info} ${exporting ? "loading" : ""}`}
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                <FiDownload className="h-5 w-5" />
                {exporting ? "Exporting..." : "Export"}
              </button>

              {canManage && (
                <button
                  className={ButtonStyles.primary}
                  onClick={() => router.push("/user/cases/petition/add")}
                >
                  <FiFileText className="h-5 w-5" />
                  Add Entry
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
              placeholder="Search case number..."
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

          <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
            {totalCount} record{totalCount !== 1 && "s"}
          </span>
        </div>

        <FilterDropdown
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          options={PETITION_FILTER_OPTIONS}
          onApply={handleApplyFilters}
          searchValue={appliedFilters}
          getSuggestions={getSuggestions}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          label="TOTAL ENTRIES"
          value={(stats.totalEntries ?? 0).toLocaleString()}
          subtitle="All petition records"
          icon={
            FiBarChart2 as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={0}
        />
        <StatsCard
          label="TODAY"
          value={(stats.todayEntries ?? 0).toLocaleString()}
          subtitle="Filed today"
          icon={
            FiFileText as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={100}
        />
        <StatsCard
          label="THIS MONTH"
          value={(stats.thisMonthEntries ?? 0).toLocaleString()}
          subtitle="Filed this month"
          icon={
            FiLock as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={200}
        />
        <StatsCard
          label="BRANCHES"
          value={(stats.distinctBranches ?? 0).toLocaleString()}
          subtitle="Distinct raffle branches"
          icon={
            FiUsers as unknown as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >
          }
          delay={300}
        />
      </div>

      <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200 shadow-lg">
        <Table
          headers={[
            ...(canManage && isSelecting
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
                          aria-label="Select all visible petition cases"
                          disabled={visibleCaseIds.length === 0}
                        />
                      </label>
                    ),
                    align: "center" as const,
                  },
                ]
              : []),
            { key: "caseNumber", label: "Case Number", sortable: true },
            { key: "raffledTo", label: "Raffled To", sortable: true },
            { key: "date", label: "Date", sortable: true },
            { key: "petitioner", label: "Petitioner", sortable: true },
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
            <PetitionCaseRow
              key={caseItem.id}
              caseItem={caseItem}
              onView={(item) => router.push(`/user/cases/petition/${item.id}`)}
              selected={selectedCaseIds.includes(caseItem.id)}
              isSelecting={isSelecting}
              onToggleSelect={
                isSelecting ? handleToggleCaseSelection : undefined
              }
              canManage={canManage}
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

export default PetitionCasePage;
