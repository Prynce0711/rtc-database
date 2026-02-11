"use client";

import React from "react";
import { FilterOption } from "./FilterTypes";
import Suggestions from "./Suggestions";

interface FilterRowProps {
  option: FilterOption;
  enabled: boolean;
  value: any;
  onToggle: (key: string) => void;
  onChange: (key: string, value: any) => void;
  focused: boolean;
  onFocus: (key: string) => void;
  onBlur: () => void;
  suggestions: string[];
  onSuggestionClick: (key: string, suggestion: string) => void;
}

const FilterRow: React.FC<FilterRowProps> = ({
  option,
  enabled,
  value,
  onToggle,
  onChange,
  focused,
  onFocus,
  onBlur,
  suggestions,
  onSuggestionClick,
}) => {
  return (
    <div className="py-3 border-b border-base-300 hover:bg-base-200/40 transition-colors rounded-lg px-2">
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          className="checkbox checkbox-md mt-1"
          checked={enabled}
          onChange={() => onToggle(option.key)}
          aria-label={`Toggle ${option.label}`}
        />
        <div className="flex-1">
          <label className="font-semibold text-lg text-base-content/90 cursor-pointer">
            {option.label}
          </label>

          {enabled && (
            <div className="mt-3">
              {option.type === "text" && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Enter ${option.label.toLowerCase()}...`}
                    className="input input-bordered w-full"
                    value={(value as string) || ""}
                    onChange={(e) => onChange(option.key, e.target.value)}
                    onFocus={() => onFocus(option.key)}
                    onBlur={onBlur}
                  />
                  {focused && suggestions.length > 0 && (
                    <Suggestions
                      suggestions={suggestions}
                      onClick={(s) => onSuggestionClick(option.key, s)}
                    />
                  )}
                </div>
              )}

              {option.type === "number" && (
                <input
                  type="number"
                  placeholder={`Enter ${option.label.toLowerCase()}...`}
                  className="input input-bordered w-full"
                  value={(value as number) || ""}
                  onChange={(e) =>
                    onChange(
                      option.key,
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              )}

              {option.type === "checkbox" && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChange(option.key, e.target.checked)}
                  />
                  <span className="text-sm">{option.label}</span>
                </div>
              )}

              {option.type === "range" && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min amount"
                    className="input input-bordered flex-1"
                    step="0.01"
                    value={((value || {}) as { min?: number }).min || ""}
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
                  <input
                    type="number"
                    placeholder="Max amount"
                    className="input input-bordered flex-1"
                    step="0.01"
                    value={((value || {}) as { max?: number }).max || ""}
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

              {option.type === "daterange" && (
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="input input-bordered input-sm flex-1"
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
                  <input
                    type="date"
                    className="input input-bordered input-sm flex-1"
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterRow;
