"use client";

import { ColumnDef } from "./AnnualColumnDef";
import type { AnnualSelectionMode } from "./AnnualToolbar";

interface AnnualRowProps {
  row: Record<string, unknown>;
  leafColumns: ColumnDef[];
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  even?: boolean;
  selectionMode?: AnnualSelectionMode;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const AnnualRow = ({
  row,
  leafColumns,
  even = true,
  selectionMode,
  isSelected,
  onToggleSelect,
}: AnnualRowProps) => {
  const isSelecting = selectionMode != null;

  return (
    <tr
      className={`transition-colors duration-100 hover:bg-primary/5 text-sm ${
        even ? "bg-base-100" : "bg-base-200/25"
      }${isSelecting && isSelected ? (selectionMode === "delete" ? " !bg-error/10" : " !bg-info/10") : ""}`}
      onClick={isSelecting ? onToggleSelect : undefined}
      style={isSelecting ? { cursor: "pointer" } : undefined}
    >
      {isSelecting && (
        <td className="px-2 py-3 text-center">
          <input
            type="checkbox"
            className={`checkbox checkbox-sm ${selectionMode === "delete" ? "checkbox-error" : "checkbox-info"}`}
            checked={!!isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
      )}
      {leafColumns.map((col) => (
        <td
          key={col.key}
          className={`px-5 py-3 tabular-nums ${
            col.align === "center"
              ? "text-center"
              : col.align === "right"
                ? "text-right"
                : ""
          }`}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
};

export default AnnualRow;
