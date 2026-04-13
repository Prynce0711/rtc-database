"use client";

import { ActionDropdown, TipCell } from "@rtc-database/shared";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import type { NotarialRecord } from "./CivilTypes";

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const CivilCaseRow = ({
  record,
  onEdit,
  onDelete,
  onRowClick,
  selected = false,
  onToggleSelect,
}: {
  record: NotarialRecord;
  onEdit: (r: NotarialRecord) => void;
  onDelete: (id: number) => void;
  onRowClick: (r: NotarialRecord) => void;
  selected?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
}) => {
  const popoverId = `civil-actions-popover-${record.id}`;
  const anchorName = `--civil-actions-anchor-${record.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className="border-b border-base-200/60 transition-colors hover:bg-base-200/30 cursor-pointer text-sm"
      onClick={() => onRowClick(record)}
    >
      <td
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-3.5 text-center"
      >
        <div className="flex items-center justify-center gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={selected}
            onChange={(e) => onToggleSelect?.(record.id, e.target.checked)}
            aria-label={`Select case ${record.title}`}
            onClick={(e) => e.stopPropagation()}
          />
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
        </div>
      </td>
      <TipCell
        label="Case Number"
        value={record.title}
        truncate
        className="font-semibold px-4 py-3.5"
      />
      <TipCell
        label="Branch"
        value={record.name}
        truncate
        className="px-4 py-3.5"
      />
      <TipCell
        label="Petitioner/s"
        value={record.atty}
        truncate
        className="px-4 py-3.5"
      />
      <TipCell
        label="Defendant/s"
        value={record.defendant}
        truncate
        className="px-4 py-3.5"
      />
      <TipCell
        label="Date Filed"
        value={formatDate(record.date)}
        className="text-base-content/70 px-4 py-3.5"
      />
      <TipCell
        label="Notes/Appealed"
        value={record.notes}
        className="px-4 py-3.5"
      />
      <TipCell
        label="Nature of Petition"
        value={record.nature}
        className="px-4 py-3.5"
      />
    </tr>
  );
};

export default CivilCaseRow;
