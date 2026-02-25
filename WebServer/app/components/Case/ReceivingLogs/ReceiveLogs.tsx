"use client";

import { RecievingLog } from "@/app/generated/prisma/client";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch } from "react-icons/fi";
import FilterModal from "../../Filter/FilterModal";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../../Filter/FilterTypes";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import Table from "../../Table/Table";
import { exportReceiveLogsExcel, uploadReceiveExcel } from "./ExcelActions";
import ReceiveDrawer, { ReceiveDrawerType } from "./ReceiveDrawer";
import { deleteRecievingLog, getRecievingLogs } from "./RecievingLogsActions";

type ReceiveLog = RecievingLog & {
  time?: string;
};

const calculateReceiveLogStats = (logs: ReceiveLog[]) => {
  const today = new Date().toDateString();
  const thisMonth = new Date().getMonth();
  return {
    total: logs.length,
    today: logs.filter(
      (l) => new Date(l.dateRecieved || 0).toDateString() === today,
    ).length,
    thisMonth: logs.filter(
      (l) => new Date(l.dateRecieved || 0).getMonth() === thisMonth,
    ).length,
    docTypes: new Set(logs.map((l) => l.caseType)).size,
  };
};

const sortReceiveLogs = (
  logs: ReceiveLog[],
  key: keyof ReceiveLog,
  order: "asc" | "desc",
) => {
  return [...logs].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
};

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
}: {
  log: ReceiveLog;
  onEdit: (log: ReceiveLog) => void;
  onDelete: (log: ReceiveLog) => void;
  isAdminOrAtty: boolean;
}) => {
  const time = extractTime(log.dateRecieved);
  const date = formatDate(log.dateRecieved);

  return (
    <tr>
      {isAdminOrAtty && (
        <td className="text-center">
          <div className="flex gap-2 justify-center">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => onEdit(log)}
            >
              Edit
            </button>
            <button
              className="btn btn-sm btn-error"
              onClick={() => onDelete(log)}
            >
              Delete
            </button>
          </div>
        </td>
      )}
      <td>{log.bookAndPage || "-"}</td>
      <td>{date}</td>
      <td>{log.caseType || "-"}</td>
      <td>{log.caseNumber || "-"}</td>
      <td>{log.content || "-"}</td>
      <td>{log.branchNumber || "-"}</td>
      <td>{time}</td>
      <td>{log.notes || "-"}</td>
    </tr>
  );
};

type ReceiveLogFilterValues = {
  bookAndPage?: string;
  caseNumber?: string;
  caseType?: string;
  branchNumber?: string;
  dateRecieved?: { start?: string; end?: string };
};

const ReceiveLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ReceiveLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerType, setDrawerType] = useState<ReceiveDrawerType | null>(null);
  const [selectedLog, setSelectedLog] = useState<ReceiveLog | null>(null);

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const statusPopup = usePopup();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ReceiveLog;
    order: "asc" | "desc";
  }>({ key: "dateRecieved", order: "desc" });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ReceiveLogFilterValues>(
    {},
  );
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<ReceiveLog[]>(
    [],
  );
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});

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
  }, [searchTerm, appliedFilters]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await getRecievingLogs();
      if (!response.success) {
        statusPopup.showError(
          response.error || "Failed to fetch receiving logs",
        );
        return;
      }
      const logsWithTime = response.result.map((log) => ({
        ...log,
        time: extractTime(log.dateRecieved),
      }));
      setLogs(logsWithTime as ReceiveLog[]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch receiving logs",
      );
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => calculateReceiveLogStats(logs), [logs]);

  const filteredAndSorted = useMemo(() => {
    const baseList =
      Object.keys(appliedFilters).length > 0 ? filteredByAdvanced : logs;

    let filtered = baseList;
    if (searchTerm) {
      filtered = baseList.filter((log) =>
        Object.values(log).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    }
    return sortReceiveLogs(filtered, sortConfig.key, sortConfig.order);
  }, [logs, searchTerm, sortConfig, appliedFilters, filteredByAdvanced]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage, PAGE_SIZE]);

  const handleSort = (key: keyof ReceiveLog) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const applyReceiveFilters = (
    filters: ReceiveLogFilterValues,
    items: ReceiveLog[],
    exactMap: ExactMatchMap = {},
  ): ReceiveLog[] => {
    return items.filter((log) => {
      const matchesText = (
        itemVal: string | null | undefined,
        filterVal: string,
        key: string,
      ): boolean => {
        if (!itemVal) return false;
        const isExact = exactMap[key] ?? true;
        const itemStr = itemVal.toString().toLowerCase();
        const filterStr = filterVal.toLowerCase();
        return isExact ? itemStr === filterStr : itemStr.includes(filterStr);
      };

      if (
        filters.bookAndPage &&
        !matchesText(log.bookAndPage, filters.bookAndPage, "bookAndPage")
      )
        return false;
      if (
        filters.caseNumber &&
        !matchesText(log.caseNumber, filters.caseNumber, "caseNumber")
      )
        return false;
      if (
        filters.caseType &&
        !matchesText(log.caseType, filters.caseType, "caseType")
      )
        return false;
      if (
        filters.branchNumber &&
        !matchesText(log.branchNumber, filters.branchNumber, "branchNumber")
      )
        return false;

      if (filters.dateRecieved) {
        const d = new Date(log.dateRecieved || 0);
        if (
          filters.dateRecieved.start &&
          d < new Date(filters.dateRecieved.start)
        )
          return false;
        if (filters.dateRecieved.end && d > new Date(filters.dateRecieved.end))
          return false;
      }
      return true;
    });
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMap: ExactMatchMap,
  ) => {
    const typed = filters as ReceiveLogFilterValues;
    setAppliedFilters(typed);
    setFilteredByAdvanced(applyReceiveFilters(typed, logs, exactMap));
    setExactMatchMap(exactMap);
  };

  const getSuggestions = (key: string, inputValue: string): string[] => {
    const textFields = [
      "bookAndPage",
      "caseNumber",
      "caseType",
      "branchNumber",
      "content",
      "notes",
    ];
    if (!textFields.includes(key)) return [];
    const values = logs
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
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    statusPopup.showSuccess("Entry deleted successfully");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
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
            Receiving Log
          </h2>
          <p className="text-xl text-base-content/70">
            Track all received documents and case filings
          </p>
        </div>

        {/* Search + Filter + Add */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
            <input
              type="text"
              placeholder="Search receiving logs..."
              className="input input-bordered input-lg w-full pl-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const result = await uploadReceiveExcel(file);
                  if (!result.success) {
                    statusPopup.showError(
                      result.error || "Failed to import receiving logs",
                    );
                  } else {
                    statusPopup.showSuccess(
                      "Receiving logs imported successfully",
                    );
                    await fetchLogs();
                  }
                } finally {
                  setUploading(false);
                  if (e.target) e.target.value = "";
                }
              }}
            />
            <button
              className="btn btn-outline flex items-center gap-2"
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
            </button>

            {isAdminOrAtty && (
              <>
                <button
                  className={`btn btn-outline ${uploading ? "loading" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
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
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedLog(null);
                    setDrawerType(ReceiveDrawerType.ADD);
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

          <FilterModal
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={receiveFilterOptions}
            onApply={handleApplyFilters}
            initialValues={appliedFilters}
            initialExactMatchMap={exactMatchMap}
            getSuggestions={getSuggestions}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 text-l font-medium text-center">
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">
              TOTAL ENTRIES
            </div>
            <div className="text-5xl font-bold text-primary">{stats.total}</div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">TODAY</div>
            <div className="text-5xl font-bold text-primary">{stats.today}</div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">THIS MONTH</div>
            <div className="text-5xl font-bold text-primary">
              {stats.thisMonth}
            </div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">DOC TYPES</div>
            <div className="text-5xl font-bold text-primary">
              {stats.docTypes}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-base-100 rounded-lg shadow">
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
              { key: "bookAndPage", label: "Book And Pages", sortable: true },
              {
                key: "dateRecieved",
                label: "Date Received",
                sortable: true,
              },
              { key: "caseType", label: "Abbreviation", sortable: true },
              { key: "caseNumber", label: "Case Number", sortable: true },
              {
                key: "content",
                label: "Content",
                sortable: true,
              },
              { key: "branchNumber", label: "Branch No", sortable: true },
              { key: "time", label: "Time", sortable: false },
              { key: "notes", label: "Notes", sortable: true },
            ]}
            data={paginatedLogs as unknown as Record<string, unknown>[]}
            sortConfig={
              {
                key: sortConfig.key,
                order: sortConfig.order,
              } as { key: string; order: "asc" | "desc" }
            }
            onSort={(k) => handleSort(k as keyof ReceiveLog)}
            showPagination={false}
            renderRow={(log) => (
              <ReceiveRow
                key={(log as unknown as ReceiveLog).id}
                log={log as unknown as ReceiveLog}
                isAdminOrAtty={isAdminOrAtty}
                onEdit={(l) => {
                  setSelectedLog(l);
                  setDrawerType(ReceiveDrawerType.EDIT);
                }}
                onDelete={(l) => handleDeleteLog(l.id)}
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

        {/* Drawer */}
        {drawerType && (
          <ReceiveDrawer
            type={drawerType}
            onClose={() => {
              setDrawerType(null);
              setSelectedLog(null);
            }}
            selectedLog={selectedLog}
            onCreate={(newLog) => {
              const withId: ReceiveLog = {
                ...newLog,
                id: Math.max(0, ...logs.map((l) => l.id)) + 1,
              };
              setLogs((prev) => [withId, ...prev]);
            }}
            onUpdate={(updatedLog) => {
              setLogs((prev) =>
                prev.map((l) => (l.id === updatedLog.id ? updatedLog : l)),
              );
            }}
          />
        )}
      </main>
    </div>
  );
};

export default ReceiveLogsPage;
