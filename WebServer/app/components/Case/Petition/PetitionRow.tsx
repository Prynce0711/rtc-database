"use client";

import TipCell from "@/app/components/Table/TipCell";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
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
