"use client";

import { TipCell } from "@rtc-database/shared";
import {
  FiCopy,
  FiDownload,
  FiEdit2,
  FiEye,
  FiExternalLink,
  FiFolder,
  FiMoreHorizontal,
  FiPrinter,
  FiTrash2,
} from "react-icons/fi";
import {
  formatExplorerBytes,
  formatExplorerDateTime,
  getExplorerDescriptor,
} from "./notarialExplorerUtils";

export type NotarialRecord = {
  id: number;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt?: string;
  updatedAt?: string;
  fileCreatedAt?: string;
  fileUpdatedAt?: string;
  filePath?: string;
  isDirectory?: boolean;
  source?: "notarial" | "archive" | "garage";
};

const NotarialRow = ({
  record,
  canManage,
  canPreview,
  isSelected,
  onToggleSelect,
  onSelectRecord,
  onPreviewFile,
  onDownloadFile,
  onOpenRecord,
  onEditRecord,
  onDeleteRecord,
  onPrintRecord,
  onUnsupportedAction,
}: {
  record: NotarialRecord;
  canManage: boolean;
  canPreview: boolean;
  isSelected: boolean;
  onToggleSelect: (id: number, checked: boolean) => void;
  onSelectRecord: (record: NotarialRecord) => void;
  onPreviewFile: (record: NotarialRecord) => void;
  onDownloadFile: (record: NotarialRecord) => void;
  onOpenRecord: (record: NotarialRecord) => void;
  onEditRecord: (record: NotarialRecord) => void;
  onDeleteRecord: (record: NotarialRecord) => void;
  onPrintRecord: (record: NotarialRecord) => void;
  onUnsupportedAction: (action: string) => void;
}) => {
  const isDirectory = record.isDirectory === true;
  const descriptor = getExplorerDescriptor({
    fileName: record.fileName ?? record.title,
    mimeType: record.mimeType,
    isFolder: isDirectory,
  });

  return (
    <tr
      className={`group border-b border-base-200/70 text-sm transition-all duration-200 hover:bg-base-200/25 ${
        isSelected ? "bg-primary/8" : ""
      }`}
      onClick={() => onSelectRecord(record)}
      onDoubleClick={() => {
        if (isDirectory) {
          onOpenRecord(record);
        }
      }}
    >
      <td
        className="px-4 py-4 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={isSelected}
          onChange={(event) => onToggleSelect(record.id, event.target.checked)}
          aria-label={`Select ${record.fileName || record.title || `record ${record.id}`}`}
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
              {record.fileName || record.title || `Record #${record.id}`}
            </p>
            <p className="truncate text-xs text-base-content/50">
              {record.title || "Untitled notarial file"}
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
        label="Client / Signatory"
        value={record.name || "—"}
        truncate
        clickHint={false}
      />
      <TipCell label="Attorney" value={record.atty || "—"} truncate clickHint={false} />
      <TipCell
        label="Uploaded"
        value={formatExplorerDateTime(record.fileCreatedAt || record.createdAt)}
        className="text-base-content/70"
        clickHint={false}
      />
      <TipCell
        label="Modified"
        value={formatExplorerDateTime(record.fileUpdatedAt || record.updatedAt)}
        className="text-base-content/70"
        clickHint={false}
      />
      <TipCell
        label="Size"
        value={formatExplorerBytes(record.fileSize)}
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
            onClick={() => onSelectRecord(record)}
            title="Open details panel"
          >
            <FiEye size={12} />
            View
          </button>

          {isDirectory ? (
            <button
              type="button"
              className="btn btn-xs btn-primary gap-1.5"
              onClick={() => onOpenRecord(record)}
              title="Open folder"
            >
              <FiFolder size={12} />
              Open
            </button>
          ) : record.link ? (
            <button
              type="button"
              className="btn btn-xs btn-primary gap-1.5"
              onClick={() => onDownloadFile(record)}
              title="Download file"
            >
              <FiDownload size={12} />
              Download
            </button>
          ) : null}

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
              className="menu dropdown-content z-1 mt-2 w-56 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
            >
              <li>
                <button type="button" onClick={() => onSelectRecord(record)}>
                  <FiEye size={14} />
                  Details
                </button>
              </li>
              {isDirectory ? (
                <li>
                  <button type="button" onClick={() => onOpenRecord(record)}>
                    <FiFolder size={14} />
                    Open Folder
                  </button>
                </li>
              ) : (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        canPreview
                          ? onPreviewFile(record)
                          : onDownloadFile(record)
                      }
                    >
                      <FiExternalLink size={14} />
                      {canPreview ? "Preview" : "Open File"}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onDownloadFile(record)}
                    >
                      <FiDownload size={14} />
                      Download
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => onPrintRecord(record)}>
                      <FiPrinter size={14} />
                      Print
                    </button>
                  </li>
                </>
              )}
              <li>
                <button type="button" onClick={() => onOpenRecord(record)}>
                  <FiEye size={14} />
                  Open Record Page
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onEditRecord(record)}>
                  <FiEdit2 size={14} />
                  Rename / Edit
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onUnsupportedAction("Move")}
                >
                  <FiCopy size={14} />
                  Move
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onUnsupportedAction("Copy")}
                >
                  <FiCopy size={14} />
                  Copy
                </button>
              </li>
              {canManage && (
                <li>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => onDeleteRecord(record)}
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

export default NotarialRow;
