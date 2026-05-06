"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

const UPLOAD_ENDPOINT = "/api/upload";
const DEFAULT_MAX_CONCURRENT_UPLOADS = 3;
const CHUNK_SIZE = 8 * 1024 * 1024;

export type UploadStatus =
  | "queued"
  | "uploading"
  | "completed"
  | "failed"
  | "canceled";

export interface UploadSource {
  file: File;
  relativePath?: string;
}

export interface UploadedFileResult {
  filename: string;
  path: string;
  relativePath: string;
  size?: number;
  status: "completed" | "chunk-uploaded";
}

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  relativePath: string;
  targetPath: string;
  size: number;
  uploadedBytes: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  serverFile?: UploadedFileResult;
  createdAt: number;
}

interface UploadState {
  items: Record<string, UploadItem>;
  order: string[];
}

type UploadAction =
  | { type: "enqueue"; items: UploadItem[] }
  | { type: "start"; id: string }
  | { type: "progress"; id: string; uploadedBytes: number; progress: number }
  | { type: "complete"; id: string; serverFile: UploadedFileResult }
  | { type: "fail"; id: string; error: string }
  | { type: "cancel"; id: string }
  | { type: "retry"; id: string }
  | { type: "remove"; id: string }
  | { type: "clear-completed" };

const initialState: UploadState = {
  items: {},
  order: [],
};

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const reducer = (state: UploadState, action: UploadAction): UploadState => {
  switch (action.type) {
    case "enqueue": {
      const nextItems = { ...state.items };
      const nextOrder = [...state.order];

      for (const item of action.items) {
        nextItems[item.id] = item;
        nextOrder.unshift(item.id);
      }

      return { items: nextItems, order: nextOrder };
    }

    case "start": {
      const item = state.items[action.id];
      if (!item || item.status === "canceled") {
        return state;
      }

      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...item,
            status: "uploading",
            error: undefined,
          },
        },
      };
    }

    case "progress": {
      const item = state.items[action.id];
      if (!item || item.status === "canceled") {
        return state;
      }

      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...item,
            uploadedBytes: action.uploadedBytes,
            progress: clampProgress(action.progress),
            status: "uploading",
          },
        },
      };
    }

    case "complete": {
      const item = state.items[action.id];
      if (!item) {
        return state;
      }

      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...item,
            uploadedBytes: item.size,
            progress: 100,
            status: "completed",
            error: undefined,
            serverFile: action.serverFile,
          },
        },
      };
    }

    case "fail": {
      const item = state.items[action.id];
      if (!item || item.status === "canceled") {
        return state;
      }

      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...item,
            status: "failed",
            error: action.error,
          },
        },
      };
    }

    case "cancel": {
      const item = state.items[action.id];
      if (!item || item.status === "completed") {
        return state;
      }

      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...item,
            status: "canceled",
            error: "Canceled",
          },
        },
      };
    }

    case "retry": {
      const item = state.items[action.id];
      if (!item || !["failed", "canceled"].includes(item.status)) {
        return state;
      }

      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: {
            ...item,
            uploadedBytes: 0,
            progress: 0,
            status: "queued",
            error: undefined,
            serverFile: undefined,
          },
        },
      };
    }

    case "remove": {
      const nextItems = { ...state.items };
      delete nextItems[action.id];

      return {
        items: nextItems,
        order: state.order.filter((id) => id !== action.id),
      };
    }

    case "clear-completed": {
      const nextItems = { ...state.items };
      const nextOrder = state.order.filter((id) => {
        const keep = nextItems[id]?.status !== "completed";
        if (!keep) {
          delete nextItems[id];
        }

        return keep;
      });

      return { items: nextItems, order: nextOrder };
    }

    default:
      return state;
  }
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeClientPath = (value: string | undefined): string =>
  String(value ?? "")
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/?garage\/?/i, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

const joinPaths = (...parts: Array<string | undefined>): string =>
  parts
    .map(normalizeClientPath)
    .filter(Boolean)
    .join("/");

const getRelativePath = (source: File | UploadSource): string => {
  if ("file" in source) {
    return normalizeClientPath(source.relativePath || getRelativePath(source.file));
  }

  const fileWithDirectoryMetadata = source as File & {
    webkitRelativePath?: string;
  };

  return normalizeClientPath(fileWithDirectoryMetadata.webkitRelativePath || source.name);
};

const toUploadSource = (source: File | UploadSource): UploadSource =>
  "file" in source ? source : { file: source, relativePath: getRelativePath(source) };

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Upload failed.";
};

interface XhrUploadOptions {
  formData: FormData;
  controller: AbortController;
  onProgress: (loaded: number, total: number) => void;
}

const uploadFormData = ({
  formData,
  controller,
  onProgress,
}: XhrUploadOptions): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const rejectAbort = () => {
      const error = new Error("Upload canceled.");
      error.name = "AbortError";
      reject(error);
    };

    const abortXhr = () => xhr.abort();
    controller.signal.addEventListener("abort", abortXhr, { once: true });

    xhr.open("POST", UPLOAD_ENDPOINT);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      controller.signal.removeEventListener("abort", abortXhr);

      let payload: Record<string, unknown> = {};
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      const errorMessage =
        typeof payload.error === "string"
          ? payload.error
          : `Upload failed with status ${xhr.status}.`;
      reject(new Error(errorMessage));
    };
    xhr.onerror = () => {
      controller.signal.removeEventListener("abort", abortXhr);
      reject(new Error("Network error during upload."));
    };
    xhr.onabort = () => {
      controller.signal.removeEventListener("abort", abortXhr);
      rejectAbort();
    };

    xhr.send(formData);
  });

const extractUploadedFile = (payload: Record<string, unknown>): UploadedFileResult => {
  const directFiles = payload.files;
  if (Array.isArray(directFiles) && directFiles[0]) {
    return directFiles[0] as UploadedFileResult;
  }

  if (payload.file && typeof payload.file === "object") {
    return payload.file as UploadedFileResult;
  }

  throw new Error("Upload completed but no file metadata was returned.");
};

export interface UploadManagerOptions {
  maxConcurrentUploads?: number;
}

export const useUploadManager = (options: UploadManagerOptions = {}) => {
  const maxConcurrentUploads =
    options.maxConcurrentUploads ?? DEFAULT_MAX_CONCURRENT_UPLOADS;
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const activeUploadsRef = useRef(0);
  const controllersRef = useRef(new Map<string, AbortController>());
  const processQueueRef = useRef<() => void>(() => undefined);

  const uploadItem = useCallback(async (item: UploadItem) => {
    const controller = new AbortController();
    controllersRef.current.set(item.id, controller);

    const updateProgress = (uploadedBytes: number) => {
      dispatch({
        type: "progress",
        id: item.id,
        uploadedBytes,
        progress: item.size ? (uploadedBytes / item.size) * 100 : 100,
      });
    };

    if (item.size <= CHUNK_SIZE) {
      const formData = new FormData();
      formData.append("files", item.file, item.name);
      formData.append("relativePaths", JSON.stringify([item.targetPath]));

      const payload = await uploadFormData({
        formData,
        controller,
        onProgress: (loaded) => updateProgress(Math.min(loaded, item.size)),
      });

      return extractUploadedFile(payload);
    }

    const totalChunks = Math.ceil(item.size / CHUNK_SIZE);
    const uploadId = `${item.id}-${item.size}`.replace(/[^a-zA-Z0-9_.-]/g, "");
    let completedFile: UploadedFileResult | null = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      if (controller.signal.aborted) {
        const error = new Error("Upload canceled.");
        error.name = "AbortError";
        throw error;
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, item.size);
      const chunk = item.file.slice(start, end);
      const formData = new FormData();
      formData.append("chunk", chunk, `${item.name}.part`);
      formData.append("uploadId", uploadId);
      formData.append("relativePath", item.targetPath);
      formData.append("fileName", item.name);
      formData.append("fileSize", String(item.size));
      formData.append("chunkIndex", String(chunkIndex));
      formData.append("totalChunks", String(totalChunks));

      const payload = await uploadFormData({
        formData,
        controller,
        onProgress: (loaded) => updateProgress(Math.min(start + loaded, item.size)),
      });

      if (payload.file && typeof payload.file === "object") {
        completedFile = payload.file as UploadedFileResult;
      } else {
        updateProgress(end);
      }
    }

    if (!completedFile) {
      throw new Error("Chunked upload did not return a completed file.");
    }

    return completedFile;
  }, []);

  const processQueue = useCallback(() => {
    const availableSlots = maxConcurrentUploads - activeUploadsRef.current;
    if (availableSlots <= 0) {
      return;
    }

    const queuedItems = stateRef.current.order
      .map((id) => stateRef.current.items[id])
      .filter((item): item is UploadItem => item?.status === "queued")
      .slice(0, availableSlots);

    for (const item of queuedItems) {
      activeUploadsRef.current += 1;
      dispatch({ type: "start", id: item.id });

      uploadItem(item)
        .then((serverFile) => {
          dispatch({ type: "complete", id: item.id, serverFile });
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") {
            dispatch({ type: "cancel", id: item.id });
          } else {
            dispatch({ type: "fail", id: item.id, error: getErrorMessage(error) });
          }
        })
        .finally(() => {
          controllersRef.current.delete(item.id);
          activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
          processQueueRef.current();
        });
    }
  }, [maxConcurrentUploads, uploadItem]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  useEffect(() => {
    processQueue();
  }, [processQueue, state.order, state.items]);

  const enqueueFiles = useCallback(
    (sources: Array<File | UploadSource>, targetDirectory = "") => {
      const items = sources.map((source) => {
        const uploadSource = toUploadSource(source);
        const relativePath = getRelativePath(uploadSource);
        const targetPath = joinPaths(targetDirectory, relativePath);

        return {
          id: createId(),
          file: uploadSource.file,
          name: uploadSource.file.name,
          relativePath,
          targetPath,
          size: uploadSource.file.size,
          uploadedBytes: 0,
          progress: 0,
          status: "queued" as const,
          createdAt: Date.now(),
        };
      });

      if (items.length) {
        dispatch({ type: "enqueue", items });
      }

      return items;
    },
    [],
  );

  const cancelUpload = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    dispatch({ type: "cancel", id });
  }, []);

  const retryUpload = useCallback((id: string) => {
    dispatch({ type: "retry", id });
  }, []);

  const removeUpload = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    dispatch({ type: "remove", id });
  }, []);

  const clearCompleted = useCallback(() => {
    dispatch({ type: "clear-completed" });
  }, []);

  const uploads = useMemo(
    () => state.order.map((id) => state.items[id]).filter(Boolean),
    [state],
  );

  const summary = useMemo(() => {
    const totalBytes = uploads.reduce((sum, item) => sum + item.size, 0);
    const uploadedBytes = uploads.reduce((sum, item) => {
      if (item.status === "completed") {
        return sum + item.size;
      }

      return sum + item.uploadedBytes;
    }, 0);

    return {
      total: uploads.length,
      queued: uploads.filter((item) => item.status === "queued").length,
      uploading: uploads.filter((item) => item.status === "uploading").length,
      completed: uploads.filter((item) => item.status === "completed").length,
      failed: uploads.filter((item) => item.status === "failed").length,
      canceled: uploads.filter((item) => item.status === "canceled").length,
      totalBytes,
      uploadedBytes,
      overallProgress: totalBytes ? clampProgress((uploadedBytes / totalBytes) * 100) : 0,
      hasActiveUploads: uploads.some((item) =>
        ["queued", "uploading"].includes(item.status),
      ),
    };
  }, [uploads]);

  return {
    uploads,
    summary,
    enqueueFiles,
    cancelUpload,
    retryUpload,
    removeUpload,
    clearCompleted,
  };
};
