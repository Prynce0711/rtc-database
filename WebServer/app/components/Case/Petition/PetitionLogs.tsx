"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiFileText,
  FiLock,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import FilterModal from "../../Filter/FilterModal";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../../Filter/FilterTypes";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import Table from "../../Table/Table";
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
      const resp = await fetch("/api/receive/list");
      const response = await resp.json();
      if (!resp.ok || !response.success) {
        statusPopup.showError(
          response.error || "Failed to fetch petition logs",
        );
        return;
      }
      setLogs(response.result || []);
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
    try {
      const resp = await fetch(`/api/receive/${logId}`, { method: "DELETE" });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        statusPopup.showError(json.error || "Failed to delete");
        return;
      }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      statusPopup.showSuccess("Entry deleted successfully");
    } catch (err) {
      statusPopup.showError("Delete failed. See console for details.");
      console.error(err);
    }
  };

  /* Import handler */
  useEffect(() => {
    const el = document.getElementById(
      "petition-import-input",
    ) as HTMLInputElement | null;
    const handleChange = async (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        statusPopup.showError("File too large. Max 5 MB allowed.");
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

      try {
        statusPopup.showLoading("Importing... Please wait.");
        const fd = new FormData();
        fd.append("file", file);
        const resp = await fetch("/api/receive/import", {
          method: "POST",
          body: fd,
        });
        const json = await resp.json();
        if (!resp.ok || !json.success) {
          statusPopup.showError(json.error || "Import failed");
          input.value = "";
          return;
        }
        const created: ReceiveLog[] = json.result || [];
        if (created.length === 0) {
          statusPopup.showSuccess("No rows were imported.");
        } else {
          setLogs((prev) => [...created, ...prev]);
          statusPopup.showSuccess(
            `${created.length} rows imported successfully`,
          );
        }
      } catch (err) {
        statusPopup.showError("Import failed. See console for details.");
        console.error(err);
      } finally {
        (e.target as HTMLInputElement).value = "";
      }
    };
    el?.addEventListener("change", handleChange);
    return () => el?.removeEventListener("change", handleChange);
  }, [statusPopup]);

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
              <>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id="petition-import-input"
                />

                <button
                  className="btn btn-outline"
                  onClick={() => {
                    const el = document.getElementById(
                      "petition-import-input",
                    ) as HTMLInputElement | null;
                    el?.click();
                  }}
                >
                  Import Excel
                </button>

                <button
                  className="btn btn-outline"
                  onClick={async () => {
                    try {
                      const resp = await fetch("/api/receive/export");
                      if (!resp.ok) throw new Error("Export failed");
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "petition-logs.csv";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      statusPopup.showError(
                        err instanceof Error ? err.message : "Export failed",
                      );
                    }
                  }}
                >
                  Export Excel
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

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Entries",
              value: stats.total ?? 0,
              subtitle: `${stats.thisMonth ?? 0} this month`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "Today",
              value: stats.today ?? 0,
              subtitle: `Today`,
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "This Month",
              value: stats.thisMonth ?? 0,
              subtitle: `Last 30 days`,
              icon: FiLock,
              delay: 200,
            },
            {
              label: "Doc Types",
              value: stats.docTypes ?? 0,
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
