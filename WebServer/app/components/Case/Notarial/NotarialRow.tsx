"use client";

import { formatDate } from "@/app/lib/utils";
import { FiDownload, FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import ActionDropdown from "../../Table/ActionDropdown";
import TipCell from "../../Table/TipCell";

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
  onEdit,
  onDelete,
  onRowClick,
  onViewFile,
  onDownloadFile,
  canPreview,
}: {
  record: NotarialRecord;
  onEdit: (r: NotarialRecord) => void;
  onDelete: (id: number) => void;
  onRowClick: (r: NotarialRecord) => void;
  onViewFile: (r: NotarialRecord) => void;
  onDownloadFile: (r: NotarialRecord) => void;
  canPreview: boolean;
}) => {
  const popoverId = `notarial-actions-popover-${record.id}`;
  const anchorName = `--notarial-actions-anchor-${record.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
      onClick={() => onRowClick(record)}
    >
      <td onClick={(e) => e.stopPropagation()} className="text-center">
        <ActionDropdown popoverId={popoverId} anchorName={anchorName}>
          <li>
            <button
              className="flex items-center gap-3 text-info"
              onClick={(e) => {
                e.stopPropagation();
                closeActionsPopover();
                onRowClick(record);
              }}
            >
              <FiEye size={16} />
              <span>View</span>
            </button>
          </li>
          <li>
            <button
              className="flex items-center gap-3 text-warning"
              onClick={(e) => {
                e.stopPropagation();
                closeActionsPopover();
                onEdit(record);
              }}
            >
              <FiEdit size={16} />
              <span>Edit</span>
            </button>
          </li>
          <li>
            <button
              className="flex items-center gap-3 text-error"
              onClick={(e) => {
                e.stopPropagation();
                closeActionsPopover();
                onDelete(record.id);
              }}
            >
              <FiTrash2 size={16} />
              <span>Delete</span>
            </button>
          </li>
        </ActionDropdown>
      </td>
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
      <td
        className="text-center relative group/tip"
        onClick={(e) => e.stopPropagation()}
      >
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
