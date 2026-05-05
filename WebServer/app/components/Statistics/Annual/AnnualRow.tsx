"use client";

import { useState } from "react";
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
  rowIndex?: number;
}

const AnnualRow = ({
  row,
  leafColumns,
  even = true,
  selectionMode,
  isSelected,
  onToggleSelect,
  rowIndex = 99,
}: AnnualRowProps) => {
  const isSelecting = selectionMode != null;
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

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
      {leafColumns.map((col) => {
        const rendered = col.render(row);
        const isHovered = hoveredCol === col.key;

        return (
          <td
            key={col.key}
            className={`px-5 py-3 tabular-nums relative overflow-hidden ${
              col.align === "center"
                ? "text-center"
                : col.align === "right"
                  ? "text-right"
                  : ""
            }`}
            onMouseEnter={() => !isSelecting && setHoveredCol(col.key)}
            onMouseLeave={() => setHoveredCol(null)}
          >
            <span className="block truncate">{rendered}</span>

            {/* ── Hover tooltip ── */}
            {isHovered &&
              !isSelecting &&
              (() => {
                const above = rowIndex > 0;
                return above ? (
                  <div className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[min(220px,70vw)]">
                    <div className="rounded-lg shadow-xl px-3 py-2.5 text-left bg-base-100 border border-base-300">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-0.5 truncate">
                        {col.label}
                      </p>
                      <p className="text-sm font-semibold text-base-content break-words leading-snug">
                        {rendered ?? "—"}
                      </p>
                      <p className="text-[11px] text-base-content/40 mt-1">
                        click to view details
                      </p>
                    </div>
                    {/* Arrow pointing down */}
                    <div
                      className="mx-auto w-0 h-0"
                      style={{
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop:
                          "6px solid var(--fallback-b1,oklch(var(--b1)))",
                      }}
                    />
                  </div>
                ) : (
                  <div className="pointer-events-none absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[min(220px,70vw)]">
                    {/* Arrow pointing up */}
                    <div
                      className="mx-auto w-0 h-0"
                      style={{
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderBottom:
                          "6px solid var(--fallback-b1,oklch(var(--b1)))",
                      }}
                    />
                    <div className="rounded-lg shadow-xl px-3 py-2.5 text-left bg-base-100 border border-base-300">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-0.5 truncate">
                        {col.label}
                      </p>
                      <p className="text-sm font-semibold text-base-content break-words leading-snug">
                        {rendered ?? "—"}
                      </p>
                      <p className="text-[11px] text-base-content/40 mt-1">
                        click to view details
                      </p>
                    </div>
                  </div>
                );
              })()}
          </td>
        );
      })}
    </tr>
  );
};

export default AnnualRow;
