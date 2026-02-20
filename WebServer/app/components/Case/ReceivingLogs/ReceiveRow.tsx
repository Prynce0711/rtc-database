"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { ReceiveLog } from "./ReceiveRecord";

const ReceiveRow = ({
  log,
  onEdit,
  onDelete,
}: {
  log: ReceiveLog;
  onEdit: (log: ReceiveLog) => void;
  onDelete: (log: ReceiveLog) => void;
}) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const dateStr =
    log.dateReceived instanceof Date
      ? log.dateReceived.toLocaleDateString()
      : new Date(log.dateReceived).toLocaleDateString();

  const bookAndPages =
    (log as any).BookAndPages ?? (log as any).receiptNo ?? "—";
  const abbreviation = (log as any).Abbreviation ?? "";
  const timeVal = (log as any).Time ?? log.timeReceived ?? "—";
  const caseNo = (log as any)["Case No"] ?? log.caseNumber ?? "—";
  const content = (log as any).Content ?? log.documentType ?? "—";
  const branchNo = (log as any)["Branch No"] ?? log.branch ?? "—";
  const notes = (log as any).Notes ?? log.remarks ?? "—";

  return (
    <tr className="bg-base-100 hover:bg-base-200 transition-colors text-sm">
      {/* ACTIONS */}
      {isAdminOrAtty && (
        <td
          className="relative text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center">
            <div className="dropdown dropdown-start">
              <button tabIndex={0} className="btn btn-ghost btn-sm px-2">
                <FiMoreHorizontal size={18} />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-44 border border-base-200"
                style={{ zIndex: 9999 }}
              >
                {/* EDIT */}
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

                {/* DELETE */}
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
          </div>
        </td>
      )}

      {/* DATA CELLS */}
      <td className="font-semibold text-center">{bookAndPages}</td>
      <td className="text-center text-base-content/70">{dateStr}</td>
      <td className="text-center">{timeVal}</td>
      <td className="text-center">{caseNo}</td>
      <td className="text-center">{content}</td>
      <td>{log.party}</td>
      <td className="text-center">{log.receivedBy}</td>
      <td className="text-center">{branchNo}</td>
      <td className="text-base-content/60">{notes}</td>
    </tr>
  );
};

export default ReceiveRow;
