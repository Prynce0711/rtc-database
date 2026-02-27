"use client";

import { Case } from "@/app/generated/prisma/browser";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import Table from "../Table/Table";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaseSortConfig = { key: keyof Case; order: "asc" | "desc" } | null;

// ─── Case Row ─────────────────────────────────────────────────────────────────

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
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer"
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
      <td className="font-semibold text-center whitespace-nowrap">
        {caseItem.caseNumber}
      </td>
      <td className="text-center">{caseItem.branch}</td>
      <td className="text-center">{caseItem.assistantBranch}</td>
      <td className="text-center text-base-content/70 whitespace-nowrap">
        {formatDate(caseItem.dateFiled)}
      </td>
      <td className="font-medium text-center">{caseItem.name}</td>
      <td className="text-xs text-center">{caseItem.charge}</td>
      <td className="text-center">{caseItem.infoSheet}</td>
      <td className="text-center">{caseItem.court}</td>

      {/* DETENTION STATUS */}
      <td className="text-center">
        <span
          className={`px-3 py-1 rounded-full border text-xs font-medium transition
            ${
              caseItem.detained
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : "bg-neutral-800 text-white border-neutral-700"
            }`}
        >
          {caseItem.detained ? "Detained" : "Free"}
        </span>
      </td>

      <td className="text-center">{caseItem.consolidation}</td>
      <td className="text-center">{caseItem.eqcNumber ?? "N/A"}</td>
      <td className="text-center">{caseItem.bond}</td>
      <td className="text-center text-base-content/70 whitespace-nowrap">
        {formatDate(caseItem.raffleDate)}
      </td>
      <td className="text-center">{caseItem.committee1}</td>
      <td className="text-center">{caseItem.committee2}</td>
      <td className="text-center">{caseItem.judge}</td>
      <td className="text-center">{caseItem.ao}</td>
      <td className="text-center">{caseItem.complainant}</td>
      <td className="text-center">{caseItem.houseNo}</td>
      <td className="text-center">{caseItem.street}</td>
      <td className="text-center">{caseItem.barangay}</td>
      <td className="text-center">{caseItem.municipality}</td>
      <td className="text-center">{caseItem.province}</td>
      <td className="text-center">{caseItem.counts}</td>
      <td className="text-center">{caseItem.jdf}</td>
      <td className="text-center">{caseItem.sajj}</td>
      <td className="text-center">{caseItem.sajj2}</td>
      <td className="text-center">{caseItem.mf}</td>
      <td className="text-center">{caseItem.stf}</td>
      <td className="text-center">{caseItem.lrf}</td>
      <td className="text-center">{caseItem.vcf}</td>
      <td className="text-center">{caseItem.total}</td>
      <td className="text-center">{caseItem.amountInvolved}</td>
    </tr>
  );
};

// ─── Case Table (uses generic Table component) ────────────────────────────────

export const CaseTable = ({
  data,
  handleDeleteCase,
}: {
  data: Case[];
  handleDeleteCase: (caseId: number) => void;
}) => {
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const [sortConfig, setSortConfig] = useState<CaseSortConfig>({
    key: "dateFiled",
    order: "desc",
  });

  const handleSort = (key: keyof Case) => {
    setSortConfig((prev) => ({
      key,
      order: prev?.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const sorted = useMemo(() => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortConfig.order === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const headers = [
    ...(isAdminOrAtty
      ? [{ key: "actions", label: "ACTIONS", align: "center" as const }]
      : []),
    {
      key: "caseNumber",
      label: "CASE NO.",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "branch",
      label: "BRANCH",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "assistantBranch",
      label: "ASST. BRANCH",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "dateFiled",
      label: "DATE FILED",
      sortable: true,
      align: "center" as const,
    },
    { key: "name", label: "NAME", sortable: true, align: "center" as const },
    {
      key: "charge",
      label: "CHARGE",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "infoSheet",
      label: "INFO SHEET",
      sortable: true,
      align: "center" as const,
    },
    { key: "court", label: "COURT", sortable: true, align: "center" as const },
    {
      key: "detained",
      label: "DETENTION",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "consolidation",
      label: "CONSOLIDATION",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "eqcNumber",
      label: "EQC NO.",
      sortable: true,
      align: "center" as const,
    },
    { key: "bond", label: "BOND", sortable: true, align: "center" as const },
    {
      key: "raffleDate",
      label: "RAFFLE DATE",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "committee1",
      label: "COMMITTEE 1",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "committee2",
      label: "COMMITTEE 2",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "judge",
      label: "JUDGE",
      sortable: true,
      align: "center" as const,
    },
    { key: "ao", label: "AO", sortable: true, align: "center" as const },
    {
      key: "complainant",
      label: "COMPLAINANT",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "houseNo",
      label: "HOUSE NO.",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "street",
      label: "STREET",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "barangay",
      label: "BARANGAY",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "municipality",
      label: "MUNICIPALITY",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "province",
      label: "PROVINCE",
      sortable: true,
      align: "center" as const,
    },
    {
      key: "counts",
      label: "COUNTS",
      sortable: true,
      align: "center" as const,
    },
    { key: "jdf", label: "JDF", sortable: true, align: "center" as const },
    { key: "sajj", label: "SAJJ", sortable: true, align: "center" as const },
    { key: "sajj2", label: "SAJJ 2", sortable: true, align: "center" as const },
    { key: "mf", label: "MF", sortable: true, align: "center" as const },
    { key: "stf", label: "STF", sortable: true, align: "center" as const },
    { key: "lrf", label: "LRF", sortable: true, align: "center" as const },
    { key: "vcf", label: "VCF", sortable: true, align: "center" as const },
    { key: "total", label: "TOTAL", sortable: true, align: "center" as const },
    {
      key: "amountInvolved",
      label: "AMOUNT INVOLVED",
      sortable: true,
      align: "center" as const,
    },
  ];

  return (
    <Table<Case>
      headers={headers}
      data={sorted}
      sortConfig={sortConfig}
      onSort={handleSort}
      renderRow={(item) => (
        <CaseRow
          key={item.id}
          caseItem={item}
          handleDeleteCase={handleDeleteCase}
        />
      )}
      rowsPerPage={25}
      className="bg-base-300 rounded-lg shadow"
    />
  );
};

export default CaseRow;
