"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiLock,
  FiSearch,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import FilterDropdown from "../../Filter/FilterDropdown";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../../Filter/FilterTypes";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import { PageListSkeleton } from "../../Skeleton/SkeletonTable";
import Table from "../../Table/Table";
import { uploadPetitionExcel } from "./ExcelActions";
import { deletePetition, getPetitions } from "./PetitionActions";
import { calculatePetitionStats, sortPetitions } from "./PetitionRecord";
import ReceiveRow from "./PetitionRow";
import { PetitionCaseData } from "./schema";

type PetitionFilterValues = {
  caseNumber?: string;
  petitioner?: string;
  raffledTo?: string;
  nature?: string;
  date?: { start?: string; end?: string };
};

const ReceiveLogsPage: React.FC = () => {
  const router = useRouter();
  const [logs, setLogs] = useState<PetitionCaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const statusPopup = usePopup();

  const [sortConfig, setSortConfig] = useState<{
    key: keyof PetitionCaseData;
    order: "asc" | "desc";
  }>({ key: "date", order: "desc" });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<PetitionFilterValues>(
    {},
  );
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<
    PetitionCaseData[]
  >([]);
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);

  const petitionFilterOptions: FilterOption[] = [
    { key: "caseNumber", label: "Case Number", type: "text" },
    { key: "petitioner", label: "Petitioner", type: "text" },
    { key: "raffledTo", label: "Raffled To", type: "text" },
    { key: "nature", label: "Nature", type: "text" },
    { key: "date", label: "Date", type: "daterange" },
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await getPetitions();
      if (!response.success) {
        statusPopup.showError(response.error || "Failed to fetch petitions");
        setError(response.error || "Failed to fetch petitions");
        return;
      }
      setLogs(response.result?.items || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch petitions",
      );
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => calculatePetitionStats(logs), [logs]);

  const filteredAndSorted = useMemo(() => {
    const baseList =
      Object.keys(appliedFilters).length > 0 ? filteredByAdvanced : logs;

    let filtered = baseList;
    return sortPetitions(filtered, sortConfig.key, sortConfig.order);
  }, [logs, sortConfig, appliedFilters, filteredByAdvanced]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage, PAGE_SIZE]);

  const handleSort = (key: keyof PetitionCaseData) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const applyPetitionFilters = (
    filters: PetitionFilterValues,
    items: PetitionCaseData[],
    exactMap: ExactMatchMap = {},
  ): PetitionCaseData[] => {
    return items.filter((petition) => {
      const matchesText = (
        itemVal: string | null | undefined,
        filterVal: string,
        key: string,
      ): boolean => {
        if (!itemVal) return false;
        const val = itemVal.toString().toLowerCase();
        const filter = filterVal.toLowerCase();
        const isExact = exactMap[key] ?? true;
        return isExact ? val === filter : val.includes(filter);
      };

      if (
        filters.caseNumber &&
        !matchesText(petition.caseNumber, filters.caseNumber, "caseNumber")
      )
        return false;
      if (
        filters.petitioner &&
        !matchesText(petition.petitioner, filters.petitioner, "petitioner")
      )
        return false;
      if (
        filters.raffledTo &&
        !matchesText(petition.raffledTo, filters.raffledTo, "raffledTo")
      )
        return false;
      if (
        filters.nature &&
        !matchesText(petition.nature, filters.nature, "nature")
      )
        return false;

      if (filters.date) {
        const d = petition.date ? new Date(petition.date) : null;
        if (!d) return false;
        if (filters.date.start && d < new Date(filters.date.start))
          return false;
        if (filters.date.end && d > new Date(filters.date.end)) return false;
      }
      return true;
    });
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMap: ExactMatchMap,
  ) => {
    const typed = filters as PetitionFilterValues;
    setAppliedFilters(typed);
    setFilteredByAdvanced(applyPetitionFilters(typed, logs, exactMap));
    setExactMatchMap(exactMap);
  };

  const getSuggestions = (key: string, inputValue: string): string[] => {
    const textFields = ["caseNumber", "petitioner", "raffledTo", "nature"];
    if (!textFields.includes(key)) return [];
    const values = logs
      .map(
        (l) =>
          (l[key as keyof PetitionCaseData] as string | null | undefined) || "",
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
        "Are you sure you want to delete this petition?",
      ))
    )
      return;
    try {
      const response = await deletePetition(logId);
      if (!response.success) {
        statusPopup.showError(response.error || "Failed to delete petition");
        return;
      }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      statusPopup.showSuccess("Petition deleted successfully");
    } catch (err) {
      statusPopup.showError("Delete failed. See console for details.");
      console.error(err);
    }
  };

  const handleDeleteSelectedLogs = async () => {
    if (selectedLogIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Are you sure you want to delete ${selectedLogIds.length} selected petition${selectedLogIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    statusPopup.showLoading("Deleting selected petitions...");

    try {
      const results = await Promise.allSettled(
        selectedLogIds.map((id) => deletePetition(id)),
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

      setLogs((prev) => prev.filter((log) => !deletedIds.includes(log.id)));
      setSelectedLogIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );

      if (failedIds.length > 0) {
        statusPopup.showError(
          `Deleted ${deletedIds.length} petition(s), but failed to delete ${failedIds.length}.`,
        );
      } else {
        statusPopup.showSuccess(
          `Deleted ${deletedIds.length} selected petition${deletedIds.length > 1 ? "s" : ""}.`,
        );
      }

      await fetchLogs();
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

    try {
      statusPopup.showLoading("Importing... Please wait.");
      const result = await uploadPetitionExcel(file);
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

      await fetchLogs();
    } catch (err) {
      statusPopup.showError("Import failed. See console for details.");
      console.error(err);
    } finally {
      input.value = "";
    }
  };

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={6} tableRows={8} />;
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
            Petition Tables
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Track all petition entries and case filings
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
                  onChange={handleImportExcel}
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
                  {" "}
                  <FiUpload className="h-5 w-5" />
                  Import Excel
                </button>

                <button
                  className="btn btn-outline"
                  onClick={async () => {
                    try {
                      const { exportPetitionsExcel } =
                        await import("./ExcelActions");
                      const result = await exportPetitionsExcel();
                      if (!result.success) {
                        statusPopup.showError(result.error || "Export failed");
                        return;
                      }
                      const link = document.createElement("a");
                      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
                      link.download = result.result.fileName;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      statusPopup.showSuccess("Exported successfully");
                    } catch (err) {
                      statusPopup.showError(
                        err instanceof Error ? err.message : "Export failed",
                      );
                    }
                  }}
                >
                  {" "}
                  <FiDownload className="h-5 w-5" />
                  Export Excel
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    router.push("/user/cases/petition/add");
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
            options={petitionFilterOptions}
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
                    {selectedLogIds.length} petition
                    {selectedLogIds.length > 1 ? "s" : ""} selected
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        router.push(
                          `/user/cases/petition/edit?ids=${selectedLogIds.join(",")}`,
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
              label: "Branches",
              value: (stats.branches ?? 0).toLocaleString(),
              subtitle: `Distinct branches`,
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
          <Table<PetitionCaseData>
            headers={[
              ...(isAdminOrAtty
                ? [
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
                  ]
                : []),
              { key: "caseNumber", label: "Case Number", sortable: true },
              { key: "raffledTo", label: "Raffled to Branch", sortable: true },
              { key: "date", label: "Date Filed", sortable: true },
              { key: "petitioner", label: "Petitioners", sortable: true },
              { key: "nature", label: "Nature", sortable: true },
            ]}
            data={paginatedLogs}
            sortConfig={sortConfig}
            onSort={handleSort}
            showPagination={false}
            renderRow={(log) => (
              <ReceiveRow
                key={log.id}
                log={log}
                onEdit={(l) =>
                  router.push(`/user/cases/petition/edit?id=${l.id}`)
                }
                onDelete={(l) => handleDeleteLog(l.id)}
                isSelected={selectedLogIds.includes(log.id)}
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
