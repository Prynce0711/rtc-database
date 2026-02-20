"use client";

import React, { useEffect, useState } from "react";
import ModalBase from "../Popup/ModalBase";
import FilterRow from "./FilterRow";
import { FilterModalProps, FilterValues } from "./FilterTypes";

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  options,
  onApply,
  initialValues,
  getSuggestions,
  requestClose,
  initialExactMatchMap,
}) => {
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterValues>({});
  const [focusedFilter, setFocusedFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [exactMatchMap, setExactMatchMap] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (isOpen) {
      const initial = initialValues || {};
      setFilters(initial);
      setEnabledFilters(new Set(Object.keys(initial)));
      setExactMatchMap(initialExactMatchMap || {});
    }
  }, [isOpen, initialValues, initialExactMatchMap]);

  const toggleFilter = (key: string) => {
    const next = new Set(enabledFilters);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      // Set default exact match to true for text filters
      const option = options.find((o) => o.key === key);
      if (option?.type === "text" && exactMatchMap[key] === undefined) {
        setExactMatchMap((prev) => ({ ...prev, [key]: true }));
      }
    }
    setEnabledFilters(next);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Update suggestions for text inputs
    const option = options.find((opt) => opt.key === key);
    if (
      option?.type === "text" &&
      getSuggestions &&
      typeof value === "string"
    ) {
      setFocusedFilter(key);
      const sugs = getSuggestions(key, value || "") || [];
      setSuggestions(sugs.slice(0, 8));
    }
  };

  const handleSuggestionClick = (key: string, suggestion: string) => {
    handleFilterChange(key, suggestion);
    setFocusedFilter(null);
    setSuggestions([]);
  };

  const resetFilters = () => {
    setEnabledFilters(new Set());
    setFilters({});
    setExactMatchMap({});
  };

  const applyFilters = () => {
    const active: FilterValues = {};

    enabledFilters.forEach((key) => {
      const value = filters[key];
      if (value === undefined || value === null) return;
      if (typeof value === "string" && value.trim() === "") return;
      if (typeof value === "object") {
        if (Array.isArray(value) && value.length === 0) return;
        if (!Array.isArray(value) && Object.keys(value).length === 0) return;
      }
      active[key] = value;
    });

    onApply(active, exactMatchMap);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalBase onClose={onClose}>
      <div className="bg-base-100 rounded-2xl shadow-2xl w-[90vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header Section */}
        <div className="bg-liner-to-r from-primary to-primary-focus text-base-content px-8 py-6 flex justify-between items-center">
          <h3 className="text-3xl font-extrabold tracking-tight">
            Advanced Search
          </h3>
          <button
            onClick={() => (requestClose ? requestClose() : onClose())}
            className="btn btn-circle btn-ghost hover:bg-primary-focus"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content Section - Scrollable */}
        <div className="overflow-y-auto flex-1 px-8 py-6">
          <div className="space-y-3">
            {options.map((option) => (
              <FilterRow
                key={option.key}
                option={option}
                enabled={enabledFilters.has(option.key)}
                value={filters[option.key]}
                onToggle={(k) => toggleFilter(k)}
                onChange={handleFilterChange}
                focused={focusedFilter === option.key}
                onFocus={(k) => {
                  setFocusedFilter(k);
                  if (getSuggestions) {
                    const currentValue = (filters[k] as string) || "";
                    const sugs = getSuggestions(k, currentValue) || [];
                    setSuggestions(sugs.slice(0, 8));
                  }
                }}
                onBlur={() => setTimeout(() => setFocusedFilter(null), 200)}
                suggestions={focusedFilter === option.key ? suggestions : []}
                onSuggestionClick={handleSuggestionClick}
                exactMatch={exactMatchMap[option.key] ?? true}
                onExactMatchChange={(key, exact) =>
                  setExactMatchMap((prev) => ({ ...prev, [key]: exact }))
                }
              />
            ))}
          </div>
        </div>

        {/* Footer Section */}
        <div className="bg-base-200 px-8 py-4 flex justify-between items-center border-t border-base-300">
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
            Reset
          </button>
          <div className="flex gap-3">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => (requestClose ? requestClose() : onClose())}
            >
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default FilterModal;
