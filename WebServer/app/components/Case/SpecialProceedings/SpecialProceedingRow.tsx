"use client";

import TipCell from "@/app/components/Table/TipCell";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import ActionDropdown from "../../Table/ActionDropdown";
import { SpecialProceedingData } from "./schema";

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const SpecialProceedingRow = ({
  caseItem,
  onEdit,
  onDelete,
  onRowClick,
}: {
  caseItem: SpecialProceedingData;
  onEdit: (c: SpecialProceedingData) => void;
  onDelete: (id: number) => void;
  onRowClick: (c: SpecialProceedingData) => void;
}) => {
  const popoverId = `special-proceeding-actions-popover-${caseItem.id}`;
  const anchorName = `--special-proceeding-actions-anchor-${caseItem.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-xs"
      onClick={() => onRowClick(caseItem)}
    >
      <td onClick={(e) => e.stopPropagation()} className="relative text-center">
        <ActionDropdown popoverId={popoverId} anchorName={anchorName}>
          <li>
            <button
              className="flex items-center gap-3 text-info"
              onClick={(e) => {
                e.stopPropagation();
                closeActionsPopover();
                onRowClick(caseItem);
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
      <TipCell
        label="SPC. No."
        value={caseItem.caseNumber}
        className="font-semibold"
      />
      <TipCell label="Raffled To" value={caseItem.raffledTo} />
      <TipCell
        label="Date Filed"
        value={formatDate(caseItem.date)}
        className="text-base-content/70"
      />
      <TipCell
        label="Petitioner"
        value={caseItem.petitioner}
        truncate
        className="font-medium"
      />
      <TipCell label="Nature" value={caseItem.nature} truncate />
      <TipCell label="Respondent" value={caseItem.respondent} truncate />
    </tr>
  );
};

export default SpecialProceedingRow;
