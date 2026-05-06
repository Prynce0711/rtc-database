"use client";

import DashboardLayout from "@/app/components/Dashboard/DashboardLayout";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Grid3X3,
  List,
  Loader2,
  Music,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UploadButtons from "./UploadButtons";
import {
  UploadItem,
  UploadSource,
  UploadStatus,
  useUploadManager,
} from "./useUploadManager";

interface GarageEntry {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "folder";
  size: number;
  modifiedAt: string;
  mimeType?: string;
}

interface GarageListResponse {
  root: string;
  storageRoot: string;
  path: string;
  relativePath: string;
  entries: GarageEntry[];
}

interface GarageDragPayload {
  name: string;
  relativePath: string;
  type: "file" | "folder";
  mimeType?: string;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
}

interface FileSystemDirectoryReaderLike {
  readEntries: (
    success: (entries: FileSystemEntryLike[]) => void,
    failure?: (error: DOMException) => void,
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader: () => FileSystemDirectoryReaderLike;
}

const GARAGE_DRAG_MIME = "application/x-rtc-garage-entry";

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const normalizeClientPath = (value: string | undefined): string =>
  String(value ?? "")
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/?garage\/?/i, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

const joinPaths = (...parts: Array<string | undefined>) =>
  parts
    .map(normalizeClientPath)
    .filter(Boolean)
    .join("/");

const parentPathOf = (relativePath: string) => {
  const segments = normalizeClientPath(relativePath).split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
};

const getDownloadUrl = (relativePath: string, inline = false) =>
  `/api/upload?download=${encodeURIComponent(relativePath)}${inline ? "&inline=1" : ""}`;

const hasExternalFiles = (event: DragEvent<HTMLElement>) =>
  Array.from(event.dataTransfer.types).includes("Files");

const readFileEntry = (entry: FileSystemFileEntryLike): Promise<File> =>
  new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });

const readDirectoryEntries = async (
  reader: FileSystemDirectoryReaderLike,
): Promise<FileSystemEntryLike[]> => {
  const entries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (!batch.length) {
      break;
    }

    entries.push(...batch);
  }

  return entries;
};

const walkEntry = async (
  entry: FileSystemEntryLike,
  prefix = "",
): Promise<UploadSource[]> => {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntryLike);
    return [{ file, relativePath: joinPaths(prefix, file.name) }];
  }

  if (entry.isDirectory) {
    const directory = entry as FileSystemDirectoryEntryLike;
    const children = await readDirectoryEntries(directory.createReader());
    const childFiles = await Promise.all(
      children.map((child) => walkEntry(child, joinPaths(prefix, entry.name))),
    );

    return childFiles.flat();
  }

  return [];
};

const extractDroppedFiles = async (
  dataTransfer: DataTransfer,
): Promise<UploadSource[]> => {
  const itemEntries = Array.from(dataTransfer.items).reduce<FileSystemEntryLike[]>(
    (entries, item) => {
      const itemWithEntry = item as DataTransferItem & {
        webkitGetAsEntry?: () => unknown;
      };
      const entry = itemWithEntry.webkitGetAsEntry?.() as
        | FileSystemEntryLike
        | null
        | undefined;

      if (entry) {
        entries.push(entry);
      }

      return entries;
    },
    [],
  );

  if (itemEntries.length) {
    const files = await Promise.all(itemEntries.map((entry) => walkEntry(entry)));
    return files.flat();
  }

  return Array.from(dataTransfer.files).map((file) => {
    const fileWithDirectoryMetadata = file as File & { webkitRelativePath?: string };
    return {
      file,
      relativePath: fileWithDirectoryMetadata.webkitRelativePath || file.name,
    };
  });
};

const getDragPayload = (event: DragEvent<HTMLElement>): GarageDragPayload | null => {
  const rawPayload = event.dataTransfer.getData(GARAGE_DRAG_MIME);
  if (!rawPayload) {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as GarageDragPayload;
  } catch {
    return null;
  }
};

const getEntryIcon = (entry: GarageEntry, className = "h-5 w-5") => {
  if (entry.type === "folder") {
    return <Folder className={className} aria-hidden="true" />;
  }

  if (entry.mimeType?.startsWith("image/")) {
    return <FileImage className={className} aria-hidden="true" />;
  }

  if (entry.mimeType?.startsWith("video/")) {
    return <FileVideo className={className} aria-hidden="true" />;
  }

  if (entry.mimeType?.startsWith("audio/")) {
    return <Music className={className} aria-hidden="true" />;
  }

  if (
    entry.mimeType?.includes("spreadsheet") ||
    entry.name.match(/\.(csv|xls|xlsx)$/i)
  ) {
    return <FileSpreadsheet className={className} aria-hidden="true" />;
  }

  if (entry.name.match(/\.(zip|rar|7z|tar|gz)$/i)) {
    return <Archive className={className} aria-hidden="true" />;
  }

  if (entry.mimeType?.startsWith("text/") || entry.name.match(/\.(docx?|pdf|txt)$/i)) {
    return <FileText className={className} aria-hidden="true" />;
  }

  return <File className={className} aria-hidden="true" />;
};

const StatusIcon = ({ status }: { status: UploadStatus }) => {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />;
  }

  if (status === "failed") {
    return <AlertCircle className="h-4 w-4 text-error" aria-hidden="true" />;
  }

  if (status === "canceled") {
    return <X className="h-4 w-4 text-base-content/45" aria-hidden="true" />;
  }

  if (status === "uploading") {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />;
  }

  return <Loader2 className="h-4 w-4 text-base-content/35" aria-hidden="true" />;
};

const statusLabel: Record<UploadStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
};

const UploadProgressRow = ({
  item,
  onCancel,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) => {
  const canCancel = item.status === "queued" || item.status === "uploading";
  const canRetry = item.status === "failed" || item.status === "canceled";

  return (
    <div className="rounded-lg border border-base-300/70 bg-base-100 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusIcon status={item.status} />
            <p className="truncate text-sm font-semibold text-base-content">
              {item.relativePath}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/55">
            <span>{statusLabel[item.status]}</span>
            <span>{formatBytes(item.uploadedBytes)} / {formatBytes(item.size)}</span>
            {item.error ? <span className="text-error">{item.error}</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canCancel ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-8 h-8 rounded-md"
              aria-label={`Cancel ${item.name}`}
              onClick={() => onCancel(item.id)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
          {canRetry ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-8 h-8 rounded-md"
              aria-label={`Retry ${item.name}`}
              onClick={() => onRetry(item.id)}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          ) : null}
          {!canCancel ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-8 h-8 rounded-md"
              aria-label={`Remove ${item.name} from upload list`}
              onClick={() => onRemove(item.id)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-base-300">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            item.status === "failed"
              ? "bg-error"
              : item.status === "completed"
                ? "bg-success"
                : "bg-primary"
          }`}
          style={{ width: `${item.progress}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] font-semibold text-base-content/55">
        {Math.round(item.progress)}%
      </div>
    </div>
  );
};

const FileManager = () => {
  const {
    uploads,
    summary,
    enqueueFiles,
    cancelUpload,
    retryUpload,
    removeUpload,
    clearCompleted,
  } = useUploadManager();
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<GarageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropActive, setIsDropActive] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "modified" | "size" | "type">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const dragDepthRef = useRef(0);

  const loadEntries = useCallback(async (pathToLoad = currentPath) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/upload?path=${encodeURIComponent(pathToLoad)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Unable to load files.");
      }

      const payload = (await response.json()) as GarageListResponse;
      setEntries(payload.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load files.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    void loadEntries(currentPath);
  }, [currentPath, loadEntries]);

  useEffect(() => {
    if (!uploads.some((item) => item.status === "completed")) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadEntries(currentPath);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [currentPath, loadEntries, uploads]);

  const handleUpload = useCallback(
    (files: File[] | UploadSource[], targetPath = currentPath) => {
      enqueueFiles(files, targetPath);
    },
    [currentPath, enqueueFiles],
  );

  const moveEntry = useCallback(
    async (sourcePath: string, destinationDirectory: string) => {
      const source = normalizeClientPath(sourcePath);
      const destination = normalizeClientPath(destinationDirectory);

      if (!source || parentPathOf(source) === destination) {
        return;
      }

      setMovingPath(source);
      setMoveError(null);

      try {
        const response = await fetch("/api/upload", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourcePath: source,
            destinationDirectory: destination,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Move failed.");
        }

        await loadEntries(currentPath);
      } catch (moveFailure) {
        setMoveError(
          moveFailure instanceof Error ? moveFailure.message : "Move failed.",
        );
      } finally {
        setMovingPath(null);
      }
    },
    [currentPath, loadEntries],
  );

  const handleRootDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasExternalFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDropActive(true);
  }, []);

  const handleRootDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (hasExternalFiles(event) || Array.from(event.dataTransfer.types).includes(GARAGE_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = hasExternalFiles(event) ? "copy" : "move";
    }
  }, []);

  const handleRootDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasExternalFiles(event)) {
      return;
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDropActive(false);
    }
  }, []);

  const handleRootDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDropActive(false);
      setDropTarget(null);

      const garagePayload = getDragPayload(event);
      if (garagePayload) {
        await moveEntry(garagePayload.relativePath, currentPath);
        return;
      }

      const droppedFiles = await extractDroppedFiles(event.dataTransfer);
      handleUpload(droppedFiles, currentPath);
    },
    [currentPath, handleUpload, moveEntry],
  );

  const handleEntryDragStart = useCallback(
    (event: DragEvent<HTMLElement>, entry: GarageEntry) => {
      const payload: GarageDragPayload = {
        name: entry.name,
        relativePath: entry.relativePath,
        type: entry.type,
        mimeType: entry.mimeType,
      };

      event.dataTransfer.effectAllowed = entry.type === "file" ? "copyMove" : "move";
      event.dataTransfer.setData(GARAGE_DRAG_MIME, JSON.stringify(payload));
      event.dataTransfer.setData("text/plain", entry.name);

      if (entry.type === "file") {
        const absoluteDownloadUrl = new URL(
          getDownloadUrl(entry.relativePath),
          window.location.origin,
        ).toString();
        event.dataTransfer.setData("text/uri-list", absoluteDownloadUrl);
        event.dataTransfer.setData(
          "DownloadURL",
          `${entry.mimeType || "application/octet-stream"}:${entry.name}:${absoluteDownloadUrl}`,
        );
      }
    },
    [],
  );

  const handleFolderDrop = useCallback(
    async (event: DragEvent<HTMLElement>, folder: GarageEntry) => {
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(null);
      setIsDropActive(false);
      dragDepthRef.current = 0;

      const garagePayload = getDragPayload(event);
      if (garagePayload) {
        if (garagePayload.relativePath !== folder.relativePath) {
          await moveEntry(garagePayload.relativePath, folder.relativePath);
        }
        return;
      }

      const droppedFiles = await extractDroppedFiles(event.dataTransfer);
      handleUpload(droppedFiles, folder.relativePath);
    },
    [handleUpload, moveEntry],
  );

  const sortedEntries = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const filtered = search
      ? entries.filter((entry) => entry.name.toLowerCase().includes(search))
      : entries;

    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      if (sortBy === "size") {
        return b.size - a.size;
      }

      if (sortBy === "modified") {
        return (
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
        );
      }

      if (sortBy === "type") {
        return (a.mimeType || a.type).localeCompare(b.mimeType || b.type);
      }

      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [entries, searchTerm, sortBy]);

  const breadcrumbs = useMemo(() => {
    const segments = currentPath.split("/").filter(Boolean);

    return [
      { label: "Garage", path: "" },
      ...segments.map((segment, index) => ({
        label: segment,
        path: segments.slice(0, index + 1).join("/"),
      })),
    ];
  }, [currentPath]);

  const renderEntryPreview = (entry: GarageEntry) => {
    if (entry.type === "file" && entry.mimeType?.startsWith("image/")) {
      return (
        <Image
          src={getDownloadUrl(entry.relativePath, true)}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-md border border-base-300 object-cover"
          unoptimized
        />
      );
    }

    return (
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-lg ${
          entry.type === "folder"
            ? "bg-warning/15 text-warning"
            : "bg-primary/10 text-primary"
        }`}
      >
        {getEntryIcon(entry, "h-6 w-6")}
      </div>
    );
  };

  const renderEntryGrid = (entry: GarageEntry) => {
    const isFolderTarget = dropTarget === entry.relativePath;
    const isMoving = movingPath === entry.relativePath;

    return (
      <article
        key={entry.relativePath}
        draggable
        onDragStart={(event) => handleEntryDragStart(event, entry)}
        onDragOver={(event) => {
          if (entry.type !== "folder") {
            return;
          }

          if (
            hasExternalFiles(event) ||
            Array.from(event.dataTransfer.types).includes(GARAGE_DRAG_MIME)
          ) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = hasExternalFiles(event) ? "copy" : "move";
            setDropTarget(entry.relativePath);
          }
        }}
        onDragLeave={() => {
          if (dropTarget === entry.relativePath) {
            setDropTarget(null);
          }
        }}
        onDrop={(event) => {
          if (entry.type === "folder") {
            void handleFolderDrop(event, entry);
          }
        }}
        onDoubleClick={() => {
          if (entry.type === "folder") {
            setCurrentPath(entry.relativePath);
          } else {
            window.location.href = getDownloadUrl(entry.relativePath);
          }
        }}
        className={`group rounded-lg border bg-base-100 p-4 shadow-sm transition-all duration-150 ${
          isFolderTarget
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-base-300/80 hover:border-primary/40 hover:shadow-md"
        } ${isMoving ? "opacity-50" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          {renderEntryPreview(entry)}
          {entry.type === "file" ? (
            <a
              href={getDownloadUrl(entry.relativePath)}
              className="btn btn-ghost btn-xs min-h-8 h-8 rounded-md opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Download ${entry.name}`}
              draggable={false}
            >
              <Download size={15} aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <button
          type="button"
          className="mt-3 w-full text-left"
          onClick={() => {
            if (entry.type === "folder") {
              setCurrentPath(entry.relativePath);
            }
          }}
        >
          <p className="truncate text-sm font-semibold text-base-content">
            {entry.name}
          </p>
          <p className="mt-1 truncate text-xs text-base-content/55">
            {entry.type === "folder" ? "Folder" : formatBytes(entry.size)}
          </p>
          <p className="mt-1 truncate text-[11px] text-base-content/40">
            {formatDate(entry.modifiedAt)}
          </p>
        </button>
      </article>
    );
  };

  const renderEntryList = (entry: GarageEntry) => {
    const isFolderTarget = dropTarget === entry.relativePath;
    const isMoving = movingPath === entry.relativePath;

    return (
      <div
        key={entry.relativePath}
        draggable
        onDragStart={(event) => handleEntryDragStart(event, entry)}
        onDragOver={(event) => {
          if (entry.type !== "folder") {
            return;
          }

          if (
            hasExternalFiles(event) ||
            Array.from(event.dataTransfer.types).includes(GARAGE_DRAG_MIME)
          ) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = hasExternalFiles(event) ? "copy" : "move";
            setDropTarget(entry.relativePath);
          }
        }}
        onDrop={(event) => {
          if (entry.type === "folder") {
            void handleFolderDrop(event, entry);
          }
        }}
        onDoubleClick={() => {
          if (entry.type === "folder") {
            setCurrentPath(entry.relativePath);
          } else {
            window.location.href = getDownloadUrl(entry.relativePath);
          }
        }}
        className={`grid min-h-16 grid-cols-[minmax(0,1fr)_120px_190px_52px] items-center gap-4 border-b border-base-300/70 px-4 py-3 transition-colors last:border-b-0 max-lg:grid-cols-[minmax(0,1fr)_90px_44px] ${
          isFolderTarget
            ? "bg-primary/10"
            : "bg-base-100 hover:bg-base-200/60"
        } ${isMoving ? "opacity-50" : ""}`}
      >
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 text-left"
          onClick={() => {
            if (entry.type === "folder") {
              setCurrentPath(entry.relativePath);
            }
          }}
        >
          {renderEntryPreview(entry)}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-base-content">
              {entry.name}
            </p>
            <p className="truncate text-xs text-base-content/50">{entry.path}</p>
          </div>
        </button>
        <p className="text-sm text-base-content/60">
          {entry.type === "folder" ? "Folder" : formatBytes(entry.size)}
        </p>
        <p className="text-sm text-base-content/60 max-lg:hidden">
          {formatDate(entry.modifiedAt)}
        </p>
        <div className="flex justify-end">
          {entry.type === "file" ? (
            <a
              href={getDownloadUrl(entry.relativePath)}
              className="btn btn-ghost btn-xs min-h-8 h-8 rounded-md"
              aria-label={`Download ${entry.name}`}
              draggable={false}
            >
              <Download size={15} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      title="File Manager"
      subtitle="Manage files stored in the local garage bucket."
    >
      <div
        className={`relative space-y-5 rounded-xl border border-base-300/70 bg-base-200/35 p-4 transition-colors ${
          isDropActive ? "border-primary bg-primary/5 ring-2 ring-primary/20" : ""
        }`}
        onDragEnter={handleRootDragEnter}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={(event) => void handleRootDrop(event)}
      >
        {isDropActive ? (
          <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-base-100/85 text-lg font-bold text-primary shadow-lg backdrop-blur-sm">
            Drop to upload
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path || "root"} className="flex items-center gap-1">
                {index > 0 ? (
                  <span className="text-base-content/30">/</span>
                ) : null}
                <button
                  type="button"
                  className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                    crumb.path === currentPath
                      ? "bg-base-300 text-base-content"
                      : "text-base-content/60 hover:bg-base-300/70 hover:text-base-content"
                  }`}
                  onClick={() => setCurrentPath(crumb.path)}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </nav>

          <UploadButtons onUpload={(files) => handleUpload(files)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300/70 bg-base-100 p-3">
          <label className="input input-bordered flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg bg-base-100">
            <Search size={16} className="text-base-content/40" aria-hidden="true" />
            <input
              type="search"
              className="grow"
              placeholder="Search files"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            <select
              className="select select-bordered h-10 min-h-10 rounded-lg text-sm"
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "name" | "modified" | "size" | "type")
              }
              aria-label="Sort files"
            >
              <option value="name">Name</option>
              <option value="modified">Modified</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            <div className="join">
              <button
                type="button"
                className={`btn join-item min-h-10 h-10 rounded-l-lg ${viewMode === "grid" ? "btn-primary" : "btn-outline"}`}
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`btn join-item min-h-10 h-10 rounded-r-lg ${viewMode === "list" ? "btn-primary" : "btn-outline"}`}
                aria-label="List view"
                onClick={() => setViewMode("list")}
              >
                <List size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline min-h-10 h-10 rounded-lg"
              aria-label="Refresh files"
              onClick={() => void loadEntries(currentPath)}
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {moveError ? (
          <div className="alert alert-error rounded-lg py-3 text-sm">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{moveError}</span>
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-error rounded-lg py-3 text-sm">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-base-300/70 bg-base-100 shadow-sm">
          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : sortedEntries.length ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-4">
                {sortedEntries.map(renderEntryGrid)}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_120px_190px_52px] gap-4 border-b border-base-300/70 bg-base-200/65 px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/45 max-lg:grid-cols-[minmax(0,1fr)_90px_44px]">
                  <span>Name</span>
                  <span>Size</span>
                  <span className="max-lg:hidden">Modified</span>
                  <span />
                </div>
                {sortedEntries.map(renderEntryList)}
              </div>
            )
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-base-200 text-base-content/35">
                <Folder className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-base-content">No files here</p>
                <p className="mt-1 text-sm text-base-content/50">
                  Upload files or folders into this location.
                </p>
              </div>
            </div>
          )}
        </div>

        {uploads.length ? (
          <aside className="rounded-lg border border-base-300/70 bg-base-100 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-base-content">
                  Uploads
                </h3>
                <p className="mt-1 text-sm text-base-content/55">
                  {summary.completed} of {summary.total} complete
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-lg"
                onClick={clearCompleted}
                disabled={!summary.completed}
              >
                Clear Completed
              </button>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-base-content/55">
                <span>Overall progress</span>
                <span>{Math.round(summary.overallProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-base-300">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${summary.overallProgress}%` }}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {uploads.map((item) => (
                <UploadProgressRow
                  key={item.id}
                  item={item}
                  onCancel={cancelUpload}
                  onRetry={retryUpload}
                  onRemove={removeUpload}
                />
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default FileManager;
