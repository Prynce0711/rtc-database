"use client";

import { TipCell } from "../../index";
import type { PetitionCaseData } from "./PetitionCaseSchema";

const PetitionCaseRow = ({
  caseItem,
  onView,
  selected = false,
  isSelecting = false,
  onToggleSelect,
  canManage,
}: {
  caseItem: PetitionCaseData;
  onView?: (item: PetitionCaseData) => void;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
  canManage: boolean;
}) => {
  const isClickable = typeof onView === "function";
  const dateStr = caseItem.date
    ? new Date(caseItem.date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <tr
      className={`bg-base-100 hover:bg-base-200 transition-colors ${isClickable ? "cursor-pointer" : ""} text-sm ${
        isSelecting && selected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (canManage && isSelecting && onToggleSelect) {
          onToggleSelect(caseItem.id, !selected);
          return;
        }
        onView?.(caseItem);
      }}
    >
      {canManage && isSelecting && (
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
              aria-label={`Select petition case ${caseItem.caseNumber}`}
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
      <TipCell label="Branch" value={caseItem.raffledTo ?? "—"} />
      <TipCell label="Date" value={dateStr} className="text-base-content/70" />
      <TipCell
        label="Petitioner"
        value={caseItem.petitioner ?? "—"}
        truncate
        className="font-medium"
      />
      <TipCell label="Nature" value={caseItem.nature ?? "—"} truncate />
    </tr>
  );
};

export default PetitionCaseRow;
