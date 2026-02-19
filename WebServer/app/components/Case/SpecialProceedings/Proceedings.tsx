"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiEdit, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";

// ─── Types ────────────────────────────────────────────────────────────────────

type SpecialCase = {
  id: number;
  spcNo: string;
  raffledToBranch: string;
  dateFiled: string;
  petitioners: string;
  nature: string;
  respondent: string;
};

type SPFilterValues = {
  spcNo?: string;
  raffledToBranch?: string;
  petitioners?: string;
  nature?: string;
  respondent?: string;
  dateFiled?: { start?: string; end?: string };
};

type FilterOptionType = "text" | "daterange";

type FilterOption = {
  key: string;
  label: string;
  type: FilterOptionType;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CASES: SpecialCase[] = [
  {
    id: 1,
    spcNo: "SPC-2024-0001",
    raffledToBranch: "Branch 1",
    dateFiled: "2024-01-15",
    petitioners: "Juan Dela Cruz",
    nature: "Petition for Adoption",
    respondent: "Republic of the Philippines",
  },
  {
    id: 2,
    spcNo: "SPC-2024-0002",
    raffledToBranch: "Branch 3",
    dateFiled: "2024-02-20",
    petitioners: "Maria Santos",
    nature: "Petition for Guardianship",
    respondent: "Pedro Santos",
  },
  {
    id: 3,
    spcNo: "SPC-2024-0003",
    raffledToBranch: "Branch 2",
    dateFiled: "2024-03-05",
    petitioners: "Jose Reyes",
    nature: "Petition for Change of Name",
    respondent: "Republic of the Philippines",
  },
  {
    id: 4,
    spcNo: "SPC-2024-0004",
    raffledToBranch: "Branch 5",
    dateFiled: "2024-03-18",
    petitioners: "Ana Lim",
    nature: "Petition for Annulment",
    respondent: "Carlos Lim",
  },
  {
    id: 5,
    spcNo: "SPC-2024-0005",
    raffledToBranch: "Branch 1",
    dateFiled: "2024-04-01",
    petitioners: "Roberto Garcia",
    nature: "Petition for Habeas Corpus",
    respondent: "Bureau of Corrections",
  },
  {
    id: 6,
    spcNo: "SPC-2024-0006",
    raffledToBranch: "Branch 4",
    dateFiled: "2024-04-22",
    petitioners: "Elena Cruz",
    nature: "Petition for Declaration of Nullity",
    respondent: "Rodrigo Cruz",
  },
  {
    id: 7,
    spcNo: "SPC-2024-0007",
    raffledToBranch: "Branch 2",
    dateFiled: "2024-05-10",
    petitioners: "Marco Villanueva",
    nature: "Petition for Adoption",
    respondent: "Republic of the Philippines",
  },
  {
    id: 8,
    spcNo: "SPC-2024-0008",
    raffledToBranch: "Branch 3",
    dateFiled: "2024-05-28",
    petitioners: "Lourdes Fernandez",
    nature: "Petition for Legal Separation",
    respondent: "Ernesto Fernandez",
  },
  {
    id: 9,
    spcNo: "SPC-2024-0009",
    raffledToBranch: "Branch 1",
    dateFiled: "2024-06-03",
    petitioners: "Dante Morales",
    nature: "Petition for Guardianship",
    respondent: "City Social Welfare",
  },
  {
    id: 10,
    spcNo: "SPC-2024-0010",
    raffledToBranch: "Branch 5",
    dateFiled: "2024-06-15",
    petitioners: "Carmen Bautista",
    nature: "Petition for Change of Name",
    respondent: "Republic of the Philippines",
  },
];

const SP_FILTER_OPTIONS: FilterOption[] = [
  { key: "spcNo", label: "SPC. No.", type: "text" },
  { key: "raffledToBranch", label: "Raffled to Branch", type: "text" },
  { key: "petitioners", label: "Petitioners", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
  { key: "respondent", label: "Respondent", type: "text" },
  { key: "dateFiled", label: "Date Filed", type: "daterange" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const PAGE_SIZE = 25;

// ─── Add/Edit Case Drawer (matches AddAccountDrawer pattern) ──────────────────

const SPCaseDrawer = ({
  isOpen,
  onClose,
  caseData,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  caseData: SpecialCase | null;
  onSave: (data: Omit<SpecialCase, "id">) => void;
}) => {
  const isEdit = !!caseData;
  const [step, setStep] = useState<"FORM" | "REVIEW">("FORM");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Omit<SpecialCase, "id">>({
    spcNo: "",
    raffledToBranch: "",
    dateFiled: "",
    petitioners: "",
    nature: "",
    respondent: "",
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setStep("FORM");
      setLoading(false);
      setForm({
        spcNo: caseData?.spcNo ?? "",
        raffledToBranch: caseData?.raffledToBranch ?? "",
        dateFiled: caseData?.dateFiled ?? "",
        petitioners: caseData?.petitioners ?? "",
        nature: caseData?.nature ?? "",
        respondent: caseData?.respondent ?? "",
      });
    }
  }, [isOpen, caseData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const canProceedToReview = () =>
    form.spcNo.trim() &&
    form.raffledToBranch.trim() &&
    form.dateFiled.trim() &&
    form.petitioners.trim() &&
    form.nature.trim() &&
    form.respondent.trim();

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      onSave(form);
      setLoading(false);
      onClose();
    }, 600);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[700px] bg-base-100 shadow-2xl z-50 overflow-y-auto border-l border-base-300"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-base-100 border-b border-base-300 p-6 flex items-center justify-between z-10 shadow-sm">
              <div>
                <h2 className="text-3xl font-bold">
                  {isEdit
                    ? "Edit Special Proceeding"
                    : "Add Special Proceeding"}
                </h2>
                <p className="text-sm text-base-content/60 mt-1">
                  {step === "FORM" &&
                    (isEdit ? "Update case details" : "Enter case details")}
                  {step === "REVIEW" && "Review and confirm"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              {/* ── STEP 1: FORM ── */}
              {step === "FORM" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  {/* SPC No. */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        SPC. No.
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      name="spcNo"
                      className="input input-bordered w-full text-base"
                      value={form.spcNo}
                      onChange={handleChange}
                      placeholder="SPC-2024-0001"
                    />
                  </div>

                  {/* Raffled to Branch */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Raffled to Branch
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      name="raffledToBranch"
                      className="input input-bordered w-full text-base"
                      value={form.raffledToBranch}
                      onChange={handleChange}
                      placeholder="Branch 1"
                    />
                  </div>

                  {/* Date Filed */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Date Filed
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      type="date"
                      name="dateFiled"
                      className="input input-bordered w-full text-base"
                      value={form.dateFiled}
                      onChange={handleChange}
                    />
                  </div>

                  {/* Petitioners */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Petitioners
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      name="petitioners"
                      className="input input-bordered w-full text-base"
                      value={form.petitioners}
                      onChange={handleChange}
                      placeholder="Full name of petitioner(s)"
                    />
                  </div>

                  {/* Nature */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Nature
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      name="nature"
                      className="input input-bordered w-full text-base"
                      value={form.nature}
                      onChange={handleChange}
                      placeholder="e.g. Petition for Adoption"
                    />
                  </div>

                  {/* Respondent */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Respondent
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      name="respondent"
                      className="input input-bordered w-full text-base"
                      value={form.respondent}
                      onChange={handleChange}
                      placeholder="e.g. Republic of the Philippines"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-6">
                    <button className="btn btn-ghost flex-1" onClick={onClose}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary flex-1"
                      onClick={() => setStep("REVIEW")}
                      disabled={!canProceedToReview()}
                    >
                      Review
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: REVIEW ── */}
              {step === "REVIEW" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="card bg-base-200 shadow-sm">
                    <div className="card-body p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                          <FiCheck className="w-6 h-6 text-success" />
                        </div>
                        <div>
                          <h3 className="font-bold text-xl">
                            Review Case Details
                          </h3>
                          <p className="text-sm text-base-content/60">
                            Please verify all information before{" "}
                            {isEdit ? "saving" : "creating"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(
                          [
                            ["SPC. No.", form.spcNo],
                            ["Raffled to Branch", form.raffledToBranch],
                            ["Date Filed", formatDate(form.dateFiled)],
                            ["Petitioners", form.petitioners],
                            ["Nature", form.nature],
                            ["Respondent", form.respondent],
                          ] as [string, string][]
                        ).map(([label, value]) => (
                          <div
                            key={label}
                            className="flex items-start gap-4 p-4 rounded-xl bg-base-100"
                          >
                            <div className="flex-1">
                              <p className="text-xs text-base-content/60 mb-1 font-semibold uppercase tracking-wide">
                                {label}
                              </p>
                              <p className="font-bold text-base">
                                {value || "—"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-6">
                    <button
                      className="btn btn-ghost flex-1"
                      onClick={() => setStep("FORM")}
                      disabled={loading}
                    >
                      Back
                    </button>
                    <button
                      className="btn btn-primary flex-1"
                      onClick={handleSave}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="loading loading-spinner loading-sm" />
                          {isEdit ? "Saving..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <FiCheck className="w-4 h-4" />
                          {isEdit ? "Save Changes" : "Confirm & Create"}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────

function PageButton({
  isActive,
  children,
  onClick,
  disabled = false,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`join-item btn btn-sm btn-ghost ${isActive ? "btn-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </button>
  );
}

const Pagination: React.FC<{
  pageCount: number;
  currentPage: number;
  onPageChange?: (page: number) => void;
}> = ({ pageCount, currentPage, onPageChange }) => {
  const [activeEllipsis, setActiveEllipsis] = useState<number | null>(null);
  const [ellipsisValue, setEllipsisValue] = useState<string>("");

  const getPages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const delta = 1;
    if (pageCount <= 1) return [1];
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(pageCount - 1, currentPage + delta);
    pages.push(1);
    if (rangeStart > 2) pages.push("...");
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < pageCount - 1) pages.push("...");
    if (pageCount > 1) pages.push(pageCount);
    return pages;
  };

  const submitEllipsis = (val?: string) => {
    const v = (val ?? ellipsisValue).trim();
    const n = Number(v);
    if (!Number.isNaN(n) && n >= 1 && n <= pageCount) onPageChange?.(n);
    setActiveEllipsis(null);
    setEllipsisValue("");
  };

  const pages = getPages();

  return (
    <div className="w-full flex justify-center py-4">
      <div className="join shadow-sm bg-base-100 rounded-lg p-1">
        {currentPage > 1 && (
          <button
            className="join-item btn btn-sm btn-ghost"
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            aria-label="Previous page"
          >
            <GrFormPrevious className="w-5 h-5" />
          </button>
        )}
        {pages.map((page, index) => {
          if (page === "...") {
            if (activeEllipsis === index) {
              return (
                <div key={`ell-${index}`} className="join-item">
                  <input
                    autoFocus
                    className="input input-sm w-20 text-center"
                    value={ellipsisValue}
                    onChange={(e) => setEllipsisValue(e.target.value)}
                    onBlur={() => submitEllipsis()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEllipsis();
                      if (e.key === "Escape") {
                        setActiveEllipsis(null);
                        setEllipsisValue("");
                      }
                    }}
                    aria-label="Jump to page"
                  />
                </div>
              );
            }
            return (
              <button
                key={`ell-btn-${index}`}
                className="join-item btn btn-sm btn-ghost"
                onClick={() => {
                  setActiveEllipsis(index);
                  setEllipsisValue("");
                }}
                aria-label="Open page jump"
              >
                ...
              </button>
            );
          }
          return (
            <PageButton
              key={page}
              isActive={currentPage === page}
              onClick={() => onPageChange?.(page as number)}
            >
              {page}
            </PageButton>
          );
        })}
        <button
          className="join-item btn btn-sm btn-ghost"
          onClick={() => onPageChange?.(Math.min(pageCount, currentPage + 1))}
          aria-label="Next page"
          disabled={currentPage >= pageCount}
        >
          <GrFormNext className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ─── Suggestions ──────────────────────────────────────────────────────────────

const Suggestions = ({
  suggestions,
  onClick,
}: {
  suggestions: string[];
  onClick: (s: string) => void;
}) => (
  <ul className="absolute z-50 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
    {suggestions.map((s) => (
      <li
        key={s}
        className="px-4 py-2 hover:bg-base-200 cursor-pointer text-sm transition-colors"
        onMouseDown={() => onClick(s)}
      >
        {s}
      </li>
    ))}
  </ul>
);

// ─── FilterRow ────────────────────────────────────────────────────────────────

const FilterRow = ({
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
}: {
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
}) => (
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
            {option.type === "daterange" && (
              <div className="flex gap-2">
                <input
                  type="date"
                  className="input input-bordered input-sm flex-1"
                  value={((value || {}) as { start?: string }).start || ""}
                  onChange={(e) => {
                    const c = (value || {}) as { start?: string; end?: string };
                    onChange(option.key, {
                      ...c,
                      start: e.target.value || undefined,
                    });
                  }}
                />
                <input
                  type="date"
                  className="input input-bordered input-sm flex-1"
                  value={((value || {}) as { end?: string }).end || ""}
                  onChange={(e) => {
                    const c = (value || {}) as { start?: string; end?: string };
                    onChange(option.key, {
                      ...c,
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

// ─── FilterModal ──────────────────────────────────────────────────────────────

const SPFilterModal = ({
  isOpen,
  onClose,
  options,
  onApply,
  initialValues,
  getSuggestions,
}: {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOption[];
  onApply: (filters: SPFilterValues) => void;
  initialValues: SPFilterValues;
  getSuggestions: (key: string, inputValue: string) => string[];
}) => {
  const [enabledFilters, setEnabledFilters] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<SPFilterValues>({});
  const [focusedFilter, setFocusedFilter] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFilters(initialValues || {});
      setEnabledFilters(new Set(Object.keys(initialValues || {})));
    }
  }, [isOpen, initialValues]);

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
  };
  const applyFilters = () => {
    const active: SPFilterValues = {};
    enabledFilters.forEach((key) => {
      const value = (filters as any)[key];
      if (value === undefined || value === null) return;
      if (typeof value === "string" && value.trim() === "") return;
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      )
        return;
      (active as any)[key] = value;
    });
    onApply(active);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-100 rounded-2xl shadow-2xl w-[90vw] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-primary to-primary-focus text-primary-content px-8 py-6 flex justify-between items-center">
          <h3 className="text-3xl font-extrabold tracking-tight">
            Advanced Search
          </h3>
          <button
            onClick={onClose}
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
        <div className="overflow-y-auto flex-1 px-8 py-6">
          <div className="space-y-3">
            {options.map((option) => (
              <FilterRow
                key={option.key}
                option={option}
                enabled={enabledFilters.has(option.key)}
                value={(filters as any)[option.key]}
                onToggle={toggleFilter}
                onChange={handleFilterChange}
                focused={focusedFilter === option.key}
                onFocus={(k) => {
                  setFocusedFilter(k);
                  setSuggestions(
                    getSuggestions(
                      k,
                      ((filters as any)[k] as string) || "",
                    ).slice(0, 8),
                  );
                }}
                onBlur={() => setTimeout(() => setFocusedFilter(null), 200)}
                suggestions={focusedFilter === option.key ? suggestions : []}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}
          </div>
        </div>
        <div className="bg-base-200 px-8 py-4 flex justify-between items-center border-t border-base-300">
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
            Reset
          </button>
          <div className="flex gap-3">
            <button className="btn btn-outline btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SPCaseRow ────────────────────────────────────────────────────────────────

const SPCaseRow = ({
  caseItem,
  setSelectedCase,
  onEdit,
  onDelete,
  onRowClick,
}: {
  caseItem: SpecialCase;
  setSelectedCase: (c: SpecialCase) => void;
  onEdit: (c: SpecialCase) => void;
  onDelete: (id: number) => void;
  onRowClick: (c: SpecialCase) => void;
}) => (
  <tr
    className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
    onClick={() => onRowClick(caseItem)}
  >
    <td className="text-center" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-center gap-1">
        <button
          className="btn btn-xs btn-ghost text-info hover:bg-info/10"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCase(caseItem);
            onEdit(caseItem);
          }}
        >
          <FiEdit size={15} />
        </button>
        <button
          className="btn btn-xs btn-ghost text-error hover:bg-error/10"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(caseItem.id);
          }}
        >
          <FiTrash2 size={15} />
        </button>
      </div>
    </td>
    <td className="font-semibold text-center">{caseItem.spcNo}</td>
    <td className="text-center">{caseItem.raffledToBranch}</td>
    <td className="text-center text-base-content/70">
      {formatDate(caseItem.dateFiled)}
    </td>
    <td className="font-medium text-center">{caseItem.petitioners}</td>
    <td className="text-center">{caseItem.nature}</td>
    <td className="text-center">{caseItem.respondent}</td>
  </tr>
);

// ─── Sort TH ─────────────────────────────────────────────────────────────────

type SortConfig = { key: keyof SpecialCase; order: "asc" | "desc" };

const SortTh = ({
  label,
  colKey,
  sortConfig,
  onSort,
}: {
  label: string;
  colKey: keyof SpecialCase;
  sortConfig: SortConfig;
  onSort: (k: keyof SpecialCase) => void;
}) => (
  <th
    className="text-center cursor-pointer select-none hover:bg-base-200 transition-colors"
    onClick={() => onSort(colKey)}
  >
    {label}
    {sortConfig.key === colKey ? (
      <span className="ml-1 text-primary">
        {sortConfig.order === "asc" ? "↑" : "↓"}
      </span>
    ) : (
      <span className="opacity-30 ml-1">↕</span>
    )}
  </th>
);

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const SPCaseDetailModal = ({
  caseData,
  onClose,
}: {
  caseData: SpecialCase;
  onClose: () => void;
}) => (
  <div className="modal modal-open">
    <div className="modal-box max-w-lg">
      <h3 className="font-bold text-xl mb-6">Case Details</h3>
      <div className="space-y-3">
        {(
          [
            ["SPC. No.", caseData.spcNo],
            ["Raffled to Branch", caseData.raffledToBranch],
            ["Date Filed", formatDate(caseData.dateFiled)],
            ["Petitioners", caseData.petitioners],
            ["Nature", caseData.nature],
            ["Respondent", caseData.respondent],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="flex gap-4 p-3 rounded-lg bg-base-200">
            <span className="text-base-content/60 text-sm w-36 flex-shrink-0 font-semibold">
              {label}
            </span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="modal-action">
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
    <div className="modal-backdrop" onClick={onClose} />
  </div>
);

// ─── Filter Logic ─────────────────────────────────────────────────────────────

const applySPFilters = (
  filters: SPFilterValues,
  items: SpecialCase[],
): SpecialCase[] =>
  items.filter((c) => {
    if (
      filters.spcNo &&
      !c.spcNo.toLowerCase().includes(filters.spcNo.toLowerCase())
    )
      return false;
    if (
      filters.raffledToBranch &&
      !c.raffledToBranch
        .toLowerCase()
        .includes(filters.raffledToBranch.toLowerCase())
    )
      return false;
    if (
      filters.petitioners &&
      !c.petitioners.toLowerCase().includes(filters.petitioners.toLowerCase())
    )
      return false;
    if (
      filters.nature &&
      !c.nature.toLowerCase().includes(filters.nature.toLowerCase())
    )
      return false;
    if (
      filters.respondent &&
      !c.respondent.toLowerCase().includes(filters.respondent.toLowerCase())
    )
      return false;
    if (filters.dateFiled) {
      const d = new Date(c.dateFiled);
      if (filters.dateFiled.start && d < new Date(filters.dateFiled.start))
        return false;
      if (filters.dateFiled.end && d > new Date(filters.dateFiled.end))
        return false;
    }
    return true;
  });

// ─── Main Page ────────────────────────────────────────────────────────────────

const Proceedings: React.FC = () => {
  const [cases, setCases] = useState<SpecialCase[]>(MOCK_CASES);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "dateFiled",
    order: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<SpecialCase | null>(null);
  const [detailCase, setDetailCase] = useState<SpecialCase | null>(null);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SPFilterValues>({});
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<SpecialCase[]>(
    [],
  );

  const isAdminOrAtty = true;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, appliedFilters]);

  const handleSort = (key: keyof SpecialCase) =>
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));

  const getSuggestions = (key: string, inputValue: string): string[] => {
    const textKeys = [
      "spcNo",
      "raffledToBranch",
      "petitioners",
      "nature",
      "respondent",
    ];
    if (!textKeys.includes(key)) return [];
    const values = cases
      .map((c) => (c[key as keyof SpecialCase] as string) || "")
      .filter(Boolean);
    const unique = Array.from(new Set(values)).sort();
    if (!inputValue) return unique;
    return unique.filter((v) =>
      v.toLowerCase().includes(inputValue.toLowerCase()),
    );
  };

  const handleApplyFilters = (filters: SPFilterValues) => {
    setAppliedFilters(filters);
    setFilteredByAdvanced(applySPFilters(filters, cases));
  };

  const filteredAndSorted = useMemo(() => {
    const baseList =
      Object.keys(appliedFilters).length > 0 ? filteredByAdvanced : cases;
    let filtered = baseList;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = baseList.filter((c) =>
        Object.values(c).some((v) =>
          v?.toString().toLowerCase().includes(lower),
        ),
      );
    }
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.order === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });
  }, [cases, searchTerm, sortConfig, appliedFilters, filteredByAdvanced]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  const stats = useMemo(() => {
    const total = cases.length;
    const now = new Date();
    const thisMonth = cases.filter((c) => {
      const d = new Date(c.dateFiled);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    const natures = new Set(cases.map((c) => c.nature)).size;
    const branches = new Set(cases.map((c) => c.raffledToBranch)).size;
    return { total, thisMonth, natures, branches };
  }, [cases]);

  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    setCases((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSave = (data: Omit<SpecialCase, "id">) => {
    if (selectedCase) {
      setCases((prev) =>
        prev.map((c) => (c.id === selectedCase.id ? { ...c, ...data } : c)),
      );
    } else {
      const newId = Math.max(0, ...cases.map((c) => c.id)) + 1;
      setCases((prev) => [...prev, { id: newId, ...data }]);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      alert("Import complete (mock)");
      e.target.value = "";
    }, 1200);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      alert("Export complete (mock)");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Special Proceedings Cases
          </h2>
          <p className="text-xl text-base-content/70">
            Manage all special proceedings
          </p>
        </div>

        {/* Search and Actions */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
            <input
              type="text"
              placeholder="Search cases..."
              className="input input-bordered input-lg w-full pl-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            className={`btn btn-outline ${activeFilterCount > 0 ? "btn-primary" : ""}`}
            onClick={() => setFilterModalOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                clipRule="evenodd"
              />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="badge badge-sm badge-primary ml-1">
                {activeFilterCount}
              </span>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />

          {isAdminOrAtty && (
            <button
              className={`btn btn-outline ${uploading ? "loading" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Importing..." : "Import Excel"}
            </button>
          )}
          {isAdminOrAtty && (
            <button
              className={`btn btn-outline ${exporting ? "loading" : ""}`}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          )}
          {isAdminOrAtty && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setSelectedCase(null);
                setDrawerOpen(true);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Add Case
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 text-l font-medium text-center">
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">TOTAL CASES</div>
            <div className="text-5xl font-bold text-primary">{stats.total}</div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">THIS MONTH</div>
            <div className="text-5xl font-bold text-primary">
              {stats.thisMonth}
            </div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">CASE TYPES</div>
            <div className="text-5xl font-bold text-primary">
              {stats.natures}
            </div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">BRANCHES</div>
            <div className="text-5xl font-bold text-primary">
              {stats.branches}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-base-300 rounded-lg shadow overflow-x-auto">
          <table className="table table-zebra w-full text-center">
            <thead>
              <tr className="text-center">
                {isAdminOrAtty && <th>ACTIONS</th>}
                <SortTh
                  label="SPC. NO."
                  colKey="spcNo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="RAFFLED TO BRANCH"
                  colKey="raffledToBranch"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE FILED"
                  colKey="dateFiled"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="PETITIONERS"
                  colKey="petitioners"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="NATURE"
                  colKey="nature"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="RESPONDENT"
                  colKey="respondent"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-base-content/50"
                  >
                    No cases found.
                  </td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <SPCaseRow
                    key={c.id}
                    caseItem={c}
                    setSelectedCase={setSelectedCase}
                    onEdit={(item) => {
                      setSelectedCase(item);
                      setDrawerOpen(true);
                    }}
                    onDelete={handleDelete}
                    onRowClick={(item) => setDetailCase(item)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex justify-end">
          <Pagination
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>

        {/* Add / Edit Drawer */}
        <SPCaseDrawer
          isOpen={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedCase(null);
          }}
          caseData={selectedCase}
          onSave={handleSave}
        />

        {/* Detail Modal */}
        {detailCase && (
          <SPCaseDetailModal
            caseData={detailCase}
            onClose={() => setDetailCase(null)}
          />
        )}

        {/* Filter Modal */}
        <SPFilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          options={SP_FILTER_OPTIONS}
          onApply={handleApplyFilters}
          initialValues={appliedFilters}
          getSuggestions={getSuggestions}
        />
      </main>
    </div>
  );
};

export default Proceedings;
