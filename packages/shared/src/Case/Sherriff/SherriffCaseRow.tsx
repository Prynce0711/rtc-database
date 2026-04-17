"use client";

import { ActionDropdown, SheriffCaseData, TipCell } from "@rtc-database/shared";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";

const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const SherriffCaseRow = ({
  record,
  onEdit,
  onDelete,
  onRowClick,
  selected = false,
  isSelecting = false,
  onToggleSelect,
}: {
  record: SheriffCaseData;
  onEdit: (r: SheriffCaseData) => void;
  onDelete: (id: number) => void;
  onRowClick: (r: SheriffCaseData) => void;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
}) => {
  const popoverId = `sheriff-actions-popover-${record.id}`;
  const anchorName = `--sheriff-actions-anchor-${record.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className={`bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm ${
        isSelecting && selected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (isSelecting) {
          onToggleSelect?.(record.id, !selected);
          return;
        }
        onRowClick(record);
      }}
    >
      {isSelecting ? (
        <td onClick={(e) => e.stopPropagation()} className="text-center">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected}
              onChange={(e) => onToggleSelect?.(record.id, e.target.checked)}
              aria-label={`Select case ${record.caseNumber}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      ) : (
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
      )}
      <TipCell
        label="Case Number"
        value={record.caseNumber}
        truncate
        className="font-semibold"
      />
      <TipCell label="Sheriff Name" value={record.sheriffName} truncate />
      <TipCell label="Mortgagee" value={record.mortgagee} truncate />
      <TipCell label="Mortgagor" value={record.mortgagor} truncate />
      <TipCell
        label="Date Filed"
        value={formatDate(record.dateFiled)}
        className="text-base-content/70"
      />
      <TipCell label="Remarks" value={record.remarks} />
    </tr>
  );
};

export default SherriffCaseRow;
