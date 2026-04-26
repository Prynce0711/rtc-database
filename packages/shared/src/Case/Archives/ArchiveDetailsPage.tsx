"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFile,
  FiFileText,
  FiFolder,
  FiGrid,
  FiImage,
} from "react-icons/fi";
import { ArchiveEntryType } from "../../generated/prisma/enums";
import {
  useAdaptiveNavigation,
  useAdaptivePathname,
} from "../../lib/nextCompat";
import { usePopup } from "../../Popup/PopupProvider";
import {
  DetailField,
  DetailSection,
  formatLongDate,
} from "../CaseDetailsShared";
import type { ArchiveAdapter } from "./ArchiveAdapter";
import { normalizeArchivePath, type ArchiveEntryData } from "./ArchiveSchema";

const getArchiveIdFromPathname = (pathname: string): number | null => {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const parsed = Number(lastSegment);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getFilePreviewType = (
  entry?: ArchiveEntryData | null,
): "image" | "pdf" | null => {
  if (!entry?.file) return null;

  const mimeType = (entry.file.mimeType || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return null;
};

const ArchiveDetailsPage = ({ adapter }: { adapter: ArchiveAdapter }) => {
  const router = useAdaptiveNavigation();
  const pathname = useAdaptivePathname();
  const statusPopup = usePopup();
  const entryId = useMemo(() => getArchiveIdFromPathname(pathname), [pathname]);

  const [entry, setEntry] = useState<ArchiveEntryData | null>(null);
  const [folderChildren, setFolderChildren] = useState<ArchiveEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const loadEntry = async () => {
      if (!entryId) {
        setError("Invalid archive entry id");
        setLoading(false);
        return;
      }

      try {
        const result = await adapter.getArchiveEntryById(entryId);
        if (!result.success) {
          setError(result.error || "Failed to load archive entry");
          return;
        }

        setEntry(result.result);
        setError(null);

        if (result.result.entryType === ArchiveEntryType.FOLDER) {
          const childrenResult = await adapter.getArchiveEntriesPage({
            page: 1,
            pageSize: 12,
            filters: {
              parentPath: result.result.fullPath,
            },
            sortKey: "name",
            sortOrder: "asc",
          });

          if (childrenResult.success) {
            setFolderChildren(childrenResult.result.items);
          }
        } else {
          setFolderChildren([]);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load archive entry",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadEntry();
  }, [adapter, entryId]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!entry || !entry.file) {
        setPreviewUrl("");
        return;
      }

      const previewType = getFilePreviewType(entry);
      if (!previewType) {
        setPreviewUrl("");
        return;
      }

      setPreviewLoading(true);
      const result = await adapter.getArchiveFileUrl(entry.id, {
        inline: true,
        fileName: entry.name,
        contentType: entry.file.mimeType,
      });
      setPreviewLoading(false);

      if (!result.success) {
        setPreviewUrl("");
        return;
      }

      setPreviewUrl(result.result);
    };

    void loadPreview();
  }, [adapter, entry]);

  const handleDownload = async () => {
    if (!entry?.file) return;

    const result = await adapter.getArchiveFileUrl(entry.id, {
      inline: false,
      fileName: entry.name,
      contentType: entry.file.mimeType,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-md text-primary/40" />
          <p className="text-[12px] font-bold uppercase tracking-widest text-base-content/25 select-none">
            Loading archive entry…
          </p>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            {error || "Archive entry not found"}
          </p>
          <button
            onClick={() => router.push("/user/cases/archive")}
            className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity underline underline-offset-4"
          >
            Back to archive explorer
          </button>
        </div>
      </div>
    );
  }

  const previewType = getFilePreviewType(entry);
  const breadcrumbSegments = normalizeArchivePath(entry.fullPath)
    .split("/")
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push(buildExplorerHref(entry.parentPath))}
            className="flex items-center gap-2 text-[13px] font-semibold text-base-content/40 hover:text-base-content transition-colors duration-150 shrink-0"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9.5 2.5L4.5 7.5L9.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>

          <div className="hidden sm:flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none overflow-hidden">
            <span>Archive</span>
            {breadcrumbSegments.map((segment, index) => (
              <React.Fragment key={`${segment}-${index}`}>
                <span>/</span>
                <span className="truncate max-w-32">{segment}</span>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                router.push(`/user/cases/archive/edit?id=${entry.id}`)
              }
            >
              <FiEdit2 size={14} />
              Edit
            </button>
            {entry.file && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => void handleDownload()}
              >
                <FiDownload size={14} />
                Download
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 sm:px-8 py-12 space-y-10">
        <div className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Archive Record
          </p>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-base-200">
                  {entry.entryType === ArchiveEntryType.FOLDER ? (
                    <FiFolder className="h-6 w-6 text-warning" />
                  ) : entry.entryType === ArchiveEntryType.DOCUMENT ? (
                    <FiFileText className="h-6 w-6 text-info" />
                  ) : entry.entryType === ArchiveEntryType.SPREADSHEET ? (
                    <FiGrid className="h-6 w-6 text-success" />
                  ) : previewType === "image" ? (
                    <FiImage className="h-6 w-6 text-info" />
                  ) : (
                    <FiFile className="h-6 w-6 text-base-content/70" />
                  )}
                </span>
                <div>
                  <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight break-words">
                    {entry.name}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="badge badge-outline">
                      {entry.entryType}
                    </span>
                    {entry.file?.mimeType && (
                      <span className="badge badge-ghost">
                        {entry.file.mimeType}
                      </span>
                    )}
                    <span className="badge badge-ghost">
                      Updated{" "}
                      {formatLongDate(entry.updatedAt || entry.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              {entry.description && (
                <p className="text-base text-base-content/65 max-w-3xl">
                  {entry.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-outline gap-2"
                onClick={() => router.push(buildExplorerHref(entry.parentPath))}
              >
                <FiExternalLink size={15} />
                Open Folder
              </button>
            </div>
          </div>
        </div>

        <div className="h-px bg-base-200" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="space-y-8">
            {entry.entryType === ArchiveEntryType.DOCUMENT && (
              <DetailSection label="Document Preview">
                <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl overflow-hidden">
                  <div className="border-b border-base-200 px-5 py-4 text-sm font-semibold text-base-content/60">
                    Editable text document
                  </div>
                  <div className="max-h-[70vh] overflow-auto px-5 py-5">
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-base-content font-sans">
                      {entry.textContent ||
                        "This document does not have text content yet."}
                    </pre>
                  </div>
                </div>
              </DetailSection>
            )}

            {entry.entryType === ArchiveEntryType.SPREADSHEET && (
              <DetailSection label="Spreadsheet Preview">
                <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl overflow-hidden">
                  <div className="border-b border-base-200 px-5 py-4 text-sm font-semibold text-base-content/60">
                    Inline spreadsheet preview
                  </div>
                  <div className="overflow-auto max-h-[70vh]">
                    <table className="table table-pin-rows table-sm">
                      <thead>
                        <tr>
                          <th className="bg-base-200">#</th>
                          {((entry.sheetData as string[][])?.[0] ?? []).map(
                            (_cell, columnIndex) => (
                              <th key={columnIndex} className="bg-base-200">
                                {String.fromCharCode(65 + columnIndex)}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {((entry.sheetData as string[][]) ?? []).map(
                          (row, rowIndex) => (
                            <tr key={rowIndex}>
                              <td className="font-semibold text-base-content/50">
                                {rowIndex + 1}
                              </td>
                              {row.map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}`}>
                                  {cell || " "}
                                </td>
                              ))}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </DetailSection>
            )}

            {entry.entryType === ArchiveEntryType.FILE && (
              <DetailSection label="File Preview">
                <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl overflow-hidden">
                  {previewLoading ? (
                    <div className="flex h-96 items-center justify-center">
                      <span className="loading loading-spinner loading-lg text-primary/60" />
                    </div>
                  ) : previewType === "image" && previewUrl ? (
                    <div className="bg-base-200/30 p-4 flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt={entry.name}
                        className="max-h-[70vh] rounded-2xl object-contain"
                      />
                    </div>
                  ) : previewType === "pdf" && previewUrl ? (
                    <iframe
                      src={previewUrl}
                      title={entry.name}
                      className="h-[70vh] w-full"
                    />
                  ) : (
                    <div className="p-8 text-center text-base-content/55">
                      Inline preview is not available for this file type. Use
                      download to open it in its native app.
                    </div>
                  )}
                </div>
              </DetailSection>
            )}

            {entry.entryType === ArchiveEntryType.FOLDER && (
              <DetailSection label="Folder Contents">
                <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl overflow-hidden">
                  <div className="border-b border-base-200 px-5 py-4 text-sm font-semibold text-base-content/60">
                    Immediate items in this folder
                  </div>
                  <div className="divide-y divide-base-200">
                    {folderChildren.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-base-content/55">
                        This folder is currently empty.
                      </div>
                    ) : (
                      folderChildren.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-base-200/40 transition-colors"
                          onClick={() =>
                            router.push(
                              child.entryType === ArchiveEntryType.FOLDER
                                ? buildExplorerHref(child.fullPath)
                                : `/user/cases/archive/${child.id}`,
                            )
                          }
                        >
                          <span className="font-medium text-base-content">
                            {child.name}
                          </span>
                          <span className="text-xs uppercase tracking-[0.14em] text-base-content/45">
                            {child.entryType}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </DetailSection>
            )}
          </div>

          <div className="space-y-8">
            <DetailSection label="Metadata">
              <div className="grid grid-cols-1 gap-5">
                <DetailField label="Full Path" value={entry.fullPath} mono />
                <DetailField
                  label="Parent Folder"
                  value={entry.parentPath || "Root"}
                  mono
                />
                <DetailField label="Type" value={entry.entryType} />
                <DetailField
                  label="File Size"
                  value={formatBytes(entry.file?.size)}
                />
                <DetailField
                  label="Created"
                  value={formatLongDate(entry.createdAt)}
                />
                <DetailField
                  label="Updated"
                  value={formatLongDate(entry.updatedAt || entry.createdAt)}
                />
              </div>
            </DetailSection>
          </div>
        </div>
      </main>
    </div>
  );
};

const buildExplorerHref = (path: string): string => {
  const normalized = normalizeArchivePath(path);
  return normalized
    ? `/user/cases/archive?path=${encodeURIComponent(normalized)}`
    : "/user/cases/archive";
};

export default ArchiveDetailsPage;
