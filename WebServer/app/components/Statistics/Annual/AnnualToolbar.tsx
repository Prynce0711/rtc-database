"use client";

import React from "react";
import { FiCheck, FiEdit2, FiSearch, FiTrash2, FiX } from "react-icons/fi";

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
  onStartEdit,
  onStartDelete,
  onConfirmSelection,
  onCancelSelection,
}) => {
  const isSelecting = selectionMode != null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" />
        <input
          type="text"
          placeholder={placeholder ?? "Search branch, category…"}
          className="input input-bordered w-full pl-11"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isSelecting}
        />
      </div>

      {/* Edit / Delete / Confirm / Cancel — right next to search */}
      {isSelecting ? (
        <>
          <span className="text-sm font-semibold text-base-content/70">
            {selectedCount} selected
          </span>
          <button
            className={`btn btn-md gap-1.5 ${
              selectionMode === "delete" ? "btn-error" : "btn-info"
            }`}
            onClick={onConfirmSelection}
            disabled={selectedCount === 0}
          >
            <FiCheck className="h-5 w-5" />
            Confirm
          </button>
          <button
            className="btn btn-ghost btn-md gap-1.5"
            onClick={onCancelSelection}
          >
            <FiX className="h-5 w-5" />
            Cancel
          </button>
        </>
      ) : (
        <>
          {onStartEdit && (
            <button
              className="btn btn-outline btn-info btn-md gap-1.5"
              onClick={onStartEdit}
            >
              <FiEdit2 className="h-5 w-5" />
              Edit
            </button>
          )}
          {onStartDelete && (
            <button
              className="btn btn-outline btn-error btn-md gap-1.5"
              onClick={onStartDelete}
            >
              <FiTrash2 className="h-5 w-5" />
              Delete
            </button>
          )}
        </>
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
