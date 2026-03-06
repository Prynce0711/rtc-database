"use client";

import React from "react";

/**
 * TipCell — a `<td>` wrapper that shows a styled hover tooltip
 * with the column label + full cell value.
 *
 * Usage:
 *   <TipCell label="Case No." value={item.caseNumber} />
 *   <TipCell label="Name" value={item.name} truncate className="font-medium" />
 *   <TipCell label="Status" value={statusText}>
 *     <span className="badge">{statusText}</span>
 *   </TipCell>
 */
const TipCell = ({
  label,
  value,
  className = "",
  truncate = false,
  children,
  clickHint = true,
  onClick,
}: {
  label: string;
  value?: string | number | Date | null;
  className?: string;
  truncate?: boolean;
  children?: React.ReactNode;
  clickHint?: boolean;
  onClick?: () => void;
}) => {
  const display = children ?? (value != null ? String(value) : "");
  const tipText =
    value != null
      ? value instanceof Date
        ? value.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : String(value)
      : "";
  const showTip = tipText.length > 0 && tipText !== "—";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <td
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      className={`relative  text-center whitespace-nowrap group/tip ${truncate ? "max-w-40" : ""} ${onClick ? "cursor-pointer select-none" : ""} ${className}`}
    >
      {truncate ? <span className="block truncate">{display}</span> : display}
      {showTip && (
        <div className="cell-tip">
          <span className="cell-tip-label text-center">{label}</span>
          <span className="cell-tip-value text-center">{tipText}</span>
          {(clickHint || onClick) && (
            <span className="cell-tip-hint text-center">
              (click to view details)
            </span>
          )}
        </div>
      )}
    </td>
  );
};

export default TipCell;
