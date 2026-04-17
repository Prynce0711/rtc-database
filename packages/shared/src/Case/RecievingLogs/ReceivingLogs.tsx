"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import FilterDropdown from "../../Filter/FilterDropdown";
import type {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../../Filter/FilterTypes";
import type { RecievingLog } from "../../generated/prisma/browser";
import { CaseType } from "../../generated/prisma/enums";
import { useAdaptiveRouter } from "../../lib/nextCompat";
import Roles from "../../lib/Roles";
import { usePopup } from "../../Popup/PopupProvider";
import { PageListSkeleton } from "../../Skeleton/SkeletonTable";
import StatsCard from "../../Stats/StatsCard";
import Pagination from "../../Table/Pagination";
import Table from "../../Table/Table";
import { ButtonStyles } from "../../Utils/ButtonStyles";
import ReceiveRow from "./ReceivingRow";
import type { RecievingLogsAdapter } from "./RecievingLogsAdapter";
import type { ReceivingLogFilterOptions } from "./RecievingLogsSchema";

type ReceiveLog = RecievingLog;
type ReceiveSortKey =
  | "bookAndPage"
  | "dateRecieved"
  | "caseType"
  | "caseNumber"
  | "content"
  | "branchNumber"
  | "notes";

type ReceiveLogFilterValues = NonNullable<ReceivingLogFilterOptions["filters"]>;

const CASE_TYPE_VALUES = new Set(Object.values(CaseType));

const normalizeCaseType = (value: unknown): CaseType | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  return CASE_TYPE_VALUES.has(normalized as CaseType)
    ? (normalized as CaseType)
    : undefined;
};

const toReceiveFilters = (filters: FilterValues): ReceiveLogFilterValues => ({
  ...filters,
  caseType: normalizeCaseType(filters.caseType),
});

const ReceiveLogsPage: React.FC<{
  adapter: RecievingLogsAdapter;
  role: Roles;
}> = ({ adapter, role }) => {
  const router = useAdaptiveRouter();
  const [logs, setLogs] = useState<ReceiveLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
  const [deletingSelected, setDeletingSelected] = useState(false);

  const isAdminOrAtty = role === Roles.ADMIN || role === Roles.ATTY;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const statusPopup = usePopup();

  const [sortConfig, setSortConfig] = useState<{
    key: ReceiveSortKey;
    order: "asc" | "desc";
  }>({ key: "dateRecieved", order: "desc" });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ReceiveLogFilterValues>(
    {},
  );
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisMonth: 0,
    docTypes: 0,
  });
  const isSelecting = selectionMode !== null;

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);

  const receiveFilterOptions: FilterOption[] = [
    { key: "bookAndPage", label: "Book and Pages", type: "text" },
    { key: "dateRecieved", label: "Date Received", type: "daterange" },
    { key: "caseType", label: "Case Type", type: "text" },
    { key: "caseNumber", label: "Case Number", type: "text" },
    { key: "content", label: "Content", type: "text" },
    { key: "branchNumber", label: "Branch Number", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, sortConfig, exactMatchMap]);

  const refreshFromBackend = useCallback(
    async (page = currentPage) => {
      try {
        const [listResult, statsResult] = await Promise.all([
          adapter.getRecievingLogsPage({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          adapter.getRecievingLogsStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!listResult.success) {
          setError(listResult.error || "Failed to fetch receiving logs");
          return;
        }

        setLogs(listResult.result.items);
        setTotalCount(
          listResult.result.total ?? listResult.result.items.length,
        );

        if (statsResult.success && statsResult.result) {
          setStats(statsResult.result);
        }

        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch receiving logs",
        );
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, currentPage, exactMatchMap, sortConfig],
  );

  useEffect(() => {
    void refreshFromBackend(currentPage);
  }, [refreshFromBackend, currentPage]);

  const handleSort = (key: ReceiveSortKey) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMap: ExactMatchMap,
  ) => {
    setAppliedFilters(toReceiveFilters(filters));
    setExactMatchMap(exactMap);
    setCurrentPage(1);
  };

  const getSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const textFields = [
      "bookAndPage",
      "caseNumber",
      "caseType",
      "branchNumber",
      "content",
      "notes",
    ];
    if (!textFields.includes(key)) return [];

    const result = await adapter.getRecievingLogsPage({
      page: 1,
      pageSize: 10,
      filters: toReceiveFilters({
        [key]: key === "caseType" ? normalizeCaseType(inputValue) : inputValue,
      }),
      exactMatchMap: { [key]: false },
      sortKey: key as ReceiveSortKey,
      sortOrder: "asc",
    });

    if (!result.success || !result.result) return [];

    const values = result.result.items
      .map((l) => {
        const val = l[key as keyof ReceiveLog];
        return val ? val.toString() : "";
      })
      .filter((v) => v.length > 0);

    const unique = Array.from(new Set(values)).sort();
    if (!inputValue) return unique;
    return unique.filter((v) =>
      v.toLowerCase().includes(inputValue.toLowerCase()),
    );
  };

  const handleDeleteLog = async (logId: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this entry?",
      ))
    )
      return;
    const result = await adapter.deleteRecievingLog(logId);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete");
      return;
    }
    await refreshFromBackend();
    statusPopup.showSuccess("Entry deleted successfully");
  };

  const handleDeleteSelectedLogs = async () => {
    if (selectedLogIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Are you sure you want to delete ${selectedLogIds.length} selected entr${selectedLogIds.length > 1 ? "ies" : "y"}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    statusPopup.showLoading("Deleting selected receiving logs...");

    try {
      const results = await Promise.allSettled(
        selectedLogIds.map((id) => adapter.deleteRecievingLog(id)),
      );

      const deletedIds: number[] = [];
      const failedIds: number[] = [];

      results.forEach((result, index) => {
        const id = selectedLogIds[index];
        if (result.status === "fulfilled" && result.value.success) {
          deletedIds.push(id);
          return;
        }
        failedIds.push(id);
      });

      setSelectedLogIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );

      if (failedIds.length > 0) {
        statusPopup.showError(
          `Deleted ${deletedIds.length} entr${deletedIds.length > 1 ? "ies" : "y"}, but failed to delete ${failedIds.length}.`,
        );
      } else {
        statusPopup.showSuccess(
          `Deleted ${deletedIds.length} selected entr${deletedIds.length > 1 ? "ies" : "y"}.`,
        );
      }

      await refreshFromBackend();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleEditSelectedLogs = () => {
    if (selectedLogIds.length === 0) {
      statusPopup.showError("Select at least one row to edit.");
      return;
    }

    router.push(`/user/cases/receiving/edit?ids=${selectedLogIds.join(",")}`);
  };

  const cancelSelectionMode = () => {
    setSelectionMode(null);
    setSelectedLogIds([]);
  };

  const applySelectionMode = async () => {
    if (selectedLogIds.length === 0) {
      statusPopup.showError("Select at least one entry first.");
      return;
    }

    if (selectionMode === "edit") {
      handleEditSelectedLogs();
      return;
    }

    if (selectionMode === "delete") {
      await handleDeleteSelectedLogs();
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      statusPopup.showError("File too large. Max 25 MB allowed.");
      input.value = "";
      return;
    }

    const okExt = ["xlsx", "xls"];
    const name = file.name || "";
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (!okExt.includes(ext)) {
      statusPopup.showError("Only Excel files (.xlsx/.xls) are allowed.");
      input.value = "";
      return;
    }

    setUploading(true);
    try {
      statusPopup.showLoading("Importing... Please wait.");
      const result = await adapter.uploadReceiveExcel(file);
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
        statusPopup.showError(result.error || "Import failed");
        input.value = "";
        return;
      }

      if ((importPayload?.meta.importedCount ?? 0) === 0) {
        statusPopup.showError(
          "No valid rows to import. Failed rows have been downloaded for review.",
        );
        input.value = "";
        return;
      }

      statusPopup.showSuccess("Import successful!");

      if (importPayload?.failedExcel) {
        statusPopup.showSuccess(
          "Import complete. Failed rows have been downloaded for review.",
        );
      }

      setCurrentPage(1);
      await refreshFromBackend(1);
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={8} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <header className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                  <span>Cases</span>
                  <span className="text-base-content/30">/</span>
                  <span className="text-base-content/70 font-medium">
                    Receiving Logs
                  </span>
                </div>
                <h2 className="text-4xl lg:text-5xl font-bold text-base-content">
                  Receiving Logs
                </h2>
                <p className="flex text-base items-center gap-2 text-base-content/50 mt-1.5">
                  <FiCalendar className="shrink-0 w-4 h-4" />
                  <span>Track all received documents and case filings</span>
                </p>
              </div>
              {isAdminOrAtty && (
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      className={`${ButtonStyles.info} ${uploading ? "loading" : ""}`}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      aria-busy={uploading}
                      aria-label="Import Excel file"
                    >
                      <FiUpload className="h-5 w-5" />
                      {uploading ? "Importing..." : "Import Excel"}
                    </button>
                    <button
                      className={`${ButtonStyles.info} ${exporting ? "loading" : ""}`}
                      onClick={async () => {
                        setExporting(true);
                        try {
                          const result = await adapter.exportReceiveLogsExcel();
                          if (!result.success) {
                            statusPopup.showError(
                              result.error || "Failed to export receiving logs",
                            );
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
                      }}
                      disabled={exporting}
                      aria-busy={exporting}
                      aria-label="Export data to Excel"
                    >
                      <FiDownload className="h-5 w-5" />
                      {exporting ? "Exporting..." : "Export Excel"}
                    </button>

                    <button
                      className={ButtonStyles.primary}
                      onClick={() => {
                        router.push("/user/cases/receiving/add");
                      }}
                      aria-label="Add new receiving log entry"
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
                      Add Entry
                    </button>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportExcel}
            />
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
        </header>

        {/* Search + Filter + Add */}
        <div className="relative mb-6">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-lg z-10" />
              <input
                type="text"
                placeholder="Search case number..."
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
              className={`${ButtonStyles.secondary} ${Object.keys(appliedFilters).length > 0 ? "btn-primary" : ""}`}
              onClick={() => {
                setFilterModalOpen((prev) => !prev);
              }}
              aria-label={`Filter (${Object.keys(appliedFilters).length} active)`}
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
            </button>

            {isAdminOrAtty &&
              (isSelecting ? (
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs text-base-content/40 tabular-nums">
                    {selectedLogIds.length} selected
                  </span>
                  <button
                    type="button"
                    className={`btn btn-md gap-2 ${selectionMode === "delete" ? "btn-error" : "btn-primary"} ${deletingSelected ? "loading" : ""}`}
                    onClick={() => void applySelectionMode()}
                    disabled={selectedLogIds.length === 0 || deletingSelected}
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
                        setSelectedLogIds([]);
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
                        setSelectedLogIds([]);
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
            options={receiveFilterOptions}
            onApply={handleApplyFilters}
            searchValue={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        {isAdminOrAtty && isSelecting && (
          <AnimatePresence>
            {selectedLogIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mb-4 overflow-hidden"
              >
                <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-primary flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {selectedLogIds.length} entr
                    {selectedLogIds.length > 1 ? "ies" : "y"} selected
                  </div>
                  <button
                    className="btn btn-ghost btn-md"
                    onClick={() => setSelectedLogIds([])}
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatsCard
            label="Total Entries"
            value={(stats.total ?? 0).toLocaleString()}
            subtitle={`${(stats.thisMonth ?? 0).toLocaleString()} this month`}
            icon={FiBarChart2}
            delay={0}
          />
          <StatsCard
            label="Today"
            value={(stats.today ?? 0).toLocaleString()}
            subtitle="Received today"
            icon={FiFileText}
            delay={100}
          />
          <StatsCard
            label="This Month"
            value={(stats.thisMonth ?? 0).toLocaleString()}
            subtitle="Last 30 days"
            icon={FiLock}
            delay={200}
          />
          <StatsCard
            label="Doc Types"
            value={(stats.docTypes ?? 0).toLocaleString()}
            subtitle="Distinct types"
            icon={FiUsers}
            delay={300}
          />
        </div>

        {/* Table */}
        <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
          <Table
            headers={[
              ...(isAdminOrAtty && isSelecting
                ? [
                    {
                      key: "select",
                      label: "Select",
                      align: "center" as const,
                    },
                  ]
                : []),
              ...(isAdminOrAtty && !isSelecting
                ? [
                    {
                      key: "actions",
                      label: "Actions",
                      align: "center" as const,
                    },
                  ]
                : []),
              {
                key: "bookAndPage",
                label: "Book And Pages",
                sortable: true,
                align: "center",
              },
              {
                key: "dateRecieved",
                label: "Date Received",
                sortable: true,
                align: "center",
              },
              {
                key: "caseType",
                label: "Case Type",
                sortable: true,
                align: "center",
              },
              {
                key: "caseNumber",
                label: "Case Number",
                sortable: true,
                align: "center",
              },
              {
                key: "content",
                label: "Content",
                sortable: true,
                align: "center",
              },
              {
                key: "branchNumber",
                label: "Branch No",
                sortable: true,
                align: "center",
              },
              { key: "time", label: "Time", sortable: false, align: "center" },
              { key: "notes", label: "Notes", sortable: true, align: "center" },
            ]}
            data={logs as unknown as Record<string, unknown>[]}
            sortConfig={
              {
                key: sortConfig.key,
                order: sortConfig.order,
              } as { key: string; order: "asc" | "desc" }
            }
            onSort={(k) => handleSort(k as ReceiveSortKey)}
            showPagination={false}
            renderRow={(log) => (
              <ReceiveRow
                key={(log as unknown as ReceiveLog).id}
                log={log as unknown as ReceiveLog}
                onView={(l) => router.push(`/user/cases/receiving/${l.id}`)}
                isAdminOrAtty={isAdminOrAtty}
                onEdit={(l) =>
                  router.push(`/user/cases/receiving/edit?id=${l.id}`)
                }
                onDelete={(l) => handleDeleteLog(l.id)}
                isSelected={selectedLogIds.includes(
                  (log as unknown as ReceiveLog).id,
                )}
                isSelecting={isSelecting}
                onToggleSelect={
                  isSelecting
                    ? (id) =>
                        setSelectedLogIds((prev) =>
                          prev.includes(id)
                            ? prev.filter((entryId) => entryId !== id)
                            : [...prev, id],
                        )
                    : undefined
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

export default ReceiveLogsPage;
