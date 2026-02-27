"use client";

import { Petition } from "@/app/generated/prisma/client";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

const ReceiveRow = ({
  log,
  onEdit,
  onDelete,
  onView,
}: {
  log: Petition;
  onEdit: (log: Petition) => void;
  onDelete: (log: Petition) => void;
  onView?: (log: Petition) => void;
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
      <td className="font-semibold text-center">{log.caseNumber}</td>
      <td className="text-center">{log.raffledTo ?? "—"}</td>
      <td className="text-center text-base-content/70">{dateStr}</td>
      <td className="font-medium text-center">{log.petitioner ?? "—"}</td>
      <td className="text-center">{log.nature ?? "—"}</td>
    </tr>
  );
};

export default ReceiveRow;
