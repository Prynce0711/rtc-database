"use client";

import { RecievingLog } from "@/app/generated/prisma/client";
import { CaseType } from "@/app/generated/prisma/enums";
import Roles from "@/app/lib/Roles";
import {
  ExactMatchMap,
  FilterDropdown,
  FilterOption,
  FilterValues,
  usePopup,
  useSession,
} from "@rtc-database/shared";
import Pagination from "@rtc-database/shared/src/Pagination/Pagination.js";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiEdit,
  FiFileText,
  FiLock,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { PageListSkeleton } from "../../Skeleton/SkeletonTable";
import ActionDropdown from "../../Table/ActionDropdown";
import Table from "../../Table/Table";
import { exportReceiveLogsExcel, uploadReceiveExcel } from "./ExcelActions";
import {
  deleteRecievingLog,
  getRecievingLogsPage,
  getRecievingLogsStats,
} from "./RecievingLogsActions";
import type { ReceivingLogFilterOptions } from "./schema";

type ReceiveLog = RecievingLog;
type ReceiveSortKey =
  | "bookAndPage"
  | "dateRecieved"
  | "caseType"
  | "caseNumber"
  | "content"
  | "branchNumber"
  | "notes";

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString();
};

const extractTime = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const ReceiveRow = ({
  log,
  onEdit,
  onDelete,
  isAdminOrAtty,
  isSelected,
  onToggleSelect,
}: {
  log: ReceiveLog;
  onEdit: (log: ReceiveLog) => void;
  onDelete: (log: ReceiveLog) => void;
  isAdminOrAtty: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}) => {
  const time = extractTime(log.dateRecieved);
  const date = formatDate(log.dateRecieved);
  const popoverId = `receive-logs-actions-popover-${log.id}`;
  const anchorName = `--receive-logs-actions-anchor-${log.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm">
      {isAdminOrAtty && onToggleSelect && (
        <td className="text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={Boolean(isSelected)}
            onChange={() => onToggleSelect(log.id)}
            aria-label={`Select receiving log ${log.id}`}
          />
        </td>
      )}
      {isAdminOrAtty && (
        <td
          className="relative text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <ActionDropdown popoverId={popoverId} anchorName={anchorName}>
            <li>
              <button
                className="flex items-center gap-3 text-warning"
                onClick={(e) => {
                  e.stopPropagation();
                  closeActionsPopover();
                  onEdit(log);
                }}
              >
                <FiEdit size={16} />
                <span>Edit</span>
              </button>
            </li>
            <li>
              <button
                className="flex items-center gap-3 text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  closeActionsPopover();
                  onDelete(log);
                }}
              >
                <FiTrash2 size={16} />
                <span>Delete</span>
              </button>
            </li>
          </ActionDropdown>
        </td>
      )}
      <td className="font-semibold text-center whitespace-nowrap">
        {log.bookAndPage || "-"}
      </td>
      <td className="text-center text-base-content/70 whitespace-nowrap">
        {date}
      </td>
      <td className="text-center">{log.caseType || "-"}</td>
      <td className="text-center">{log.caseNumber || "-"}</td>
      <td className="text-center">{log.content || "-"}</td>
      <td className="text-center">{log.branchNumber || "-"}</td>
      <td className="text-center">{time}</td>
      <td className="text-base-content/60 text-center">{log.notes || "-"}</td>
    </tr>
  );
};

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

const ReceiveLogsPage: React.FC = () => {
  const router = useRouter();
  const [logs, setLogs] = useState<ReceiveLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

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
          getRecievingLogsPage({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          getRecievingLogsStats({
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

    const result = await getRecievingLogsPage({
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
    const result = await deleteRecievingLog(logId);
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
        selectedLogIds.map((id) => deleteRecievingLog(id)),
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
      const result = await uploadReceiveExcel(file);
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
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Receiving Logs
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Track all received documents and case filings
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

        {/* Search + Filter + Add */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
            <input
              type="text"
              placeholder="Search case number..."
              className="input input-bordered input-lg w-full pl-12 text-base"
              value={appliedFilters?.caseNumber || ""}
              onChange={(e) =>
                setAppliedFilters((prev) => ({
                  ...prev,
                  caseNumber: e.target.value,
                }))
              }
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportExcel}
            />
            <button
              type="button"
              className="btn btn-outline flex items-center gap-2"
              onClick={() => {
                console.log(
                  "ReceivingLogs Filter button clicked, current state:",
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
            </button>

            {isAdminOrAtty && (
              <>
                <button
                  className={`btn btn-outline ${uploading ? "loading" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {" "}
                  <FiUpload className="h-5 w-5" />
                  {uploading ? "Importing..." : "Import Excel"}
                </button>
                <button
                  className={`btn btn-outline ${exporting ? "loading" : ""}`}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const result = await exportReceiveLogsExcel();
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
                >
                  {" "}
                  <FiDownload className="h-5 w-5 mr-2" />
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    router.push("/user/cases/receiving/add");
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
                  Add Entry
                </button>
              </>
            )}
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

        {isAdminOrAtty && (
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
                  <div className="text-sm font-semibold text-primary">
                    {selectedLogIds.length} entr
                    {selectedLogIds.length > 1 ? "ies" : "y"} selected
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        router.push(
                          `/user/cases/receiving/edit?ids=${selectedLogIds.join(",")}`,
                        )
                      }
                    >
                      Edit Selected
                    </button>
                    <button
                      className={`btn btn-sm btn-error btn-outline ${deletingSelected ? "loading" : ""}`}
                      onClick={handleDeleteSelectedLogs}
                      disabled={deletingSelected}
                    >
                      Delete Selected
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setSelectedLogIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Entries",
              value: (stats.total ?? 0).toLocaleString(),
              subtitle: `${(stats.thisMonth ?? 0).toLocaleString()} this month`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "Today",
              value: (stats.today ?? 0).toLocaleString(),
              subtitle: `Today`,
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "This Month",
              value: (stats.thisMonth ?? 0).toLocaleString(),
              subtitle: `Last 30 days`,
              icon: FiLock,
              delay: 200,
            },
            {
              label: "Doc Types",
              value: (stats.docTypes ?? 0).toLocaleString(),
              subtitle: `Distinct types`,
              icon: FiUsers,
              delay: 300,
            },
          ].map((card, idx) => {
            const Icon = card.icon as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >;
            return (
              <div
                key={idx}
                className={`transform hover:scale-105 card surface-card-hover group`}
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
                      {card.value}
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
          <Table
            headers={[
              {
                key: "select",
                label: "Select",
                align: "center" as const,
              },
              {
                key: "actions",
                label: "Actions",
                align: "center" as const,
              },
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
                isAdminOrAtty={isAdminOrAtty}
                onEdit={(l) =>
                  router.push(`/user/cases/receiving/edit?id=${l.id}`)
                }
                onDelete={(l) => handleDeleteLog(l.id)}
                isSelected={selectedLogIds.includes(
                  (log as unknown as ReceiveLog).id,
                )}
                onToggleSelect={(id) =>
                  setSelectedLogIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((entryId) => entryId !== id)
                      : [...prev, id],
                  )
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
