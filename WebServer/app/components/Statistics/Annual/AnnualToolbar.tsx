"use client";

import React from "react";
import { FiCheck, FiSearch, FiX } from "react-icons/fi";

export type AnnualSelectionMode = "edit" | "delete" | null;

interface AnnualToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  rowCount: number;
  placeholder?: string;
  children?: React.ReactNode;
  selectionMode?: AnnualSelectionMode;
  selectedCount?: number;
  onStartEdit?: () => void;
  onStartDelete?: () => void;
  onConfirmSelection?: () => void;
  onCancelSelection?: () => void;
}

const AnnualToolbar: React.FC<AnnualToolbarProps> = ({
  search,
  onSearchChange,
  rowCount,
  placeholder,
  children,
  selectionMode,
  selectedCount = 0,
  onConfirmSelection,
  onCancelSelection,
}) => {
  const isSelecting = selectionMode != null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
        <input
          type="text"
          placeholder={placeholder ?? "Search branch, category…"}
          className="input input-bordered w-full pl-11"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isSelecting}
        />
      </div>

      {/* Actions */}
      {isSelecting && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-base-content/40 tabular-nums">
            {selectedCount} selected
          </span>
          <button
            className={`btn btn-md gap-2 ${
              selectionMode === "delete" ? "btn-error" : "btn-primary"
            }`}
            onClick={onConfirmSelection}
            disabled={selectedCount === 0}
          >
            <FiCheck className="h-4 w-4" />
            Apply
          </button>
          <button
            className="btn btn-md btn-ghost text-base-content/50"
            onClick={onCancelSelection}
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {children}
        <span className="text-sm text-base-content/50 tabular-nums font-medium">
          {rowCount} row{rowCount !== 1 && "s"}
        </span>
      </div>
    </div>
  );
};

export default AnnualToolbar;
