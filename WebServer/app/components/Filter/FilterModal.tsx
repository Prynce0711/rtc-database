"use client";

import React, { useEffect, useState } from "react";

export type FilterTypeName =
  | "text"
  | "number"
  | "checkbox"
  | "range"
  | "daterange";

export interface FilterOption {
  key: string;
  label: string;
  type: FilterTypeName;
}

export type FilterValues = Record<string, any>;

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOption[];
  onApply: (filters: FilterValues) => void;
  initialValues?: FilterValues;
  getSuggestions?: (key: string, inputValue: string) => string[];
}

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

  useEffect(() => {
    if (isOpen) {
      const initial = initialValues || {};
      setFilters(initial);
      setEnabledFilters(new Set(Object.keys(initial)));
    }
  }, [isOpen, initialValues]);

  const toggleFilter = (key: string) => {
    const next = new Set(enabledFilters);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setEnabledFilters(next);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTextInputChange = (key: string, value: string) => {
    handleFilterChange(key, value);
    setFocusedFilter(key);

    if (!getSuggestions) {
      setSuggestions([]);
      return;
    }

    if (value.length > 0) {
      const sugs = getSuggestions(key, value) || [];
      setSuggestions(sugs.slice(0, 8));
    } else {
      const sugs = getSuggestions(key, "") || [];
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

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">Advanced Search</h3>

        <div className="space-y-4">
          {options.map((option) => (
            <div key={option.key} className="border-b pb-4">
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={enabledFilters.has(option.key)}
                  onChange={() => toggleFilter(option.key)}
                />
                <label className="label-text font-medium">{option.label}</label>
              </div>

              {enabledFilters.has(option.key) && (
                <div className="ml-6">
                  {option.type === "text" && (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`Enter ${option.label.toLowerCase()}...`}
                        className="input input-bordered input-sm w-full"
                        value={(filters[option.key] as string) || ""}
                        onChange={(e) =>
                          handleTextInputChange(option.key, e.target.value)
                        }
                        onFocus={() => {
                          setFocusedFilter(option.key);
                          if (getSuggestions) {
                            const currentValue =
                              (filters[option.key] as string) || "";
                            const sugs =
                              getSuggestions(option.key, currentValue) || [];
                            setSuggestions(sugs.slice(0, 8));
                          }
                        }}
                        onBlur={() =>
                          setTimeout(() => setFocusedFilter(null), 200)
                        }
                      />
                      {focusedFilter === option.key &&
                        suggestions.length > 0 && (
                          <div className="absolute z-10 w-full bg-base-100 border border-base-300 rounded mt-1 shadow-lg">
                            {suggestions.map((suggestion, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
                                onClick={() =>
                                  handleSuggestionClick(option.key, suggestion)
                                }
                              >
                                {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}

                  {option.type === "number" && (
                    <input
                      type="number"
                      placeholder={`Enter ${option.label.toLowerCase()}...`}
                      className="input input-bordered input-sm w-full"
                      value={(filters[option.key] as number) || ""}
                      onChange={(e) =>
                        handleFilterChange(
                          option.key,
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  )}

                  {option.type === "checkbox" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={Boolean(filters[option.key])}
                        onChange={(e) =>
                          handleFilterChange(option.key, e.target.checked)
                        }
                      />
                      <span className="text-sm">{option.label}</span>
                    </div>
                  )}

                  {option.type === "range" && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min amount"
                        className="input input-bordered input-sm flex-1"
                        step="0.01"
                        value={
                          (
                            (filters[option.key] || {}) as {
                              min?: number;
                            }
                          ).min || ""
                        }
                        onChange={(e) => {
                          const current = (filters[option.key] || {}) as {
                            min?: number;
                            max?: number;
                          };
                          handleFilterChange(option.key, {
                            ...current,
                            min: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          });
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Max amount"
                        className="input input-bordered input-sm flex-1"
                        step="0.01"
                        value={
                          (
                            (filters[option.key] || {}) as {
                              max?: number;
                            }
                          ).max || ""
                        }
                        onChange={(e) => {
                          const current = (filters[option.key] || {}) as {
                            min?: number;
                            max?: number;
                          };
                          handleFilterChange(option.key, {
                            ...current,
                            max: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          });
                        }}
                      />
                    </div>
                  )}

                  {option.type === "daterange" && (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1"
                        value={
                          (
                            (filters[option.key] || {}) as {
                              start?: string;
                            }
                          ).start || ""
                        }
                        onChange={(e) => {
                          const current = (filters[option.key] || {}) as {
                            start?: string;
                            end?: string;
                          };
                          handleFilterChange(option.key, {
                            ...current,
                            start: e.target.value || undefined,
                          });
                        }}
                      />
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1"
                        value={
                          (
                            (filters[option.key] || {}) as {
                              end?: string;
                            }
                          ).end || ""
                        }
                        onChange={(e) => {
                          const current = (filters[option.key] || {}) as {
                            start?: string;
                            end?: string;
                          };
                          handleFilterChange(option.key, {
                            ...current,
                            end: e.target.value || undefined,
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="modal-action gap-2 mt-6">
          <button className="btn btn-sm" onClick={resetFilters}>
            Reset
          </button>
          <button className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-sm btn-primary" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
};

export default FilterModal;
