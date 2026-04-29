"use client";

import { exportNotarialExcel } from "@/app/components/Case/Notarial/ExcelActions";
import {
  createNotarial,
  deleteNotarial,
  getNotarialByIds,
  getNotarialFileUrl,
  getNotarialPage,
  getNotarialStats,
} from "@/app/components/Case/Notarial/NotarialActions";
import NotarialExcelUploader from "@/app/components/Case/Notarial/NotarialExcelUploader";
import { NotarialData } from "@/app/components/Case/Notarial/schema";
import Roles from "@/app/lib/Roles";
import {
  ExactMatchMap,
  FileViewerModal,
  FilterDropdown,
  FilterOption,
  FilterValues,
  ModalBase,
  Pagination,
  usePopup,
  useToast,
} from "@rtc-database/shared";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FiChevronRight,
  FiClock,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiFilter,
  FiFolder,
  FiGrid,
  FiHardDrive,
  FiImage,
  FiList,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiX,
  FiChevronsDown,
  FiCheck,
} from "react-icons/fi";
import NotarialRow, { NotarialRecord } from "./NotarialRow";
import {
  formatExplorerBytes,
  formatExplorerDateTime,
  getExplorerDescriptor,
  getExplorerPathSegments,
} from "./notarialExplorerUtils";

type NotarialFilterValues = {
  title?: string;
  name?: string;
  atty?: string;
  date?: { start?: string; end?: string };
};

type SortKey = "title" | "name" | "atty" | "date";
type SortConfig = { key: SortKey; order: "asc" | "desc" };
type ViewMode = "list" | "grid";
type NotarialFileTypeFilter =
  | "ALL"
  | "pdf"
  | "word"
  | "excel"
  | "image"
  | "other";
type UploadFormState = {
  title: string;
  name: string;
  atty: string;
  date: string;
  description: string;
  file: File | null;
};

export type NotarialFormEntry = {
  id: string;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;
  file?: File | null;
  errors: Record<string, string>;
  saved: boolean;
};

const NOTARIAL_FILTER_OPTIONS: FilterOption[] = [
  { key: "title", label: "Document Title", type: "text" },
  { key: "name", label: "Client / Signatory", type: "text" },
  { key: "atty", label: "Attorney", type: "text" },
  { key: "date", label: "Date Range", type: "daterange" },
];

const PAGE_SIZE = 10;
const ACCEPTED_NOTARIAL_UPLOAD_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff";

const initialUploadForm = (): UploadFormState => ({
  title: "",
  name: "",
  atty: "",
  date: "",
  description: "",
  file: null,
});

const downloadCsv = (fileName: string, headers: string[], rows: string[][]) => {
  const escapeValue = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escapeValue(value ?? "")).join(","))
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const statsCardClassName =
  "group overflow-hidden rounded-[28px] border border-base-300/70 bg-base-100/95 p-5 shadow-[0_18px_55px_-28px_rgba(15,23,42,0.42)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-30px_rgba(14,116,144,0.36)]";

const mapBackendRecord = (item: NotarialData): NotarialRecord => ({
  id: item.id,
  title: item.title ?? "",
  name: item.name ?? "",
  atty: item.attorney ?? "",
  date: item.date ? new Date(item.date).toISOString().slice(0, 10) : "",
  link: item.file?.key ?? "",
  fileName: item.file?.fileName ?? undefined,
  mimeType: item.file?.mimeType ?? undefined,
  fileSize: item.file?.size ?? undefined,
  createdAt: item.createdAt?.toISOString(),
  updatedAt: item.updatedAt?.toISOString(),
  fileCreatedAt: item.file?.createdAt?.toISOString(),
  fileUpdatedAt: item.file?.updatedAt?.toISOString(),
  filePath: item.file?.path ?? item.file?.key ?? "",
});

const getPreviewType = (record: NotarialRecord): "pdf" | "image" | null => {
  const mime = (record.mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";

  const nameOrKey = (record.fileName || record.link || "").toLowerCase();
  if (nameOrKey.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpg|jpeg|gif|bmp|webp|svg|tif|tiff)$/i.test(nameOrKey)) {
    return "image";
  }

  return null;
};

const getSortLabel = (sortConfig: SortConfig) => {
  const base =
    sortConfig.key === "title"
      ? "Document Title"
      : sortConfig.key === "name"
        ? "Client Name"
        : sortConfig.key === "atty"
          ? "Attorney"
          : "Filing Date";

  return `${base} · ${sortConfig.order === "asc" ? "Ascending" : "Descending"}`;
};

const NotarialPage: React.FC<{ role: Roles }> = ({ role }) => {
  const router = useRouter();
  const statusPopup = usePopup();
  const toast = useToast();
  const canManageNotarial = role === Roles.ADMIN || role === Roles.NOTARIAL;

  const [records, setRecords] = useState<NotarialRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    order: "desc",
  });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<NotarialRecord | null>(
    null,
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<NotarialFilterValues>(
    {},
  );
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [fileTypeFilter, setFileTypeFilter] =
    useState<NotarialFileTypeFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] =
    useState<UploadFormState>(initialUploadForm());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    attorneys: 0,
    noDate: 0,
    storedFiles: 0,
    storageUsedBytes: 0,
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

  const deferredSearch = useDeferredValue(searchInput.trim());

  const toServerFilters = useCallback(
    (filters: NotarialFilterValues) => ({
      query: deferredSearch || undefined,
      title: filters.title,
      name: filters.name,
      atty: filters.atty,
      date: filters.date,
      fileType: fileTypeFilter === "ALL" ? undefined : fileTypeFilter,
    }),
    [deferredSearch, fileTypeFilter],
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
          setError(listResult.error || "Failed to fetch notarial files");
          return;
        }

        const mapped = listResult.result.items.map((item) =>
          mapBackendRecord(item),
        );
        setRecords(mapped);
        setTotalCount(listResult.result.total ?? mapped.length);
        setError(null);

        if (statsResult.success && statsResult.result) {
          setStats({
            total: statsResult.result.totalRecords,
            thisMonth: statsResult.result.thisMonth,
            attorneys: statsResult.result.uniqueAttorneys,
            noDate: statsResult.result.noDate,
            storedFiles: statsResult.result.storedFiles,
            storageUsedBytes: statsResult.result.storageUsedBytes,
          });
        }
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to fetch notarial files",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedFilters, currentPage, exactMatchMap, sortConfig, toServerFilters],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    appliedFilters,
    sortConfig,
    exactMatchMap,
    deferredSearch,
    fileTypeFilter,
  ]);

  useEffect(() => {
    void refreshFromBackend(currentPage);
  }, [currentPage, refreshFromBackend]);

  useEffect(() => {
    setSelectedRecord((previous) => {
      if (records.length === 0) return null;
      if (!previous) return records[0] ?? null;
      return (
        records.find((item) => item.id === previous.id) ?? records[0] ?? null
      );
    });
  }, [records]);

  const activeFilterCount =
    Object.keys(appliedFilters).length +
    (deferredSearch ? 1 : 0) +
    (fileTypeFilter !== "ALL" ? 1 : 0);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const visibleRecordIds = records.map((record) => record.id);
  const allVisibleRecordsSelected =
    visibleRecordIds.length > 0 &&
    visibleRecordIds.every((recordId) => selectedRecordIds.includes(recordId));
  const selectedCount = selectedRecordIds.length;

  const selectedRecordsOnPage = useMemo(
    () => records.filter((record) => selectedRecordIds.includes(record.id)),
    [records, selectedRecordIds],
  );

  const detailPathSegments = useMemo(() => {
    const detailPath = selectedRecord?.filePath || selectedRecord?.link || "";
    const directory = detailPath.includes("/")
      ? detailPath.split("/").slice(0, -1).join("/")
      : detailPath;
    return getExplorerPathSegments(directory);
  }, [selectedRecord]);

  const destinationPreview = useMemo(() => {
    const trimmedAttorney = uploadForm.atty.trim();
    const year = uploadForm.date
      ? new Date(uploadForm.date).getFullYear()
      : null;
    if (!trimmedAttorney) {
      return "Generated after attorney and filing date are entered";
    }
    return year
      ? `${trimmedAttorney}/${year}`
      : `${trimmedAttorney}/unknown-year`;
  }, [uploadForm.atty, uploadForm.date]);

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

  const handlePreviewFile = async (record: NotarialRecord) => {
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

    const result = await getNotarialFileUrl(record.id, {
      inline: true,
      fileName: record.fileName,
      contentType: record.mimeType,
    });

    if (!result.success) {
      setPreviewState((previous) => ({
        ...previous,
        loading: false,
        error: result.error || "Failed to open file",
      }));
      return;
    }

    setPreviewState((previous) => ({
      ...previous,
      loading: false,
      url: result.result,
      error: "",
    }));
  };

  const handleDownloadFile = async (record: NotarialRecord) => {
    if (!record.link) return;

    const result = await getNotarialFileUrl(record.id, {
      inline: false,
      fileName: record.fileName,
      contentType: record.mimeType,
    });
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to download file");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = result.result;
    anchor.download = record.fileName || record.link.split("/").pop() || "file";
    anchor.click();
  };

  const handlePrintFile = async (record: NotarialRecord) => {
    const result = await getNotarialFileUrl(record.id, {
      inline: true,
      fileName: record.fileName,
      contentType: record.mimeType,
    });

    if (!result.success) {
      statusPopup.showError(result.error || "Unable to print this file");
      return;
    }

    const win = window.open(result.result, "_blank", "noopener,noreferrer");
    win?.focus();
  };

  const handleDeleteRecord = async (record: NotarialRecord) => {
    if (
      !(await statusPopup.showConfirm(
        `Delete "${record.fileName || record.title || `record #${record.id}`}" from Notarial Explorer?`,
      ))
    ) {
      return;
    }

    const result = await deleteNotarial(record.id);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete notarial record");
      return;
    }

    setSelectedRecordIds((previous) =>
      previous.filter((id) => id !== record.id),
    );
    if (selectedRecord?.id === record.id) {
      setSelectedRecord(null);
    }
    statusPopup.showSuccess("Notarial file deleted.");
    await refreshFromBackend();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFromBackend(currentPage);
    toast.success("Notarial Explorer refreshed.");
  };

  const handleExport = async () => {
    setExporting(true);
    const result = await exportNotarialExcel();
    setExporting(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Export failed");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
    anchor.download = result.result.fileName;
    anchor.click();
    toast.success("Notarial records exported.");
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    setAppliedFilters(filters as NotarialFilterValues);
    setExactMatchMap(exactMatchMapParam);
    setCurrentPage(1);
  };

  const toggleRecordSelection = (recordId: number, checked: boolean) => {
    setSelectedRecordIds((previous) => {
      if (checked) {
        if (previous.includes(recordId)) return previous;
        return [...previous, recordId];
      }
      return previous.filter((id) => id !== recordId);
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedRecordIds((previous) => {
      if (checked) {
        const merged = new Set([...previous, ...visibleRecordIds]);
        return Array.from(merged);
      }
      return previous.filter((id) => !visibleRecordIds.includes(id));
    });
  };

  const clearSelection = () => {
    setSelectedRecordIds([]);
  };

  const fetchSelectedRecords = async () => {
    if (selectedRecordIds.length === 0) return [] as NotarialRecord[];
    const result = await getNotarialByIds(selectedRecordIds);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to load selected files");
      return [] as NotarialRecord[];
    }
    return result.result.map((item) => mapBackendRecord(item));
  };

  const handleDownloadSelected = async () => {
    const items = await fetchSelectedRecords();
    for (const item of items.filter((record) => record.link)) {
      await handleDownloadFile(item);
    }
  };

  const handleExportSelected = async () => {
    const items = await fetchSelectedRecords();
    if (items.length === 0) return;

    downloadCsv(
      "notarial-selected-files.csv",
      [
        "Document Title",
        "Client / Signatory",
        "Attorney",
        "Date Filed",
        "File Name",
        "Type",
        "Uploaded",
        "Modified",
        "Size",
        "Storage Path",
      ],
      items.map((item) => {
        const descriptor = getExplorerDescriptor({
          fileName: item.fileName ?? item.title,
          mimeType: item.mimeType,
        });
        return [
          item.title || "",
          item.name || "",
          item.atty || "",
          item.date || "",
          item.fileName || "",
          descriptor.label,
          formatExplorerDateTime(item.fileCreatedAt || item.createdAt),
          formatExplorerDateTime(item.fileUpdatedAt || item.updatedAt),
          formatExplorerBytes(item.fileSize),
          item.filePath || item.link || "",
        ];
      }),
    );
    toast.success("Selected notarial metadata exported.");
  };

  const handleDeleteSelected = async () => {
    if (selectedRecordIds.length === 0) return;
    if (
      !(await statusPopup.showConfirm(
        `Delete ${selectedRecordIds.length} selected notarial file${selectedRecordIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    statusPopup.showLoading("Deleting selected notarial files...");
    const results = await Promise.allSettled(
      selectedRecordIds.map((id) => deleteNotarial(id)),
    );

    const failed = results.filter(
      (result) => result.status !== "fulfilled" || !result.value.success,
    );

    if (failed.length > 0) {
      statusPopup.showError(
        `Deleted ${selectedRecordIds.length - failed.length} file(s), but ${failed.length} could not be removed.`,
      );
    } else {
      statusPopup.showSuccess("Selected notarial files deleted.");
    }

    clearSelection();
    await refreshFromBackend();
  };

  const handleUploadFile = async () => {
    if (!uploadForm.file) {
      statusPopup.showError("Select a file first.");
      return;
    }

    if (!uploadForm.title.trim()) {
      statusPopup.showError("Document title is required.");
      return;
    }

    setUploading(true);
    setUploadProgress(12);

    const result = await createNotarial({
      title: uploadForm.title.trim(),
      name: uploadForm.name.trim() || undefined,
      attorney: uploadForm.atty.trim() || undefined,
      date: uploadForm.date || undefined,
      file: uploadForm.file,
    });

    setUploadProgress(result.success ? 100 : 0);
    setUploading(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Upload failed");
      return;
    }

    toast.success("Notarial file uploaded.");
    setShowUploadModal(false);
    setUploadForm(initialUploadForm());
    clearSelection();
    setCurrentPage(1);
    await refreshFromBackend(1);
  };

  const handleUnsupportedAction = (action: string) => {
    statusPopup.showError(
      `${action} is not wired for Notarial Explorer yet. Use the edit flow for single-file changes.`,
    );
  };

  const fileTypeLegend = [
    { label: "PDF", icon: <FiFileText className="h-4 w-4 text-error" /> },
    { label: "Word", icon: <FiFileText className="h-4 w-4 text-info" /> },
    { label: "Excel", icon: <FiGrid className="h-4 w-4 text-success" /> },
    { label: "Image", icon: <FiImage className="h-4 w-4 text-secondary" /> },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-base-300 bg-base-100 p-8 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="loading loading-spinner loading-md text-primary" />
            <span className="text-sm font-semibold text-base-content/65">
              Loading Notarial Explorer...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {showUploadModal && (
        <ModalBase onClose={() => setShowUploadModal(false)}>
          <div className="w-[95vw] max-w-4xl rounded-[30px] border border-base-300 bg-base-100 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/60">
                  Secure Upload
                </p>
                <h2 className="mt-2 text-2xl font-bold text-base-content">
                  Add a Notarial File
                </h2>
                <p className="mt-2 text-sm text-base-content/60">
                  Files are organized automatically by attorney and filing year.
                  The note field below is for the operator only and is not saved
                  to the record yet.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowUploadModal(false)}
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <div
                  className={`rounded-[24px] border-2 border-dashed p-6 transition-all ${
                    uploadForm.file
                      ? "border-primary/40 bg-primary/6"
                      : "border-base-300 bg-base-200/20 hover:border-primary/35"
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0] ?? null;
                    setUploadForm((previous) => ({
                      ...previous,
                      file,
                    }));
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-base-100 shadow-sm">
                      <FiUpload className="h-6 w-6 text-primary" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-base-content">
                        Drag and drop a legal file here
                      </p>
                      <p className="mt-1 text-sm text-base-content/55">
                        PDF, Word, Excel, images, and scanned legal documents
                      </p>
                    </div>
                    <label className="btn btn-outline btn-primary btn-sm gap-2">
                      <FiUpload className="h-4 w-4" />
                      Select File
                      <input
                        type="file"
                        accept={ACCEPTED_NOTARIAL_UPLOAD_TYPES}
                        className="hidden"
                        onChange={(event) =>
                          setUploadForm((previous) => ({
                            ...previous,
                            file: event.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </label>
                    <p className="text-xs font-medium text-base-content/45">
                      {uploadForm.file
                        ? `${uploadForm.file.name} · ${formatExplorerBytes(uploadForm.file.size)}`
                        : "No file selected"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="form-control">
                    <span className="label-text mb-2 text-sm font-semibold">
                      Document Title
                    </span>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={uploadForm.title}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-2 text-sm font-semibold">
                      Client / Signatory
                    </span>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={uploadForm.name}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-2 text-sm font-semibold">
                      Attorney
                    </span>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={uploadForm.atty}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          atty: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text mb-2 text-sm font-semibold">
                      Filing Date
                    </span>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={uploadForm.date}
                      onChange={(event) =>
                        setUploadForm((previous) => ({
                          ...previous,
                          date: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="form-control">
                  <span className="label-text mb-2 text-sm font-semibold">
                    Description / Operator Note
                  </span>
                  <textarea
                    className="textarea textarea-bordered min-h-24"
                    placeholder="Optional handoff note for the uploader. This is not saved in the database yet."
                    value={uploadForm.description}
                    onChange={(event) =>
                      setUploadForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-base-300 bg-base-200/25 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                    Folder Destination Preview
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-base-content">
                    <FiFolder className="h-4 w-4 text-warning" />
                    <span>{destinationPreview}</span>
                  </div>
                  <p className="mt-3 text-xs text-base-content/55">
                    Notarial files follow the current storage convention:
                    attorney/year/generated-filename.
                  </p>
                </div>

                <div className="rounded-[24px] border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-base-content/70">
                      Upload Progress
                    </span>
                    <span className="font-semibold text-bFase-content/55">
                      {uploadProgress}%
                    </span>
                  </div>
                  <progress
                    className="progress progress-primary mt-3 w-full"
                    value={uploadProgress}
                    max={100}
                  />
                  <div className="mt-4 space-y-2 text-sm text-base-content/60">
                    <p>Role-based access is enforced by the current session.</p>
                    <p>Downloads use secure generated links.</p>
                    <p>Unsupported file notes are kept operator-side only.</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-base-300 bg-base-100 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-base-content">
                    Accepted File Types
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {fileTypeLegend.map((item) => (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-base-300 px-3 py-1.5 text-xs font-semibold"
                      >
                        {item.icon}
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn btn-primary gap-2 ${uploading ? "loading" : ""}`}
                    onClick={() => void handleUploadFile()}
                    disabled={uploading}
                  >
                    <FiUpload className="h-4 w-4" />
                    {uploading ? "Uploading..." : "Confirm Upload"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalBase>
      )}

      <header className="relative overflow-hidden rounded-[34px] border border-base-300/70 bg-gradient-to-br from-base-100 via-base-100 to-primary/8 p-6 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.55)]">
        <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_55%)] lg:block" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-base-content/45">
              <span>Archive & Notarial Workspace</span>
              <span className="opacity-40">•</span>
              <span>Role-based access</span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-base-content md:text-5xl">
              Notarial Explorer
            </h1>
            {/* <p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/62 md:text-base">
              Clean, secure file handling for sworn records, scanned legal
              documents, and office-ready exports. Search, preview, organize,
              and retrieve notarial files from one efficient workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/80 px-3 py-1.5 text-xs font-semibold text-base-content/70">
                <FiShield className="h-3.5 w-3.5 text-primary" />
                Role-based access
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/80 px-3 py-1.5 text-xs font-semibold text-base-content/70">
                <FiLock className="h-3.5 w-3.5 text-primary" />
                Secure file delivery
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/80 px-3 py-1.5 text-xs font-semibold text-base-content/70">
                <FiHardDrive className="h-3.5 w-3.5 text-primary" />
                {stats.storedFiles.toLocaleString()} stored file
                {stats.storedFiles !== 1 ? "s" : ""}
              </span>
            </div> */}
          </div>

          {/* <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[29rem]">
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Total Files
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.storedFiles.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                {stats.total.toLocaleString()} records tracked
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Storage Used
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {formatExplorerBytes(stats.storageUsedBytes)}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Organized by attorney/year
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Active Attorneys
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.attorneys.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                {stats.thisMonth.toLocaleString()} filed this month
              </p>
            </div>
          </div> */}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <aside className="space-y-5">
          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
              Workspace
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() => {
                  setSearchInput("");
                  setAppliedFilters({});
                  setExactMatchMap({});
                  setFileTypeFilter("ALL");
                }}
              >
                <FiFileText className="h-4 w-4" />
                All Records
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() => setFileTypeFilter("pdf")}
              >
                <FiFileText className="h-4 w-4 text-error" />
                PDF Files
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() => setFileTypeFilter("image")}
              >
                <FiImage className="h-4 w-4 text-secondary" />
                Scanned Images
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() =>
                  setSortConfig({
                    key: "date",
                    order: "desc",
                  })
                }
              >
                <FiClock className="h-4 w-4" />
                Recent Activity
              </button>
            </div>
          </div> */}

          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
              Secure Controls
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-base-300 bg-base-200/20 p-3">
                <p className="font-semibold text-base-content">Role-based access</p>
                <p className="mt-1 text-base-content/55">
                  {canManageNotarial
                    ? "This account can upload, edit, export, and delete notarial files."
                    : "This account can search, preview, and download approved files."}
                </p>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-200/20 p-3">
                <p className="font-semibold text-base-content">Permissions-aware actions</p>
                <p className="mt-1 text-base-content/55">
                  Row menus surface only the actions available to the current role.
                </p>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-200/20 p-3">
                <p className="font-semibold text-base-content">Protected file delivery</p>
                <p className="mt-1 text-base-content/55">
                  Downloads and previews use secure generated access links.
                </p>
              </div>
            </div>
          </div> */}

          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
                Upload Tools
              </p>
            </div>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="btn btn-primary w-full justify-start gap-2"
                onClick={() => setShowUploadModal(true)}
              >
                <FiUpload className="h-4 w-4" />
                Upload File
              </button>
              <button
                type="button"
                className="btn btn-outline w-full justify-start gap-2"
                onClick={() => router.push("/user/cases/notarial/add")}
              >
                <FiEdit2 className="h-4 w-4" />
                New Record
              </button>
              <div className="pt-1">
                <NotarialExcelUploader
                  onUploadCompleted={async () => await refreshFromBackend()}
                />
              </div>
            </div>
          </div> */}

          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
              Supported Types
            </p>
            <div className="mt-4 grid gap-2">
              {fileTypeLegend.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-200/15 px-3 py-2.5 text-sm font-semibold"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div> */}
        </aside>

        <main className="space-y-5">
          {/* <div className="rounded-[30px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
                <div className="relative flex-1">
                  <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" />
                  <input
                    type="text"
                    placeholder="Search files, folders, client names, case numbers..."
                    className="input input-bordered h-12 w-full rounded-2xl pl-11"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary gap-2"
                    onClick={() => setShowUploadModal(true)}
                  >
                    <FiUpload className="h-4 w-4" />
                    Upload File
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline gap-2"
                    onClick={() => router.push("/user/cases/notarial/add")}
                  >
                    <FiEdit2 className="h-4 w-4" />
                    New Record
                  </button>
                  <button
                    type="button"
                    className={`btn btn-outline gap-2 ${refreshing ? "loading" : ""}`}
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                  >
                    <FiRefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    className={`btn btn-outline btn-info gap-2 ${exporting ? "loading" : ""}`}
                    onClick={() => void handleExport()}
                    disabled={exporting}
                  >
                    <FiDownload className="h-4 w-4" />
                    Export
                  </button>

                  <div className="dropdown dropdown-end">
                    <button
                      type="button"
                      tabIndex={0}
                      className="btn btn-outline gap-2"
                    >
                      <FiList className="h-4 w-4" />
                      Sort
                    </button>
                    <ul
                      tabIndex={0}
                      className="menu dropdown-content z-[4] mt-2 w-64 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
                    >
                      {[
                        {
                          label: "Newest first",
                          config: { key: "date", order: "desc" } as SortConfig,
                        },
                        {
                          label: "Oldest first",
                          config: { key: "date", order: "asc" } as SortConfig,
                        },
                        {
                          label: "Title A-Z",
                          config: { key: "title", order: "asc" } as SortConfig,
                        },
                        {
                          label: "Client A-Z",
                          config: { key: "name", order: "asc" } as SortConfig,
                        },
                        {
                          label: "Attorney A-Z",
                          config: { key: "atty", order: "asc" } as SortConfig,
                        },
                      ].map((item) => (
                        <li key={item.label}>
                          <button
                            type="button"
                            className={
                              sortConfig.key === item.config.key &&
                              sortConfig.order === item.config.order
                                ? "active"
                                : ""
                            }
                            onClick={() => setSortConfig(item.config)}
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    className={`btn btn-outline gap-2 ${activeFilterCount > 0 ? "btn-primary" : ""}`}
                    onClick={() => setFilterModalOpen((previous) => !previous)}
                  >
                    <FiFilter className="h-4 w-4" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="badge badge-sm badge-primary">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/55">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={() => {
                      setSelectedRecord(null);
                    }}
                  >
                    Root Directory
                  </button>
                  <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                  <span className="rounded-full bg-base-200/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                    Notarial Records
                  </span>
                  {detailPathSegments.map((segment) => (
                    <React.Fragment key={segment.path}>
                      <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/55">
                        {segment.label}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="join rounded-2xl border border-base-300 bg-base-100 p-1">
                    <button
                      type="button"
                      className={`join-item btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setViewMode("grid")}
                    >
                      <FiGrid className="h-4 w-4" />
                      Grid
                    </button>
                    <button
                      type="button"
                      className={`join-item btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setViewMode("list")}
                    >
                      <FiList className="h-4 w-4" />
                      List
                    </button>
                  </div>

                  <select
                    className="select select-bordered select-sm rounded-2xl"
                    value={fileTypeFilter}
                    onChange={(event) =>
                      setFileTypeFilter(
                        event.target.value as NotarialFileTypeFilter,
                      )
                    }
                  >
                    <option value="ALL">All file types</option>
                    <option value="pdf">PDF</option>
                    <option value="word">Word</option>
                    <option value="excel">Excel</option>
                    <option value="image">Images</option>
                    <option value="other">Other</option>
                  </select>

                  <span className="rounded-full bg-base-200/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/55">
                    {getSortLabel(sortConfig)}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              <FilterDropdown
                isOpen={filterModalOpen}
                onClose={() => setFilterModalOpen(false)}
                options={NOTARIAL_FILTER_OPTIONS}
                onApply={handleApplyFilters}
                searchValue={appliedFilters}
                getSuggestions={getSuggestions}
              />
            </div>
          </div> */}

          <div className="w-full rounded-[30px] border border-base-300 bg-base-100 p-6 shadow-lg">
            <div className="flex flex-col gap-4">
              {/* Row 1 — Search */}
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" />
                <input
                  type="text"
                  placeholder="Search files, folders, client names, case numbers..."
                  className="input input-bordered h-10 w-full rounded-2xl pl-11 text-sm"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>

              {/* Row 2 — Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm gap-2"
                  onClick={() => setShowUploadModal(true)}
                >
                  <FiUpload className="h-4 w-4" />
                  Upload file
                </button>

                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => router.push("/user/cases/notarial/add")}
                >
                  <FiEdit2 className="h-4 w-4" />
                  New record
                </button>

                <button
                  type="button"
                  className={`btn btn-outline btn-sm gap-2 ${refreshing ? "loading" : ""}`}
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Refresh
                </button>

                <button
                  type="button"
                  className={`btn btn-outline btn-sm gap-2 ${exporting ? "loading" : ""}`}
                  onClick={() => void handleExport()}
                  disabled={exporting}
                >
                  <FiDownload className="h-4 w-4" />
                  Export
                </button>

                {/* Sort — pushed to the right */}
                <div className="dropdown dropdown-end ml-auto">
                  <button
                    type="button"
                    tabIndex={0}
                    className="btn btn-ghost btn-sm gap-1.5 font-normal text-base-content/70"
                  >
                    <FiList className="h-4 w-4" />
                    Sort
                    <FiChevronsDown className="h-3.5 w-3.5" />
                  </button>
                  <ul
                    tabIndex={0}
                    className="menu dropdown-content z-[4] mt-2 w-56 rounded-2xl border border-base-300 bg-base-100 p-1.5 shadow-xl"
                  >
                    {[
                      {
                        label: "Newest first",
                        config: { key: "date", order: "desc" } as SortConfig,
                      },
                      {
                        label: "Oldest first",
                        config: { key: "date", order: "asc" } as SortConfig,
                      },
                      {
                        label: "Title A–Z",
                        config: { key: "title", order: "asc" } as SortConfig,
                      },
                      {
                        label: "Client A–Z",
                        config: { key: "name", order: "asc" } as SortConfig,
                      },
                      {
                        label: "Attorney A–Z",
                        config: { key: "atty", order: "asc" } as SortConfig,
                      },
                    ].map((item) => {
                      const active =
                        sortConfig.key === item.config.key &&
                        sortConfig.order === item.config.order;
                      return (
                        <li key={item.label}>
                          <button
                            type="button"
                            className={`flex items-center justify-between rounded-xl text-sm ${
                              active ? "font-semibold text-primary" : ""
                            }`}
                            onClick={() => setSortConfig(item.config)}
                          >
                            {item.label}
                            {active && <FiCheck className="h-3.5 w-3.5" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Filter */}
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm gap-1.5 font-normal ${
                    activeFilterCount > 0
                      ? "text-primary"
                      : "text-base-content/70"
                  }`}
                  onClick={() => setFilterModalOpen((previous) => !previous)}
                >
                  <FiFilter className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="badge badge-xs badge-primary">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="h-px bg-base-200" />

              {/* Row 3 — Breadcrumb + view controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Breadcrumb */}
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <button
                    type="button"
                    className="font-medium text-base-content/55 transition-colors hover:text-base-content"
                    onClick={() => setSelectedRecord(null)}
                  >
                    Root directory
                  </button>
                  <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                  <span className="text-xs font-bold uppercase tracking-widest text-base-content">
                    Notarial Records
                  </span>
                  {detailPathSegments.map((segment) => (
                    <React.Fragment key={segment.path}>
                      <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-base-content/55">
                        {segment.label}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Right controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Grid / List toggle */}
                  <div className="flex items-center gap-0.5 rounded-xl border border-base-300 bg-base-100 p-0.5">
                    <button
                      type="button"
                      className={`btn btn-xs gap-1.5 rounded-lg ${
                        viewMode === "grid"
                          ? "btn-primary shadow-sm"
                          : "btn-ghost text-base-content/50"
                      }`}
                      onClick={() => setViewMode("grid")}
                    >
                      <FiGrid className="h-3.5 w-3.5" />
                      Grid
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs gap-1.5 rounded-lg ${
                        viewMode === "list"
                          ? "btn-primary shadow-sm"
                          : "btn-ghost text-base-content/50"
                      }`}
                      onClick={() => setViewMode("list")}
                    >
                      <FiList className="h-3.5 w-3.5" />
                      List
                    </button>
                  </div>

                  {/* File type filter */}
                  <select
                    className="select select-bordered select-xs h-8 rounded-xl pr-8 text-sm"
                    value={fileTypeFilter}
                    onChange={(event) =>
                      setFileTypeFilter(
                        event.target.value as NotarialFileTypeFilter,
                      )
                    }
                  >
                    <option value="ALL">All file types</option>
                    <option value="pdf">PDF</option>
                    <option value="word">Word</option>
                    <option value="excel">Excel</option>
                    <option value="image">Images</option>
                    <option value="other">Other</option>
                  </select>

                  {/* Active sort label */}
                  <span className="text-xs font-semibold uppercase tracking-widest text-base-content/45">
                    {getSortLabel(sortConfig)}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter dropdown */}
            <div className="relative">
              <FilterDropdown
                isOpen={filterModalOpen}
                onClose={() => setFilterModalOpen(false)}
                options={NOTARIAL_FILTER_OPTIONS}
                onApply={handleApplyFilters}
                searchValue={appliedFilters}
                getSuggestions={getSuggestions}
              />
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="rounded-[26px] border border-primary/20 bg-primary/8 p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">
                    Bulk Actions
                  </p>
                  <p className="mt-1 text-sm font-semibold text-base-content">
                    {selectedCount} file{selectedCount !== 1 ? "s" : ""}{" "}
                    selected
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline gap-2"
                    onClick={() => void handleDownloadSelected()}
                  >
                    <FiDownload className="h-4 w-4" />
                    Download Selected
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline gap-2"
                    onClick={() => handleUnsupportedAction("Move")}
                  >
                    <FiFolder className="h-4 w-4" />
                    Move Selected
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline gap-2"
                    onClick={() => void handleExportSelected()}
                  >
                    <FiDownload className="h-4 w-4" />
                    Export Selected
                  </button>
                  {canManageNotarial && (
                    <button
                      type="button"
                      className="btn btn-sm btn-error gap-2"
                      onClick={() => void handleDeleteSelected()}
                    >
                      <FiTrash2 className="h-4 w-4" />
                      Delete Selected
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={clearSelection}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-[30px] border border-base-300 bg-base-100 shadow-lg">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-base-200/60">
                  <FiFileText className="h-7 w-7 text-base-content/35" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-base-content">
                  No notarial files match this view
                </h3>
                <p className="mt-2 max-w-md text-sm text-base-content/55">
                  Adjust search terms, change filters, or upload a new file to
                  start building this notarial folder thread.
                </p>
              </div>
            ) : viewMode === "list" ? (
              <div className="overflow-x-auto">
                <table className="table w-full text-center">
                  <thead>
                    <tr className="bg-base-200/40 text-xs uppercase tracking-[0.16em] text-base-content/45">
                      <th className="px-4 py-4">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={allVisibleRecordsSelected}
                          onChange={(event) =>
                            toggleSelectAllVisible(event.target.checked)
                          }
                          aria-label="Select all visible notarial records"
                        />
                      </th>
                      <th className="px-4 py-4 text-left">File Name</th>
                      <th className="px-4 py-4">File Type</th>
                      <th className="px-4 py-4">Client / Signatory</th>
                      <th className="px-4 py-4">Attorney</th>
                      <th className="px-4 py-4">Date Uploaded</th>
                      <th className="px-4 py-4">Last Modified</th>
                      <th className="px-4 py-4">File Size</th>
                      <th className="px-4 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <NotarialRow
                        key={record.id}
                        record={record}
                        canManage={canManageNotarial}
                        canPreview={getPreviewType(record) !== null}
                        isSelected={selectedRecordIds.includes(record.id)}
                        onToggleSelect={toggleRecordSelection}
                        onSelectRecord={setSelectedRecord}
                        onPreviewFile={(item) => void handlePreviewFile(item)}
                        onDownloadFile={(item) => void handleDownloadFile(item)}
                        onOpenRecord={(item) =>
                          router.push(`/user/cases/notarial/${item.id}`)
                        }
                        onEditRecord={(item) =>
                          router.push(
                            `/user/cases/notarial/edit?ids=${item.id}`,
                          )
                        }
                        onDeleteRecord={(item) => void handleDeleteRecord(item)}
                        onPrintRecord={(item) => void handlePrintFile(item)}
                        onUnsupportedAction={handleUnsupportedAction}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
                {records.map((record) => {
                  const descriptor = getExplorerDescriptor({
                    fileName: record.fileName ?? record.title,
                    mimeType: record.mimeType,
                  });
                  return (
                    <div
                      key={record.id}
                      className={`group cursor-pointer rounded-[26px] border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                        selectedRecord?.id === record.id
                          ? "border-primary/35 bg-primary/7"
                          : "border-base-300 bg-base-100"
                      }`}
                      onClick={() => setSelectedRecord(record)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${descriptor.iconWrapClassName}`}
                          >
                            {descriptor.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-base-content">
                              {record.fileName ||
                                record.title ||
                                `Record #${record.id}`}
                            </p>
                            <p className="mt-1 truncate text-xs text-base-content/50">
                              {record.name || "No client name"}
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm mt-1"
                          checked={selectedRecordIds.includes(record.id)}
                          onChange={(event) =>
                            toggleRecordSelection(
                              record.id,
                              event.target.checked,
                            )
                          }
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${record.fileName || record.title || record.id}`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${descriptor.badgeClassName}`}
                        >
                          {descriptor.label}
                        </span>
                        <span className="rounded-full bg-base-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/55">
                          {record.atty || "No attorney"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-base-200/30 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                            Upload Date
                          </p>
                          <p className="mt-2 text-sm font-semibold text-base-content">
                            {formatExplorerDateTime(
                              record.fileCreatedAt || record.createdAt,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-base-200/30 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                            Size
                          </p>
                          <p className="mt-2 text-sm font-semibold text-base-content">
                            {formatExplorerBytes(record.fileSize)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedRecord(record);
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePreviewFile(record);
                          }}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDownloadFile(record);
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/38">
              Showing page {currentPage} of {pageCount} ·{" "}
              {totalCount.toLocaleString()} records
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
        </main>

        <aside className="space-y-5">
          <div className="sticky top-4 rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
                  File Details
                </p>
                <h2 className="mt-2 text-lg font-bold text-base-content">
                  {selectedRecord?.fileName ||
                    selectedRecord?.title ||
                    "No file selected"}
                </h2>
              </div>
              {selectedRecord && (
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    getExplorerDescriptor({
                      fileName: selectedRecord.fileName ?? selectedRecord.title,
                      mimeType: selectedRecord.mimeType,
                    }).badgeClassName
                  }`}
                >
                  {
                    getExplorerDescriptor({
                      fileName: selectedRecord.fileName ?? selectedRecord.title,
                      mimeType: selectedRecord.mimeType,
                    }).label
                  }
                </span>
              )}
            </div>

            {!selectedRecord ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-base-300 bg-base-200/15 p-5 text-sm text-base-content/55">
                Select a file row or card to inspect its metadata, storage path,
                timestamps, and quick actions.
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  {[
                    ["File Name", selectedRecord.fileName || "—"],
                    [
                      "File Type",
                      getExplorerDescriptor({
                        fileName:
                          selectedRecord.fileName ?? selectedRecord.title,
                        mimeType: selectedRecord.mimeType,
                      }).label,
                    ],
                    ["Client / Signatory", selectedRecord.name || "—"],
                    ["Attorney", selectedRecord.atty || "—"],
                    [
                      "Date Created",
                      formatExplorerDateTime(
                        selectedRecord.fileCreatedAt ||
                          selectedRecord.createdAt,
                      ),
                    ],
                    [
                      "Last Modified",
                      formatExplorerDateTime(
                        selectedRecord.fileUpdatedAt ||
                          selectedRecord.updatedAt,
                      ),
                    ],
                    ["File Size", formatExplorerBytes(selectedRecord.fileSize)],
                    ["Filing Date", selectedRecord.date || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[22px] border border-base-300 bg-base-200/18 px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                        {label}
                      </p>
                      <p className="mt-2 break-words text-sm font-semibold text-base-content">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-base-300 bg-base-200/15 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                    Folder Thread
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-base-content/58">
                    <span>Root Directory</span>
                    <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                    <span>Notarial Records</span>
                    {detailPathSegments.map((segment) => (
                      <React.Fragment key={segment.path}>
                        <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                        <span>{segment.label}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-base-300 bg-base-200/15 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                    Security
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-base-content/60">
                    <p className="flex items-center gap-2">
                      <FiShield className="h-4 w-4 text-primary" />
                      Access scoped to the active role
                    </p>
                    <p className="flex items-center gap-2">
                      <FiLock className="h-4 w-4 text-primary" />
                      Secure preview and download links
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-2"
                    onClick={() => void handlePreviewFile(selectedRecord)}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() => void handleDownloadFile(selectedRecord)}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() => void handlePrintFile(selectedRecord)}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() =>
                      router.push(`/user/cases/notarial/${selectedRecord.id}`)
                    }
                  >
                    Open Page
                  </button>
                  {canManageNotarial && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm gap-2"
                      onClick={() =>
                        router.push(
                          `/user/cases/notarial/edit?ids=${selectedRecord.id}`,
                        )
                      }
                    >
                      Edit
                    </button>
                  )}
                  {canManageNotarial && (
                    <button
                      type="button"
                      className="btn btn-error btn-sm gap-2"
                      onClick={() => void handleDeleteRecord(selectedRecord)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default NotarialPage;
