"use client";

import { useState, type SyntheticEvent } from "react";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import type { RecievingLog } from "../../generated/prisma/browser";
import { useAdaptiveRouter } from "../../lib/nextCompat";
import Roles from "../../lib/Roles";
import ActionDropdown from "../../Table/ActionDropdown";
import TipCell from "../../Table/TipCell";

function ExpandableContent({
  text,
  maxChars = 220,
}: {
  text: string;
  maxChars?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span>—</span>;
  const isLong = text.length > maxChars;
  const short = isLong ? text.slice(0, maxChars).trimEnd() + "…" : text;
  return (
    <div className="max-w-45 mx-auto text-sm">
      <div className="wrap-break-word" title={text} aria-expanded={expanded}>
        {expanded ? text : short}
      </div>
      {isLong && (
        <button
          className="text-xs text-info mt-1"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((s) => !s);
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

const ReceiveRow = ({
  log,
  onEdit,
  onDelete,
  onRowClick,
  role,
}: {
  log: RecievingLog;
  onEdit: (log: RecievingLog) => void;
  onDelete: (log: RecievingLog) => void;
  onRowClick?: (log: RecievingLog) => void;
  role: Roles;
}) => {
  const isAdminOrAtty = role === Roles.ADMIN || role === Roles.ATTY;

  const dateStr =
    log.dateRecieved instanceof Date
      ? log.dateRecieved.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const timeVal =
    log.dateRecieved instanceof Date
      ? log.dateRecieved.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";

  const bookAndPages = log.bookAndPage ?? "—";
  const caseType = log.caseType ?? "—";
  const caseNo = log.caseNumber ?? "—";
  const content = log.content ?? "—";
  const branchNo = log.branchNumber ?? "—";
  const notes = log.notes ?? "—";

  const [isOpen, setIsOpen] = useState(false);
  const router = useAdaptiveRouter();
  const popoverId = `receive-actions-popover-${log.id}`;
  const anchorName = `--receive-actions-anchor-${log.id}`;

  const closeActionsPopover = () => {
    const popoverEl = document.getElementById(popoverId) as
      | (HTMLElement & { hidePopover?: () => void })
      | null;
    popoverEl?.hidePopover?.();
  };

  const openModal = (e?: SyntheticEvent) => {
    e?.stopPropagation();
    setIsOpen(true);
    onRowClick?.(log);
  };

  const closeModal = () => setIsOpen(false);

  return (
    <>
      <tr
        className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer"
        onClick={openModal}
      >
        {/* ACTIONS */}
        <td
          className="relative text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center items-center gap-2">
            {/* Visible View button for all users */}
            <button
              className="btn btn-ghost btn-sm px-2"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/user/cases/receiving/${log.id}`);
              }}
            >
              <FiEye size={18} />
            </button>

            {/* Admin dropdown (keeps Edit/Delete) */}
            {isAdminOrAtty && (
              <ActionDropdown popoverId={popoverId} anchorName={anchorName}>
                <li>
                  <button
                    className="flex items-center gap-3 text-info"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeActionsPopover();
                      router.push(`/user/cases/receiving/${log.id}`);
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
            )}
          </div>
        </td>

        {/* DATA CELLS */}
        <TipCell
          label="Book & Pages"
          value={bookAndPages}
          className="font-semibold"
        />
        <TipCell
          label="Date Received"
          value={dateStr}
          className="text-base-content/70"
        />
        <TipCell label="Case Type" value={caseType} />
        <TipCell label="Case No." value={caseNo} />
        <td className="text-center relative">
          {content && content !== "—" ? (
            <div
              className="tooltip tooltip-bottom z-50 block w-full"
              role="presentation"
            >
              <div className="tooltip-content z-50">
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    Content
                  </span>
                  <span className="text-xs font-medium">
                    {String(content).slice(0, 200)}
                    {String(content).length > 200 ? "…" : ""}
                  </span>
                </div>
              </div>
              <ExpandableContent text={content} maxChars={220} />
            </div>
          ) : (
            <ExpandableContent text={content} maxChars={220} />
          )}
        </td>
        <TipCell label="Branch No." value={branchNo} />
        <TipCell label="Time" value={timeVal} />
        <td className="text-center relative">
          {notes && notes !== "—" ? (
            <div
              className="tooltip tooltip-bottom z-50 block w-full"
              role="presentation"
            >
              <div className="tooltip-content z-50">
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    Notes
                  </span>
                  <span className="text-xs font-medium">
                    {String(notes).slice(0, 200)}
                    {String(notes).length > 200 ? "…" : ""}
                  </span>
                </div>
              </div>
              <ExpandableContent text={notes} maxChars={140} />
            </div>
          ) : (
            <ExpandableContent text={notes} maxChars={140} />
          )}
        </td>
      </tr>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="bg-base-100 rounded-lg shadow-lg max-w-3xl w-full p-6 border border-base-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4">
              <h3 className="text-lg font-semibold">Receiving Log Details</h3>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    closeModal();
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold">Book and Pages</div>
                <div className="text-base-content/80">{bookAndPages}</div>
              </div>
              <div>
                <div className="font-semibold">Date Received</div>
                <div className="text-base-content/80">{dateStr}</div>
              </div>
              <div>
                <div className="font-semibold">Case Type</div>
                <div className="text-base-content/80">{caseType}</div>
              </div>
              <div>
                <div className="font-semibold">Case Number</div>
                <div className="text-base-content/80">{caseNo}</div>
              </div>
              <div className="col-span-2">
                <div className="font-semibold">Content</div>
                <div className="whitespace-pre-line wrap-break-word text-base-content/90 mt-1">
                  {content}
                </div>
              </div>
              <div>
                <div className="font-semibold">Branch No</div>
                <div className="text-base-content/80">{branchNo}</div>
              </div>
              <div>
                <div className="font-semibold">Time</div>
                <div className="text-base-content/80">{timeVal}</div>
              </div>
              <div className="col-span-2">
                <div className="font-semibold">Notes</div>
                <div className="whitespace-pre-line wrap-break-word text-base-content/90 mt-1">
                  {notes}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="btn btn-outline"
                onClick={() => {
                  closeModal();
                  onEdit(log);
                }}
              >
                Edit
              </button>
              <button
                className="btn btn-error"
                onClick={() => {
                  closeModal();
                  onDelete(log);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceiveRow;
