"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiEdit3,
  FiEye,
  FiFileText,
  FiUsers,
} from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import { SpecialCase } from "./SpecialProceedingRow";
import {
  createSpecialProceeding,
  updateSpecialProceeding,
} from "./SpecialProceedingsActions";

type FormEntry = {
  id: string;
  spcNo: string;
  dateFiled: string;
  raffledToBranch: string;
  titleNo: string;
  petitioners: string;
  nature: string;
  respondent: string;
  errors: Record<string, string>;
  saved: boolean;
};

type ColDef = {
  key: keyof Omit<FormEntry, "id" | "errors" | "saved">;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};

type ModalType = "ADD" | "EDIT";
type Step = "entry" | "review";

const uid = () => Math.random().toString(36).slice(2, 9);

const createEmptyEntry = (id: string): FormEntry => ({
  id,
  spcNo: "",
  dateFiled: "",
  raffledToBranch: "",
  titleNo: "",
  petitioners: "",
  nature: "",
  respondent: "",
  errors: {},
  saved: false,
});

const caseToEntry = (id: string, c: SpecialCase): FormEntry => ({
  id,
  spcNo: c.spcNo,
  dateFiled: c.dateFiled,
  raffledToBranch: c.raffledToBranch,
  titleNo: c.titleNo || "",
  petitioners: c.petitioners,
  nature: c.nature,
  respondent: c.respondent,
  errors: {},
  saved: false,
});

const FROZEN_COLS: ColDef[] = [
  {
    key: "spcNo",
    label: "Case Number",
    placeholder: "SPC-2026-0001",
    type: "text",
    width: 160,
    required: true,
    mono: true,
  },
  {
    key: "dateFiled",
    label: "Date Filed",
    placeholder: "",
    type: "date",
    width: 148,
    required: true,
    mono: true,
  },
];

const TAB_GROUP_COLS: ColDef[] = [
  {
    key: "raffledToBranch",
    label: "Branch",
    placeholder: "Branch 1",
    type: "text",
    width: 148,
    required: true,
  },
  {
    key: "titleNo",
    label: "Title No",
    placeholder: "T-12345",
    type: "text",
    width: 148,
    mono: true,
  },
  {
    key: "petitioners",
    label: "Petitioners",
    placeholder: "Full name of petitioner(s)",
    type: "text",
    width: 220,
    required: true,
  },
  {
    key: "nature",
    label: "Nature",
    placeholder: "e.g. Petition for Adoption",
    type: "text",
    width: 240,
    required: true,
  },
  {
    key: "respondent",
    label: "Respondent",
    placeholder: "e.g. Republic of the Philippines",
    type: "text",
    width: 260,
    required: true,
  },
];

const REQUIRED_FIELDS: Array<keyof Omit<FormEntry, "id" | "errors" | "saved">> =
  [
    "spcNo",
    "dateFiled",
    "raffledToBranch",
    "petitioners",
    "nature",
    "respondent",
  ];

function validateEntry(entry: FormEntry): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "")
      errs[k as string] = "Required";
  });
  return errs;
}

const CellInput = ({
  col,
  value,
  error,
  onChange,
  onKeyDown,
}: {
  col: ColDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <input
      type={col.type === "date" ? "date" : "text"}
      value={value}
      placeholder={col.placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      title={error || col.label}
      className={`xls-input${error ? " xls-input-err" : ""}${col.mono ? " xls-mono" : ""}`}
    />
    {error && (
      <span className="xls-cell-err">
        <FiAlertCircle size={10} />
        {error}
      </span>
    )}
  </div>
);

function ReviewCard({ entry }: { entry: FormEntry }) {
  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="rv-card">
      <div className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-hero-casenum">
            {entry.spcNo || <span style={{ opacity: 0.4 }}>No SPC No.</span>}
          </div>
          <div className="rv-hero-name">
            {entry.petitioners || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No petitioner entered
              </span>
            )}
          </div>
          {entry.nature && <div className="rv-hero-charge">{entry.nature}</div>}
        </div>
        <div className="rv-hero-badges">
          {entry.raffledToBranch && (
            <span className="rv-badge rv-badge-court">
              {entry.raffledToBranch}
            </span>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Case Identity</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">SPC No.</div>
                <div className="rv-field-value rv-mono">
                  {entry.spcNo || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Raffled to Branch</div>
                <div className="rv-field-value">
                  {entry.raffledToBranch || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date Filed</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.dateFiled) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              {entry.titleNo && (
                <div className="rv-field">
                  <div className="rv-field-label">Title No.</div>
                  <div className="rv-field-value rv-mono">{entry.titleNo}</div>
                </div>
              )}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiUsers size={13} />
              <span>Petition Details</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Petitioners</div>
                <div className="rv-field-value">
                  {entry.petitioners || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Nature</div>
                <div className="rv-field-value">
                  {entry.nature || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Respondent</div>
                <div className="rv-field-value">
                  {entry.respondent || <span className="rv-empty">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SpecialProceedingDrawer = ({
  type,
  selectedCase,
  onClose,
  onCreate,
  onUpdate,
}: {
  type: ModalType;
  selectedCase?: SpecialCase | null;
  onClose: () => void;
  onCreate?: (data: SpecialCase) => void;
  onUpdate?: (data: SpecialCase) => void;
}) => {
  const isEdit = type === "EDIT";
  const popup = usePopup();
  const [step, setStep] = useState<Step>("entry");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<FormEntry[]>(() => {
    if (isEdit && selectedCase) return [caseToEntry(uid(), selectedCase)];
    return [createEmptyEntry(uid())];
  });

  useEffect(() => {
    if (!isEdit) {
      setEntries([createEmptyEntry(uid())]);
      setStep("entry");
    }
  }, [type, selectedCase, isEdit]);

  const handleChange = (id: string, field: string, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: value, errors: { ...e.errors, [field]: "" } }
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEmptyEntry(uid())]);
    setTimeout(() => {
      scrollAreaRef.current?.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 60);
  }, []);

  const handleRemove = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: string) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: FormEntry = {
      ...source,
      id: uid(),
      spcNo: "",
      errors: {},
      saved: false,
    };
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    entryId: string,
    isLastCol: boolean,
  ) => {
    if (e.key === "Tab" && !e.shiftKey && isLastCol) {
      const isLastRow = entries[entries.length - 1]?.id === entryId;
      if (isLastRow && !isEdit) {
        e.preventDefault();
        handleAddEntry();
        setTimeout(() => {
          const rows = scrollAreaRef.current?.querySelectorAll("[data-row]");
          const lastRow = rows?.[rows.length - 1];
          (lastRow?.querySelector("input") as HTMLInputElement)?.focus();
        }, 80);
      }
    }
  };

  const completedCount = entries.filter((e) =>
    REQUIRED_FIELDS.every((k) => e[k] && String(e[k]).trim() !== ""),
  ).length;
  const incompleteCount = entries.length - completedCount;

  const handleGoToReview = () => {
    let anyError = false;
    const validated = entries.map((e) => {
      const errs = validateEntry(e);
      if (Object.keys(errs).length > 0) {
        anyError = true;
        return { ...e, errors: errs };
      }
      return e;
    });
    setEntries(validated);
    if (anyError) {
      alert("Please fill in all required fields before reviewing.");
      return;
    }
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this case?"
      : entries.length === 1
        ? "Create this case?"
        : `Create ${entries.length} cases?`;
    if (!confirm(label)) return;
    setIsSubmitting(true);
    try {
      if (isEdit && selectedCase) {
        const e = entries[0];
        const result = await updateSpecialProceeding(selectedCase.id, {
          caseNumber: e.spcNo,
          raffledTo: e.raffledToBranch,
          date: e.dateFiled ? new Date(e.dateFiled) : null,
          petitioner: e.petitioners,
          nature: e.nature,
          respondent: e.respondent,
        });
        if (!result.success) {
          popup.showError(result.error || "Update failed");
          return;
        }
        popup.showSuccess("Case updated successfully");
        onUpdate?.(result.result as any);
      } else {
        for (const e of entries) {
          const result = await createSpecialProceeding({
            caseNumber: e.spcNo,
            raffledTo: e.raffledToBranch,
            date: e.dateFiled ? new Date(e.dateFiled) : null,
            petitioner: e.petitioners,
            nature: e.nature,
            respondent: e.respondent,
          });
          if (!result.success) {
            popup.showError(result.error || "Create failed");
            return;
          }
          onCreate?.(result.result as any);
        }
        popup.showSuccess(
          `${entries.length} case${entries.length > 1 ? "s" : ""} created successfully`,
        );
      }
      onClose();
    } catch (error) {
      popup.showError("An error occurred");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allCols = [...TAB_GROUP_COLS];
  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <div className="xls-root">
      {/* TOPBAR */}
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button
            className="xls-back-btn"
            onClick={step === "review" ? () => setStep("entry") : onClose}
            title="Back"
          >
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>Proceedings</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit ? "Edit Petition" : "New Proceedings Entries"}
            </span>
            {step === "review" && (
              <>
                <FiChevronRight size={12} className="xls-breadcrumb-sep" />
                <span className="xls-breadcrumb-current">Review</span>
              </>
            )}
          </nav>
        </div>
        <div className="xls-topbar-right">
          <div className="xls-stepper">
            <div className={`xls-step ${step === "entry" ? "active" : "done"}`}>
              <span className="xls-step-dot">
                {step === "review" ? (
                  <FiCheck size={10} strokeWidth={3} />
                ) : (
                  <FiEdit3 size={10} />
                )}
              </span>
              Data Entry
            </div>
            <div className={`xls-step ${step === "review" ? "active" : ""}`}>
              <span className="xls-step-dot">
                <FiEye size={10} />
              </span>
              Review
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <AnimatePresence mode="wait">
        {step === "entry" ? (
          <motion.div
            key="entry"
            className="bg-base-100 xls-main"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <div className="xls-title-row">
              <div>
                <h1 className="text-5xl xls-title">
                  {isEdit ? "Edit Petition" : "New Proceedings Entries"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update petition details. Required fields are marked *."
                  ) : (
                    <>
                      Fill rows like a spreadsheet —{" "}
                      <kbd className="xls-kbd">Tab</kbd> past the last cell to
                      add a new row.
                    </>
                  )}
                </p>
                {!isEdit && (
                  <div className="xls-pills" style={{ marginTop: 10 }}>
                    <span className="xls-pill xls-pill-neutral">
                      <span className="xls-pill-dot" />
                      {entries.length} {entries.length === 1 ? "row" : "rows"}
                    </span>
                    <span
                      className={`xls-pill ${completedCount > 0 ? "xls-pill-ok" : "xls-pill-neutral"}`}
                    >
                      <span className="xls-pill-dot" />
                      {completedCount} complete
                    </span>
                    {incompleteCount > 0 && (
                      <span className="xls-pill xls-pill-err">
                        <span className="xls-pill-dot" />
                        {incompleteCount} incomplete
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!isEdit && (
              <div className="xls-progress">
                <div
                  className="xls-progress-fill"
                  style={{
                    width: `${entries.length ? (completedCount / entries.length) * 100 : 0}%`,
                  }}
                />
              </div>
            )}

            <div className="xls-sheet-wrap">
              {/* Tab bar */}
              <div className="xls-tab-bar">
                <button className="xls-tab active">Petition Info</button>
              </div>
              <div className="xls-table-outer" ref={scrollAreaRef}>
                <table className="xls-table">
                  <colgroup>
                    <col style={{ width: ROW_NUM_W }} />
                    {FROZEN_COLS.map((c) => (
                      <col key={c.key} style={{ width: c.width }} />
                    ))}
                    {allCols.map((c) => (
                      <col key={c.key} style={{ width: c.width }} />
                    ))}
                    <col style={{ width: ACTION_W }} />
                  </colgroup>
                  <thead>
                    <tr className="xls-thead-group">
                      <th style={{ width: ROW_NUM_W }} />
                      <th colSpan={FROZEN_COLS.length}>
                        <div className="xls-group-label">Identity</div>
                      </th>
                      <th colSpan={allCols.length}>
                        <div className="xls-group-label">Petition Info</div>
                      </th>
                      <th />
                    </tr>
                    <tr className="xls-thead-cols">
                      <th style={{ textAlign: "center" }}>#</th>
                      {FROZEN_COLS.map((col) => (
                        <th
                          key={col.key}
                          className={col.required ? "req-col" : ""}
                        >
                          {col.label}
                        </th>
                      ))}
                      {allCols.map((col) => (
                        <th
                          key={col.key}
                          className={col.required ? "req-col" : ""}
                        >
                          {col.label}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {entries.map((entry, rowIdx) => {
                        const lastColIdx = allCols.length - 1;
                        return (
                          <motion.tr
                            key={entry.id}
                            data-row
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                            transition={{ duration: 0.12 }}
                            className="xls-row"
                          >
                            <td className="td-num">
                              <span className="xls-rownum">{rowIdx + 1}</span>
                            </td>
                            {FROZEN_COLS.map((col) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={entry[col.key] as string}
                                  error={entry.errors[col.key as string]}
                                  onChange={(v) =>
                                    handleChange(entry.id, col.key as string, v)
                                  }
                                  onKeyDown={(e) =>
                                    handleCellKeyDown(e, entry.id, false)
                                  }
                                />
                              </td>
                            ))}
                            {allCols.map((col, colIdx) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={entry[col.key] as string}
                                  error={entry.errors[col.key as string]}
                                  onChange={(v) =>
                                    handleChange(entry.id, col.key as string, v)
                                  }
                                  onKeyDown={(e) =>
                                    handleCellKeyDown(
                                      e,
                                      entry.id,
                                      colIdx === lastColIdx,
                                    )
                                  }
                                />
                              </td>
                            ))}
                            <td className="td-actions">
                              <div className="flex gap-2 justify-center">
                                <button
                                  className="xls-action-btn"
                                  title="Duplicate row"
                                  onClick={() => handleDuplicate(entry.id)}
                                >
                                  📋
                                </button>
                                {!isEdit && entries.length > 1 && (
                                  <button
                                    className="xls-action-btn"
                                    title="Delete row"
                                    onClick={() => handleRemove(entry.id)}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              {!isEdit && (
                <div className="xls-sheet-footer">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={handleAddEntry}
                  >
                    + Add Row
                  </button>
                </div>
              )}
            </div>
            <div className="xls-bottom-actions">
              <button className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGoToReview}
                disabled={completedCount === 0}
              >
                Review {completedCount > 0 && `(${completedCount})`} →
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="review"
            className="bg-base-100 xls-main xls-review"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <AnimatePresence mode="wait">
              {entries[reviewIdx] && (
                <motion.div
                  key={reviewIdx}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.12 }}
                >
                  <ReviewCard entry={entries[reviewIdx]} />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="xls-review-nav">
              {entries.length > 1 && (
                <>
                  <span className="xls-review-counter">
                    {reviewIdx + 1} of {entries.length}
                  </span>
                  <button
                    className="btn btn-sm"
                    onClick={() => setReviewIdx(Math.max(0, reviewIdx - 1))}
                    disabled={reviewIdx === 0}
                  >
                    ← Prev
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      setReviewIdx(Math.min(entries.length - 1, reviewIdx + 1))
                    }
                    disabled={reviewIdx === entries.length - 1}
                  >
                    Next →
                  </button>
                </>
              )}
            </div>
            <div className="xls-bottom-actions">
              <button
                className="btn btn-outline"
                onClick={() => setStep("entry")}
              >
                ← Back to Edit
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Saving...
                  </>
                ) : isEdit ? (
                  "Save Changes"
                ) : (
                  `Create ${entries.length} ${entries.length === 1 ? "Case" : "Cases"}`
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpecialProceedingDrawer;
