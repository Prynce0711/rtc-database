"use client";

import { Case } from "@/app/generated/prisma/browser";
import { useSession } from "@/app/lib/authClient";
import { CaseModalType } from "./CaseModal";

const CaseRow = ({
  caseItem,
  setSelectedCase,
  showModal,
  handleDeleteCase,
}: {
  caseItem: Case;
  setSelectedCase: (caseItem: Case) => void;
  showModal: (type: CaseModalType) => void;
  handleDeleteCase: (caseNumber: string) => void;
}) => {
  const session = useSession();
  const isAdmin = session?.data?.user?.role === "admin";

  return (
    <tr key={caseItem.id}>
      <td>{caseItem.caseNumber}</td>
      <td>{caseItem.name}</td>
      <td>{caseItem.charge}</td>
      <td>{caseItem.branch}</td>
      <td>
        <span
          className={`badge ${
            caseItem.detained ? "badge-warning" : "badge-success"
          }`}
        >
          {caseItem.detained ? "Yes" : "No"}
        </span>
      </td>
      <td>{new Date(caseItem.dateFiled).toLocaleDateString()}</td>
      {isAdmin && (
        <td>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setSelectedCase(caseItem);
                showModal(CaseModalType.EDIT);
              }}
            >
              Edit
            </button>
            <button
              className="btn btn-sm btn-error btn-ghost"
              onClick={() => handleDeleteCase(caseItem.caseNumber)}
            >
              Delete
            </button>
          </div>
        </td>
      )}
    </tr>
  );
};

export default CaseRow;
