"use client";

import TipCell from "@/app/components/Table/TipCell";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import { SpecialProceedingData } from "./schema";

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const SpecialProceedingRow = ({
  caseItem,
  onEdit,
  onDelete,
  onRowClick,
}: {
  caseItem: SpecialProceedingData;
  onEdit: (c: SpecialProceedingData) => void;
  onDelete: (id: number) => void;
  onRowClick: (c: SpecialProceedingData) => void;
}) => (
  <tr
    className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-xs"
    onClick={() => onRowClick(caseItem)}
  >
    <td onClick={(e) => e.stopPropagation()} className="relative text-center">
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
                className="flex items-center gap-3 text-info"
                onClick={(e) => {
                  e.stopPropagation();
                  onRowClick(caseItem);
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
                  onEdit(caseItem);
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
                  onDelete(caseItem.id);
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
    <TipCell
      label="SPC. No."
      value={caseItem.caseNumber}
      className="font-semibold"
    />
    <TipCell label="Raffled To" value={caseItem.raffledTo} />
    <TipCell
      label="Date Filed"
      value={formatDate(caseItem.date)}
      className="text-base-content/70"
    />
    <TipCell
      label="Petitioner"
      value={caseItem.petitioner}
      truncate
      className="font-medium"
    />
    <TipCell label="Nature" value={caseItem.nature} truncate />
    <TipCell label="Respondent" value={caseItem.respondent} truncate />
  </tr>
);

export default SpecialProceedingRow;
