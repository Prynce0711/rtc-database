"use client";

import type { CriminalCaseData } from "@rtc-database/shared";
import { Table, TipCell } from "@rtc-database/shared";
import { useMemo, useState } from "react";
import Roles from "../../lib/Roles";
import { useAdaptiveNavigation } from "../../lib/nextCompat";

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

export type CaseSortConfig = {
  key: keyof CriminalCaseData;
  order: "asc" | "desc";
} | null;

// ─── Case Row ─────────────────────────────────────────────────────────────────

const CriminalCaseRow = ({
  caseItem,
  handleDeleteCase,
  onEdit,
  selected = false,
  isSelecting = false,
  onToggleSelect,
  role,
}: {
  caseItem: CriminalCaseData;
  handleDeleteCase: (caseId: number) => void;
  onEdit: (caseItem: CriminalCaseData) => void;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (caseId: number, checked: boolean) => void;
  role: Roles;
}) => {
  const router = useAdaptiveNavigation();
  const isAdminOrAtty = role === Roles.ADMIN || role === Roles.ATTY;

  return (
    <tr
      className={`border-b border-base-200/60 transition-colors hover:bg-base-200/30 cursor-pointer text-xs ${
        isSelecting && selected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (isSelecting && isAdminOrAtty) {
          onToggleSelect?.(caseItem.id, !selected);
          return;
        }
        console.log(caseItem);
        router.push(`/user/cases/criminal/${caseItem.id}`);
      }}
    >
      {isAdminOrAtty && isSelecting && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="relative text-center px-4 py-3.5"
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected}
              onChange={(e) => onToggleSelect?.(caseItem.id, e.target.checked)}
              aria-label={`Select case ${caseItem.caseNumber}`}
              onClick={(e) => e.stopPropagation()}
            />
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
      <td className="text-center whitespace-nowrap relative">
        <div
          className="tooltip tooltip-bottom z-50 inline-block"
          role="presentation"
        >
          <div className="tooltip-content z-50">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                Detention
              </span>
              <span className="text-xs font-medium">
                {caseItem.detained && caseItem.detained.trim()
                  ? caseItem.detained
                  : "Released"}
              </span>
            </div>
          </div>
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
  onEdit,
  role,
}: {
  data: CriminalCaseData[];
  handleDeleteCase: (caseId: number) => void;
  onEdit: (caseItem: CriminalCaseData) => void;
  role: Roles;
}) => {
  const [sortConfig, setSortConfig] = useState<CaseSortConfig>({
    key: "dateFiled",
    order: "desc",
  });

  const handleSort = (key: keyof CriminalCaseData) => {
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
    <Table<CriminalCaseData>
      headers={headers}
      data={sorted}
      sortConfig={sortConfig}
      onSort={handleSort}
      renderRow={(item) => (
        <CriminalCaseRow
          key={item.id}
          caseItem={item}
          handleDeleteCase={handleDeleteCase}
          onEdit={onEdit}
          role={role}
        />
      )}
      rowsPerPage={25}
      className="bg-base-300 rounded-lg shadow"
    />
  );
};

export default CriminalCaseRow;
