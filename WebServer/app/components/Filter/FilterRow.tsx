"use client";

import React from "react";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckSquare,
  FiHash,
  FiSearch,
  FiTrendingUp,
  FiType,
} from "react-icons/fi";
import { FilterOption, FilterTypeName } from "./FilterTypes";
import Suggestions from "./Suggestions";

interface FilterRowProps {
  option: FilterOption;
  enabled: boolean;
  value: any;
  onToggle: (key: string) => void;
  onChange: (key: string, value: any) => void;
  onInputChange?: (key: string, value: string) => void;
  focused: boolean;
  onFocus: (key: string) => void;
  onBlur: () => void;
  suggestions: string[];
  onSuggestionClick: (key: string, suggestion: string) => void;
  exactMatch?: boolean;
  onExactMatchChange?: (key: string, exactMatch: boolean) => void;
}

const typeIcons: Record<FilterTypeName, React.ReactNode> = {
  text: <FiType className="w-3.5 h-3.5" />,
  number: <FiHash className="w-3.5 h-3.5" />,
  checkbox: <FiCheckSquare className="w-3.5 h-3.5" />,
  range: <FiTrendingUp className="w-3.5 h-3.5" />,
  daterange: <FiCalendar className="w-3.5 h-3.5" />,
};

const FilterRow: React.FC<FilterRowProps> = ({
  option,
  enabled,
  value,
  onToggle,
  onChange,
  onInputChange,
  focused,
  onFocus,
  onBlur,
  suggestions,
  onSuggestionClick,
  exactMatch = true,
  onExactMatchChange,
}) => {
  return (
    <div
      className={[
        "group relative rounded-xl border transition-all duration-200",
        enabled
          ? "border-primary/25 bg-primary/3 shadow-(--shadow-xs)"
          : "border-base-300/60 bg-base-100 hover:border-base-300 hover:shadow-(--shadow-xs)",
      ].join(" ")}
    >
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-3 w-full px-4 py-3 cursor-pointer select-none"
        onClick={() => onToggle(option.key)}
        aria-label={`Toggle ${option.label} filter`}
      >
        <div
          className={[
            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors duration-200",
            enabled
              ? "bg-primary/10 text-primary"
              : "bg-base-200 text-base-content/40 group-hover:text-base-content/60",
          ].join(" ")}
        >
          {typeIcons[option.type]}
        </div>

        <span
          className={[
            "flex-1 text-left text-sm font-semibold tracking-tight transition-colors duration-200",
            enabled ? "text-base-content" : "text-base-content/70",
          ].join(" ")}
        >
          {option.label}
        </span>

        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary pointer-events-none"
          checked={enabled}
          readOnly
          tabIndex={-1}
        />
      </button>

      {/* Expandable content */}
      <div
        className={[
          "grid transition-[grid-template-rows] duration-200 ease-out",
          enabled ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-3">
            {/* Exact / Partial match toggle for text filters */}
            {option.type === "text" && onExactMatchChange && (
              <div className="flex items-center gap-2 rounded-lg bg-base-200/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => onExactMatchChange(option.key, false)}
                  className={[
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                    !exactMatch
                      ? "bg-base-100 text-base-content shadow-(--shadow-xs)"
                      : "text-base-content/50 hover:text-base-content/70",
                  ].join(" ")}
                >
                  Partial
                </button>
                <button
                  type="button"
                  onClick={() => onExactMatchChange(option.key, true)}
                  className={[
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                    exactMatch
                      ? "bg-base-100 text-base-content shadow-(--shadow-xs)"
                      : "text-base-content/50 hover:text-base-content/70",
                  ].join(" ")}
                >
                  Exact
                </button>
              </div>
            )}

            {/* Text input */}
            {option.type === "text" && (
              <div className="relative">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={`Search ${option.label.toLowerCase()}…`}
                    className="input input-bordered input-sm w-full pl-9 bg-base-100 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-shadow"
                    value={(value as string) || ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      onChange(option.key, next);
                      onInputChange?.(option.key, next);
                    }}
                    onFocus={() => onFocus(option.key)}
                    onBlur={onBlur}
                  />
                </div>
                {focused && suggestions.length > 0 && (
                  <Suggestions
                    suggestions={suggestions}
                    onClick={(s) => onSuggestionClick(option.key, s)}
                  />
                )}
              </div>
            )}

            {/* Number input */}
            {option.type === "number" && (
              <input
                type="number"
                placeholder={`Enter ${option.label.toLowerCase()}…`}
                className="input input-bordered input-sm w-full bg-base-100 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-shadow"
                value={(value as number) || ""}
                onChange={(e) =>
                  onChange(
                    option.key,
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            )}

            {/* Checkbox */}
            {option.type === "checkbox" && (
              <label className="flex items-center gap-3 cursor-pointer rounded-lg bg-base-200/40 px-3 py-2.5 hover:bg-base-200/70 transition-colors">
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(option.key, e.target.checked)}
                />
                <span className="text-xs font-medium text-base-content/70">
                  {value ? "Enabled" : "Disabled"}
                </span>
              </label>
            )}

            {/* Numeric range */}
            {option.type === "range" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="input input-bordered input-sm flex-1 bg-base-100 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-shadow"
                  step="0.01"
                  value={((value || {}) as { min?: number }).min ?? ""}
                  onChange={(e) => {
                    const current = (value || {}) as {
                      min?: number;
                      max?: number;
                    };
                    onChange(option.key, {
                      ...current,
                      min: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    });
                  }}
                />
                <FiArrowRight className="w-3.5 h-3.5 text-base-content/30 shrink-0" />
                <input
                  type="number"
                  placeholder="Max"
                  className="input input-bordered input-sm flex-1 bg-base-100 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-shadow"
                  step="0.01"
                  value={((value || {}) as { max?: number }).max ?? ""}
                  onChange={(e) => {
                    const current = (value || {}) as {
                      min?: number;
                      max?: number;
                    };
                    onChange(option.key, {
                      ...current,
                      max: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    });
                  }}
                />
              </div>
            )}

            {/* Date range */}
            {option.type === "daterange" && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-base-content/40 mb-1 block">
                    From
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full bg-base-100 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-shadow"
                    value={((value || {}) as { start?: string }).start || ""}
                    onChange={(e) => {
                      const current = (value || {}) as {
                        start?: string;
                        end?: string;
                      };
                      onChange(option.key, {
                        ...current,
                        start: e.target.value || undefined,
                      });
                    }}
                  />
                </div>
                <FiArrowRight className="w-3.5 h-3.5 text-base-content/30 shrink-0 mt-5" />
                <div className="flex-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-base-content/40 mb-1 block">
                    To
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full bg-base-100 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-shadow"
                    value={((value || {}) as { end?: string }).end || ""}
                    onChange={(e) => {
                      const current = (value || {}) as {
                        start?: string;
                        end?: string;
                      };
                      onChange(option.key, {
                        ...current,
                        end: e.target.value || undefined,
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterRow;
