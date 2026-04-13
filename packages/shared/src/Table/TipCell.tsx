"use client";

import React, { useId, useRef } from "react";

/**
 * TipCell — a `<td>` wrapper that shows a DaisyUI hover tooltip
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
  const rawId = useId();
  const safeId = rawId.replace(/[:]/g, "");
  const popoverId = `tip-popover-${safeId}`;
  const anchorName = `--tip-anchor-${safeId}`;
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const openPopover = () => {
    if (!showTip) return;
    const popoverEl = popoverRef.current as
      | (HTMLDivElement & { showPopover?: () => void })
      | null;
    if (!popoverEl?.showPopover) return;

    try {
      popoverEl.showPopover();
    } catch {
      // Ignore if already open.
    }
  };

  const closePopover = () => {
    const popoverEl = popoverRef.current as
      | (HTMLDivElement & { hidePopover?: () => void })
      | null;
    if (!popoverEl?.hidePopover) return;

    try {
      popoverEl.hidePopover();
    } catch {
      // Ignore if already closed.
    }
  };

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
      onClick={() => {
        onClick?.();
        closePopover();
      }}
      onMouseEnter={openPopover}
      onMouseLeave={closePopover}
      onFocus={openPopover}
      onBlur={closePopover}
      className={`relative text-center whitespace-nowrap ${truncate ? "max-w-40" : ""} ${onClick ? "cursor-pointer select-none" : ""} ${className}`}
    >
      <span
        className="block"
        style={{ anchorName } as React.CSSProperties}
        aria-describedby={showTip ? popoverId : undefined}
      >
        {truncate ? <span className="block truncate">{display}</span> : display}
      </span>

      {showTip && (
        <div
          ref={popoverRef}
          id={popoverId}
          popover="manual"
          role="tooltip"
          className="tip-popover"
          style={
            {
              positionAnchor: anchorName,
            } as React.CSSProperties
          }
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
              {label}
            </span>
            <span className="text-xs font-medium">{tipText}</span>
            {(clickHint || onClick) && (
              <span className="text-[10px] opacity-80">
                (click to view details)
              </span>
            )}
          </div>
        </div>
      )}
    </td>
  );
};

export default TipCell;
