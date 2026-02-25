"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { ReceiveLog } from "./PetitionRecord";

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
      <td className="font-semibold text-center">{caseNumber}</td>
      <td className="text-center">{raffledToBranch}</td>
      <td className="text-center text-base-content/70">{dateStr}</td>
      <td>{petitioners}</td>
      <td className="text-center">{titleNo}</td>
      <td className="text-center">{nature}</td>
    </tr>
  );
};

export default ReceiveRow;
