"use client";

import { useSession } from "@rtc-database/shared";
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
import { FilterDropdown } from "@rtc-database/shared";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "@rtc-database/shared";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "@rtc-database/shared";
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header Card - Statistics Style */}
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left Section */}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                <span>Case Management</span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">
                  Petition Cases
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Petition Cases
              </h2>
              <p className="flex text-base items-center gap-2 text-base-content/50 mt-1.5">
                <FiFileText className="shrink-0 w-4 h-4" />
                <span>Track all petition entries and case filings</span>
              </p>
            </div>

            {/* Right Section - Quick Actions */}
            {isAdminOrAtty && (
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2 flex-nowrap">
                  {/* Import button */}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    id="petition-import-input"
                    onChange={handleImportExcel}
                  />
                  <button
                    className="btn btn-outline btn-md gap-2"
                    onClick={() => {
                      const el = document.getElementById(
                        "petition-import-input",
                      ) as HTMLInputElement | null;
                      el?.click();
                    }}
                  >
                    <FiUpload className="h-5 w-5" />
                    Import
                  </button>

                  <button
                    className="btn btn-outline btn-info btn-md gap-2"
                    onClick={async () => {
                      try {
                        const { exportPetitionsExcel } =
                          await import("./ExcelActions");
                        const result = await exportPetitionsExcel();
                        if (!result.success) {
                          statusPopup.showError(
                            result.error || "Export failed",
                          );
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
                    <FiDownload className="h-5 w-5" />
                    Export
                  </button>

                  <button
                    className="btn btn-success btn-md gap-2"
                    onClick={() => router.push("/user/cases/petition/add")}
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
        </div>
      </header>

      {/* Toolbar - Search & Filter */}
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
            className="btn btn-md btn-outline gap-2 whitespace-nowrap"
            onClick={() => {
              console.log(
                "Filter button clicked, current state:",
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
            {filteredAndSorted.length} record
            {filteredAndSorted.length !== 1 && "s"}
          </span>
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

      {/* Stats (KPI cards) - Statistics Style */}
      <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Entries",
            value: stats.total ?? 0,
            subtitle: `All time records`,
            icon: FiBarChart2,
            delay: 0,
            color: "primary",
          },
          {
            label: "Today",
            value: stats.today ?? 0,
            subtitle: `Filed today`,
            icon: FiFileText,
            delay: 100,
            color: "info",
          },
          {
            label: "This Month",
            value: stats.thisMonth ?? 0,
            subtitle: `Last 30 days`,
            icon: FiLock,
            delay: 200,
            color: "success",
          },
          {
            label: "Branches",
            value: stats.branches ?? 0,
            subtitle: `Distinct branches`,
            icon: FiUsers,
            delay: 300,
            color: "warning",
          },
        ].map((card, idx) => {
          const Icon = card.icon as React.ComponentType<
            React.SVGProps<SVGSVGElement>
          >;
          const isGrandTotal = idx === 0;
          return (
            <div
              key={idx}
              className={`transform hover:scale-105 card shadow-lg hover:shadow-xl transition-all group ${
                isGrandTotal
                  ? "bg-primary/10 ring-1 ring-primary/20"
                  : "bg-base-100 hover:ring-2 hover:ring-base-300"
              }`}
              style={{
                transitionDelay: `${card.delay}ms`,
                transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <div
                className="card-body relative overflow-hidden"
                style={{ padding: "1.5rem" }}
              >
                {/* Watermark icon */}
                <div
                  className={`absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110 ${
                    isGrandTotal ? "text-primary" : ""
                  }`}
                >
                  <Icon className="h-full w-full" />
                </div>

                {/* Content */}
                <div className="relative text-center">
                  <p className="font-extrabold uppercase text-sm tracking-wide text-base-content mb-3">
                    {card.label}
                  </p>
                  <p
                    className={`text-4xl sm:text-5xl font-black mb-2 ${
                      isGrandTotal ? "text-primary" : "text-base-content"
                    }`}
                  >
                    {card.value.toLocaleString()}
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-base-content/60">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

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
    </div>
  );
};

export default ReceiveLogsPage;

