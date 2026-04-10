"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiSliders, FiX } from "react-icons/fi";
import FilterRow from "./FilterRow";
import { ExactMatchMap, FilterModalProps, FilterValues } from "./FilterTypes";

export const FILTERS_SEARCH_PARAM_KEY = "filters";
export const EXACT_MATCH_SEARCH_PARAM_KEY = "exactMatchMap";

export const getFilterStateFromSearchParams = (
  searchParams: Pick<URLSearchParams, "get">,
): { filters: FilterValues; exactMatchMap: ExactMatchMap } => {
  const parseObjectParam = (key: string): Record<string, unknown> => {
    const raw = searchParams.get(key);
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  };

  const filters = parseObjectParam(FILTERS_SEARCH_PARAM_KEY) as FilterValues;
  const exactRaw = parseObjectParam(EXACT_MATCH_SEARCH_PARAM_KEY);
  const exactMatchMap = Object.entries(exactRaw).reduce<ExactMatchMap>(
    (acc, [key, value]) => {
      acc[key] = Boolean(value);
      return acc;
    },
    {},
  );

  return { filters, exactMatchMap };
};

const FilterDropdown: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  options,
  onApply,
  searchValue,
  getSuggestions,
}) => {
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterValues>({});
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});
  const [focusedFilter, setFocusedFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Debug log
  useEffect(() => {
    console.log("FilterDropdown isOpen changed:", isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const { filters: initialFilters, exactMatchMap: initialExactMatchMap } =
        getFilterStateFromSearchParams(searchParams);
      setFilters(initialFilters);
      setEnabledFilters(new Set(Object.keys(initialFilters)));
      setExactMatchMap(initialExactMatchMap);
    }
  }, [isOpen, searchParams]);

  useEffect(() => {
    if (!searchValue) return;

    setFilters((prev) => {
      const next = { ...prev };

      Object.entries(searchValue).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          delete next[key];
          return;
        }

        if (typeof value === "string" && value.trim() === "") {
          delete next[key];
          return;
        }

        next[key] = value;
      });

      return next;
    });

    setEnabledFilters((prev) => {
      const next = new Set(prev);

      Object.entries(searchValue).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim() === "")
        ) {
          next.delete(key);
          return;
        }

        next.add(key);
      });

      return next;
    });
  }, [searchValue]);

  const toggleFilter = (key: string) => {
    const next = new Set(enabledFilters);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      // Default text filters to partial match when first enabled
      const filterOption = options.find((opt) => opt.key === key);
      if (filterOption?.type === "text" && exactMatchMap[key] === undefined) {
        setExactMatchMap((prev) => ({ ...prev, [key]: false }));
      }
    }
    setEnabledFilters(next);
  };

  const handleFilterChange = (key: string, value: any) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleSuggestionClick = (key: string, suggestion: string) => {
    handleFilterChange(key, suggestion);
    setFocusedFilter(null);
    setSuggestions([]);
  };

  useEffect(() => {
    if (!focusedFilter || !getSuggestions) return;

    const value = (filters[focusedFilter] as string) ?? "";

    const id = setTimeout(() => {
      Promise.resolve(getSuggestions(focusedFilter, value))
        .then((sugs) => setSuggestions((sugs || []).slice(0, 8)))
        .catch(() => setSuggestions([]));
    }, 200); // debounce

    return () => clearTimeout(id);
  }, [focusedFilter, filters, getSuggestions]);

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

    const activeExactMatchMap = Object.entries(
      exactMatchMap,
    ).reduce<ExactMatchMap>((acc, [key, value]) => {
      if (active[key] !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const params = new URLSearchParams(searchParams.toString());
    if (Object.keys(active).length > 0) {
      params.set(FILTERS_SEARCH_PARAM_KEY, JSON.stringify(active));
    } else {
      params.delete(FILTERS_SEARCH_PARAM_KEY);
    }

    if (Object.keys(activeExactMatchMap).length > 0) {
      params.set(
        EXACT_MATCH_SEARCH_PARAM_KEY,
        JSON.stringify(activeExactMatchMap),
      );
    } else {
      params.delete(EXACT_MATCH_SEARCH_PARAM_KEY);
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });

    onApply(active, activeExactMatchMap);
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
                  onInputChange={(k, v) => {
                    setFocusedFilter(k);
                    handleFilterChange(k, v);
                  }}
                  focused={focusedFilter === option.key}
                  onFocus={(k) => {
                    setFocusedFilter(k);
                  }}
                  onBlur={() => setTimeout(() => setFocusedFilter(null), 200)}
                  suggestions={focusedFilter === option.key ? suggestions : []}
                  onSuggestionClick={handleSuggestionClick}
                  exactMatch={exactMatchMap[option.key] ?? false}
                  onExactMatchChange={(key, exact) =>
                    setExactMatchMap((prev) => ({ ...prev, [key]: exact }))
                  }
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

export default FilterDropdown;
