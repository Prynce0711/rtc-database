"use client";

import { SheriffCaseData, TipCell } from "@rtc-database/shared";

const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const SherriffCaseRow = ({
  record,
  onRowClick,
  selected = false,
  isSelecting = false,
  onToggleSelect,
}: {
  record: SheriffCaseData;
  onRowClick?: (r: SheriffCaseData) => void;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: (id: number, checked: boolean) => void;
}) => {
  const isClickable = typeof onRowClick === "function";
  return (
    <tr
      className={`bg-base-100 hover:bg-base-200 transition-colors ${isClickable ? "cursor-pointer" : ""} text-sm ${
        isSelecting && selected ? "bg-primary/10" : ""
      }`}
      onClick={() => {
        if (isSelecting) {
          onToggleSelect?.(record.id, !selected);
          return;
        }
        onRowClick?.(record);
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
              checked={selected}
              onChange={(e) => onToggleSelect?.(record.id, e.target.checked)}
              aria-label={`Select sheriff case ${record.caseNumber}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      )}

      <TipCell
        label="Case Number"
        value={record.caseNumber}
        truncate
        className="font-semibold"
      />
      <TipCell label="Sheriff Name" value={record.sheriffName} truncate />
      <TipCell label="Mortgagee" value={record.mortgagee} truncate />
      <TipCell label="Mortgagor" value={record.mortgagor} truncate />
      <TipCell
        label="Date Filed"
        value={formatDate(record.dateFiled)}
        className="text-base-content/70"
      />
      <TipCell label="Remarks" value={record.remarks} />
    </tr>
  );
};

export default SherriffCaseRow;
