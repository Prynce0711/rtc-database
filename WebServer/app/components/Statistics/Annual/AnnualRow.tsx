"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { FiEdit, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { ColumnDef } from "./AnnualColumnDef";

interface AnnualRowProps {
  row: Record<string, unknown>;
  leafColumns: ColumnDef[];
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
}

const AnnualRow = ({ row, leafColumns, onEdit, onDelete }: AnnualRowProps) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  return (
    <tr className="bg-base-100 hover:bg-base-200 transition-colors text-sm">
      {/* Actions dropdown – admin/atty only */}
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
                <li>
                  <button
                    className="flex items-center gap-3 text-warning"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(row);
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
                      onDelete(row);
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

      {leafColumns.map((col) => (
        <td
          key={col.key}
          className={
            col.align === "center"
              ? "text-center"
              : col.align === "right"
                ? "text-right"
                : ""
          }
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
};

export default AnnualRow;
