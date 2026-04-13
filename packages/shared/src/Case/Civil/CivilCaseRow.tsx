"use client";

import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import { ActionDropdown, TipCell } from "../../index";
import type { CivilCaseData } from "./CivilCaseSchema";

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const CivilCaseRow = ({
  caseItem,
  onEdit,
  onDelete,
  onView,
  selected = false,
  onToggleSelect,
  canManage,
}: {
  caseItem: CivilCaseData;
  onEdit: (c: CivilCaseData) => void;
  onDelete: (id: number) => void;
  onView: (c: CivilCaseData) => void;
  selected?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
  canManage: boolean;
}) => {
  const popoverId = `civil-actions-popover-${caseItem.id}`;
  const anchorName = `--civil-actions-anchor-${caseItem.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className="border-b border-base-200/60 transition-colors hover:bg-base-200/30 cursor-pointer text-sm"
      onClick={() => onView(caseItem)}
    >
      {canManage && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="px-4 py-3.5 text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected}
              onChange={(e) => onToggleSelect?.(caseItem.id, e.target.checked)}
              aria-label={`Select case ${caseItem.caseNumber}`}
              onClick={(e) => e.stopPropagation()}
            />
            <ActionDropdown popoverId={popoverId} anchorName={anchorName}>
              <li>
                <button
                  className="flex items-center gap-3 text-info"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeActionsPopover();
                    onView(caseItem);
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
                    onEdit(caseItem);
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
                    onDelete(caseItem.id);
                  }}
                >
                  <FiTrash2 size={16} />
                  <span>Delete</span>
                </button>
              </li>
            </ActionDropdown>
          </div>
        </td>
      )}
      <TipCell
        label="Case Number"
        value={caseItem.caseNumber}
        className="font-semibold"
      />
      <TipCell label="Branch" value={caseItem.branch} />
      <TipCell label="Petitioner/s" value={caseItem.petitioners} truncate />
      <TipCell label="Defendant/s" value={caseItem.defendants} truncate />
      <TipCell
        label="Date Filed"
        value={formatDate(caseItem.dateFiled)}
        className="text-base-content/70"
      />
      <TipCell label="Notes/Appealed" value={caseItem.notes} />
      <TipCell label="Nature of Petition" value={caseItem.nature} />
    </tr>
  );
};

export default CivilCaseRow;
