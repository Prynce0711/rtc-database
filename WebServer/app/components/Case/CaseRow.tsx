"use client";

import { Case } from "@/app/generated/prisma/browser";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
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
  handleDeleteCase: (caseNumber: string) => void;
  onRowClick: (caseItem: Case) => void;
}) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  return (
    <tr
      key={caseItem.id}
      className="hover:bg-base-200 cursor-pointer transition-colors"
      onClick={() => onRowClick(caseItem)}
    >
      {/* <td>{caseItem.caseNumber}</td>
      <td>{caseItem.name}</td>
      <td>{caseItem.charge}</td>
      <td>{caseItem.branch}</td>
      <td>{caseItem.assistantBranch}</td>
      <td>{caseItem.court}</td> */}
      {isAdminOrAtty && (
        <td onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCase(caseItem);
                showModal(CaseModalType.EDIT);
              }}
            >
              Edit
            </button>
            <button
              className="btn btn-sm btn-error btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCase(caseItem.caseNumber);
              }}
            >
              Delete
            </button>
          </div>
        </td>
      )}

      <td>{caseItem.branch}</td>
      <td>{caseItem.assistantBranch}</td>
      <td>{caseItem.caseNumber}</td>
      <td>{new Date(caseItem.dateFiled).toLocaleDateString()}</td>
      <td>{caseItem.name}</td>
      <td>{caseItem.charge}</td>
      <td>{caseItem.infoSheet}</td>
      <td>{caseItem.court}</td>
      <td>
        <span
          className={`badge ${
            caseItem.detained ? "badge-warning" : "badge-success"
          }`}
        >
          {caseItem.detained ? "Yes" : "No"}
        </span>
      </td>
      <td>{caseItem.consolidation}</td>
      <td>{caseItem.eqcNumber ?? "N/A"}</td>
      <td>{caseItem.bond}</td>
      <td>
        {caseItem.raffleDate
          ? new Date(caseItem.raffleDate).toLocaleDateString()
          : ""}
      </td>
      <td>{caseItem.committe1}</td>
      <td>{caseItem.committe2}</td>
    </tr>
  );
};

export default CaseRow;
