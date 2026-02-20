"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiSliders, FiX } from "react-icons/fi";
import FilterRow from "./FilterRow";
import { FilterModalProps, FilterValues } from "./FilterTypes";

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  options,
  onApply,
  initialValues,
  getSuggestions,
}) => {
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterValues>({});
  const [focusedFilter, setFocusedFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

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
    next.has(key) ? next.delete(key) : next.add(key);
    setEnabledFilters(next);
  };

  const handleFilterChange = (key: string, value: any) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

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
    onApply(active);
    onClose();
  };

  const activeCount = enabledFilters.size;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          className="absolute top-full mt-2 left-0 right-0 w-full bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 overflow-hidden"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
            <div className="flex items-center gap-3">
              <FiSliders className="w-5 h-5 text-primary" />
              <span className="font-bold text-base">Advanced Filters</span>
              {activeCount > 0 && (
                <span className="badge badge-primary badge-sm">
                  {activeCount} active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  className="btn btn-ghost btn-xs gap-1 text-error"
                  onClick={resetFilters}
                >
                  <FiX className="w-3 h-3" />
                  Reset all
                </button>
              )}

              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={onClose}
              >
                <FiChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {options.map((option) => (
                <FilterRow
                  key={option.key}
                  option={option}
                  enabled={enabledFilters.has(option.key)}
                  value={filters[option.key]}
                  onToggle={toggleFilter}
                  onChange={handleFilterChange}
                  focused={focusedFilter === option.key}
                  onFocus={(k) => {
                    setFocusedFilter(k);
                    if (getSuggestions) {
                      const sugs =
                        getSuggestions(k, (filters[k] as string) || "") || [];
                      setSuggestions(sugs.slice(0, 8));
                    }
                  }}
                  onBlur={() => setTimeout(() => setFocusedFilter(null), 200)}
                  suggestions={focusedFilter === option.key ? suggestions : []}
                  onSuggestionClick={handleSuggestionClick}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-200/50">
            <span className="text-sm text-base-content/50">
              {activeCount === 0
                ? "Select filters above to narrow results"
                : `${activeCount} filter${activeCount > 1 ? "s" : ""} will be applied`}
            </span>

            <div className="flex gap-3">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={applyFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FilterModal;
