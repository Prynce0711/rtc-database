"use client";

import { ArchiveEntryType } from "../../generated/prisma/enums";
import TipCell from "../../Table/TipCell";
import type { ArchiveEntryData } from "./ArchiveSchema";
import {
  FiDownload,
  FiEdit2,
  FiEye,
  FiFile,
  FiFileText,
  FiFolder,
  FiGrid,
  FiTrash2,
} from "react-icons/fi";

const formatDateTime = (value?: Date | string | null): string => {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getArchiveTypeLabel = (entryType: ArchiveEntryType): string => {
  switch (entryType) {
    case ArchiveEntryType.FOLDER:
      return "Folder";
    case ArchiveEntryType.DOCUMENT:
      return "Document";
    case ArchiveEntryType.SPREADSHEET:
      return "Spreadsheet";
    default:
      return "File";
  }
};

const getArchiveIcon = (entryType: ArchiveEntryType) => {
  switch (entryType) {
    case ArchiveEntryType.FOLDER:
      return <FiFolder className="h-4 w-4 text-warning" />;
    case ArchiveEntryType.DOCUMENT:
      return <FiFileText className="h-4 w-4 text-info" />;
    case ArchiveEntryType.SPREADSHEET:
      return <FiGrid className="h-4 w-4 text-success" />;
    default:
      return <FiFile className="h-4 w-4 text-base-content/70" />;
  }
};

const ArchiveRow = ({
  entry,
  canManage,
  onOpen,
  onEdit,
  onDelete,
  onDownload,
}: {
  entry: ArchiveEntryData;
  canManage: boolean;
  onOpen: (entry: ArchiveEntryData) => void;
  onEdit: (entry: ArchiveEntryData) => void;
  onDelete: (entry: ArchiveEntryData) => void;
  onDownload: (entry: ArchiveEntryData) => void;
}) => {
  const typeLabel = getArchiveTypeLabel(entry.entryType);

  return (
    <tr
      className="border-b border-base-200/60 transition-colors hover:bg-base-200/30 cursor-pointer text-sm"
      onClick={() => onOpen(entry)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-base-200">
            {getArchiveIcon(entry.entryType)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-base-content">
              {entry.name}
            </p>
            <p className="truncate text-xs text-base-content/45">
              {entry.parentPath || "Root"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3 text-center">
        <span
          className={[
            "badge badge-outline font-medium",
            entry.entryType === ArchiveEntryType.FOLDER
              ? "badge-warning"
              : entry.entryType === ArchiveEntryType.DOCUMENT
                ? "badge-info"
                : entry.entryType === ArchiveEntryType.SPREADSHEET
                  ? "badge-success"
                  : "",
          ].join(" ")}
        >
          {typeLabel}
        </span>
      </td>

      <TipCell
        label="Description"
        value={entry.description || "—"}
        truncate
        clickHint={false}
      />
      <TipCell
        label="Size"
        value={formatBytes(entry.file?.size)}
        className="text-base-content/70"
        clickHint={false}
      />
      <TipCell
        label="Updated"
        value={formatDateTime(entry.updatedAt || entry.createdAt)}
        className="text-base-content/70"
        clickHint={false}
      />

      <td
        className="px-4 py-3 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={() => onOpen(entry)}
            title={entry.entryType === ArchiveEntryType.FOLDER ? "Open" : "View"}
          >
            <FiEye size={12} />
            {entry.entryType === ArchiveEntryType.FOLDER ? "Open" : "View"}
          </button>

          {entry.file && (
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => onDownload(entry)}
              title="Download file"
            >
              <FiDownload size={12} />
              Download
            </button>
          )}

          {canManage && (
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => onEdit(entry)}
              title="Edit archive entry"
            >
              <FiEdit2 size={12} />
              Edit
            </button>
          )}

          {canManage && (
            <button
              type="button"
              className="btn btn-xs btn-outline btn-error"
              onClick={() => onDelete(entry)}
              title="Delete archive entry"
            >
              <FiTrash2 size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default ArchiveRow;
