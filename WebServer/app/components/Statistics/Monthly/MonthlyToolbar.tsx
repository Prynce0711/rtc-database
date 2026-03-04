"use client";

import React from "react";
import { FiCheck, FiEdit2, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import type { SelectionMode } from "./MonthlyTable";

interface MonthlyToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: string[];
  rowCount: number;
  selectionMode?: SelectionMode;
  selectedCount?: number;
  onStartEdit?: () => void;
  onStartDelete?: () => void;
  onConfirmSelection?: () => void;
  onCancelSelection?: () => void;
}

const MonthlyToolbar: React.FC<MonthlyToolbarProps> = ({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  rowCount,
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
          placeholder="Search branch, category…"
          className="input input-bordered w-full pl-11"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isSelecting}
        />
      </div>

      <select
        className="select select-bordered"
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
        disabled={isSelecting}
      >
        <option value="all">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Edit / Delete / Confirm / Cancel — right next to filters */}
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

      <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
        {rowCount} row{rowCount !== 1 && "s"}
      </span>
    </div>
  );
};

export default MonthlyToolbar;
