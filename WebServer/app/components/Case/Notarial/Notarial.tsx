"use client";

import { exportNotarialExcel } from "@/app/components/Case/Notarial/ExcelActions";
import {
  deleteNotarial,
  getNotarialPage,
  getNotarialStats,
} from "@/app/components/Case/Notarial/NotarialActions";
import NotarialExcelUploader from "@/app/components/Case/Notarial/NotarialExcelUploader";
import { NotarialData } from "@/app/components/Case/Notarial/schema";
import FileViewerModal from "@/app/components/Popup/FileViewerModal";
import { getGarageFileUrl } from "@/app/lib/garageActions";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiLock,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import FilterDropdown from "../../Filter/FilterDropdown";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../../Filter/FilterTypes";
import { Pagination } from "../../Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import { useToast } from "../../Toast/ToastProvider";
import NotarialRow, { NotarialRecord } from "./NotarialRow";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotarialFilterValues = {
  title?: string;
  name?: string;
  atty?: string;
  date?: { start?: string; end?: string };
};

const NOTARIAL_FILTER_OPTIONS: FilterOption[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "atty", label: "Attorney", type: "text" },
  { key: "date", label: "Date", type: "daterange" },
];

// ─── Form Types ───────────────────────────────────────────────────────────────

export type NotarialFormEntry = {
  id: string;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;

  file?: File | null; // ✅ ADD THIS

  errors: Record<string, string>;
  saved: boolean;
};

const PAGE_SIZE = 25;

// ─── Sort TH ─────────────────────────────────────────────────────────────────

type SortKey = "title" | "name" | "atty" | "date";
type SortConfig = { key: SortKey; order: "asc" | "desc" };

const isSortKey = (key: keyof NotarialRecord): key is SortKey =>
  key === "title" || key === "name" || key === "atty" || key === "date";

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
    className="text-center cursor-pointer select-none hover:bg-base-200 transition-colors"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const NotarialPage: React.FC = () => {
  const router = useRouter();
  const statusPopup = usePopup();
  const toast = useToast();
  const [records, setRecords] = useState<NotarialRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    order: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<NotarialFilterValues>(
    {},
  );
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});

  const isAdminOrAtty = true;
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    attorneys: 0,
    noDate: 0,
  });
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    loading: boolean;
    url: string;
    type: "pdf" | "image" | null;
    title: string;
    error: string;
    record: NotarialRecord | null;
  }>({
    open: false,
    loading: false,
    url: "",
    type: null,
    title: "",
    error: "",
    record: null,
  });

  const mapBackendRecord = (item: NotarialData): NotarialRecord => ({
    id: item.id,
    title: item.title ?? "",
    name: item.name ?? "",
    atty: item.attorney ?? "",
    date: item.date ? new Date(item.date).toISOString().slice(0, 10) : "",
    link: item.file?.key ?? "",
    fileName: item.file?.fileName ?? undefined,
    mimeType: item.file?.mimeType ?? undefined,
  });

  const getPreviewType = (record: NotarialRecord): "pdf" | "image" | null => {
    const mime = (record.mimeType ?? "").toLowerCase();
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("image/")) return "image";

    const nameOrKey = (record.fileName || record.link || "").toLowerCase();
    if (/\.pdf$/i.test(nameOrKey)) return "pdf";
    if (/\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(nameOrKey)) return "image";
    return null;
  };

  const isPreviewable = (record: NotarialRecord) => {
    return getPreviewType(record) !== null;
  };

  const closePreview = () => {
    setPreviewState({
      open: false,
      loading: false,
      url: "",
      type: null,
      title: "",
      error: "",
      record: null,
    });
  };

  const handleViewFile = async (record: NotarialRecord) => {
    if (!record.link) return;

    const previewType = getPreviewType(record);
    if (!previewType) {
      await handleDownloadFile(record);
      return;
    }

    setPreviewState({
      open: true,
      loading: true,
      url: "",
      type: previewType,
      title: record.fileName || record.link.split("/").pop() || "File Preview",
      error: "",
      record,
    });

    const result = await getGarageFileUrl(record.link, {
      inline: true,
      fileName: record.fileName,
      contentType: record.mimeType,
    });
    if (!result.success) {
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        error: result.error || "Failed to open file",
      }));
      return;
    }

    setPreviewState((prev) => ({
      ...prev,
      loading: false,
      url: result.result,
      error: "",
    }));
  };

  const handleDownloadFile = async (record: NotarialRecord) => {
    if (!record.link) return;

    const result = await getGarageFileUrl(record.link, {
      inline: false,
      fileName: record.fileName,
      contentType: record.mimeType,
    });
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to download file");
      return;
    }

    const a = document.createElement("a");
    a.href = result.result;
    a.download = record.fileName || record.link.split("/").pop() || "file";
    a.click();
  };

  const toServerFilters = useCallback(
    (filters: NotarialFilterValues) => ({
      title: filters.title,
      name: filters.name,
      atty: filters.atty,
      date: filters.date,
    }),
    [],
  );

  const refreshFromBackend = useCallback(
    async (page = currentPage) => {
      try {
        const serverFilters = toServerFilters(appliedFilters);
        const [listResult, statsResult] = await Promise.all([
          getNotarialPage({
            page,
            pageSize: PAGE_SIZE,
            filters: serverFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          getNotarialStats({
            filters: serverFilters,
            exactMatchMap,
          }),
        ]);

        if (!listResult.success) {
          setError(listResult.error || "Failed to fetch notarial records");
          return;
        }

        const mapped = listResult.result.items.map((item) =>
          mapBackendRecord(item),
        );
        setRecords(mapped);
        setTotalCount(listResult.result.total ?? mapped.length);

        if (statsResult.success && statsResult.result) {
          setStats({
            total: statsResult.result.totalRecords,
            thisMonth: statsResult.result.thisMonth,
            attorneys: statsResult.result.uniqueAttorneys,
            noDate: statsResult.result.noDate,
          });
        }

        setError(null);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to fetch notarial records",
        );
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, currentPage, exactMatchMap, sortConfig, toServerFilters],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, sortConfig, exactMatchMap]);

  useEffect(() => {
    void refreshFromBackend(currentPage);
  }, [refreshFromBackend, currentPage]);

  const handleSort = (key: keyof NotarialRecord) => {
    if (!isSortKey(key)) return;
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const getSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const textKeys = ["title", "name", "atty"];
    if (!textKeys.includes(key)) return [];

    const filters: NotarialFilterValues = {
      [key]: inputValue,
    };

    const result = await getNotarialPage({
      page: 1,
      pageSize: 10,
      filters: toServerFilters(filters),
      exactMatchMap: { [key]: false },
      sortKey: key as SortKey,
      sortOrder: "asc",
    });

    if (!result.success || !result.result) return [];

    const values = result.result.items
      .map((item) => {
        const mapped = mapBackendRecord(item);
        return (mapped[key as keyof NotarialRecord] as string) || "";
      })
      .filter((value) => value.length > 0);

    return Array.from(new Set(values)).sort().slice(0, 10);
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    setAppliedFilters(filters as NotarialFilterValues);
    setExactMatchMap(exactMatchMapParam);
    setCurrentPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleDelete = async (id: number) => {
    const isConfirmed = await statusPopup.showConfirm(
      "Are you sure you want to delete this record?",
    );
    if (!isConfirmed) return;
    const result = await deleteNotarial(id);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete record");
      return;
    }
    await refreshFromBackend();
    toast.success("Notarial entry deleted.");
  };

  const handleDeleteSelectedRecords = async () => {
    if (selectedRecordIds.length === 0) return;

    if (
      !(await statusPopup.showConfirm(
        `Are you sure you want to delete ${selectedRecordIds.length} selected record${selectedRecordIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    setDeletingSelected(true);
    statusPopup.showLoading("Deleting selected records...");

    try {
      const results = await Promise.allSettled(
        selectedRecordIds.map((id) => deleteNotarial(id)),
      );

      const failedIds: number[] = [];
      const deletedIds: number[] = [];

      results.forEach((result, index) => {
        const recordId = selectedRecordIds[index];
        if (result.status === "fulfilled" && result.value.success) {
          deletedIds.push(recordId);
          return;
        }
        failedIds.push(recordId);
      });

      if (failedIds.length > 0) {
        statusPopup.showError(
          `Deleted ${deletedIds.length} record(s), but failed to delete ${failedIds.length}.`,
        );
      } else {
        statusPopup.showSuccess(
          `Deleted ${deletedIds.length} selected record${deletedIds.length > 1 ? "s" : ""}.`,
        );
      }

      setSelectedRecordIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
      await refreshFromBackend();
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const result = await exportNotarialExcel();
    setExporting(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Export failed");
      return;
    }

    const a = document.createElement("a");
    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
    a.download = result.result.fileName;
    a.click();
    toast.success("Notarial records exported.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading notarial records...</span>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-base-100">
      <FileViewerModal
        open={previewState.open}
        loading={previewState.loading}
        url={previewState.url}
        type={previewState.type}
        title={previewState.title}
        error={previewState.error}
        onClose={closePreview}
        onDownload={
          previewState.record
            ? () =>
                void handleDownloadFile(previewState.record as NotarialRecord)
            : undefined
        }
      />
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Notarial Records
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Manage notarial reports and filings
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

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
              <input
                type="text"
                placeholder="Search by title..."
                className="input input-bordered input-lg w-full pl-12 text-base"
                value={appliedFilters?.title || ""}
                onChange={(e) =>
                  setAppliedFilters((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />
            </div>

            <button
              className={`btn btn-outline ${activeFilterCount > 0 ? "btn-primary" : ""}`}
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
              {activeFilterCount > 0 && (
                <span className="badge badge-sm badge-primary ml-1">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isAdminOrAtty && (
              <NotarialExcelUploader onUploadCompleted={refreshFromBackend} />
            )}
            {isAdminOrAtty && (
              <button
                className={`btn btn-outline ${exporting ? "loading" : ""}`}
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {" "}
                <FiDownload className="h-5 w-5" />
                {exporting ? "Exporting..." : "Export Excel"}
              </button>
            )}
            {isAdminOrAtty && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  router.push("/user/cases/notarial/add");
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
                Add Record
              </button>
            )}
          </div>

          <FilterDropdown
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={NOTARIAL_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            searchValue={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        {isAdminOrAtty && (
          <AnimatePresence>
            {selectedRecordIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mb-4 overflow-hidden"
              >
                <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-primary">
                    {selectedRecordIds.length} record
                    {selectedRecordIds.length > 1 ? "s" : ""} selected
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() =>
                        router.push(
                          `/user/cases/notarial/edit?ids=${selectedRecordIds.join(",")}`,
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Records",
              value: (stats.total ?? 0).toLocaleString(),
              subtitle: `${(stats.noDate ?? 0).toLocaleString()} missing dates`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "This Month",
              value: (stats.thisMonth ?? 0).toLocaleString(),
              subtitle: `${(stats.thisMonth ?? 0).toLocaleString()} entries this month`,
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "Unique Attorneys",
              value: (stats.attorneys ?? 0).toLocaleString(),
              subtitle: `${(stats.attorneys ?? 0).toLocaleString()} attorneys`,
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "No Date",
              value: (stats.noDate ?? 0).toLocaleString(),
              subtitle: `Records without date`,
              icon: FiLock,
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
          <table className="table table-zebra w-full text-center">
            <thead className="bg-base-300">
              <tr className="text-center">
                {isAdminOrAtty && <th>SELECT</th>}
                {isAdminOrAtty && <th>ACTIONS</th>}
                <SortTh
                  label="TITLE"
                  colKey="title"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="NAME"
                  colKey="name"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="ATTORNEY"
                  colKey="atty"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE"
                  colKey="date"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th>LINK</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrAtty ? 7 : 6}>
                    <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                      <div className=" flex items-center justify-center mb-4">
                        <FiFileText className="w-15 h-15 opacity-50" />
                      </div>
                      <p className="text-lg uppercase font-semibold text-base-content/50">
                        No records found
                      </p>
                      <p className="text-sm mt-1 uppercase text-base-content/35">
                        No notarial records match your current filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <NotarialRow
                    key={r.id}
                    record={r}
                    onEdit={(item) =>
                      router.push(`/user/cases/notarial/edit?id=${item.id}`)
                    }
                    onDelete={handleDelete}
                    onViewFile={(item) => void handleViewFile(item)}
                    onDownloadFile={(item) => void handleDownloadFile(item)}
                    canPreview={isPreviewable(r)}
                    onRowClick={(item) =>
                      router.push(`/user/cases/notarial/${item.id}`)
                    }
                    isSelected={selectedRecordIds.includes(r.id)}
                    onToggleSelect={(id) =>
                      setSelectedRecordIds((prev) =>
                        prev.includes(id)
                          ? prev.filter((entryId) => entryId !== id)
                          : [...prev, id],
                      )
                    }
                  />
                ))
              )}
            </tbody>
          </table>
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

export default NotarialPage;
