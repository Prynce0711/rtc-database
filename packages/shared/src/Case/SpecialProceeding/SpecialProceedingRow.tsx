"use client";

import { SpecialProceedingData, TipCell } from "../../index";

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const SpecialProceedingRow = ({
  caseItem,
  onRowClick,
  isSelected,
  isSelecting = false,
  onToggleSelect,
}: {
  caseItem: SpecialProceedingData;
  onRowClick: (c: SpecialProceedingData) => void;
  isSelected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
}) => {
  return (
    <tr
      className={`bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-xs ${
        isSelecting && isSelected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (isSelecting && onToggleSelect) {
          onToggleSelect(caseItem.id, !Boolean(isSelected));
          return;
        }
        onRowClick(caseItem);
      }}
    >
      {isSelecting && (
        <td
          onClick={(e) => e.stopPropagation()}
          className="relative text-center px-4 py-3.5"
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={Boolean(isSelected)}
              onChange={(e) => onToggleSelect?.(caseItem.id, e.target.checked)}
              aria-label={`Select special proceeding case ${caseItem.caseNumber}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      )}

      <TipCell
        label="SPC. No."
        value={caseItem.caseNumber}
        className="font-semibold"
      />
      <TipCell label="Raffled To" value={caseItem.raffledTo} />
      <TipCell
        label="Date Filed"
        value={formatDate(caseItem.date)}
        className="text-base-content/70"
      />
      <TipCell
        label="Petitioner"
        value={caseItem.petitioner}
        truncate
        className="font-medium"
      />
      <TipCell label="Nature" value={caseItem.nature} truncate />
      <TipCell label="Respondent" value={caseItem.respondent} truncate />
    </tr>
  );
};

export default SpecialProceedingRow;
