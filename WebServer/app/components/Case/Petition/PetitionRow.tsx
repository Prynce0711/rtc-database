"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { ReceiveLog } from "./PetitionRecord";

const ReceiveRow = ({
  log,
  onEdit,
  onDelete,
  onView,
}: {
  log: ReceiveLog;
  onEdit: (log: ReceiveLog) => void;
  onDelete: (log: ReceiveLog) => void;
  onView?: (log: ReceiveLog) => void;
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

  const caseNumber = (log as any)["Case No"] ?? log.caseNumber ?? "—";
  const raffledToBranch =
    (log as any).RaffledToBranch ??
    (log as any)["Branch No"] ??
    log.branch ??
    "—";
  const petitioners = (log as any).Petitioners ?? log.party ?? "—";
  const titleNo =
    (log as any).TitleNo ?? (log as any).BookAndPages ?? log.receiptNo ?? "—";
  const nature =
    (log as any).Nature ?? (log as any).Content ?? log.documentType ?? "—";
  const respondent = (log as any).Respondent ?? "—";

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
                {/* VIEW */}
                <li>
                  <button
                    className="flex items-center gap-3 text-info"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView?.(log);
                    }}
                  >
                    <FiEye size={16} />
                    <span>View</span>
                  </button>
                </li>

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

      {/* DATA CELLS — matching Proceedings column order */}
      <td className="font-semibold text-center">{caseNumber}</td>
      <td className="text-center">{raffledToBranch}</td>
      <td className="text-center text-base-content/70">{dateStr}</td>
      <td className="font-medium text-center">{petitioners}</td>
      <td className="text-center">{titleNo}</td>
      <td className="text-center">{nature}</td>
      <td className="text-center">{respondent}</td>
    </tr>
  );
};

export default ReceiveRow;
