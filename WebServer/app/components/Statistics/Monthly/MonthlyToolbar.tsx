"use client";

import React from "react";
import {
  FiCheck,
  FiChevronDown,
  FiEdit2,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiX,
} from "react-icons/fi";
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
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
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

      {/* Actions */}
      {isSelecting ? (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-base-content/40 tabular-nums">
            {selectedCount} selected
          </span>
          <button
            className={`btn btn-sm gap-1.5 ${
              selectionMode === "delete" ? "btn-error" : "btn-primary"
            }`}
            onClick={onConfirmSelection}
            disabled={selectedCount === 0}
          >
            <FiCheck className="h-3.5 w-3.5" />
            Apply
          </button>
          <button
            className="btn btn-sm btn-ghost text-base-content/50"
            onClick={onCancelSelection}
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="dropdown dropdown-end">
          <label
            tabIndex={0}
            className="btn btn-sm btn-primary gap-2 text-base-100 "
          >
            <FiSettings className="h-4 w-4" />
            Actions
            <FiChevronDown className="h-3 w-3" />
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-lg z-50 w-40 p-1.5 shadow-xl border border-base-200/80"
          >
            {onStartEdit && (
              <li>
                <button
                  onClick={onStartEdit}
                  className="gap-2.5 text-sm rounded-md"
                >
                  <FiEdit2 className="h-3.5 w-3.5 opacity-60" />
                  Edit rows
                </button>
              </li>
            )}
            {onStartDelete && (
              <li>
                <button
                  onClick={onStartDelete}
                  className="gap-2.5 text-sm rounded-md hover:bg-error/10 hover:text-error"
                >
                  <FiTrash2 className="h-3.5 w-3.5 opacity-60" />
                  Delete rows
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
        {rowCount} row{rowCount !== 1 && "s"}
      </span>
    </div>
  );
};

export default MonthlyToolbar;
