"use client";

import React, { useState } from "react";
import type { Case } from "../../generated/prisma/client";

export interface CaseFilters {
  branch?: string;
  assistantBranch?: string;
  caseNumber?: string;
  name?: string;
  charge?: string;
  infoSheet?: string;
  court?: string;
  detained?: boolean;
  consolidation?: string;
  eqcNumber?: number;
  bond?: { min?: number; max?: number };
  raffleDate?: { start?: string; end?: string };
  dateFiled?: { start?: string; end?: string };
}

interface CaseFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: CaseFilterFilters, cases: Case[]) => void;
  cases: Case[];
}

export type CaseFilterFilters = Omit<
  CaseFilters,
  "bond" | "raffleDate" | "dateFiled"
> & {
  bond?: { min?: number; max?: number };
  raffleDate?: { start?: string; end?: string };
  dateFiled?: { start?: string; end?: string };
};

const CaseFilterModal: React.FC<CaseFilterModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  cases,
}) => {
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<CaseFilterFilters>({});
  const [focusedFilter, setFocusedFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const filterOptions = [
    { key: "branch", label: "Branch", type: "text" },
    { key: "assistantBranch", label: "Assistant Branch", type: "text" },
    { key: "caseNumber", label: "Case Number", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "charge", label: "Charge", type: "text" },
    { key: "infoSheet", label: "Info Sheet", type: "text" },
    { key: "court", label: "Court", type: "text" },
    { key: "consolidation", label: "Consolidation", type: "text" },
    { key: "eqcNumber", label: "EQC Number", type: "number" },
    { key: "detained", label: "Detained", type: "checkbox" },
    { key: "bond", label: "Bond Amount", type: "range" },
    { key: "dateFiled", label: "Date Filed", type: "daterange" },
    { key: "raffleDate", label: "Raffle Date", type: "daterange" },
  ];

  const toggleFilter = (key: string) => {
    const newEnabled = new Set(enabledFilters);
    if (newEnabled.has(key)) {
      newEnabled.delete(key);
      setFilters((prev) => {
        const updated = { ...prev };
        delete updated[key as keyof CaseFilterFilters];
        return updated;
      });
    } else {
      newEnabled.add(key);
    }
    setEnabledFilters(newEnabled);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getUniqueSuggestions = (key: string): string[] => {
    const textFields = [
      "branch",
      "assistantBranch",
      "caseNumber",
      "name",
      "charge",
      "infoSheet",
      "court",
      "consolidation",
    ];

    if (!textFields.includes(key)) return [];

    const values = cases
      .map((c) => (c[key as keyof Case] as string)?.toString())
      .filter((v) => v && v.length > 0);

    const uniqueValues = Array.from(new Set(values)).sort();
    return uniqueValues;
  };

  const filterSuggestions = (key: string, inputValue: string): string[] => {
    if (!inputValue) return getUniqueSuggestions(key);

    const allSuggestions = getUniqueSuggestions(key);
    const lowerInput = inputValue.toLowerCase();

    return allSuggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(lowerInput),
    );
  };

  const handleTextInputChange = (key: string, value: string) => {
    handleFilterChange(key, value);
    setFocusedFilter(key);

    if (value.length > 0) {
      const suggestions = filterSuggestions(key, value);
      setSuggestions(suggestions.slice(0, 8)); // Limit to 8 suggestions
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (key: string, suggestion: string) => {
    handleFilterChange(key, suggestion);
    setFocusedFilter(null);
    setSuggestions([]);
  };

  const applyFilters = () => {
    const filtered = cases.filter((caseItem) => {
      // Branch filter
      if (
        enabledFilters.has("branch") &&
        filters.branch &&
        !caseItem.branch.toLowerCase().includes(filters.branch.toLowerCase())
      ) {
        return false;
      }

      // Assistant Branch filter
      if (
        enabledFilters.has("assistantBranch") &&
        filters.assistantBranch &&
        !caseItem.assistantBranch
          .toLowerCase()
          .includes(filters.assistantBranch.toLowerCase())
      ) {
        return false;
      }

      // Case Number filter
      if (
        enabledFilters.has("caseNumber") &&
        filters.caseNumber &&
        !caseItem.caseNumber
          .toLowerCase()
          .includes(filters.caseNumber.toLowerCase())
      ) {
        return false;
      }

      // Name filter
      if (
        enabledFilters.has("name") &&
        filters.name &&
        !caseItem.name.toLowerCase().includes(filters.name.toLowerCase())
      ) {
        return false;
      }

      // Charge filter
      if (
        enabledFilters.has("charge") &&
        filters.charge &&
        !caseItem.charge.toLowerCase().includes(filters.charge.toLowerCase())
      ) {
        return false;
      }

      // Info Sheet filter
      if (
        enabledFilters.has("infoSheet") &&
        filters.infoSheet &&
        !caseItem.infoSheet
          .toLowerCase()
          .includes(filters.infoSheet.toLowerCase())
      ) {
        return false;
      }

      // Court filter
      if (
        enabledFilters.has("court") &&
        filters.court &&
        !caseItem.court.toLowerCase().includes(filters.court.toLowerCase())
      ) {
        return false;
      }

      // Consolidation filter
      if (
        enabledFilters.has("consolidation") &&
        filters.consolidation &&
        !caseItem.consolidation
          .toLowerCase()
          .includes(filters.consolidation.toLowerCase())
      ) {
        return false;
      }

      // EQC Number filter
      if (
        enabledFilters.has("eqcNumber") &&
        filters.eqcNumber !== undefined &&
        caseItem.eqcNumber !== filters.eqcNumber
      ) {
        return false;
      }

      // Detained filter
      if (
        enabledFilters.has("detained") &&
        filters.detained !== undefined &&
        caseItem.detained !== filters.detained
      ) {
        return false;
      }

      // Bond filter
      if (enabledFilters.has("bond") && filters.bond) {
        if (
          filters.bond.min !== undefined &&
          (caseItem.bond === null || caseItem.bond < filters.bond.min)
        ) {
          return false;
        }
        if (
          filters.bond.max !== undefined &&
          (caseItem.bond === null || caseItem.bond > filters.bond.max)
        ) {
          return false;
        }
      }

      // Date Filed filter
      if (enabledFilters.has("dateFiled") && filters.dateFiled) {
        const caseDate = new Date(caseItem.dateFiled);
        if (
          filters.dateFiled.start &&
          caseDate < new Date(filters.dateFiled.start)
        ) {
          return false;
        }
        if (
          filters.dateFiled.end &&
          caseDate > new Date(filters.dateFiled.end)
        ) {
          return false;
        }
      }

      // Raffle Date filter
      if (enabledFilters.has("raffleDate") && filters.raffleDate) {
        if (caseItem.raffleDate === null) {
          return false;
        }
        const caseDate = new Date(caseItem.raffleDate);
        if (
          filters.raffleDate.start &&
          caseDate < new Date(filters.raffleDate.start)
        ) {
          return false;
        }
        if (
          filters.raffleDate.end &&
          caseDate > new Date(filters.raffleDate.end)
        ) {
          return false;
        }
      }

      return true;
    });

    onApplyFilters(filters, filtered);
    onClose();
  };

  const resetFilters = () => {
    setEnabledFilters(new Set());
    setFilters({});
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">Advanced Search</h3>

        <div className="space-y-4">
          {filterOptions.map((option) => (
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
                        value={
                          (filters[
                            option.key as keyof CaseFilterFilters
                          ] as string) || ""
                        }
                        onChange={(e) =>
                          handleTextInputChange(option.key, e.target.value)
                        }
                        onFocus={() => {
                          setFocusedFilter(option.key);
                          const inputValue = filters[
                            option.key as keyof CaseFilterFilters
                          ] as string;
                          if (inputValue) {
                            const suggestions = filterSuggestions(
                              option.key,
                              inputValue,
                            );
                            setSuggestions(suggestions.slice(0, 8));
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
                      value={
                        (filters[
                          option.key as keyof CaseFilterFilters
                        ] as number) || ""
                      }
                      onChange={(e) =>
                        handleFilterChange(
                          option.key,
                          e.target.value ? parseInt(e.target.value) : undefined,
                        )
                      }
                    />
                  )}

                  {option.type === "checkbox" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={
                          (filters[
                            option.key as keyof CaseFilterFilters
                          ] as boolean) || false
                        }
                        onChange={(e) =>
                          handleFilterChange(option.key, e.target.checked)
                        }
                      />
                      <span className="text-sm">Detained</span>
                    </div>
                  )}

                  {option.type === "range" && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min amount"
                        className="input input-bordered input-sm flex-1"
                        step="0.01"
                        value={(filters.bond?.min as number) || ""}
                        onChange={(e) =>
                          handleFilterChange("bond", {
                            ...filters.bond,
                            min: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                      />
                      <input
                        type="number"
                        placeholder="Max amount"
                        className="input input-bordered input-sm flex-1"
                        step="0.01"
                        value={(filters.bond?.max as number) || ""}
                        onChange={(e) =>
                          handleFilterChange("bond", {
                            ...filters.bond,
                            max: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>
                  )}

                  {option.type === "daterange" && (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1"
                        value={
                          option.key === "dateFiled"
                            ? filters.dateFiled?.start || ""
                            : filters.raffleDate?.start || ""
                        }
                        onChange={(e) =>
                          handleFilterChange(option.key, {
                            ...(option.key === "dateFiled"
                              ? filters.dateFiled
                              : filters.raffleDate),
                            start: e.target.value || undefined,
                          })
                        }
                      />
                      <input
                        type="date"
                        className="input input-bordered input-sm flex-1"
                        value={
                          option.key === "dateFiled"
                            ? filters.dateFiled?.end || ""
                            : filters.raffleDate?.end || ""
                        }
                        onChange={(e) =>
                          handleFilterChange(option.key, {
                            ...(option.key === "dateFiled"
                              ? filters.dateFiled
                              : filters.raffleDate),
                            end: e.target.value || undefined,
                          })
                        }
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

export default CaseFilterModal;
