"use client";

import { type SyntheticEvent } from "react";
import type { RecievingLog } from "../../generated/prisma/browser";
import { TipCell } from "../../index";
import Roles from "../../lib/Roles";

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
  onRowClick,
  isAdminOrAtty,
  isSelected,
  isSelecting = false,
  onToggleSelect,
  role,
}: {
  log: RecievingLog;
  onView?: (log: RecievingLog) => void;
  onRowClick?: (log: RecievingLog) => void;
  isAdminOrAtty?: boolean;
  isSelected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
  role?: Roles;
}) => {
  const canManage =
    typeof isAdminOrAtty === "boolean"
      ? isAdminOrAtty
      : role === Roles.ADMIN || role === Roles.ATTY;

  const timeVal = extractTime(log.dateRecieved);
  const dateStr = formatDate(log.dateRecieved);

  const openRow = (e?: SyntheticEvent) => {
    e?.stopPropagation();
    if (canManage && isSelecting && onToggleSelect) {
      onToggleSelect(log.id, !Boolean(isSelected));
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
      {canManage && isSelecting && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="relative text-center px-4 py-3.5"
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={Boolean(isSelected)}
              onChange={(e) => onToggleSelect?.(log.id, e.target.checked)}
              aria-label={`Select receiving log ${log.id}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      )}

      <TipCell
        label="Book and Page"
        value={log.bookAndPage || "-"}
        className="font-semibold"
      />
      <TipCell
        label="Date Received"
        value={dateStr || "-"}
        className="text-base-content/70"
      />
      <TipCell label="Case Type" value={log.caseType || "-"} />
      <TipCell label="Case No." value={log.caseNumber || "-"} />
      <TipCell label="Content" value={log.content || "-"} truncate />
      <TipCell label="Branch No." value={log.branchNumber || "-"} />
      <TipCell label="Time" value={timeVal || "-"} />
      <TipCell
        label="Notes"
        value={log.notes || "-"}
        className="text-base-content/60"
        truncate
      />
    </tr>
  );
};

export default ReceiveRow;
