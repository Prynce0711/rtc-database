"use client";

import { Case } from "@/app/generated/prisma/browser";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FiEdit, FiEye, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";
import Table from "../Table/Table";
import TipCell from "../Table/TipCell";

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
      className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-xs"
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
                      router.push(`/user/cases/${caseItem.id}/edit`);
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
      <TipCell
        label="Case No."
        value={caseItem.caseNumber}
        className="font-semibold"
      />
      <TipCell label="Branch" value={caseItem.branch} />
      <TipCell label="Asst. Branch" value={caseItem.assistantBranch} />
      <TipCell
        label="Date Filed"
        value={formatDate(caseItem.dateFiled)}
        className="text-base-content/70"
      />
      <TipCell
        label="Case Type"
        value={caseItem.caseType}
        className="font-medium"
      />
      <TipCell
        label="Name"
        value={caseItem.name}
        truncate
        className="font-medium"
      />
      <TipCell label="Charge" value={caseItem.charge} truncate />
      <TipCell label="Info Sheet" value={caseItem.infoSheet} />
      <TipCell label="Court" value={caseItem.court} />

      {/* DETENTION STATUS */}
      <td className="text-center whitespace-nowrap relative group/tip ">
        <span
          className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition
            ${
              caseItem.detained && caseItem.detained.trim()
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : "bg-neutral-800 text-white border-neutral-700"
            }`}
        >
          {caseItem.detained && caseItem.detained.trim()
            ? caseItem.detained
            : "Released"}
        </span>
        <div className="cell-tip">
          <span className="cell-tip-label">Detention</span>
          <span className="cell-tip-value">
            {caseItem.detained && caseItem.detained.trim()
              ? caseItem.detained
              : "Released"}
          </span>
        </div>
      </td>

      <TipCell label="Consolidation" value={caseItem.consolidation} truncate />
      <TipCell label="EQC No." value={caseItem.eqcNumber ?? "N/A"} />
      <TipCell label="Bond" value={caseItem.bond} />
      <TipCell
        label="Raffle Date"
        value={formatDate(caseItem.raffleDate)}
        className="text-base-content/70"
      />
      <TipCell label="Committee 1" value={caseItem.committee1} />
      <TipCell label="Committee 2" value={caseItem.committee2} />
      <TipCell label="Judge" value={caseItem.judge} />
      <TipCell label="AO" value={caseItem.ao} />
      <TipCell label="Complainant" value={caseItem.complainant} truncate />
      <TipCell label="House No." value={caseItem.houseNo} />
      <TipCell label="Street" value={caseItem.street} />
      <TipCell label="Barangay" value={caseItem.barangay} />
      <TipCell label="Municipality" value={caseItem.municipality} />
      <TipCell label="Province" value={caseItem.province} />
      <TipCell label="Counts" value={caseItem.counts} />
      <TipCell label="JDF" value={caseItem.jdf} />
      <TipCell label="SAJJ" value={caseItem.sajj} />
      <TipCell label="SAJJ 2" value={caseItem.sajj2} />
      <TipCell label="MF" value={caseItem.mf} />
      <TipCell label="STF" value={caseItem.stf} />
      <TipCell label="LRF" value={caseItem.lrf} />
      <TipCell label="VCF" value={caseItem.vcf} />
      <TipCell label="Total" value={caseItem.total} />
      <TipCell label="Amount Involved" value={caseItem.amountInvolved} />
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
