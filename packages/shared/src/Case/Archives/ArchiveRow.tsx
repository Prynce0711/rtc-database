"use client";

import { ArchiveEntryType } from "../../generated/prisma/enums";
import TipCell from "../../Table/TipCell";
import type { ArchiveEntryData } from "./ArchiveSchema";
import {
  FiCopy,
  FiDownload,
  FiEdit2,
  FiEye,
  FiExternalLink,
  FiMoreHorizontal,
  FiPrinter,
  FiTrash2,
} from "react-icons/fi";
import {
  formatArchiveBytes,
  formatArchiveDateTime,
  getArchiveDescriptor,
} from "./archiveExplorerUtils";

const ArchiveRow = ({
  entry,
  canManage,
  isSelected,
  onToggleSelect,
  onSelectEntry,
  onOpen,
  onPreview,
  onEdit,
  onDelete,
  onDownload,
  onPrint,
  onUnsupportedAction,
}: {
  entry: ArchiveEntryData;
  canManage: boolean;
  isSelected: boolean;
  onToggleSelect: (id: number, checked: boolean) => void;
  onSelectEntry: (entry: ArchiveEntryData) => void;
  onOpen: (entry: ArchiveEntryData) => void;
  onPreview: (entry: ArchiveEntryData) => void;
  onEdit: (entry: ArchiveEntryData) => void;
  onDelete: (entry: ArchiveEntryData) => void;
  onDownload: (entry: ArchiveEntryData) => void;
  onPrint: (entry: ArchiveEntryData) => void;
  onUnsupportedAction: (action: string) => void;
}) => {
  const descriptor = getArchiveDescriptor({
    entryType: entry.entryType,
    mimeType: entry.file?.mimeType,
    name: entry.name,
  });
  const uploadedAt = entry.file?.createdAt ?? entry.createdAt;
  const modifiedAt = entry.file?.updatedAt ?? entry.updatedAt ?? entry.createdAt;
  const sizeValue =
    entry.entryType === ArchiveEntryType.FOLDER ? null : entry.file?.size;

  return (
    <tr
      className={`group border-b border-base-200/70 text-sm transition-all duration-200 hover:bg-base-200/25 ${
        isSelected ? "bg-primary/8" : ""
      }`}
      onClick={() => onSelectEntry(entry)}
    >
      <td
        className="px-4 py-4 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={isSelected}
          onChange={(event) => onToggleSelect(entry.id, event.target.checked)}
          aria-label={`Select ${entry.name}`}
        />
      </td>

      <td className="px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${descriptor.iconWrapClassName}`}
          >
            {descriptor.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-base-content">
              {entry.name}
            </p>
            <p className="truncate text-xs text-base-content/50">
              {entry.parentPath || "Root Directory"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 text-center">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${descriptor.badgeClassName}`}
        >
          {descriptor.label}
        </span>
      </td>

      <TipCell
        label="Location"
        value={entry.parentPath || "Root Directory"}
        truncate
        clickHint={false}
      />
      <TipCell
        label="Uploaded"
        value={formatArchiveDateTime(uploadedAt)}
        className="text-base-content/70"
        clickHint={false}
      />
      <TipCell
        label="Modified"
        value={formatArchiveDateTime(modifiedAt)}
        className="text-base-content/70"
        clickHint={false}
      />
      <TipCell
        label="Size"
        value={formatArchiveBytes(sizeValue)}
        className="text-base-content/70"
        clickHint={false}
      />

      <td
        className="px-4 py-4 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn btn-xs btn-outline gap-1.5"
            onClick={() => onSelectEntry(entry)}
            title="Open details panel"
          >
            <FiEye size={12} />
            View
          </button>

          {entry.entryType === ArchiveEntryType.FOLDER ? (
            <button
              type="button"
              className="btn btn-xs btn-primary gap-1.5"
              onClick={() => onOpen(entry)}
              title="Open folder"
            >
              <FiExternalLink size={12} />
              Open
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-xs btn-primary gap-1.5"
              onClick={() => onDownload(entry)}
              title="Download file"
              disabled={!entry.file}
            >
              <FiDownload size={12} />
              Download
            </button>
          )}

          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-xs btn-ghost"
              title="More actions"
            >
              <FiMoreHorizontal size={14} />
            </button>
            <ul
              tabIndex={0}
              className="menu dropdown-content z-[1] mt-2 w-56 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
            >
              <li>
                <button type="button" onClick={() => onSelectEntry(entry)}>
                  <FiEye size={14} />
                  Details
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    entry.entryType === ArchiveEntryType.FOLDER
                      ? onOpen(entry)
                      : onPreview(entry)
                  }
                >
                  <FiExternalLink size={14} />
                  {entry.entryType === ArchiveEntryType.FOLDER
                    ? "Open Folder"
                    : "Preview"}
                </button>
              </li>
              {entry.file && (
                <li>
                  <button type="button" onClick={() => onDownload(entry)}>
                    <FiDownload size={14} />
                    Download
                  </button>
                </li>
              )}
              {entry.file && (
                <li>
                  <button type="button" onClick={() => onPrint(entry)}>
                    <FiPrinter size={14} />
                    Print
                  </button>
                </li>
              )}
              {canManage && (
                <li>
                  <button type="button" onClick={() => onEdit(entry)}>
                    <FiEdit2 size={14} />
                    Rename / Edit
                  </button>
                </li>
              )}
              {canManage && (
                <li>
                  <button
                    type="button"
                    onClick={() => onUnsupportedAction("Move")}
                  >
                    <FiCopy size={14} />
                    Move
                  </button>
                </li>
              )}
              {canManage && (
                <li>
                  <button
                    type="button"
                    onClick={() => onUnsupportedAction("Copy")}
                  >
                    <FiCopy size={14} />
                    Copy
                  </button>
                </li>
              )}
              {canManage && (
                <li>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => onDelete(entry)}
                  >
                    <FiTrash2 size={14} />
                    Delete
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
};

export default ArchiveRow;
