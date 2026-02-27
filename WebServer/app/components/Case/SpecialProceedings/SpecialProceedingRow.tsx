"use client";

import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

export type SpecialCase = {
  id: number;
  spcNo: string;
  raffledToBranch: string;
  dateFiled: string;
  petitioners: string;
  nature: string;
  respondent: string;
  titleNo?: string;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
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
  caseItem: SpecialCase;
  onEdit: (c: SpecialCase) => void;
  onDelete: (id: number) => void;
  onRowClick: (c: SpecialCase) => void;
}) => (
  <tr
    className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
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
    <td className="font-semibold text-center">{caseItem.spcNo}</td>
    <td className="text-center">{caseItem.raffledToBranch}</td>
    <td className="text-center text-base-content/70">
      {formatDate(caseItem.dateFiled)}
    </td>
    <td className="font-medium text-center">{caseItem.petitioners}</td>
    <td className="text-center">{caseItem.nature}</td>
    <td className="text-center">{caseItem.respondent}</td>
  </tr>
);

export default SpecialProceedingRow;
