"use client";

import { type SyntheticEvent } from "react";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import ActionDropdown from "../../Table/ActionDropdown";
import type { RecievingLog } from "../../generated/prisma/browser";
import Roles from "../../lib/Roles";
import { useAdaptiveRouter } from "../../lib/nextCompat";

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString();
};

const extractTime = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const ReceiveRow = ({
  log,
  onView,
  onEdit,
  onDelete,
  onRowClick,
  isAdminOrAtty,
  isSelected,
  isSelecting = false,
  onToggleSelect,
  role,
}: {
  log: RecievingLog;
  onView?: (log: RecievingLog) => void;
  onEdit: (log: RecievingLog) => void;
  onDelete: (log: RecievingLog) => void;
  onRowClick?: (log: RecievingLog) => void;
  isAdminOrAtty?: boolean;
  isSelected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number) => void;
  role?: Roles;
}) => {
  const canManage =
    typeof isAdminOrAtty === "boolean"
      ? isAdminOrAtty
      : role === Roles.ADMIN || role === Roles.ATTY;

  const timeVal = extractTime(log.dateRecieved);
  const dateStr = formatDate(log.dateRecieved);
  const router = useAdaptiveRouter();
  const popoverId = `receive-logs-actions-popover-${log.id}`;
  const anchorName = `--receive-logs-actions-anchor-${log.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  const openRow = (e?: SyntheticEvent) => {
    e?.stopPropagation();
    if (canManage && isSelecting && onToggleSelect) {
      onToggleSelect(log.id);
      return;
    }

    if (onView) {
      onView(log);
      return;
    }

    onRowClick?.(log);
  };

  return (
    <tr
      className={`bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm ${
        isSelecting && isSelected ? "bg-primary/10" : ""
      }`}
      onClick={openRow}
    >
      {canManage && isSelecting && onToggleSelect && (
        <td className="text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={Boolean(isSelected)}
            onChange={() => onToggleSelect(log.id)}
            aria-label={`Select receiving log ${log.id}`}
          />
        </td>
      )}
      {canManage && !isSelecting && (
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
                  if (onView) {
                    onView(log);
                  } else {
                    router.push(`/user/cases/receiving/${log.id}`);
                  }
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

      <td className="font-semibold text-center whitespace-nowrap">
        {log.bookAndPage || "-"}
      </td>
      <td className="text-center text-base-content/70 whitespace-nowrap">
        {dateStr || "-"}
      </td>
      <td className="text-center">{log.caseType || "-"}</td>
      <td className="text-center">{log.caseNumber || "-"}</td>
      <td className="text-center">{log.content || "-"}</td>
      <td className="text-center">{log.branchNumber || "-"}</td>
      <td className="text-center">{timeVal || "-"}</td>
      <td className="text-base-content/60 text-center">{log.notes || "-"}</td>
    </tr>
  );
};

export default ReceiveRow;
