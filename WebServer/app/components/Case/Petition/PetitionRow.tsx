"use client";

import TipCell from "@/app/components/Table/TipCell";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import ActionDropdown from "../../Table/ActionDropdown";
import { PetitionCaseData } from "./schema";

const ReceiveRow = ({
  log,
  onEdit,
  onDelete,
  onView,
}: {
  log: PetitionCaseData;
  onEdit: (log: PetitionCaseData) => void;
  onDelete: (log: PetitionCaseData) => void;
  onView?: (log: PetitionCaseData) => void;
}) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const dateStr = log.date
    ? new Date(log.date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const popoverId = `petition-actions-popover-${log.id}`;
  const anchorName = `--petition-actions-anchor-${log.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  return (
    <tr
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
      onClick={() => onView?.(log)}
    >
      {/* ACTIONS */}
      {isAdminOrAtty && (
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
                  onView?.(log);
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
                  onEdit(log);
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
                  onDelete(log);
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
        value={log.caseNumber}
        className="font-semibold"
      />
      <TipCell label="Raffled To" value={log.raffledTo ?? "—"} />
      <TipCell label="Date" value={dateStr} className="text-base-content/70" />
      <TipCell
        label="Petitioner"
        value={log.petitioner ?? "—"}
        truncate
        className="font-medium"
      />
      <TipCell label="Nature" value={log.nature ?? "—"} truncate />
    </tr>
  );
};

export default ReceiveRow;
