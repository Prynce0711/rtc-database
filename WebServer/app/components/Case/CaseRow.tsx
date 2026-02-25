"use client";

import { Case } from "@/app/generated/prisma/browser";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";

import { useRouter } from "next/navigation";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
// import { CaseModalType } from "./CaseModal";
const CaseRow = ({
  caseItem,
  handleDeleteCase,
}: {
  caseItem: Case;
  handleDeleteCase: (caseId: number) => void;
}) => {
  const session = useSession();
  const router = useRouter();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  return (
    <tr
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
      onClick={() => router.push(`/user/cases/${caseItem.id}`)}
    >
      {/* ACTIONS */}
      {isAdminOrAtty && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="relative text-center"
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
                      router.push(`/user/cases/${caseItem.id}`);
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
                      router.push(`/user/casesmanage/${caseItem.id}/edit`);
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
                      handleDeleteCase(caseItem.id);
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
      <td>{caseItem.Judge}</td>
      <td>{caseItem.AO}</td>
      <td>{caseItem.Complainant}</td>
      <td>{caseItem.HouseNo}</td>
      <td>{caseItem.Street}</td>
      <td>{caseItem.Barangay}</td>
      <td>{caseItem.Municipality}</td>
      <td>{caseItem.Province}</td>
      <td>{caseItem.Counts}</td>
      <td>{caseItem.Jdf}</td>
      <td>{caseItem.Sajj}</td>
      <td>{caseItem.Sajj2}</td>
      <td>{caseItem.MF}</td>
      <td>{caseItem.STF}</td>
      <td>{caseItem.LRF}</td>
      <td>{caseItem.VCF}</td>
      <td>{caseItem.Total}</td>
      <td>{caseItem.AmountInvolved}</td>
    </tr>
  );
};

export default CaseRow;
