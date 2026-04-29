"use client";
import {
  createNotarial,
  deleteNotarial,
  getNotarialByIds,
  getNotarialFileUrl,
  getNotarialPage,
  createGarageFolder,
} from "@/app/components/Case/Notarial/NotarialActions";

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
  useRef,
  useState,
} from "react";
import {
  FiChevronRight,
  FiChevronLeft,
  FiDownload,
  FiFileText,
  FiFilter,
  FiFolder,
  FiGrid,
  FiImage,
  FiList,
  FiLock,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUpload,
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
// Allow all file types by leaving this empty; inputs will omit `accept` when falsy
const ACCEPTED_NOTARIAL_UPLOAD_TYPES = "";

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
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] =
    useState<UploadFormState>(initialUploadForm());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderForm, setFolderForm] = useState({
    name: "",
    parentPath: "",
    description: "",
  });
  const [creatingFolder, setCreatingFolder] = useState(false);
  // Prevent 'assigned but never used' TypeScript warnings for optional toolbar states
  void refreshing;
  const [isOpen, setIsOpen] = useState(false);
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
        const listResult = await getNotarialPage({
          page,
          pageSize: PAGE_SIZE,
          filters: serverFilters,
          sortKey: sortConfig.key,
          sortOrder: sortConfig.order,
          exactMatchMap,
        });

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

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

  // Refresh and export handlers removed (toolbar controls are currently disabled)

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

  // Detect Excel-like files by mime or extension
  const isExcelRecord = (record: NotarialRecord) => {
    const mime = (record.mimeType ?? "").toLowerCase();
    if (mime.includes("excel") || mime.includes("spreadsheetml")) return true;
    const name = (record.fileName ?? record.link ?? "").toLowerCase();
    return (
      name.endsWith(".xls") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xlsm") ||
      name.endsWith(".csv") ||
      name.endsWith(".ods")
    );
  };

  // Folder upload input ref — attribute added after mount for cross-browser support
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (folderInputRef.current) {
      try {
        folderInputRef.current.setAttribute("webkitdirectory", "");
        folderInputRef.current.setAttribute("directory", "");
      } catch {
        // ignore if not supported
      }
    }
  }, []);

  const handleUploadFolderFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (
      !(await statusPopup.showConfirm(
        `Upload ${files.length} file${files.length > 1 ? "s" : ""} from folder?`,
      ))
    ) {
      return;
    }

    statusPopup.showLoading(`Uploading ${files.length} files...`);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const title = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;
        // Upload sequentially to avoid overwhelming the backend
        const result = await createNotarial({ title, file });
        if (result.success) successCount++;
      } catch {
        // continue to next file
      }
    }

    statusPopup.showSuccess(`Uploaded ${successCount} of ${files.length} files.`);
    await refreshFromBackend(1);
  };

    // Garage drop upload handler: accepts a single File and uploads immediately
    const handleGarageDrop = async (file: File | null) => {
      if (!file) return;
      try {
        setUploading(true);
        setUploadProgress(12);

        const result = await createNotarial({
          title: file.name,
          file,
        });

        setUploadProgress(result.success ? 100 : 0);

        if (!result.success) {
          statusPopup.showError(result.error || "Upload failed");
          return;
        }

        toast.success("Notarial file uploaded.");
        setUploadForm(initialUploadForm());
        clearSelection();
        setCurrentPage(1);
        await refreshFromBackend(1);
      } catch (err) {
        statusPopup.showError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };

    const handleCreateFolder = async () => {
      if (!folderForm.name.trim()) {
        statusPopup.showError("Folder name is required.");
        return;
      }

      setCreatingFolder(true);
      const result = await createGarageFolder({
        name: folderForm.name.trim(),
        parentPath: folderForm.parentPath?.trim() || "",
      });
      setCreatingFolder(false);

      if (!result.success) {
        statusPopup.showError(result.error || "Failed to create folder");
        return;
      }

      setShowFolderModal(false);
      setFolderForm({ name: "", parentPath: "", description: "" });
      statusPopup.showSuccess("Archive folder created.");
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
                  className={`rounded-3xl border-2 border-dashed p-6 transition-all ${
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
                        accept={ACCEPTED_NOTARIAL_UPLOAD_TYPES || undefined}
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
                <div className="rounded-3xl border border-base-300 bg-base-200/25 p-5">
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

                <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
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

                <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
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

      {showFolderModal && (
        <ModalBase onClose={() => setShowFolderModal(false)}>
          <div className="w-[90vw] max-w-md rounded-[20px] border border-base-300 bg-base-100 p-6 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/60">New Folder</p>
                <h2 className="mt-2 text-lg font-bold">Create Archive Folder</h2>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFolderModal(false)}>
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="form-control">
                <span className="label-text text-sm font-semibold">Folder Name</span>
                <input
                  type="text"
                  className="input input-bordered mt-1"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>

              <label className="form-control">
                <span className="label-text text-sm font-semibold">Parent Path (optional)</span>
                <input
                  type="text"
                  className="input input-bordered mt-1"
                  placeholder="subfolder/or/parent"
                  value={folderForm.parentPath}
                  onChange={(e) => setFolderForm((p) => ({ ...p, parentPath: e.target.value }))}
                />
              </label>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFolderModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleCreateFolder()}
                  disabled={creatingFolder}
                >
                  {creatingFolder ? "Creating..." : "Create Folder"}
                </button>
              </div>
            </div>
          </div>
        </ModalBase>
      )}

      <header className="relative overflow-hidden rounded-[34px] border border-base-300/70 bg-linear-to-br from-base-100 via-base-100 to-primary/8 p-6 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.55)]">
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

          </div>

        </div>
      </header>

      <div className="grid gap-6">
        <aside className="hidden space-y-5">
         
        </aside>

        <main className="w-full space-y-5">
          <div className="w-full rounded-none border-x-0 border-t-0 border-b border-base-300 bg-base-100 p-6">
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
                {/* <button
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
                </button> */}

                {/* Sort — pushed to the right */}
                {/* <div className="dropdown dropdown-end ml-auto">
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
                    className="menu dropdown-content z-4 mt-2 w-56 rounded-2xl border border-base-300 bg-base-100 p-1.5 shadow-xl"
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
                </div> */}

                {/* Filter
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
                </button> */}
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
                    className="menu dropdown-content z-4 mt-2 w-56 rounded-2xl border border-base-300 bg-base-100 p-1.5 shadow-xl"
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

          {/* TABLE/GRID LISTING DISABLED - replaced by File Garage UI below */}
          {false && (
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
          )}

          <div className="overflow-hidden rounded-[18px] border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between mb-4">
              {/* <h3 className="text-lg font-semibold">File Garage</h3> */}
              <div className="flex items-center gap-2">
                <label className="btn btn-sm btn-outline flex items-center gap-2">
                  <FiUpload className="h-4 w-4" />
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    accept={ACCEPTED_NOTARIAL_UPLOAD_TYPES || undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) void handleGarageDrop(f);
                    }}
                  />
                </label>
                <label className="btn btn-sm btn-outline flex items-center gap-2">
                  <FiFolder className="h-4 w-4" />
                  Upload Folder
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.currentTarget.files ?? null;
                      void handleUploadFolderFiles(files);
                      // reset so same folder can be chosen again
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline flex items-center gap-2"
                  onClick={() => setShowFolderModal(true)}
                >
                  <FiChevronsDown className="h-4 w-4" />
                  New Folder
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowUploadModal(true)}
                >
                  Metadata
                </button>
              </div>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0] ?? null;
                if (f) void handleGarageDrop(f);
              }}
              className="flex flex-col gap-3"
            >
              {/* <div className="rounded-md border border-dashed border-base-300 p-6 text-center">
                <p className="text-sm text-base-content/70">
                  Drag & drop files here to upload (all types accepted)
                </p>
                <p className="text-xs text-base-content/50 mt-2">
                  Or click Upload to select files
                </p>
              </div> */}

              <div className="mt-3 w-full">
                <div className="w-full overflow-hidden">
                  <div className="hidden sm:flex items-center gap-4 px-3 py-2 text-xs uppercase text-base-content/45 bg-base-200/40 rounded-t-md">
                    <div className="w-6" />
                    <div className="flex-1">File Name</div>
                    <div className="w-36">Owner</div>
                    <div className="w-24">Size</div>
                    <div className="w-36">Modified</div>
                  </div>
                  <div className="divide-y">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (isExcelRecord(record)) {
                            void handleDownloadFile(record);
                          } else {
                            setSelectedRecord(record);
                          }
                        }}
                        onDoubleClick={() => void handlePreviewFile(record)}
                        className="flex items-center gap-3 px-3 py-3 hover:bg-base-200/40"
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedRecordIds.includes(record.id)}
                          onChange={(e) =>
                            toggleRecordSelection(record.id, e.target.checked)
                          }
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${record.fileName || record.title || record.id}`}
                        />
                        <div className="flex-1 truncate">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-base-200">
                              {getExplorerDescriptor({
                                fileName: record.fileName ?? record.title,
                                mimeType: record.mimeType,
                              }).icon}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {record.fileName || record.title || `Record #${record.id}`}
                              </div>
                              <div className="text-xs text-base-content/50 truncate">
                                {record.name || ""}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-36 text-sm text-base-content/60">—</div>
                        <div className="w-24 text-sm text-base-content/60">
                          {formatExplorerBytes(record.fileSize)}
                        </div>
                        <div className="w-36 text-sm text-base-content/60">
                          {formatExplorerDateTime(record.fileUpdatedAt || record.updatedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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

        {/* <aside className="space-y-5">
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
        </aside> */}

        {/* Toggle tab — always visible on the right edge */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? "Close file details" : "Open file details"}
          className="fixed right-0 top-1/2 z-50 -translate-y-1/2 flex flex-col items-center gap-2 rounded-l-xl border border-r-0 border-base-300 bg-base-100 px-2.5 py-4 shadow-md transition hover:bg-base-200"
        >
          {isOpen ? (
            <FiChevronRight className="h-4 w-4 text-base-content/60" />
          ) : (
            <FiChevronLeft className="h-4 w-4 text-base-content/60" />
          )}
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/50">
            Details
          </span>
        </button>

        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          className={`fixed right-0 top-0 z-50 h-full w-85 max-w-[92vw] overflow-y-auto border-l border-base-300 bg-base-100 shadow-xl transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-5 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
                  File Details
                </p>
                <h2 className="mt-2 text-lg font-bold text-base-content">
                  {selectedRecord?.fileName ??
                    selectedRecord?.title ??
                    "No file selected"}
                </h2>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                {selectedRecord && (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      getExplorerDescriptor({
                        fileName:
                          selectedRecord.fileName ?? selectedRecord.title,
                        mimeType: selectedRecord.mimeType,
                      }).badgeClassName
                    }`}
                  >
                    {
                      getExplorerDescriptor({
                        fileName:
                          selectedRecord.fileName ?? selectedRecord.title,
                        mimeType: selectedRecord.mimeType,
                      }).label
                    }
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-base-300 p-1.5 text-base-content/50 hover:bg-base-200"
                  aria-label="Close"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!selectedRecord ? (
              <div className="mt-6 rounded-3xl border border-dashed border-base-300 bg-base-200/15 p-5 text-sm text-base-content/55">
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
                        selectedRecord.fileCreatedAt ??
                          selectedRecord.createdAt,
                      ),
                    ],
                    [
                      "Last Modified",
                      formatExplorerDateTime(
                        selectedRecord.fileUpdatedAt ??
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
                      <p className="mt-2 wrap-break-word text-sm font-semibold text-base-content">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-3xl border border-base-300 bg-base-200/15 p-4">
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

                <div className="mt-5 rounded-3xl border border-base-300 bg-base-200/15 p-4">
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
