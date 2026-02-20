"use client";

import { Case } from "@/app/generated/prisma/browser";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";

import { FiEdit, FiTrash2 } from "react-icons/fi";
import { CaseModalType } from "./CaseModal";

const CaseRow = ({
  caseItem,
  setSelectedCase,
  showModal,
  handleDeleteCase,
  onRowClick,
}: {
  caseItem: Case;
  setSelectedCase: (caseItem: Case) => void;
  showModal: (type: CaseModalType) => void;
  handleDeleteCase: (caseId: number) => void;
  onRowClick: (caseItem: Case) => void;
}) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  return (
    <tr
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
      onClick={() => onRowClick(caseItem)}
    >
      {/* ACTIONS */}
      {isAdminOrAtty && (
        <td className="text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center gap-1">
            <button
              className="btn btn-xs btn-ghost text-info hover:bg-info/10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCase(caseItem);
                showModal(CaseModalType.EDIT);
              }}
            >
              <FiEdit size={15} />
            </button>

            <button
              className="btn btn-xs btn-ghost text-error hover:bg-error/10"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCase(caseItem.id);
              }}
            >
              <FiTrash2 size={15} />
            </button>
          </div>
        </td>
      )}

      {/* DATA CELLS */}
      <td className="text-center">{caseItem.branch}</td>
      <td className="text-center">{caseItem.assistantBranch}</td>
      <td className="font-semibold text-center">{caseItem.caseNumber}</td>
      <td className="text-center text-base-content/70">
        {new Date(caseItem.dateFiled).toLocaleDateString()}
      </td>
      <td className="font-medium">{caseItem.name}</td>
      <td>{caseItem.charge}</td>
      <td>{caseItem.infoSheet}</td>
      <td>{caseItem.court}</td>

      {/* DETENTION STATUS (GLASS STYLE) */}
      <td className="text-center">
        <span
          className={`px-3 py-1 rounded-full backdrop-blur-md border text-xs font-medium
            ${
              caseItem.detained
                ? "bg-red-500/15 text-red-600 border-red-400/30"
                : "bg-emerald-500/15 text-emerald-600 border-emerald-400/30"
            }`}
        >
          {caseItem.detained ? "Detained" : "Free"}
        </span>
      </td>

      <td className="text-center">{caseItem.consolidation}</td>
      <td className="text-center">{caseItem.eqcNumber ?? "N/A"}</td>
      <td className="text-center">{caseItem.bond}</td>
      <td className="text-center text-base-content/70">
        {caseItem.raffleDate
          ? new Date(caseItem.raffleDate).toLocaleDateString()
          : ""}
      </td>
      <td>{caseItem.committe1}</td>
      <td>{caseItem.committe2}</td>
      <td>{(caseItem as any).Judge}</td>
      <td>{(caseItem as any).AO}</td>
      <td>{(caseItem as any).Complainant}</td>
      <td>{(caseItem as any).HouseNo}</td>
      <td>{(caseItem as any).Street}</td>
      <td>{(caseItem as any).Barangay}</td>
      <td>{(caseItem as any).Municipality}</td>
      <td>{(caseItem as any).Province}</td>
      <td>{(caseItem as any).Is}</td>
      <td>{(caseItem as any).Counts}</td>
      <td>{(caseItem as any).Jdf}</td>
      <td>{(caseItem as any).Sajj}</td>
      <td>{(caseItem as any).Sajj2}</td>
      <td>{(caseItem as any).MF}</td>
      <td>{(caseItem as any).STF}</td>
      <td>{(caseItem as any).LRF}</td>
      <td>{(caseItem as any).VCF}</td>
      <td>{(caseItem as any).Total}</td>
      <td>{(caseItem as any).AmountInvolved}</td>
    </tr>
  );
};

export default CaseRow;
