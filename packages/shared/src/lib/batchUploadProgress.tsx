"use client";

import React from "react";

export const MAX_UPLOAD_BATCH_BYTES = 250 * 1024 * 1024;

export type BatchUploadPhase = "processing" | "completed" | "failed";

export type BatchUploadProgressState = {
  phase: BatchUploadPhase;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  currentBatchBytes: number;
  uploadedBatchBytes: number;
  totalBatches: number;
  currentBatch: number;
  currentFileName?: string;
  title?: string;
  error?: string;
};

export const createUploadBatches = <T,>(
  items: T[],
  getSize: (item: T) => number,
  maxBatchBytes = MAX_UPLOAD_BATCH_BYTES,
) => {
  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentBatchBytes = 0;

  for (const item of items) {
    const itemBytes = Math.max(0, getSize(item));
    const wouldExceedBatch =
      currentBatch.length > 0 &&
      currentBatchBytes + itemBytes > maxBatchBytes;

    if (wouldExceedBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }

    currentBatch.push(item);
    currentBatchBytes += itemBytes;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

export const buildFileUploadBatches = (
  files: File[],
  maxBatchBytes = MAX_UPLOAD_BATCH_BYTES,
) => createUploadBatches(files, (file) => file.size, maxBatchBytes);

export const getUploadTotalBytes = (files: File[]) =>
  files.reduce((total, file) => total + file.size, 0);

export const createBatchUploadProgressState = (
  totalFiles: number,
  totalBytes: number,
  totalBatches: number,
  title = "Processing",
  currentBatchBytes = totalBytes,
): BatchUploadProgressState => ({
  phase: "processing",
  totalFiles,
  completedFiles: 0,
  failedFiles: 0,
  totalBytes,
  uploadedBytes: 0,
  currentBatchBytes,
  uploadedBatchBytes: 0,
  totalBatches: Math.max(1, totalBatches),
  currentBatch: totalBatches > 0 ? 1 : 0,
  title,
});

export const getBatchUploadProgressPercent = (
  state: BatchUploadProgressState,
) => {
  if (state.phase === "completed") return 100;
  const denominator = state.currentBatchBytes || state.totalBytes;
  if (denominator <= 0) return 0;
  return Math.min(
    100,
    Math.max(
      0,
      Math.round((state.uploadedBatchBytes / denominator) * 100),
    ),
  );
};

export const formatUploadBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};

type BatchUploadProgressPanelProps = {
  state: BatchUploadProgressState | null;
  className?: string;
  onDismiss?: () => void;
};

const getStatusLabel = (state: BatchUploadProgressState) => {
  if (state.phase === "completed") return "Completed";
  if (state.phase === "failed") return "Failed";
  return "In progress";
};

const getSubcopy = (state: BatchUploadProgressState) => {
  if (state.phase === "completed") {
    return `Uploaded ${state.completedFiles.toLocaleString()} file${
      state.completedFiles !== 1 ? "s" : ""
    }.`;
  }

  if (state.phase === "failed") {
    return state.error || "Some files could not be uploaded.";
  }

  const remaining = Math.max(0, state.totalFiles - state.completedFiles);
  const fileCount =
    state.totalFiles === 1
      ? "1 file"
      : `${state.totalFiles.toLocaleString()} files`;

  if (state.completedFiles === 0) {
    return `Uploading ${fileCount}...`;
  }

  return `Uploading ${state.completedFiles.toLocaleString()} of ${state.totalFiles.toLocaleString()} files... ${remaining.toLocaleString()} remaining`;
};

export function BatchUploadProgressPanel({
  state,
  className = "",
  onDismiss,
}: BatchUploadProgressPanelProps) {
  if (!state) return null;

  const percent = getBatchUploadProgressPercent(state);
  const progressColor =
    state.phase === "failed"
      ? "bg-error"
      : state.phase === "completed"
        ? "bg-success"
        : "bg-primary";

  return (
    <div
      className={`overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-lg ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4 px-4 py-4">
        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
          {state.phase === "processing" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          ) : (
            <span
              className={`h-3 w-3 rounded-full ${
                state.phase === "completed" ? "bg-success" : "bg-error"
              }`}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-bold text-base-content">
              {state.title || "Processing"}
            </p>
            <span
              className={`shrink-0 text-xs font-medium ${
                state.phase === "failed"
                  ? "text-error"
                  : state.phase === "completed"
                    ? "text-success"
                    : "text-base-content/45"
              }`}
            >
              {getStatusLabel(state)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-base-content/55">
            {getSubcopy(state)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/45">
            <span>{percent}% this batch</span>
            {state.totalBatches > 1 && (
              <span>
                Batch {Math.min(state.currentBatch, state.totalBatches)} of{" "}
                {state.totalBatches}
              </span>
            )}
            <span>
              {formatUploadBytes(state.uploadedBatchBytes)} /{" "}
              {formatUploadBytes(state.currentBatchBytes)}
            </span>
            <span>
              Total {formatUploadBytes(state.uploadedBytes)} /{" "}
              {formatUploadBytes(state.totalBytes)}
            </span>
            {state.currentFileName && (
              <span className="max-w-full truncate">
                {state.currentFileName}
              </span>
            )}
          </div>
        </div>

        {onDismiss && state.phase !== "processing" && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
      <div className="h-1.5 bg-base-200">
        <div
          className={`h-full rounded-r-full transition-all duration-300 ease-out ${progressColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
