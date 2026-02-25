"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import React, { useEffect, useMemo, useState } from "react";
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
import { deleteReceiveLog, getReceiveLogs } from "./Petition";
import PetitionEntryPage, { ReceiveDrawerType } from "./PetitionDrawer";
import {
  ReceiveLog,
  calculateReceiveLogStats,
  sortReceiveLogs,
} from "./PetitionRecord";
import ReceiveRow from "./PetitionRow";

type ReceiveLogFilterValues = {
  receiptNo?: string;
  caseNumber?: string;
  documentType?: string;
  party?: string;
  receivedBy?: string;
  branch?: string;
  dateReceived?: { start?: string; end?: string };
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

  const statusPopup = usePopup();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ReceiveLog;
    order: "asc" | "desc";
  }>({ key: "dateReceived", order: "desc" });
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
    { key: "Book And Pages", label: "Book and pages", type: "text" },
    { key: "Date Received", label: "Date Received", type: "daterange" },
    { key: "Abbreviation", label: "Abbreviation", type: "text" },
    { key: "Case No", label: "Case No.", type: "text" },
    { key: "Content ", label: "Content", type: "text" },
    { key: "Branch No", label: "Branch No.", type: "text" },
    { key: "Time", label: "Time ", type: "text" },
    { key: " Notes", label: "Notes ", type: "text" },
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
      const response = await getReceiveLogs();
      if (!response.success) {
        statusPopup.showError(
          response.error || "Failed to fetch petition logs",
        );
        return;
      }
      setLogs(response.result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch petition logs",
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
        itemVal: string,
        filterVal: string,
        key: string,
      ): boolean => {
        const isExact = exactMap[key] ?? true;
        return isExact
          ? itemVal.toLowerCase() === filterVal.toLowerCase()
          : itemVal.toLowerCase().includes(filterVal.toLowerCase());
      };

      if (
        filters.receiptNo &&
        !matchesText(log.receiptNo, filters.receiptNo, "receiptNo")
      )
        return false;
      if (
        filters.caseNumber &&
        !matchesText(log.caseNumber, filters.caseNumber, "caseNumber")
      )
        return false;
      if (
        filters.documentType &&
        !matchesText(log.documentType, filters.documentType, "documentType")
      )
        return false;
      if (filters.party && !matchesText(log.party, filters.party, "party"))
        return false;
      if (
        filters.receivedBy &&
        !matchesText(log.receivedBy, filters.receivedBy, "receivedBy")
      )
        return false;
      if (filters.branch && !matchesText(log.branch, filters.branch, "branch"))
        return false;

      if (filters.dateReceived) {
        const d = new Date(log.dateReceived);
        if (
          filters.dateReceived.start &&
          d < new Date(filters.dateReceived.start)
        )
          return false;
        if (filters.dateReceived.end && d > new Date(filters.dateReceived.end))
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
      "receiptNo",
      "caseNumber",
      "documentType",
      "party",
      "receivedBy",
      "branch",
    ];
    if (!textFields.includes(key)) return [];
    const values = logs
      .map(
        (l) => (l[key as keyof ReceiveLog] as string | null | undefined) || "",
      )
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
    const result = await deleteReceiveLog(logId);
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

  if (drawerType) {
    return (
      <PetitionEntryPage
        type={drawerType}
        onClose={() => {
          setDrawerType(null);
          setSelectedLog(null);
          fetchLogs();
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
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Petition Tables
          </h2>
          <p className="text-xl text-base-content/70">
            Track all petition entries and case filings
          </p>
        </div>

        {/* Search + Filter + Add */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
            <input
              type="text"
              placeholder="Search petition logs..."
              className="input input-bordered input-lg w-full pl-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              { key: "caseNumber", label: "Case Number", sortable: true },
              { key: "branch", label: "Rafled to Branch", sortable: true },
              { key: "dateReceived", label: "Date Filled", sortable: true },
              { key: "party", label: "Petitioners", sortable: true },
              { key: "receiptNo", label: "Title No", sortable: true },
              { key: "documentType", label: "Nature", sortable: true },
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
      </main>
    </div>
  );
};

export default ReceiveLogsPage;
