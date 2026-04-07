"use client";

import React from "react";

export interface MultiSelectPopoverOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectPopoverDropdownProps {
  popoverId: string;
  anchorName: string;
  summary: string;
  options: MultiSelectPopoverOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  emptyLabel?: string;
  actionLabel?: string;
}

const MultiSelectPopoverDropdown = ({
  popoverId,
  anchorName,
  summary,
  options,
  selectedValues,
  onToggle,
  emptyLabel,
  actionLabel = "Select",
}: MultiSelectPopoverDropdownProps) => {
  return (
    <div className="w-full">
      <button
        type="button"
        className="btn btn-outline btn-sm sm:btn-md w-full justify-between normal-case font-normal"
        popoverTarget={popoverId}
        style={{ anchorName } as React.CSSProperties}
        aria-label={actionLabel}
      >
        <span className="truncate">{summary}</span>
        <span className="text-xs text-base-content/45">{actionLabel}</span>
      </button>
      <ul
        popover="auto"
        id={popoverId}
        className="dropdown menu p-2 rounded-xl border border-base-300 bg-base-100 shadow-lg"
        style={
          {
            positionAnchor: anchorName,
            inset: "auto",
            top: "anchor(bottom)",
            left: "anchor(start)",
            marginTop: "0.25rem",
            width: "anchor-size(width)",
            maxHeight: "20rem",
            overflowY: "auto",
            zIndex: 9999,
          } as React.CSSProperties
        }
      >
        {options.length === 0 ? (
          <li className="px-2 py-2 text-sm text-base-content/45">
            {emptyLabel ?? "No options available."}
          </li>
        ) : (
          options.map((option) => (
            <li key={option.value}>
              <label className="flex items-start gap-3 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-base-200/60">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-0.5"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-base-content">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block text-xs text-base-content/45">
                      {option.description}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default MultiSelectPopoverDropdown;
