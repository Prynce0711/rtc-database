"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { ReceiveLog } from "./ReceiveRecord";

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
    <div className="max-w-[180px] mx-auto text-sm">
      <div className="break-words" title={text} aria-expanded={expanded}>
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
}: {
  log: ReceiveLog;
  onEdit: (log: ReceiveLog) => void;
  onDelete: (log: ReceiveLog) => void;
  onRowClick?: (log: ReceiveLog) => void;
}) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const dateStr =
    log.dateReceived instanceof Date
      ? log.dateReceived.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : new Date(log.dateReceived).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

  const bookAndPages =
    (log as any).BookAndPages ?? (log as any).receiptNo ?? "—";
  const caseType = (log as any).caseType ?? (log as any).Abbreviation ?? "—";
  const timeVal = (log as any).Time ?? log.timeReceived ?? "—";
  const caseNo = (log as any)["Case No"] ?? log.caseNumber ?? "—";
  const content = (log as any).Content ?? log.documentType ?? "—";
  const branchNo = (log as any)["Branch No"] ?? log.branch ?? "—";
  const notes = (log as any).Notes ?? log.remarks ?? "—";

  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const openModal = (e?: React.SyntheticEvent) => {
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
                router.push(`/user/cases/proceedings/${log.id}`);
              }}
            >
              <FiEye size={18} />
            </button>

            {/* Admin dropdown (keeps Edit/Delete) */}
            {isAdminOrAtty && (
              <div className="dropdown dropdown-start">
                <button tabIndex={0} className="btn btn-ghost btn-sm px-2">
                  <FiMoreHorizontal size={18} />
                </button>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-44 border border-base-200"
                  style={{ zIndex: 9999 }}
                >
                  <li>
                    <button
                      className="flex items-center gap-3 text-info"
                      onClick={(e) => {
                        e.stopPropagation();
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
                        onDelete(log);
                      }}
                    >
                      <FiTrash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </td>

        {/* DATA CELLS */}
        <td className="font-semibold text-center whitespace-nowrap">
          {bookAndPages}
        </td>
        <td className="text-center text-base-content/70 whitespace-nowrap">
          {dateStr}
        </td>
        <td className="text-center whitespace-nowrap">{caseType}</td>
        <td className="text-center whitespace-nowrap">{caseNo}</td>
        <td className="text-center">
          <ExpandableContent text={content} maxChars={220} />
        </td>
        <td className="text-center whitespace-nowrap">{branchNo}</td>
        <td className="text-center whitespace-nowrap">{timeVal}</td>
        <td className="text-center">
          <ExpandableContent text={notes} maxChars={140} />
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
                <div className="whitespace-pre-line break-words text-base-content/90 mt-1">
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
                <div className="whitespace-pre-line break-words text-base-content/90 mt-1">
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
