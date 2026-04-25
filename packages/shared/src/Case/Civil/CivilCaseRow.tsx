"use client";

import { TipCell } from "../../index";
import type { CivilCaseData } from "./CivilCaseSchema";

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const CivilCaseRow = ({
  caseItem,
  onView,
  selected = false,
  isSelecting = false,
  onToggleSelect,
}: {
  caseItem: CivilCaseData;
  onView: (c: CivilCaseData) => void;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
}) => {
  return (
    <tr
      className={`border-b border-base-200/60 transition-colors hover:bg-base-200/30 cursor-pointer text-sm ${
        isSelecting && selected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (isSelecting) {
          onToggleSelect?.(caseItem.id, !selected);
          return;
        }
        onView(caseItem);
      }}
    >
      {isSelecting && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="px-4 py-3.5 text-center"
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
      <TipCell
        label="Case Number"
        value={
          caseItem.caseNumber?.toLowerCase().includes("undocketed")
            ? "UNDOCKETED"
            : caseItem.caseNumber
        }
        className="font-semibold"
      />
      <TipCell label="Branch" value={caseItem.branch} />
      <TipCell label="Petitioner/s" value={caseItem.petitioners} truncate />
      <TipCell label="Defendant/s" value={caseItem.defendants} truncate />
      <TipCell
        label="Date Filed"
        value={formatDate(caseItem.dateFiled)}
        className="text-base-content/70"
      />
      <TipCell label="Notes/Appealed" value={caseItem.notes} />
      <TipCell label="Nature of Petition" value={caseItem.nature} />
    </tr>
  );
};

export default CivilCaseRow;
