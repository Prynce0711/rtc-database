"use client";

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit2,
  FiFilePlus,
  FiFilter,
  FiFolder,
  FiFolderPlus,
  FiGrid,
  FiImage,
  FiList,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { ArchiveEntryType } from "../../generated/prisma/enums";
import { IPC_CHANNELS } from "../../lib/electron/channels";
import {
  useAdaptiveNavigation,
  useAdaptivePathname,
} from "../../lib/nextCompat";
import Roles from "../../lib/Roles";
import FileViewerModal from "../../Popup/FileViewerModal";
import ModalBase from "../../Popup/ModalBase";
import { usePopup } from "../../Popup/PopupProvider";
import Pagination from "../../Table/Pagination";
import { useToast } from "../../Toast/ToastProvider";
import type {
  ArchiveAdapter,
  ArchiveGarageDirectoryItem,
} from "./ArchiveAdapter";
import {
  formatArchiveBytes,
  formatArchiveDateTime,
  getArchiveDescriptor,
} from "./archiveExplorerUtils";
import ArchiveRow from "./ArchiveRow";
import {
  getArchiveExtension,
  joinArchivePath,
  normalizeArchivePath,
  type ArchiveEntryData,
  type ArchiveFilterOptions,
  type ArchiveStats,
} from "./ArchiveSchema";

type ViewMode = "list" | "grid";
type EntryTypeFilter = ArchiveEntryType | "ALL";
type SortConfig = {
  key: NonNullable<ArchiveFilterOptions["sortKey"]>;
  order: "asc" | "desc";
};
type UploadFormState = {
  name: string;
  description: string;
  file: File | null;
};
type FolderFormState = {
  name: string;
  description: string;
};
type GarageArchiveEntry = ArchiveEntryData & {
  source: "garage";
  garageKey: string;
};
type ArchiveContextMenuState = {
  x: number;
  y: number;
  entry: ArchiveEntryData;
};

type DesktopEditSessionState = {
  sessionId: string;
  lockId: string;
  lockMode: "archive" | "garage";
  entryId?: number;
  garageKey?: string;
  entryName: string;
  mimeType: string;
  heartbeatTimer: number;
  syncTimer: number;
  unlockCheckTimer: number;
};

const pageSize = 10;
const acceptedArchiveUploadTypes =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.csv,.txt,.json,.xml";
const DEBUG_DESKTOP_EDIT = true;

const logDesktopEdit = (...args: unknown[]) => {
  if (DEBUG_DESKTOP_EDIT) {
    console.log(...args);
  }
};

const errorDesktopEdit = (...args: unknown[]) => {
  if (DEBUG_DESKTOP_EDIT) {
    console.error(...args);
  }
};

const getCurrentQueryPath = (): string => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return normalizeArchivePath(params.get("path"));
};

const buildArchiveHref = (path: string): string => {
  const normalized = normalizeArchivePath(path);
  return normalized
    ? `/user/cases/archive?path=${encodeURIComponent(normalized)}`
    : "/user/cases/archive";
};

const initialUploadForm = (): UploadFormState => ({
  name: "",
  description: "",
  file: null,
});

const initialFolderForm = (): FolderFormState => ({
  name: "",
  description: "",
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

const getPreviewType = (entry: ArchiveEntryData): "pdf" | "image" | null => {
  const mimeType = (entry.file?.mimeType ?? "").toLowerCase();
  const name = entry.name.toLowerCase();

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|gif|bmp|webp|svg|tiff?)$/i.test(name)
  ) {
    return "image";
  }
  return null;
};

const isGarageArchiveEntry = (
  entry: ArchiveEntryData | null | undefined,
): entry is GarageArchiveEntry =>
  (entry as { source?: string } | null | undefined)?.source === "garage";

const mapGarageItemToArchiveEntry = (
  item: ArchiveGarageDirectoryItem,
  index: number,
  parentPath: string,
): GarageArchiveEntry => {
  const normalizedParent = normalizeArchivePath(parentPath);
  const normalizedKey = normalizeArchivePath(item.key);
  const entryPath = item.isDirectory
    ? normalizedKey
    : joinArchivePath(normalizedParent, item.name || normalizedKey);
  const timestamp = item.lastModified
    ? new Date(item.lastModified)
    : new Date();
  const updatedAt = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;
  const id = -(index + 1);

  return {
    id,
    name: item.name || normalizedKey || "Untitled",
    parentPath: normalizedParent,
    fullPath: entryPath,
    entryType: item.isDirectory
      ? ArchiveEntryType.FOLDER
      : ArchiveEntryType.FILE,
    description: null,
    extension: item.isDirectory ? null : getArchiveExtension(item.name),
    textContent: null,
    sheetData: null,
    fileId: item.isDirectory ? null : id,
    createdAt: updatedAt,
    updatedAt,
    file: item.isDirectory
      ? null
      : {
          id,
          key: item.key,
          fileHash: "",
          fileName: item.name || normalizedKey,
          path: normalizedParent,
          size: item.size,
          mimeType: "",
          createdAt: updatedAt,
          updatedAt,
        },
    source: "garage",
    garageKey: item.key,
  } as GarageArchiveEntry;
};

// Treat common spreadsheet file types as 'excel' for single-click download behavior
const isSpreadsheetEntry = (entry: ArchiveEntryData) => {
  const mime = (entry.file?.mimeType ?? "").toLowerCase();
  const name = (entry.name ?? "").toLowerCase();
  if (
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv") ||
    name.endsWith(".ods")
  ) {
    return true;
  }
  return false;
};

const isWordOrExcelEntry = (entry: ArchiveEntryData) => {
  const mime = (entry.file?.mimeType ?? "").toLowerCase();
  const name = (entry.name ?? "").toLowerCase();
  const extension = (getArchiveExtension(entry.name) || entry.extension || "")
    .toLowerCase()
    .trim();

  if (["doc", "docx", "xls", "xlsx"].includes(extension)) {
    return true;
  }

  return (
    mime.includes("word") ||
    mime.includes("wordprocessingml") ||
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("officedocument")
  );
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read downloaded file."));
    reader.onload = () => {
      const value = String(reader.result || "");
      const marker = "base64,";
      const index = value.indexOf(marker);
      resolve(index >= 0 ? value.slice(index + marker.length) : value);
    };
    reader.readAsDataURL(blob);
  });

const base64ToFile = (
  base64: string,
  fileName: string,
  mimeType: string,
): File => {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes], fileName, {
    type: mimeType || "application/octet-stream",
  });
};

const getSortLabel = (sortConfig: SortConfig) => {
  const keyLabel =
    sortConfig.key === "name"
      ? "Name"
      : sortConfig.key === "entryType"
        ? "Type"
        : sortConfig.key === "createdAt"
          ? "Created"
          : "Modified";

  return `${keyLabel} - ${sortConfig.order === "asc" ? "Ascending" : "Descending"}`;
};

const statsCardClassName =
  "group overflow-hidden rounded-[28px] border border-base-300/70 bg-base-100/95 p-5 shadow-[0_18px_55px_-28px_rgba(15,23,42,0.42)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-30px_rgba(14,116,144,0.36)]";

const ArchiveEmptyState = () => (
  <div className="flex min-h-[18rem] flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
    <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-base-200/60 sm:h-20 sm:w-20">
      <FiFolder className="h-7 w-7 text-base-content/35 sm:h-8 sm:w-8" />
    </span>
    <h3 className="mt-5 text-lg font-semibold text-base-content">
      This folder is empty
    </h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-base-content/55">
      Create a folder, upload a file, or add a document/spreadsheet to start
      organizing this archive thread.
    </p>
  </div>
);

const ArchivePage: React.FC<{
  role: Roles;
  adapter: ArchiveAdapter;
}> = ({ role, adapter }) => {
  const router = useAdaptiveNavigation();
  const pathname = useAdaptivePathname();
  const statusPopup = usePopup();
  const toast = useToast();
  const canManage =
    role === Roles.ADMIN || role === Roles.NOTARIAL || role === Roles.ARCHIVE;

  const [entries, setEntries] = useState<ArchiveEntryData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>("ALL");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // Match Notarial: allow switching overall display between explorer and table
  const [displayMode, setDisplayMode] = useState<"explorer" | "table">(
    "explorer",
  );
  // Details drawer open state (matches Notarial drawer behavior)
  const [isOpen, setIsOpen] = useState(false);
  // Folder upload input ref - add webkitdirectory attribute after mount
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
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "updatedAt",
    order: "desc",
  });
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntryData | null>(
    null,
  );
  const [contextMenu, setContextMenu] =
    useState<ArchiveContextMenuState | null>(null);
  const [draggedEntryId, setDraggedEntryId] = useState<number | null>(null);
  const [dragOverEntryId, setDragOverEntryId] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [uploadForm, setUploadForm] =
    useState<UploadFormState>(initialUploadForm());
  const [folderForm, setFolderForm] =
    useState<FolderFormState>(initialFolderForm());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [stats, setStats] = useState<ArchiveStats>({
    totalItems: 0,
    folders: 0,
    editableItems: 0,
    uploadedFiles: 0,
    storageUsedBytes: 0,
  });
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    loading: boolean;
    url: string;
    type: "pdf" | "image" | null;
    title: string;
    error: string;
    entry: ArchiveEntryData | null;
  }>({
    open: false,
    loading: false,
    url: "",
    type: null,
    title: "",
    error: "",
    entry: null,
  });

  const deferredSearch = useDeferredValue(searchValue.trim());
  const desktopEditSessionsRef = useRef<Map<string, DesktopEditSessionState>>(
    new Map(),
  );
  const desktopEditSyncInFlightRef = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string | null>(null);

  const getElectronIpc = () => {
    if (typeof window === "undefined") {
      return null;
    }
    const ipc = (
      window as unknown as {
        ipcRenderer?: {
          invoke?: (...args: unknown[]) => Promise<unknown>;
          on?: (...args: unknown[]) => unknown;
          off?: (...args: unknown[]) => unknown;
        };
      }
    ).ipcRenderer;
    return ipc?.invoke ? ipc : null;
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const extractDeviceId = (value: unknown): string | null => {
    if (!isRecord(value) || value.success !== true) {
      return null;
    }

    if (!isRecord(value.result) || typeof value.result.deviceId !== "string") {
      return null;
    }

    return value.result.deviceId;
  };

  const getDeviceIdFromIpc = async (): Promise<string | null> => {
    if (deviceIdRef.current) {
      return deviceIdRef.current;
    }

    const ipc = getElectronIpc();
    if (!ipc?.invoke) {
      return null;
    }

    try {
      const deviceIdResponse = await ipc.invoke(
        IPC_CHANNELS.SESSION_GET_DEVICE_ID,
      );
      const deviceId = extractDeviceId(deviceIdResponse);
      if (deviceId) {
        deviceIdRef.current = deviceId;
      }
      return deviceId;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const syncPath = () => {
      setCurrentPath(getCurrentQueryPath());
    };

    syncPath();
    window.addEventListener("popstate", syncPath);
    window.addEventListener("hashchange", syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("hashchange", syncPath);
    };
  }, [pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentPath, deferredSearch, displayMode, sortConfig, typeFilter]);

  const filters = useMemo(
    () => ({
      parentPath: currentPath,
      search: deferredSearch || undefined,
      entryType: typeFilter === "ALL" ? undefined : typeFilter,
    }),
    [currentPath, deferredSearch, typeFilter],
  );

  const refreshEntries = useCallback(
    async (page = currentPage) => {
      try {
        if (
          displayMode === "explorer" &&
          adapter.getArchiveGarageDirectoryItems
        ) {
          const listResult =
            await adapter.getArchiveGarageDirectoryItems(currentPath);

          if (!listResult.success) {
            setError(listResult.error || "Failed to load garage files");
            return;
          }

          const normalizedSearch = deferredSearch.toLowerCase();
          const mapped = listResult.result.map((item, index) =>
            mapGarageItemToArchiveEntry(item, index, currentPath),
          );
          const filtered = mapped
            .filter((entry) => {
              if (!normalizedSearch) return true;
              return (
                entry.name.toLowerCase().includes(normalizedSearch) ||
                entry.fullPath.toLowerCase().includes(normalizedSearch)
              );
            })
            .filter((entry) =>
              typeFilter === "ALL" ? true : entry.entryType === typeFilter,
            )
            .sort((a, b) => {
              if (sortConfig.key === "name") {
                return sortConfig.order === "asc"
                  ? a.name.localeCompare(b.name)
                  : b.name.localeCompare(a.name);
              }

              if (sortConfig.key === "entryType") {
                return sortConfig.order === "asc"
                  ? a.entryType.localeCompare(b.entryType)
                  : b.entryType.localeCompare(a.entryType);
              }

              const aTime = new Date(
                a.file?.updatedAt ?? a.updatedAt ?? a.createdAt,
              ).getTime();
              const bTime = new Date(
                b.file?.updatedAt ?? b.updatedAt ?? b.createdAt,
              ).getTime();
              return sortConfig.order === "asc" ? aTime - bTime : bTime - aTime;
            });
          const start = (page - 1) * pageSize;
          const pagedItems = filtered.slice(start, start + pageSize);

          setEntries(pagedItems);
          setTotalCount(filtered.length);
          setStats({
            totalItems: filtered.length,
            folders: filtered.filter(
              (entry) => entry.entryType === ArchiveEntryType.FOLDER,
            ).length,
            editableItems: 0,
            uploadedFiles: filtered.filter(
              (entry) => entry.entryType !== ArchiveEntryType.FOLDER,
            ).length,
            storageUsedBytes: filtered.reduce(
              (total, entry) => total + (entry.file?.size ?? 0),
              0,
            ),
          });
          setError(null);
          return;
        }

        const [listResult, statsResult] = await Promise.all([
          adapter.getArchiveEntriesPage({
            page,
            pageSize,
            filters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
          }),
          adapter.getArchiveStats({
            filters,
          }),
        ]);

        if (!listResult.success) {
          setError(listResult.error || "Failed to load archive entries");
          return;
        }

        setEntries(listResult.result.items);
        setTotalCount(
          listResult.result.total ?? listResult.result.items.length,
        );
        setError(null);

        if (statsResult.success && statsResult.result) {
          setStats(statsResult.result);
        }
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load archive entries",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      adapter,
      currentPage,
      currentPath,
      deferredSearch,
      displayMode,
      filters,
      sortConfig,
      typeFilter,
    ],
  );

  useEffect(() => {
    void refreshEntries(currentPage);
  }, [currentPage, refreshEntries]);

  useEffect(() => {
    setSelectedEntry((previous) => {
      if (entries.length === 0) return null;
      if (!previous) return entries[0] ?? null;
      return (
        entries.find((item) => item.id === previous.id) ?? entries[0] ?? null
      );
    });
  }, [entries]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setContextMenu(null);
      }
    };

    const closeMenu = () => setContextMenu(null);

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const breadcrumbSegments = useMemo(() => {
    const normalized = normalizeArchivePath(currentPath);
    if (!normalized) return [] as Array<{ label: string; path: string }>;

    const segments = normalized.split("/");
    return segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join("/"),
    }));
  }, [currentPath]);

  const parentArchivePath = useMemo(() => {
    const normalized = normalizeArchivePath(currentPath);
    if (!normalized.includes("/")) return "";
    return normalized.slice(0, normalized.lastIndexOf("/"));
  }, [currentPath]);

  const navigateArchivePath = useCallback(
    (path: string) => {
      const normalized = normalizeArchivePath(path);
      const href = buildArchiveHref(normalized);

      setCurrentPath(normalized);
      setSelectedEntry(null);
      setSelectedEntryIds([]);
      setCurrentPage(1);

      if (typeof window === "undefined") {
        router.push(href);
        return;
      }

      if (window.location.hash.startsWith("#/")) {
        window.location.hash = href;
        return;
      }

      window.history.pushState(null, "", href);
    },
    [router],
  );

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeFilterCount =
    (deferredSearch ? 1 : 0) + (typeFilter !== "ALL" ? 1 : 0);
  const visibleEntryIds = entries.map((entry) => entry.id);
  const allVisibleEntriesSelected =
    visibleEntryIds.length > 0 &&
    visibleEntryIds.every((entryId) => selectedEntryIds.includes(entryId));
  const selectedCount = selectedEntryIds.length;

  const detailDescriptor = selectedEntry
    ? getArchiveDescriptor({
        entryType: selectedEntry.entryType,
        mimeType: selectedEntry.file?.mimeType,
        name: selectedEntry.name,
      })
    : null;

  const closePreview = () => {
    setPreviewState({
      open: false,
      loading: false,
      url: "",
      type: null,
      title: "",
      error: "",
      entry: null,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshEntries(currentPage);
    statusPopup.showSuccess("Archive Explorer refreshed.");
  };

  const handleOpen = (entry: ArchiveEntryData) => {
    if (entry.entryType === ArchiveEntryType.FOLDER) {
      navigateArchivePath(entry.fullPath);
      return;
    }
    router.push(`/user/cases/archive/${entry.id}?page=${currentPage}`);
  };

  const handleEdit = (entry: ArchiveEntryData) => {
    if (isGarageArchiveEntry(entry)) {
      statusPopup.showError(
        "Garage-only files do not have archive metadata to edit yet.",
      );
      return;
    }

    router.push(
      `/user/cases/archive/edit?id=${entry.id}&page=${currentPage}`,
    );
  };

  const getEntryFileUrl = async (
    entry: ArchiveEntryData,
    options: {
      inline?: boolean;
      fileName?: string;
      contentType?: string;
    },
  ) => {
    if (isGarageArchiveEntry(entry)) {
      if (!adapter.getArchiveGarageFileUrl) {
        return {
          success: false as const,
          error: "Garage file access is not available.",
        };
      }

      return adapter.getArchiveGarageFileUrl(entry.garageKey, options);
    }

    return adapter.getArchiveFileUrl(entry.id, options);
  };

  const resolveServerUpdatedAtMs = (
    entry: ArchiveEntryData,
    response: Response,
  ): number | undefined => {
    const headerLastModified = response.headers.get("last-modified");
    const headerUpdatedAtMs = headerLastModified
      ? new Date(headerLastModified).getTime()
      : undefined;
    const serverTimestamp =
      entry.file?.updatedAt ?? entry.updatedAt ?? entry.createdAt;

    if (headerUpdatedAtMs && !Number.isNaN(headerUpdatedAtMs)) {
      return headerUpdatedAtMs;
    }
    if (!serverTimestamp) return undefined;
    const parsed = new Date(serverTimestamp).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const syncDesktopEditSession = useCallback(
    async (sessionId: string, force: boolean) => {
      const session = desktopEditSessionsRef.current.get(sessionId);
      if (!session) {
        logDesktopEdit("[DESKTOP_EDIT] Session not found:", sessionId);
        return;
      }

      if (
        desktopEditSyncInFlightRef.current.has(sessionId) ||
        (session.lockMode === "archive" && !adapter.syncArchiveEditedFile) ||
        (session.lockMode === "garage" && !adapter.syncArchiveGarageEditedFile)
      ) {
        logDesktopEdit(
          "[DESKTOP_EDIT] Sync skipped - in flight or adapter missing",
        );
        return;
      }

      const ipc = getElectronIpc();
      if (!ipc?.invoke) {
        logDesktopEdit("[DESKTOP_EDIT] IPC not available");
        return;
      }

      logDesktopEdit("[DESKTOP_EDIT] Starting sync for sessionId:", sessionId);
      desktopEditSyncInFlightRef.current.add(sessionId);
      try {
        const readResult = (await ipc.invoke(
          IPC_CHANNELS.ARCHIVE_READ_EXTERNAL_EDIT_SESSION,
          {
            sessionId,
            force,
          },
        )) as
          | {
              success: true;
              result: {
                changed: boolean;
                base64?: string;
              };
            }
          | {
              success: false;
              error?: string;
            };

        if (!readResult?.success) {
          errorDesktopEdit(
            "[DESKTOP_EDIT] Failed to read file:",
            readResult?.error,
          );
          statusPopup.showError(
            readResult?.error ||
              `Failed reading local edited file for ${session.entryName}.`,
          );
          return;
        }

        const { changed, base64 } = readResult.result;
        logDesktopEdit(
          "[DESKTOP_EDIT] File changed:",
          changed,
          "base64 length:",
          base64?.length,
        );

        if (!changed || !base64) {
          logDesktopEdit("[DESKTOP_EDIT] No changes to sync");
          return;
        }

        const editedFile = base64ToFile(
          base64,
          session.entryName,
          session.mimeType,
        );
        const syncResult =
          session.lockMode === "archive"
            ? await adapter.syncArchiveEditedFile?.(session.lockId, editedFile)
            : await adapter.syncArchiveGarageEditedFile?.(
                session.lockId,
                editedFile,
              );

        logDesktopEdit("[DESKTOP_EDIT] Sync result:", syncResult);

        if (!syncResult?.success) {
          errorDesktopEdit("[DESKTOP_EDIT] Sync failed:", syncResult?.error);
          statusPopup.showError(
            syncResult?.error ||
              `Failed syncing changes for ${session.entryName}.`,
          );
          return;
        }

        logDesktopEdit("[DESKTOP_EDIT] Sync completed successfully");
      } finally {
        desktopEditSyncInFlightRef.current.delete(sessionId);
      }
    },
    [adapter, statusPopup],
  );

  const stopDesktopEditSession = useCallback(
    async (
      sessionId: string,
      options?: {
        releaseLock?: boolean;
        removeFile?: boolean;
        syncBeforeClose?: boolean;
      },
    ) => {
      logDesktopEdit("[DESKTOP_EDIT] stopDesktopEditSession called:", {
        sessionId,
        options,
      });

      const session = desktopEditSessionsRef.current.get(sessionId);
      if (!session) {
        logDesktopEdit("[DESKTOP_EDIT] Session not found in map:", sessionId);
        return;
      }

      window.clearInterval(session.heartbeatTimer);
      window.clearInterval(session.syncTimer);
      window.clearInterval(session.unlockCheckTimer);

      if (options?.syncBeforeClose) {
        logDesktopEdit("[DESKTOP_EDIT] Syncing before close...");
        await syncDesktopEditSession(sessionId, true);
        logDesktopEdit("[DESKTOP_EDIT] Sync complete");
      }

      const ipc = getElectronIpc();
      if (ipc?.invoke) {
        logDesktopEdit(
          "[DESKTOP_EDIT] Invoking IPC close with removeFile:",
          options?.removeFile,
        );
        await ipc.invoke(IPC_CHANNELS.ARCHIVE_CLOSE_EXTERNAL_EDIT_SESSION, {
          sessionId,
          removeFile: options?.removeFile ?? false,
        });
      }

      if (options?.releaseLock) {
        logDesktopEdit("[DESKTOP_EDIT] Releasing lock...");
        if (session.lockMode === "archive") {
          await adapter.releaseArchiveEditLock?.(session.lockId);
        } else {
          await adapter.releaseArchiveGarageEditLock?.(session.lockId);
        }
      }

      desktopEditSessionsRef.current.delete(sessionId);
      desktopEditSyncInFlightRef.current.delete(sessionId);
      logDesktopEdit("[DESKTOP_EDIT] Session cleanup complete");
    },
    [adapter, syncDesktopEditSession],
  );

  const openDesktopReadOnly = useCallback(
    async (entry: ArchiveEntryData, lockedBy?: string) => {
      if (!entry.file) {
        statusPopup.showError("File metadata is missing for desktop viewing.");
        return false;
      }

      const ipc = getElectronIpc();
      if (!ipc?.invoke) {
        statusPopup.showError("Desktop viewing is only available in Electron.");
        return false;
      }

      const downloadResult = await getEntryFileUrl(entry, {
        inline: false,
        fileName: entry.name,
        contentType: entry.file?.mimeType || undefined,
      });

      if (!downloadResult.success) {
        statusPopup.showError(
          downloadResult.error || "Failed to download file for read-only view.",
        );
        return false;
      }

      const response = await fetch(downloadResult.result, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        statusPopup.showError(
          "Failed to fetch file payload for read-only view.",
        );
        return false;
      }

      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      if (!base64) {
        statusPopup.showError(
          "Failed to decode file payload for read-only view.",
        );
        return false;
      }

      const sessionId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `readonly-${entry.id}-${Date.now()}`;
      const isGarage = isGarageArchiveEntry(entry);
      const serverUpdatedAtMs = resolveServerUpdatedAtMs(entry, response);

      const openResult = (await ipc.invoke(
        IPC_CHANNELS.ARCHIVE_OPEN_EXTERNAL_EDIT_SESSION,
        {
          sessionId,
          fileName: entry.name,
          base64,
          tempKey: isGarage
            ? `garage:${entry.garageKey}`
            : `archive:${entry.id}`,
          serverUpdatedAtMs,
          readOnly: true,
        },
      )) as
        | { success: true; result: { sessionId: string } }
        | { success: false; error?: string };

      if (!openResult?.success) {
        statusPopup.showError(
          openResult?.error || "Failed to open file in read-only mode.",
        );
        return false;
      }

      const lockedLabel = lockedBy ? ` (locked by ${lockedBy})` : "";
      toast.success(`${entry.name} opened read-only${lockedLabel}.`);
      return true;
    },
    [getEntryFileUrl, resolveServerUpdatedAtMs, statusPopup, toast],
  );

  const handleOpenDesktopEditor = useCallback(
    async (entry: ArchiveEntryData) => {
      if (!entry.file) {
        statusPopup.showError("File metadata is missing for desktop editing.");
        return false;
      }

      const ipc = getElectronIpc();
      if (!ipc?.invoke) {
        statusPopup.showError("Desktop editing is only available in Electron.");
        return false;
      }

      const deviceId = await getDeviceIdFromIpc();
      const isGarage = isGarageArchiveEntry(entry);
      const hasArchiveDesktopEditActions =
        !!adapter.acquireArchiveEditLock &&
        !!adapter.heartbeatArchiveEditLock &&
        !!adapter.releaseArchiveEditLock &&
        !!adapter.syncArchiveEditedFile;
      const hasGarageDesktopEditActions =
        !!adapter.acquireArchiveGarageEditLock &&
        !!adapter.heartbeatArchiveGarageEditLock &&
        !!adapter.releaseArchiveGarageEditLock &&
        !!adapter.syncArchiveGarageEditedFile;

      if (
        (isGarage && !hasGarageDesktopEditActions) ||
        (!isGarage && !hasArchiveDesktopEditActions)
      ) {
        statusPopup.showError("Archive edit lock actions are not configured.");
        return false;
      }

      const acquireLock = isGarage
        ? (options?: { deviceId?: string }) =>
            adapter.acquireArchiveGarageEditLock!(entry.garageKey, options)
        : (options?: { deviceId?: string }) =>
            adapter.acquireArchiveEditLock!(entry.id, options);
      const releaseLock = isGarage
        ? (lockId: string) => adapter.releaseArchiveGarageEditLock!(lockId)
        : (lockId: string) => adapter.releaseArchiveEditLock!(lockId);
      const heartbeatLock = isGarage
        ? (lockId: string) => adapter.heartbeatArchiveGarageEditLock!(lockId)
        : (lockId: string) => adapter.heartbeatArchiveEditLock!(lockId);

      const lockResult = await acquireLock(deviceId ? { deviceId } : undefined);
      if (!lockResult.success) {
        if (lockResult.errorResult?.code === "locked") {
          return await openDesktopReadOnly(
            entry,
            lockResult.errorResult.lockedBy,
          );
        }

        statusPopup.showError(
          lockResult.error || "Failed to lock this file for editing.",
        );
        return false;
      }

      if (desktopEditSessionsRef.current.has(lockResult.result.lockId)) {
        toast.success(`${entry.name} is already open on this device.`);
        return true;
      }

      const downloadResult = await getEntryFileUrl(entry, {
        inline: false,
        fileName: entry.name,
        contentType: entry.file?.mimeType || undefined,
      });
      if (!downloadResult.success) {
        await releaseLock(lockResult.result.lockId);
        statusPopup.showError(
          downloadResult.error ||
            "Failed to download file for desktop editing.",
        );
        return false;
      }

      const response = await fetch(downloadResult.result, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        await releaseLock(lockResult.result.lockId);
        statusPopup.showError(
          "Failed to fetch file payload for desktop editing.",
        );
        return false;
      }

      const blob = await response.blob();
      logDesktopEdit("[DESKTOP_EDIT] Downloaded blob:", {
        size: blob.size,
        type: blob.type,
        name: entry.name,
      });

      const base64 = await blobToBase64(blob);
      logDesktopEdit("[DESKTOP_EDIT] Base64 conversion:", {
        originalSize: blob.size,
        base64Length: base64.length,
        isValid: base64.length > 0,
        first50Chars: base64.slice(0, 50),
      });

      const sessionId = lockResult.result.lockId;
      const serverUpdatedAtMs = resolveServerUpdatedAtMs(entry, response);
      logDesktopEdit("[DESKTOP_EDIT] Invoking IPC handler with:", {
        sessionId,
        fileName: entry.name,
        base64Length: base64.length,
        serverUpdatedAtMs,
        tempKey: isGarage ? `garage:${entry.garageKey}` : `archive:${entry.id}`,
      });

      const openResult = (await ipc.invoke(
        IPC_CHANNELS.ARCHIVE_OPEN_EXTERNAL_EDIT_SESSION,
        {
          sessionId,
          fileName: entry.name,
          base64,
          tempKey: isGarage
            ? `garage:${entry.garageKey}`
            : `archive:${entry.id}`,
          serverUpdatedAtMs,
        },
      )) as
        | { success: true; result: { sessionId: string } }
        | { success: false; error?: string };

      if (!openResult?.success) {
        await releaseLock(lockResult.result.lockId);
        statusPopup.showError(
          openResult?.error || "Failed to open file in desktop app.",
        );
        return false;
      }

      const heartbeatTimer = window.setInterval(async () => {
        const heartbeat = await heartbeatLock(lockResult.result.lockId);
        if (!heartbeat?.success) {
          window.clearInterval(heartbeatTimer);
          statusPopup.showError(
            heartbeat?.error ||
              `Edit lock expired for ${entry.name}. Changes may no longer sync.`,
          );
          logDesktopEdit(
            "[DESKTOP_EDIT] Heartbeat failed. Keeping session open.",
          );
        }
      }, lockResult.result.heartbeatIntervalMs);

      const syncIntervalMs = Math.max(
        lockResult.result.syncIntervalMs || 15000,
        5000,
      );
      const syncTimer = window.setInterval(() => {
        void syncDesktopEditSession(sessionId, true);
      }, syncIntervalMs);

      const unlockCheckTimer = window.setInterval(async () => {
        const ipc = getElectronIpc();
        if (!ipc?.invoke) {
          return;
        }

        const lockStatus = (await ipc.invoke(
          IPC_CHANNELS.ARCHIVE_CHECK_EXTERNAL_EDIT_LOCK,
          { sessionId },
        )) as
          | { success: true; result: { locked: boolean; exists: boolean } }
          | { success: false; error?: string };

        if (!lockStatus?.success || !lockStatus.result?.exists) {
          return;
        }

        if (!lockStatus.result.locked) {
          logDesktopEdit(
            "[DESKTOP_EDIT] File unlocked. Syncing and releasing lock.",
          );
          await stopDesktopEditSession(sessionId, {
            releaseLock: true,
            removeFile: false,
            syncBeforeClose: true,
          });
        }
      }, 5000);

      desktopEditSessionsRef.current.set(sessionId, {
        sessionId,
        lockId: lockResult.result.lockId,
        lockMode: isGarage ? "garage" : "archive",
        entryId: isGarage ? undefined : entry.id,
        garageKey: isGarage ? entry.garageKey : undefined,
        entryName: entry.name,
        mimeType: entry.file?.mimeType || "application/octet-stream",
        heartbeatTimer,
        syncTimer,
        unlockCheckTimer,
      });

      toast.success(
        `${entry.name} opened in desktop editor. Changes sync every 15 seconds while open.`,
      );
      return true;
    },
    [
      adapter,
      getEntryFileUrl,
      getDeviceIdFromIpc,
      openDesktopReadOnly,
      resolveServerUpdatedAtMs,
      statusPopup,
      toast,
    ],
  );

  const syncDesktopEditSessionRef = useRef(syncDesktopEditSession);
  const stopDesktopEditSessionRef = useRef(stopDesktopEditSession);

  useEffect(() => {
    syncDesktopEditSessionRef.current = syncDesktopEditSession;
    stopDesktopEditSessionRef.current = stopDesktopEditSession;
  }, [stopDesktopEditSession, syncDesktopEditSession]);

  useEffect(() => {
    const ipc = getElectronIpc();
    if (!ipc?.on || !ipc?.off) {
      return;
    }

    const onDirty = (
      _event: unknown,
      payload: { sessionId?: string } | null | undefined,
    ) => {
      const sessionId = String(payload?.sessionId || "").trim();
      if (!sessionId) return;
      void syncDesktopEditSessionRef.current(sessionId, false);
    };

    ipc.on(IPC_CHANNELS.ARCHIVE_EXTERNAL_EDIT_DIRTY_EVENT, onDirty);

    return () => {
      ipc.off?.(IPC_CHANNELS.ARCHIVE_EXTERNAL_EDIT_DIRTY_EVENT, onDirty);
    };
  }, []);

  const handlePreview = async (entry: ArchiveEntryData) => {
    if (!entry.file) {
      handleOpen(entry);
      return;
    }

    if (isWordOrExcelEntry(entry) && getElectronIpc()?.invoke) {
      await handleOpenDesktopEditor(entry);
      return;
    }

    const previewType = getPreviewType(entry);
    if (!previewType) {
      await handleDownload(entry);
      return;
    }

    setPreviewState({
      open: true,
      loading: true,
      url: "",
      type: previewType,
      title: entry.name,
      error: "",
      entry,
    });

    const result = await getEntryFileUrl(entry, {
      inline: true,
      fileName: entry.name,
      contentType: entry.file?.mimeType ?? undefined,
    });

    if (!result.success) {
      setPreviewState((previous) => ({
        ...previous,
        loading: false,
        error: result.error || "Failed to open archive file",
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

  const handleDownload = async (entry: ArchiveEntryData) => {
    if (!entry.file) return;

    const result = await getEntryFileUrl(entry, {
      inline: false,
      fileName: entry.name,
      contentType: entry.file?.mimeType ?? undefined,
    });

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to download archive file");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = result.result;
    anchor.download = entry.name;
    anchor.click();
  };

  const handlePrint = async (entry: ArchiveEntryData) => {
    if (!entry.file) return;

    const result = await getEntryFileUrl(entry, {
      inline: true,
      fileName: entry.name,
      contentType: entry.file?.mimeType ?? undefined,
    });

    if (!result.success) {
      statusPopup.showError(
        result.error || "Unable to print this archive file",
      );
      return;
    }

    const win = window.open(result.result, "_blank", "noopener,noreferrer");
    win?.focus();
  };

  const deleteGarageEntries = async (items: GarageArchiveEntry[]) => {
    if (!adapter.deleteArchiveGarageItems) {
      statusPopup.showError(
        "Garage deletion is not available in Archive Explorer.",
      );
      return false;
    }

    statusPopup.showLoading(
      `Deleting ${items.length} Garage item${items.length !== 1 ? "s" : ""}...`,
    );
    const result = await adapter.deleteArchiveGarageItems(
      items.map((item) => item.garageKey),
    );

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete Garage items");
      return false;
    }

    statusPopup.showSuccess(
      `Deleted ${result.result.deletedCount.toLocaleString()} Garage object${
        result.result.deletedCount !== 1 ? "s" : ""
      }.`,
    );
    return true;
  };

  const handleDelete = async (entry: ArchiveEntryData) => {
    const confirmed = await statusPopup.showConfirm(
      entry.entryType === ArchiveEntryType.FOLDER
        ? `Delete folder "${entry.name}" and everything inside it?`
        : `Delete "${entry.name}" from the archive?`,
    );

    if (!confirmed) return;

    if (isGarageArchiveEntry(entry)) {
      const deleted = await deleteGarageEntries([entry]);
      if (!deleted) return;

      setSelectedEntryIds((previous) =>
        previous.filter((id) => id !== entry.id),
      );
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry(null);
      }
      await refreshEntries(1);
      return;
    }

    const result = await adapter.deleteArchiveEntry(entry.id);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete archive entry");
      return;
    }

    setSelectedEntryIds((previous) => previous.filter((id) => id !== entry.id));
    if (selectedEntry?.id === entry.id) {
      setSelectedEntry(null);
    }
    statusPopup.showSuccess("Archive entry deleted.");
    await refreshEntries();
  };

  const handleCreateFolder = async () => {
    if (!folderForm.name.trim()) {
      statusPopup.showError("Folder name is required.");
      return;
    }

    setCreatingFolder(true);
    const result = await adapter.createArchiveEntry({
      name: folderForm.name.trim(),
      parentPath: currentPath,
      entryType: ArchiveEntryType.FOLDER,
      description: folderForm.description.trim() || undefined,
    });
    setCreatingFolder(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to create folder");
      return;
    }

    setShowFolderModal(false);
    setFolderForm(initialFolderForm());
    setCurrentPage(1);
    statusPopup.showSuccess("Archive folder created.");
    await refreshEntries(1);
  };

  const handleUploadFile = async () => {
    if (!uploadForm.file) {
      statusPopup.showError("Select a file first.");
      return;
    }

    setUploading(true);
    setUploadProgress(18);

    const result = await adapter.createArchiveEntry({
      name: uploadForm.name.trim() || uploadForm.file.name,
      parentPath: currentPath,
      entryType: ArchiveEntryType.FILE,
      description: uploadForm.description.trim() || undefined,
      file: uploadForm.file,
    });

    setUploading(false);
    setUploadProgress(result.success ? 100 : 0);

    if (!result.success) {
      statusPopup.showError(result.error || "Upload failed");
      return;
    }

    setShowUploadModal(false);
    setUploadForm(initialUploadForm());
    setCurrentPage(1);
    statusPopup.showSuccess("Archive file uploaded.");
    await refreshEntries(1);
  };

  // Garage drop handler: quick-set file and open upload modal
  const handleGarageDrop = async (file: File | null) => {
    if (!file) return;
    setUploadForm((previous) => ({
      ...previous,
      file,
      name: previous.name || file.name,
    }));
    setShowUploadModal(true);
  };

  const getEntriesForDrag = (entry: ArchiveEntryData) => {
    if (selectedEntryIds.includes(entry.id)) {
      return entries.filter((item) => selectedEntryIds.includes(item.id));
    }

    return [entry];
  };

  const uploadDroppedArchiveFiles = async (
    fileList: FileList,
    targetPath: string,
  ) => {
    const files = Array.from(fileList);
    if (files.length === 0) return false;

    statusPopup.showLoading(
      `Uploading ${files.length} file${files.length !== 1 ? "s" : ""}...`,
    );

    let successCount = 0;
    for (const file of files) {
      const result = await adapter.createArchiveEntry({
        name: file.name,
        parentPath: targetPath,
        entryType: ArchiveEntryType.FILE,
        file,
      });

      if (result.success) {
        successCount++;
      }
    }

    statusPopup.showSuccess(
      `Uploaded ${successCount} of ${files.length} file${files.length !== 1 ? "s" : ""}.`,
    );
    setCurrentPage(1);
    await refreshEntries(1);
    return true;
  };

  const moveArchiveEntriesToFolder = async (
    items: ArchiveEntryData[],
    targetPath: string,
  ) => {
    const garageItems = items.filter(isGarageArchiveEntry);
    if (garageItems.length !== items.length) {
      statusPopup.showError(
        "Only Garage Explorer items can be moved by drag and drop.",
      );
      return false;
    }

    if (!adapter.moveArchiveGarageItems) {
      statusPopup.showError(
        "Garage move is not available in Archive Explorer.",
      );
      return false;
    }

    const normalizedTarget = normalizeArchivePath(targetPath);
    const keys = garageItems
      .filter((item) => item.fullPath !== normalizedTarget)
      .map((item) => item.garageKey);

    if (keys.length === 0) return false;

    statusPopup.showLoading(
      `Moving ${keys.length} item${keys.length !== 1 ? "s" : ""}...`,
    );
    const result = await adapter.moveArchiveGarageItems(keys, normalizedTarget);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to move archive items");
      return false;
    }

    statusPopup.showSuccess(
      `Moved ${result.result.movedCount.toLocaleString()} Garage object${
        result.result.movedCount !== 1 ? "s" : ""
      }.`,
    );
    clearSelection();
    setSelectedEntry(null);
    await refreshEntries(1);
    return true;
  };

  const handleArchiveDropOnFolder = async (
    event: React.DragEvent,
    targetEntry: ArchiveEntryData,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverEntryId(null);

    if (targetEntry.entryType !== ArchiveEntryType.FOLDER) return;

    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await uploadDroppedArchiveFiles(droppedFiles, targetEntry.fullPath);
      return;
    }

    const draggedId = Number(
      event.dataTransfer.getData("application/x-rtc-archive-entry"),
    );
    const draggedEntry =
      entries.find((entry) => entry.id === draggedId) ??
      (draggedEntryId == null
        ? undefined
        : entries.find((entry) => entry.id === draggedEntryId));
    if (!draggedEntry) return;

    await moveArchiveEntriesToFolder(
      getEntriesForDrag(draggedEntry),
      targetEntry.fullPath,
    );
  };

  const handleArchiveSurfaceDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOverEntryId(null);

    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await uploadDroppedArchiveFiles(droppedFiles, currentPath);
      return;
    }

    const draggedId = Number(
      event.dataTransfer.getData("application/x-rtc-archive-entry"),
    );
    const draggedEntry = entries.find((entry) => entry.id === draggedId);
    if (!draggedEntry) return;

    await moveArchiveEntriesToFolder(
      getEntriesForDrag(draggedEntry),
      currentPath,
    );
  };

  const handleArchiveContextMenu = (
    event: React.MouseEvent,
    entry: ArchiveEntryData,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedEntry(entry);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      entry,
    });
  };

  const handleRenameArchiveEntry = async (entry: ArchiveEntryData) => {
    setContextMenu(null);

    if (!isGarageArchiveEntry(entry)) {
      handleEdit(entry);
      return;
    }

    if (!adapter.renameArchiveGarageItem) {
      statusPopup.showError(
        "Garage rename is not available in Archive Explorer.",
      );
      return;
    }

    const nextName = window.prompt("Rename item", entry.name);
    if (!nextName || nextName.trim() === entry.name) return;

    const result = await adapter.renameArchiveGarageItem(
      entry.garageKey,
      nextName.trim(),
    );
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to rename archive item");
      return;
    }

    statusPopup.showSuccess("Archive item renamed.");
    await refreshEntries(1);
  };

  const ensureArchiveFolderPath = async (
    basePath: string,
    folderSegments: string[],
    createdFolderPaths: Set<string>,
  ): Promise<
    { success: true; path: string } | { success: false; error: string }
  > => {
    let parentPath = normalizeArchivePath(basePath);

    for (const rawSegment of folderSegments) {
      const folderName = rawSegment.trim();
      if (!folderName) continue;

      const fullPath = joinArchivePath(parentPath, folderName);
      if (createdFolderPaths.has(fullPath)) {
        parentPath = fullPath;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const result = await adapter.createArchiveEntry({
        name: folderName,
        parentPath,
        entryType: ArchiveEntryType.FOLDER,
      });

      if (!result.success) {
        const message = result.error || "Failed to create folder";
        if (!message.toLowerCase().includes("already exists")) {
          return { success: false, error: message };
        }
      }

      createdFolderPaths.add(fullPath);
      parentPath = fullPath;
    }

    return { success: true, path: parentPath };
  };

  const handleUploadFolderFiles = async (files: File[] | null) => {
    if (!files || files.length === 0) {
      statusPopup.showError("No files found in the selected folder.");
      return;
    }
    if (
      !(await statusPopup.showConfirm(
        `Upload ${files.length} file${files.length > 1 ? "s" : ""} from folder?`,
      ))
    ) {
      return;
    }

    statusPopup.showLoading(`Uploading ${files.length} files...`);
    let successCount = 0;
    const createdFolderPaths = new Set<string>();

    for (const file of files) {
      try {
        const relativePath = normalizeArchivePath(
          (file as unknown as { webkitRelativePath?: string })
            .webkitRelativePath || file.name,
        );
        const pathSegments = relativePath
          ? relativePath.split("/")
          : [file.name];
        const fileName = pathSegments.pop() || file.name;
        // sequential upload to avoid overwhelming backend and to preserve folder order
        // eslint-disable-next-line no-await-in-loop
        const folderResult = await ensureArchiveFolderPath(
          currentPath,
          pathSegments,
          createdFolderPaths,
        );
        if (!folderResult.success) {
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const result = await adapter.createArchiveEntry({
          name: fileName,
          parentPath: folderResult.path,
          entryType: ArchiveEntryType.FILE,
          description: undefined,
          file,
        });
        if (result.success) successCount++;
      } catch {
        // continue
      }
    }

    statusPopup.showSuccess(
      `Uploaded ${successCount} of ${files.length} files.`,
    );
    setCurrentPage(1);
    await refreshEntries(1);
  };

  const toggleEntrySelection = (entryId: number, checked: boolean) => {
    setSelectedEntryIds((previous) => {
      if (checked) {
        if (previous.includes(entryId)) return previous;
        return [...previous, entryId];
      }
      return previous.filter((id) => id !== entryId);
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedEntryIds((previous) => {
      if (checked) {
        const merged = new Set([...previous, ...visibleEntryIds]);
        return Array.from(merged);
      }
      return previous.filter((id) => !visibleEntryIds.includes(id));
    });
  };

  const clearSelection = () => {
    setSelectedEntryIds([]);
  };

  const handleUnsupportedAction = (action: string) => {
    statusPopup.showError(
      `${action} is not available in bulk from Archive Explorer yet. Use the edit flow for single-entry changes.`,
    );
  };

  const fetchSelectedEntries = async () => {
    if (selectedEntryIds.length === 0) return [] as ArchiveEntryData[];
    const selectedGarageEntries = entries.filter(
      (entry) =>
        selectedEntryIds.includes(entry.id) && isGarageArchiveEntry(entry),
    );
    if (selectedGarageEntries.length > 0) {
      return selectedGarageEntries;
    }

    const result = await adapter.getArchiveEntriesByIds(selectedEntryIds);
    if (!result.success) {
      statusPopup.showError(
        result.error || "Failed to load selected archive entries",
      );
      return [] as ArchiveEntryData[];
    }
    return result.result;
  };

  const handleDownloadSelected = async () => {
    const items = await fetchSelectedEntries();
    for (const item of items.filter((entry) => !!entry.file)) {
      await handleDownload(item);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEntryIds.length === 0) return;
    const selectedGarageEntries = entries.filter(
      (entry): entry is GarageArchiveEntry =>
        selectedEntryIds.includes(entry.id) && isGarageArchiveEntry(entry),
    );

    if (
      !(await statusPopup.showConfirm(
        `Delete ${selectedEntryIds.length} selected archive item${selectedEntryIds.length > 1 ? "s" : ""}?`,
      ))
    ) {
      return;
    }

    if (selectedGarageEntries.length > 0) {
      const deleted = await deleteGarageEntries(selectedGarageEntries);
      if (!deleted) return;

      clearSelection();
      setSelectedEntry(null);
      await refreshEntries(1);
      return;
    }

    statusPopup.showLoading("Deleting selected archive entries...");
    const results = await Promise.allSettled(
      selectedEntryIds.map((id) => adapter.deleteArchiveEntry(id)),
    );

    const failed = results.filter(
      (result) => result.status !== "fulfilled" || !result.value.success,
    );

    if (failed.length > 0) {
      statusPopup.showError(
        `Deleted ${selectedEntryIds.length - failed.length} item(s), but ${failed.length} failed.`,
      );
    } else {
      statusPopup.showSuccess("Selected archive items deleted.");
    }

    clearSelection();
    await refreshEntries();
  };

  const handleExportSelected = async () => {
    const items = await fetchSelectedEntries();
    if (items.length === 0) return;

    downloadCsv(
      "archive-selected-items.csv",
      [
        "Name",
        "Type",
        "Folder",
        "Description",
        "Created",
        "Modified",
        "Size",
        "Full Path",
      ],
      items.map((item) => [
        item.name,
        getArchiveDescriptor({
          entryType: item.entryType,
          mimeType: item.file?.mimeType,
          name: item.name,
        }).label,
        item.parentPath || "Root Directory",
        item.description || "",
        formatArchiveDateTime(item.file?.createdAt ?? item.createdAt),
        formatArchiveDateTime(
          item.file?.updatedAt ?? item.updatedAt ?? item.createdAt,
        ),
        formatArchiveBytes(item.file?.size),
        item.fullPath,
      ]),
    );
    statusPopup.showSuccess("Selected archive metadata exported.");
  };

  const handleExportCurrentView = () => {
    downloadCsv(
      "archive-current-view.csv",
      [
        "Name",
        "Type",
        "Folder",
        "Description",
        "Modified",
        "Size",
        "Full Path",
      ],
      entries.map((entry) => [
        entry.name,
        getArchiveDescriptor({
          entryType: entry.entryType,
          mimeType: entry.file?.mimeType,
          name: entry.name,
        }).label,
        entry.parentPath || "Root Directory",
        entry.description || "",
        formatArchiveDateTime(
          entry.file?.updatedAt ?? entry.updatedAt ?? entry.createdAt,
        ),
        formatArchiveBytes(entry.file?.size),
        entry.fullPath,
      ]),
    );
    statusPopup.showSuccess("Current archive view exported.");
  };

  const fileTypeLegend = [
    { label: "Folder", icon: <FiFolder className="h-4 w-4 text-warning" /> },
    { label: "PDF", icon: <FiFilePlus className="h-4 w-4 text-error" /> },
    { label: "Word", icon: <FiFilePlus className="h-4 w-4 text-info" /> },
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
              Loading Archive Explorer...
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

  const renderListing = () => {
    if (displayMode === "table") {
      return (
        <div className="min-w-0 overflow-hidden rounded-[24px] border border-base-300 bg-base-100 shadow-lg sm:rounded-[30px]">
          {entries.length === 0 ? (
            <ArchiveEmptyState />
          ) : viewMode === "list" ? (
            <div className="overflow-x-auto">
              <table className="table w-full text-center">
                <thead>
                  <tr className="bg-base-200/40 text-xs uppercase tracking-[0.16em] text-base-content/45">
                    <th className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={allVisibleEntriesSelected}
                        onChange={(event) =>
                          toggleSelectAllVisible(event.target.checked)
                        }
                        aria-label="Select all visible archive entries"
                      />
                    </th>
                    <th className="px-4 py-4 text-left">File Name</th>
                    <th className="px-4 py-4">File Type</th>
                    <th className="px-4 py-4">Folder</th>
                    <th className="px-4 py-4">Date Uploaded</th>
                    <th className="px-4 py-4">Last Modified</th>
                    <th className="px-4 py-4">File Size</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <ArchiveRow
                      key={entry.id}
                      entry={entry}
                      canManage={canManage && !isGarageArchiveEntry(entry)}
                      isSelected={selectedEntryIds.includes(entry.id)}
                      onToggleSelect={toggleEntrySelection}
                      onSelectEntry={setSelectedEntry}
                      onOpen={handleOpen}
                      onPreview={(item) => void handlePreview(item)}
                      onEdit={handleEdit}
                      onDelete={(item) => void handleDelete(item)}
                      onDownload={(item) => void handleDownload(item)}
                      onPrint={(item) => void handlePrint(item)}
                      onUnsupportedAction={handleUnsupportedAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-3">
              {entries.map((entry) => {
                const descriptor = getArchiveDescriptor({
                  entryType: entry.entryType,
                  mimeType: entry.file?.mimeType,
                  name: entry.name,
                });
                return (
                  <div
                    key={entry.id}
                    draggable
                    className={`group cursor-pointer rounded-[26px] border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                      selectedEntry?.id === entry.id
                        ? "border-primary/35 bg-primary/7"
                        : dragOverEntryId === entry.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-base-300 bg-base-100"
                    }`}
                    onContextMenu={(event) =>
                      handleArchiveContextMenu(event, entry)
                    }
                    onDragStart={(event) => {
                      setDraggedEntryId(entry.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        "application/x-rtc-archive-entry",
                        String(entry.id),
                      );
                    }}
                    onDragEnd={() => {
                      setDraggedEntryId(null);
                      setDragOverEntryId(null);
                    }}
                    onDragOver={(event) => {
                      if (entry.entryType !== ArchiveEntryType.FOLDER) return;
                      event.preventDefault();
                      setDragOverEntryId(entry.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverEntryId === entry.id)
                        setDragOverEntryId(null);
                    }}
                    onDrop={(event) =>
                      void handleArchiveDropOnFolder(event, entry)
                    }
                    onClick={() => setSelectedEntry(entry)}
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
                            {entry.name}
                          </p>
                          <p className="mt-1 truncate text-xs text-base-content/50">
                            {entry.parentPath || "Root Directory"}
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm mt-1"
                        checked={selectedEntryIds.includes(entry.id)}
                        onChange={(event) =>
                          toggleEntrySelection(entry.id, event.target.checked)
                        }
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${entry.name}`}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${descriptor.badgeClassName}`}
                      >
                        {descriptor.label}
                      </span>
                      <span className="rounded-full bg-base-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/55">
                        {entry.entryType === ArchiveEntryType.FOLDER
                          ? "Container"
                          : "Stored Item"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-base-200/30 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                          Modified
                        </p>
                        <p className="mt-2 text-sm font-semibold text-base-content">
                          {formatArchiveDateTime(
                            entry.file?.updatedAt ??
                              entry.updatedAt ??
                              entry.createdAt,
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-base-200/30 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                          Size
                        </p>
                        <p className="mt-2 text-sm font-semibold text-base-content">
                          {formatArchiveBytes(entry.file?.size)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline min-w-0 gap-2 sm:w-auto"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEntry(entry);
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline min-w-0 gap-2 sm:w-auto"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (entry.entryType === ArchiveEntryType.FOLDER) {
                            handleOpen(entry);
                          } else {
                            void handlePreview(entry);
                          }
                        }}
                      >
                        {entry.entryType === ArchiveEntryType.FOLDER
                          ? "Open"
                          : "Preview"}
                      </button>
                      {entry.file && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary min-w-0 gap-2 sm:w-auto"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDownload(entry);
                          }}
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // explorer view
    return (
      <div className="min-w-0 overflow-hidden rounded-[22px] border border-base-300 bg-base-100 p-3 sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              className="btn btn-sm btn-outline flex items-center justify-center gap-2"
              onClick={() => navigateArchivePath(parentArchivePath)}
              disabled={!currentPath}
              title="Back to parent folder"
            >
              <FiChevronLeft className="h-4 w-4" />
              Back
            </button>

            <label className="btn btn-sm btn-outline flex items-center justify-center gap-2">
              <FiUpload className="h-4 w-4" />
              Upload
              <input
                type="file"
                accept={acceptedArchiveUploadTypes}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    setUploadForm((previous) => ({
                      ...previous,
                      file,
                      name: previous.name || file.name,
                    }));
                    setShowUploadModal(true);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </label>

            <label className="btn btn-sm btn-outline flex items-center justify-center gap-2">
              <FiFolder className="h-4 w-4" />
              Upload Folder
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-expect-error -- non-standard attribute required for folder selection
                webkitdirectory=""
               
                directory=""
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files ?? []);
                  void handleUploadFolderFiles(
                    files.length > 0 ? files : null,
                  );
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              type="button"
              className="btn btn-sm btn-outline flex items-center justify-center gap-2"
              onClick={() => setShowFolderModal(true)}
            >
              <FiFolderPlus className="h-4 w-4" />
              New Folder
            </button>

            <button
              type="button"
              className="btn btn-sm col-span-2 sm:col-span-1"
              onClick={() => setShowUploadModal(true)}
            >
              Metadata
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <ArchiveEmptyState />
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(event) => void handleArchiveSurfaceDrop(event)}
            className="flex flex-col gap-3"
          >
            <div className="mt-3 w-full">
              <div className="w-full min-w-0 overflow-hidden">
                <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_9rem_6rem_9rem] items-center gap-4 rounded-t-md bg-base-200/40 px-4 py-2 text-xs uppercase text-base-content/45 lg:grid">
                  <div className="w-6" />
                  <div>File Name</div>
                  <div className="w-36">Owner</div>
                  <div className="w-24">Size</div>
                  <div className="w-36">Modified</div>
                </div>

                <div className="divide-y rounded-b-md">
                  {entries.map((entry) => {
                    const descriptor = getArchiveDescriptor({
                      entryType: entry.entryType,
                      mimeType: entry.file?.mimeType,
                      name: entry.name,
                    });
                    return (
                      <div
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        draggable
                        onContextMenu={(event) =>
                          handleArchiveContextMenu(event, entry)
                        }
                        onDragStart={(event) => {
                          setDraggedEntryId(entry.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/x-rtc-archive-entry",
                            String(entry.id),
                          );
                        }}
                        onDragEnd={() => {
                          setDraggedEntryId(null);
                          setDragOverEntryId(null);
                        }}
                        onDragOver={(event) => {
                          if (entry.entryType !== ArchiveEntryType.FOLDER)
                            return;
                          event.preventDefault();
                          setDragOverEntryId(entry.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverEntryId === entry.id)
                            setDragOverEntryId(null);
                        }}
                        onDrop={(event) =>
                          void handleArchiveDropOnFolder(event, entry)
                        }
                        onClick={() => {
                          if (isSpreadsheetEntry(entry)) {
                            void handleDownload(entry);
                          } else {
                            setSelectedEntry(entry);
                          }
                        }}
                        onDoubleClick={() => {
                          if (entry.entryType === ArchiveEntryType.FOLDER) {
                            handleOpen(entry);
                          } else {
                            void handlePreview(entry);
                          }
                        }}
                        className={`grid gap-3 px-3 py-3 transition hover:bg-base-200/40 sm:px-4 lg:grid-cols-[1.5rem_minmax(0,1fr)_9rem_6rem_9rem] lg:items-center lg:gap-4 ${
                          selectedEntry?.id === entry.id
                            ? "bg-primary/7"
                            : dragOverEntryId === entry.id
                              ? "bg-primary/10"
                              : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3 lg:contents">
                          <div className="shrink-0 pt-2 lg:pt-0">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedEntryIds.includes(entry.id)}
                              onChange={(e) =>
                                toggleEntrySelection(entry.id, e.target.checked)
                              }
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${entry.name}`}
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${descriptor.iconWrapClassName}`}
                            >
                              {descriptor.icon}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-base-content">
                                {entry.name}
                              </p>
                              <p className="mt-1 truncate text-xs text-base-content/50">
                                {entry.parentPath || "Root Directory"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pl-12 sm:grid-cols-3 lg:contents lg:pl-0">
                          <div className="min-w-0 rounded-2xl bg-base-200/35 px-3 py-2 lg:bg-transparent lg:p-0">
                            <p className="text-[10px] font-semibold uppercase text-base-content/38 lg:hidden">
                              Owner
                            </p>
                            <p className="mt-1 truncate text-xs text-base-content/60 lg:mt-0 lg:text-sm">
                              -
                            </p>
                          </div>
                          <div className="min-w-0 rounded-2xl bg-base-200/35 px-3 py-2 lg:bg-transparent lg:p-0">
                            <p className="text-[10px] font-semibold uppercase text-base-content/38 lg:hidden">
                              Size
                            </p>
                            <p className="mt-1 truncate text-xs text-base-content/60 lg:mt-0 lg:text-sm">
                              {formatArchiveBytes(entry.file?.size)}
                            </p>
                          </div>
                          <div className="col-span-2 min-w-0 rounded-2xl bg-base-200/35 px-3 py-2 sm:col-span-1 lg:col-span-auto lg:bg-transparent lg:p-0">
                            <p className="text-[10px] font-semibold uppercase text-base-content/38 lg:hidden">
                              Modified
                            </p>
                            <p className="mt-1 truncate text-xs text-base-content/60 lg:mt-0 lg:text-sm">
                              {formatArchiveDateTime(
                                entry.file?.updatedAt ??
                                  entry.updatedAt ??
                                  entry.createdAt,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-6">
      <FileViewerModal
        open={previewState.open}
        loading={previewState.loading}
        url={previewState.url}
        type={previewState.type}
        title={previewState.title}
        error={previewState.error}
        onClose={closePreview}
        onDownload={
          previewState.entry
            ? () => void handleDownload(previewState.entry as ArchiveEntryData)
            : undefined
        }
      />

      {contextMenu && (
        <div
          className="fixed z-[90] w-44 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-2xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2"
            onClick={() => {
              const entry = contextMenu.entry;
              setContextMenu(null);
              if (entry.entryType === ArchiveEntryType.FOLDER) {
                handleOpen(entry);
              } else {
                void handlePreview(entry);
              }
            }}
          >
            <FiFolder className="h-4 w-4" />
            Open
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2"
            onClick={() => void handleRenameArchiveEntry(contextMenu.entry)}
          >
            <FiEdit2 className="h-4 w-4" />
            Rename
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-error"
            onClick={() => {
              const entry = contextMenu.entry;
              setContextMenu(null);
              void handleDelete(entry);
            }}
          >
            <FiTrash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      {showUploadModal && (
        <ModalBase onClose={() => setShowUploadModal(false)}>
          <div className="w-[95vw] max-w-4xl rounded-[30px] border border-base-300 bg-base-100 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/60">
                  Archive Upload
                </p>
                <h2 className="mt-2 text-2xl font-bold text-base-content">
                  Upload a File to the Current Folder
                </h2>
                <p className="mt-2 text-sm text-base-content/60">
                  Add PDFs, office documents, images, and scanned legal files
                  directly into{" "}
                  <span className="font-semibold">
                    {currentPath || "Root Directory"}
                  </span>
                  .
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
                      name: previous.name || file?.name || "",
                    }));
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-base-100 shadow-sm">
                      <FiUpload className="h-6 w-6 text-primary" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-base-content">
                        Drag and drop a file here
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
                        accept={acceptedArchiveUploadTypes}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setUploadForm((previous) => ({
                            ...previous,
                            file,
                            name: previous.name || file?.name || "",
                          }));
                        }}
                      />
                    </label>
                    <p className="text-xs font-medium text-base-content/45">
                      {uploadForm.file
                        ? `${uploadForm.file.name} - ${formatArchiveBytes(uploadForm.file.size)}`
                        : "No file selected"}
                    </p>
                  </div>
                </div>

                <label className="form-control">
                  <span className="label-text mb-2 text-sm font-semibold">
                    File Name
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
                    Description
                  </span>
                  <textarea
                    className="textarea textarea-bordered min-h-24"
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
                    Folder Destination
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-base-content">
                    <FiFolder className="h-4 w-4 text-warning" />
                    <span>{currentPath || "Root Directory"}</span>
                  </div>
                  <p className="mt-3 text-xs text-base-content/55">
                    Uploads inherit the current folder thread and remain
                    searchable by name, path, and description.
                  </p>
                </div>

                <div className="rounded-[24px] border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-base-content/70">
                      Upload Progress
                    </span>
                    <span className="font-semibold text-base-content/55">
                      {uploadProgress}%
                    </span>
                  </div>
                  <progress
                    className="progress progress-primary mt-3 w-full"
                    value={uploadProgress}
                    max={100}
                  />
                  <div className="mt-4 space-y-2 text-sm text-base-content/60">
                    <p>Role-based access is enforced server-side.</p>
                    <p>
                      Folder permissions and action visibility follow the active
                      role.
                    </p>
                    <p>Preview and download links are generated securely.</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-base-300 bg-base-100 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-base-content">
                    Supported File Types
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
          <div className="w-[95vw] max-w-2xl rounded-[30px] border border-base-300 bg-base-100 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/60">
                  Folder Creation
                </p>
                <h2 className="mt-2 text-2xl font-bold text-base-content">
                  Create a New Folder
                </h2>
                <p className="mt-2 text-sm text-base-content/60">
                  The folder will be created inside{" "}
                  <span className="font-semibold">
                    {currentPath || "Root Directory"}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowFolderModal(false)}
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="form-control">
                <span className="label-text mb-2 text-sm font-semibold">
                  Folder Name
                </span>
                <input
                  type="text"
                  className="input input-bordered"
                  value={folderForm.name}
                  onChange={(event) =>
                    setFolderForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 text-sm font-semibold">
                  Description
                </span>
                <textarea
                  className="textarea textarea-bordered min-h-24"
                  value={folderForm.description}
                  onChange={(event) =>
                    setFolderForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="rounded-[24px] border border-base-300 bg-base-200/15 p-4 text-sm text-base-content/60">
                Folders support breadcrumb navigation, secure path-based
                organization, and cleaner legal document retrieval across the
                archive explorer.
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowFolderModal(false)}
                  disabled={creatingFolder}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-primary gap-2 ${creatingFolder ? "loading" : ""}`}
                  onClick={() => void handleCreateFolder()}
                  disabled={creatingFolder}
                >
                  <FiFolderPlus className="h-4 w-4" />
                  {creatingFolder ? "Creating..." : "Create Folder"}
                </button>
              </div>
            </div>
          </div>
        </ModalBase>
      )}

      <header className="relative overflow-hidden rounded-[26px] border border-base-300/70 bg-gradient-to-br from-base-100 via-base-100 to-primary/8 p-4 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.55)] sm:rounded-[34px] sm:p-6">
        <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_55%)] lg:block" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            {/* <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-base-content/45">
              <span>Archive & Notarial Workspace</span>
              <span className="opacity-40">•</span>
              <span>Structured file organization</span>
            </div> */}
            <h1 className="mt-3 text-2xl font-black tracking-tight text-base-content sm:text-3xl md:text-5xl">
              Archive Explorer
            </h1>
            {/* <p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/62 md:text-base">
              A clean archive workspace for folders, office files, scanned
              legal documents, and premium dashboard-style retrieval. Move
              quickly between threads, inspect metadata, and keep archive
              storage easy to browse.
            </p> */}
            {/* <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/80 px-3 py-1.5 text-xs font-semibold text-base-content/70">
                <FiShield className="h-3.5 w-3.5 text-primary" />
                Permission-aware explorer
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/80 px-3 py-1.5 text-xs font-semibold text-base-content/70">
                <FiLock className="h-3.5 w-3.5 text-primary" />
                Secure file delivery
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/80 px-3 py-1.5 text-xs font-semibold text-base-content/70">
                <FiHardDrive className="h-3.5 w-3.5 text-primary" />
                {stats.totalItems.toLocaleString()} visible item
                {stats.totalItems !== 1 ? "s" : ""}
              </span>
            </div> */}
          </div>

          {/* <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[29rem]">
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Total Items
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.totalItems.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Visible in the active folder
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Storage Used
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {formatArchiveBytes(stats.storageUsedBytes)}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Files currently indexed
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Folders
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.folders.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                {stats.uploadedFiles.toLocaleString()} uploaded files
              </p>
            </div>
          </div> */}
        </div>
      </header>

      <div className="grid gap-6">
        <aside className="hidden space-y-5">
          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
              Workspace
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() => router.push("/user/cases/archive")}
              >
                <FiFolder className="h-4 w-4" />
                Root Directory
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() =>
                  router.push(
                    buildArchiveHref(
                      currentPath.split("/").slice(0, -1).join("/"),
                    ),
                  )
                }
                disabled={!currentPath}
              >
                <FiChevronRight className="h-4 w-4" />
                Up One Level
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() => setTypeFilter(ArchiveEntryType.FOLDER)}
              >
                <FiFolderPlus className="h-4 w-4 text-warning" />
                Folders Only
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost justify-start"
                onClick={() => setTypeFilter(ArchiveEntryType.FILE)}
              >
                <FiUpload className="h-4 w-4 text-primary" />
                Uploaded Files
              </button>
            </div>
          </div> */}

          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
              Quick Create
            </p>
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
                onClick={() => setShowFolderModal(true)}
              >
                <FiFolderPlus className="h-4 w-4" />
                New Folder
              </button>
              <button
                type="button"
                className="btn btn-outline w-full justify-start gap-2"
                onClick={() =>
                  router.push(
                    `/user/cases/archive/add?template=document&path=${encodeURIComponent(currentPath)}`,
                  )
                }
              >
                <FiFilePlus className="h-4 w-4" />
                New Document
              </button>
              <button
                type="button"
                className="btn btn-outline w-full justify-start gap-2"
                onClick={() =>
                  router.push(
                    `/user/cases/archive/add?template=spreadsheet&path=${encodeURIComponent(currentPath)}`,
                  )
                }
              >
                <FiGrid className="h-4 w-4" />
                New Spreadsheet
              </button>
            </div>
          </div> */}

          {/* <div className="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
              Security
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-base-300 bg-base-200/20 p-3">
                <p className="font-semibold text-base-content">Role-based access</p>
                <p className="mt-1 text-base-content/55">
                  {canManage
                    ? "This account can create folders, upload files, and manage archive entries."
                    : "This account can browse, preview, and download approved archive files."}
                </p>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-200/20 p-3">
                <p className="font-semibold text-base-content">File permissions</p>
                <p className="mt-1 text-base-content/55">
                  Action menus and bulk actions are limited to the current role.
                </p>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-200/20 p-3">
                <p className="font-semibold text-base-content">Secure delivery</p>
                <p className="mt-1 text-base-content/55">
                  Previews and downloads use generated file-access links.
                </p>
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

        <main className="min-w-0 space-y-5">
          <div className="rounded-[24px] border border-base-300 bg-base-100 p-3 shadow-lg sm:rounded-[30px] sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" />
                  <input
                    type="text"
                    placeholder="Search files, folders, client names, case numbers..."
                    className="input input-bordered h-12 w-full rounded-2xl pl-11"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <div
                    className="btn-group col-span-2 w-full sm:col-span-1 sm:mr-2 sm:w-auto"
                    role="tablist"
                    aria-label="Display mode"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={displayMode === "explorer"}
                      className={`btn btn-sm flex-1 sm:flex-none ${
                        displayMode === "explorer" ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() => setDisplayMode("explorer")}
                    >
                      <FiGrid className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Explorer</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={displayMode === "table"}
                      className={`btn btn-sm flex-1 sm:flex-none ${
                        displayMode === "table" ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() => setDisplayMode("table")}
                    >
                      <FiList className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Table</span>
                    </button>
                  </div>
                  <label className="btn btn-sm btn-outline flex min-w-0 items-center justify-center gap-2">
                    <FiUpload className="h-4 w-4" />
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      accept={acceptedArchiveUploadTypes}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        if (f) {
                          setUploadForm((previous) => ({
                            ...previous,
                            file: f,
                            name: previous.name || f.name,
                          }));
                          setShowUploadModal(true);
                        }
                      }}
                    />
                  </label>
                  <label className="btn btn-sm btn-outline flex min-w-0 items-center justify-center gap-2">
                    <FiFolder className="h-4 w-4" />
                    Upload Folder
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      // @ts-expect-error -- non-standard attribute required for folder selection
                      webkitdirectory=""
                   
                      directory=""
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(
                          e.currentTarget.files ?? [],
                        );
                        void handleUploadFolderFiles(
                          files.length > 0 ? files : null,
                        );
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline min-w-0 gap-2"
                    onClick={() => setShowFolderModal(true)}
                  >
                    <FiFolderPlus className="h-4 w-4" />
                    New Folder
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm btn-outline min-w-0 gap-2 ${refreshing ? "loading" : ""}`}
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                  >
                    <FiRefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <div className="dropdown dropdown-end">
                    <button
                      type="button"
                      tabIndex={0}
                      className="btn btn-sm btn-outline min-w-0 gap-2"
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
                          config: {
                            key: "updatedAt",
                            order: "desc",
                          } as SortConfig,
                        },
                        {
                          label: "Oldest first",
                          config: {
                            key: "updatedAt",
                            order: "asc",
                          } as SortConfig,
                        },
                        {
                          label: "Name A-Z",
                          config: { key: "name", order: "asc" } as SortConfig,
                        },
                        {
                          label: "Created date",
                          config: {
                            key: "createdAt",
                            order: "desc",
                          } as SortConfig,
                        },
                        {
                          label: "Type",
                          config: {
                            key: "entryType",
                            order: "asc",
                          } as SortConfig,
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
                    className={`btn btn-sm btn-outline min-w-0 gap-2 ${activeFilterCount > 0 ? "btn-primary" : ""}`}
                    onClick={() => setShowFilterPanel((previous) => !previous)}
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

              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-1 text-sm text-base-content/55">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost shrink-0"
                    onClick={() => navigateArchivePath("")}
                  >
                    Root Directory
                  </button>
                  {breadcrumbSegments.map((segment) => (
                    <React.Fragment key={segment.path}>
                      <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost shrink-0"
                        onClick={() => navigateArchivePath(segment.path)}
                      >
                        {segment.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {/* <button
                    type="button"
                    className="btn btn-sm btn-outline gap-2"
                    onClick={() => navigateArchivePath(parentArchivePath)}
                    disabled={!currentPath}
                    title="Back to parent folder"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                    Back
                  </button> */}

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

                  <span className="max-w-full truncate rounded-full bg-base-200/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/55">
                    {getSortLabel(sortConfig)}
                  </span>
                </div>
              </div>

              {showFilterPanel && (
                <div className="grid gap-3 rounded-[24px] border border-base-300 bg-base-200/12 p-4 md:grid-cols-3">
                  <label className="form-control">
                    <span className="label-text mb-2 text-sm font-semibold">
                      Entry Type
                    </span>
                    <select
                      className="select select-bordered"
                      value={typeFilter}
                      onChange={(event) =>
                        setTypeFilter(event.target.value as EntryTypeFilter)
                      }
                    >
                      <option value="ALL">All Types</option>
                      <option value={ArchiveEntryType.FOLDER}>Folders</option>
                      <option value={ArchiveEntryType.DOCUMENT}>
                        Documents
                      </option>
                      <option value={ArchiveEntryType.SPREADSHEET}>
                        Spreadsheets
                      </option>
                      <option value={ArchiveEntryType.FILE}>Files</option>
                    </select>
                  </label>

                  <div className="rounded-[18px] border border-base-300 bg-base-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                      Current Folder
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold text-base-content">
                      {currentPath || "Root Directory"}
                    </p>
                  </div>

                  <div className="rounded-[18px] border border-base-300 bg-base-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-base-content/38">
                      Search Scope
                    </p>
                    <p className="mt-2 text-sm font-semibold text-base-content">
                      Name, path, and description
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="rounded-[26px] border border-primary/20 bg-primary/8 p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">
                    Bulk Actions
                  </p>
                  <p className="mt-1 text-sm font-semibold text-base-content">
                    {selectedCount} item{selectedCount !== 1 ? "s" : ""}{" "}
                    selected
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
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
                  {canManage && (
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

          {/* <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Total Items
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.totalItems.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Current folder view
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Storage Used
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {formatArchiveBytes(stats.storageUsedBytes)}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Stored file footprint
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Folders
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.folders.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Folder-based organization
              </p>
            </div>
            <div className={statsCardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/40">
                Uploaded Files
              </p>
              <p className="mt-3 text-3xl font-black text-base-content">
                {stats.uploadedFiles.toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-base-content/55">
                Binary attachments indexed
              </p>
            </div>
          </div> */}

          {renderListing()}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/38">
              Showing page {currentPage} of {pageCount} -{" "}
              {totalCount.toLocaleString()} items
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

        {/* Toggle tab - always visible on the right edge */}
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
          className={`fixed right-0 top-0 z-50 h-full w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto border-l border-base-300 bg-base-100 shadow-xl transition-transform duration-300 sm:w-[24rem] ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-4 pb-10 sm:p-5">
            <div className="sticky top-4 rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/38">
                    File Details
                  </p>
                  <h2 className="mt-2 break-words text-lg font-bold text-base-content">
                    {selectedEntry?.name || "No file selected"}
                  </h2>
                </div>
                {detailDescriptor && (
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${detailDescriptor.badgeClassName}`}
                  >
                    {detailDescriptor.label}
                  </span>
                )}
              </div>

              {!selectedEntry ? (
                <div className="mt-6 rounded-[24px] border border-dashed border-base-300 bg-base-200/15 p-5 text-sm text-base-content/55">
                  Select an archive row or card to inspect its metadata, folder
                  thread, and quick actions.
                </div>
              ) : (
                <>
                  <div className="mt-5 space-y-3">
                    {[
                      ["File Name", selectedEntry.name],
                      ["File Type", detailDescriptor?.label || "-"],
                      ["Folder", selectedEntry.parentPath || "Root Directory"],
                      ["Description", selectedEntry.description || "-"],
                      [
                        "Date Created",
                        formatArchiveDateTime(
                          selectedEntry.file?.createdAt ??
                            selectedEntry.createdAt,
                        ),
                      ],
                      [
                        "Last Modified",
                        formatArchiveDateTime(
                          selectedEntry.file?.updatedAt ??
                            selectedEntry.updatedAt ??
                            selectedEntry.createdAt,
                        ),
                      ],
                      [
                        "File Size",
                        formatArchiveBytes(selectedEntry.file?.size),
                      ],
                      ["Full Path", selectedEntry.fullPath],
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
                      {breadcrumbSegments.map((segment) => (
                        <React.Fragment key={segment.path}>
                          <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                          <span>{segment.label}</span>
                        </React.Fragment>
                      ))}
                      {selectedEntry.entryType !== ArchiveEntryType.FOLDER && (
                        <>
                          <FiChevronRight className="h-3.5 w-3.5 text-base-content/30" />
                          <span>{selectedEntry.name}</span>
                        </>
                      )}
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
                      onClick={() =>
                        selectedEntry.entryType === ArchiveEntryType.FOLDER
                          ? handleOpen(selectedEntry)
                          : void handlePreview(selectedEntry)
                      }
                    >
                      {selectedEntry.entryType === ArchiveEntryType.FOLDER
                        ? "Open Folder"
                        : "Preview"}
                    </button>
                    {selectedEntry.file && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm gap-2"
                        onClick={() => void handleDownload(selectedEntry)}
                      >
                        Download
                      </button>
                    )}
                    {selectedEntry.file && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm gap-2"
                        onClick={() => void handlePrint(selectedEntry)}
                      >
                        Print
                      </button>
                    )}
                    {!isGarageArchiveEntry(selectedEntry) && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm gap-2"
                        onClick={() => handleOpen(selectedEntry)}
                      >
                        Open Page
                      </button>
                    )}
                    {canManage && !isGarageArchiveEntry(selectedEntry) && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm gap-2"
                        onClick={() => handleEdit(selectedEntry)}
                      >
                        Edit
                      </button>
                    )}
                    {canManage && !isGarageArchiveEntry(selectedEntry) && (
                      <button
                        type="button"
                        className="btn btn-error btn-sm gap-2"
                        onClick={() => void handleDelete(selectedEntry)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ArchivePage;
