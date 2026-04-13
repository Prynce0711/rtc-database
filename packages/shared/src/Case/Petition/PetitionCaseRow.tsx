"use client";

import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import { ActionDropdown, TipCell } from "../../index";
import type { PetitionCaseData } from "./PetitionCaseSchema";

const PetitionCaseRow = ({
  caseItem,
  onEdit,
  onDelete,
  onView,
  selected = false,
  onToggleSelect,
  canManage,
}: {
  caseItem: PetitionCaseData;
  onEdit: (item: PetitionCaseData) => void;
  onDelete: (id: number) => void;
  onView: (item: PetitionCaseData) => void;
  selected?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
  canManage: boolean;
}) => {
  const dateStr = caseItem.date
    ? new Date(caseItem.date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const popoverId = `petition-actions-popover-${caseItem.id}`;
  const anchorName = `--petition-actions-anchor-${caseItem.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
      onClick={() => onView(caseItem)}
    >
      {canManage && onToggleSelect && (
        <td className="text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={selected}
            onChange={(e) => onToggleSelect(caseItem.id, e.target.checked)}
            aria-label={`Select petition ${caseItem.id}`}
          />
        </td>
      )}
      {/* ACTIONS */}
      {canManage && (
        <td
          className="relative text-center"
          onClick={(e) => e.stopPropagation()}
        >
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
        </td>
      )}

      {/* DATA CELLS */}
      <TipCell
        label="Case No."
        value={caseItem.caseNumber}
        className="font-semibold"
      />
      <TipCell label="Raffled To" value={caseItem.raffledTo ?? "—"} />
      <TipCell label="Date" value={dateStr} className="text-base-content/70" />
      <TipCell
        label="Petitioner"
        value={caseItem.petitioner ?? "—"}
        truncate
        className="font-medium"
      />
      <TipCell label="Nature" value={caseItem.nature ?? "—"} truncate />
    </tr>
  );
};

export default PetitionCaseRow;
