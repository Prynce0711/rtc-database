"use client";

import React from "react";
import { FiSearch } from "react-icons/fi";

interface MonthlyToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: string[];
  rowCount: number;
}

const MonthlyToolbar: React.FC<MonthlyToolbarProps> = ({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  rowCount,
}) => {
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
        />
      </div>

      <select
        className="select select-bordered"
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
      >
        <option value="all">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
        {rowCount} row{rowCount !== 1 && "s"}
      </span>
    </div>
  );
};

export default MonthlyToolbar;
