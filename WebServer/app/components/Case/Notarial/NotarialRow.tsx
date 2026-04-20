"use client";

import { formatDate, TipCell } from "@rtc-database/shared";
import { FiDownload, FiEye } from "react-icons/fi";

export type NotarialRecord = {
  id: number;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;
  fileName?: string;
  mimeType?: string;
};

const NotarialRow = ({
  record,
  onRowClick,
  onViewFile,
  onDownloadFile,
  canPreview,
  isSelecting,
  isSelected,
  onToggleSelect,
}: {
  record: NotarialRecord;
  onRowClick: (r: NotarialRecord) => void;
  onViewFile: (r: NotarialRecord) => void;
  onDownloadFile: (r: NotarialRecord) => void;
  canPreview: boolean;
  isSelecting?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
}) => {
  return (
    <tr
      className={`border-b border-base-200/60 transition-colors hover:bg-base-200/30 cursor-pointer text-sm ${
        isSelecting && isSelected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (isSelecting && onToggleSelect) {
          onToggleSelect(record.id, !Boolean(isSelected));
          return;
        }
        onRowClick(record);
      }}
    >
      {isSelecting && onToggleSelect && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="relative text-center px-4 py-3.5"
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={Boolean(isSelected)}
              onChange={(e) => onToggleSelect(record.id, e.target.checked)}
              aria-label={`Select notarial record ${record.title || record.id}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      )}

      <TipCell
        label="Title"
        value={record.title}
        truncate
        className="font-semibold"
      />
      <TipCell label="Name" value={record.name} truncate />
      <TipCell label="Attorney" value={record.atty} truncate />
      <TipCell
        label="Date"
        value={formatDate(record.date)}
        className="text-base-content/70"
      />
      <td className="text-center relative" onClick={(e) => e.stopPropagation()}>
        {record.link ? (
          <div className="flex items-center justify-center gap-2">
            {canPreview && (
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => onViewFile(record)}
              >
                <FiEye size={12} />
                View
              </button>
            )}
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => onDownloadFile(record)}
            >
              <FiDownload size={12} />
              Download
            </button>
          </div>
        ) : (
          <span className="text-base-content/50 text-xs">No file</span>
        )}
      </td>
    </tr>
  );
};

export default NotarialRow;
