"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiEye,
  FiFileText,
  FiMapPin,
  FiPlus,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import { ReceiveLog } from "./ReceiveRecord";

export enum ReceiveDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

interface EntryForm {
  id: string;
  BookAndPages: string;
  dateReceived: string;
  Abbreviation: string;
  CaseNo: string;
  Content: string;
  BranchNo: string;
  Time: string;
  Notes: string;
  errors: Record<string, string>;
  saved: boolean;
}

const today = new Date().toISOString().slice(0, 10);

const emptyEntry = (id: string): EntryForm => ({
  id,
  BookAndPages: "",
  dateReceived: today,
  Abbreviation: "",
  CaseNo: "",
  Content: "",
  BranchNo: "",
  Time: "",
  Notes: "",
  errors: {},
  saved: false,
});

const uid = () => Math.random().toString(36).slice(2, 9);

const REQUIRED_FIELDS = ["BookAndPages", "CaseNo", "dateReceived"] as const;

type ColDef = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "time";
  width: number;
  required?: boolean;
  mono?: boolean;
};

const FROZEN_COLS: ColDef[] = [
  {
    key: "BookAndPages",
    label: "Book & Pages",
    placeholder: "OR-2026-00001",
    type: "text",
    width: 170,
    required: true,
    mono: true,
  },
  {
    key: "dateReceived",
    label: "Date Received",
    placeholder: "",
    type: "date",
    width: 150,
    required: true,
    mono: true,
  },
];

type TabGroup = { id: string; label: string; cols: ColDef[] };

const TAB_GROUPS: TabGroup[] = [
  {
    id: "document",
    label: "Document Info",
    cols: [
      {
        key: "Time",
        label: "Time",
        placeholder: "",
        type: "time",
        width: 120,
        mono: true,
      },
      {
        key: "Abbreviation",
        label: "Abbreviation",
        placeholder: "e.g. CR",
        type: "text",
        width: 140,
      },
      {
        key: "CaseNo",
        label: "Case No",
        placeholder: "Crim-2026-0001",
        type: "text",
        width: 180,
        required: true,
        mono: true,
      },
      {
        key: "BranchNo",
        label: "Branch No",
        placeholder: "Branch 1",
        type: "text",
        width: 140,
      },
      {
        key: "Content",
        label: "Content",
        placeholder: "Short description",
        type: "text",
        width: 260,
      },
      {
        key: "Notes",
        label: "Notes",
        placeholder: "Optional notes",
        type: "text",
        width: 240,
      },
    ],
  },
];

function validateEntry(entry: EntryForm): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "") errs[k] = "Required";
  });
  return errs;
}

/* ─── Cell Input ─────────────────────────────────────────────── */
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
      type={
        col.type === "date" ? "date" : col.type === "time" ? "time" : "text"
      }
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

/* ─── Review Card ────────────────────────────────────────────── */
function ReviewCard({ entry }: { entry: EntryForm }) {
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
            {entry.BookAndPages || (
              <span style={{ opacity: 0.4 }}>No Book & Pages</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.CaseNo || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No case no. entered
              </span>
            )}
          </div>
          {entry.Content && (
            <div className="rv-hero-charge">{entry.Content}</div>
          )}
        </div>
        <div className="rv-hero-badges">
          {entry.BranchNo && (
            <span className="rv-badge rv-badge-court">{entry.BranchNo}</span>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Document Information</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">Book & Pages</div>
                <div className="rv-field-value rv-mono">
                  {entry.BookAndPages || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date Received</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.dateReceived) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              {entry.Time && (
                <div className="rv-field">
                  <div className="rv-field-label">Time</div>
                  <div className="rv-field-value rv-mono">{entry.Time}</div>
                </div>
              )}
              {entry.Abbreviation && (
                <div className="rv-field">
                  <div className="rv-field-label">Abbreviation</div>
                  <div className="rv-field-value">{entry.Abbreviation}</div>
                </div>
              )}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiMapPin size={13} />
              <span>Case & Content</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Case No</div>
                <div className="rv-field-value rv-mono">
                  {entry.CaseNo || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Branch No</div>
                <div className="rv-field-value">
                  {entry.BranchNo || <span className="rv-empty">—</span>}
                </div>
              </div>
              {entry.Content && (
                <div className="rv-field">
                  <div className="rv-field-label">Content</div>
                  <div className="rv-field-value">{entry.Content}</div>
                </div>
              )}
              {entry.Notes && (
                <div className="rv-field">
                  <div className="rv-field-label">Notes</div>
                  <div className="rv-field-value">{entry.Notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
const ReceiveDrawer = ({
  type,
  onClose,
  selectedLog = null,
  onCreate,
  onUpdate,
}: {
  type: ReceiveDrawerType;
  onClose: () => void;
  selectedLog?: ReceiveLog | null | any;
  onCreate?: (log: any) => void;
  onUpdate?: (log: any) => void;
}) => {
  const isEdit = type === ReceiveDrawerType.EDIT;
  const statusPopup = usePopup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [activeTab, setActiveTab] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const makeFromLog = (log: any): EntryForm => ({
    id: uid(),
    BookAndPages: log.BookAndPages ?? log.receiptNo ?? "",
    dateReceived: log.dateReceived
      ? String(log.dateReceived).slice(0, 10)
      : today,
    Abbreviation: log.Abbreviation ?? "",
    CaseNo: log["Case No"] ?? log.caseNumber ?? "",
    Content: log.Content ?? "",
    BranchNo: log["Branch No"] ?? log.branch ?? "",
    Time: log.Time ?? log.timeReceived ?? "",
    Notes: log.Notes ?? log.remarks ?? "",
    errors: {},
    saved: false,
  });

  const [entries, setEntries] = useState<EntryForm[]>(() => {
    if (isEdit && selectedLog) return [makeFromLog(selectedLog)];
    return [emptyEntry(uid())];
  });

  useEffect(() => {
    if (isEdit && selectedLog) {
      setEntries([makeFromLog(selectedLog)]);
    } else if (!isEdit) {
      setEntries([emptyEntry(uid())]);
    }
    setStep("entry");
    setActiveTab(0);
  }, [type, selectedLog]);

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
    setEntries((prev) => [...prev, emptyEntry(uid())]);
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
    const dup: EntryForm = {
      ...source,
      id: uid(),
      BookAndPages: "",
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
    isLastColOfTab: boolean,
  ) => {
    if (e.key === "Tab" && !e.shiftKey && isLastColOfTab) {
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
      statusPopup.showError(
        "Please fill in all required fields before reviewing.",
      );
      return;
    }
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildPayload = (e: EntryForm) => ({
    BookAndPages: e.BookAndPages,
    dateReceived: e.dateReceived,
    Abbreviation: e.Abbreviation || null,
    "Case No": e.CaseNo,
    Content: e.Content || null,
    "Branch No": e.BranchNo || null,
    Time: e.Time || null,
    Notes: e.Notes || null,
  });

  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this receiving log entry?"
      : entries.length === 1
        ? "Create this receiving log entry?"
        : `Create ${entries.length} receiving log entries?`;
    if (!(await statusPopup.showConfirm(label))) return;

    setIsSubmitting(true);
    statusPopup.showLoading(
      isEdit ? "Updating entry..." : "Creating entry(ies)...",
    );
    try {
      if (isEdit && selectedLog) {
        onUpdate?.({ ...buildPayload(entries[0]), id: selectedLog.id });
        statusPopup.showSuccess("Receiving log updated successfully");
      } else {
        for (const entry of entries) onCreate?.(buildPayload(entry));
        statusPopup.showSuccess(
          entries.length === 1
            ? "Receiving log created successfully"
            : `${entries.length} receiving logs created successfully`,
        );
      }
      onClose();
    } catch (err) {
      statusPopup.showError(
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
      statusPopup.hidePopup();
    }
  };

  const currentTabCols = TAB_GROUPS[activeTab].cols;
  const tabHasErrors = (tabIdx: number) =>
    entries.some((e) => TAB_GROUPS[tabIdx].cols.some((c) => e.errors[c.key]));
  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <div className="xls-root">
      {/* ══ TOPBAR ══ */}
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
            <span>Receiving Log</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit ? "Edit Entry" : "New Entries"}
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

      {/* ══ BODY ══ */}
      <AnimatePresence mode="wait">
        {step === "entry" ? (
          /* ── STEP 1: Data Entry ── */
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
                  {isEdit
                    ? "Edit Receiving Log Entry"
                    : "New Receiving Log Entries"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update entry details. Required fields are marked *."
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
              <div className="xls-tab-bar">
                {TAB_GROUPS.map((grp, idx) => (
                  <button
                    key={grp.id}
                    className={`xls-tab${activeTab === idx ? " active" : ""}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    {grp.label}
                    {tabHasErrors(idx) && (
                      <span className="xls-tab-errbadge">!</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="xls-table-outer" ref={scrollAreaRef}>
                <table className="xls-table">
                  <colgroup>
                    <col style={{ width: ROW_NUM_W }} />
                    {FROZEN_COLS.map((c) => (
                      <col key={c.key} style={{ width: c.width }} />
                    ))}
                    {currentTabCols.map((c) => (
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
                      <th colSpan={currentTabCols.length}>
                        <div className="xls-group-label">
                          {TAB_GROUPS[activeTab].label}
                        </div>
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
                      {currentTabCols.map((col) => (
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
                        const lastColIdx = currentTabCols.length - 1;
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
                                  value={(entry as any)[col.key]}
                                  error={entry.errors[col.key]}
                                  onChange={(v) =>
                                    handleChange(entry.id, col.key, v)
                                  }
                                />
                              </td>
                            ))}
                            {currentTabCols.map((col, colIdx) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={(entry as any)[col.key]}
                                  error={entry.errors[col.key]}
                                  onChange={(v) =>
                                    handleChange(entry.id, col.key, v)
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
                              <div className="xls-row-actions">
                                <button
                                  type="button"
                                  className="xls-row-btn"
                                  onClick={() => handleDuplicate(entry.id)}
                                  title="Duplicate row"
                                >
                                  <FiCopy size={13} />
                                </button>
                                {entries.length > 1 && (
                                  <button
                                    type="button"
                                    className="xls-row-btn del"
                                    onClick={() => handleRemove(entry.id)}
                                    title="Remove row"
                                  >
                                    <FiTrash2 size={13} />
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
                <button
                  type="button"
                  className="xls-add-row"
                  onClick={handleAddEntry}
                >
                  <FiPlus size={14} strokeWidth={2.5} />
                  Add Row
                </button>
              )}
            </div>

            <div className="xls-footer">
              <div className="xls-footer-meta">
                {!isEdit && entries.length > 1 && (
                  <span>
                    <strong>{completedCount}</strong> of{" "}
                    <strong>{entries.length}</strong> rows ready
                  </span>
                )}
                <span style={{ color: "var(--color-subtle)", fontSize: 13 }}>
                  Fields marked{" "}
                  <span style={{ color: "var(--color-error)" }}>*</span> are
                  required
                </span>
              </div>
              <div className="xls-footer-right">
                <button className="xls-btn xls-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="xls-btn xls-btn-primary"
                  onClick={handleGoToReview}
                >
                  <FiEye size={15} />
                  Review
                  {!isEdit && entries.length > 1 ? ` (${entries.length})` : ""}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── STEP 2: Review ── */
          <motion.div
            key="review"
            className="xls-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="rv-summary">
              <div className="rv-summary-left">
                <div className="rv-summary-icon">
                  <FiCheck size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="rv-summary-title">
                    {isEdit
                      ? "Review your edits"
                      : entries.length === 1
                        ? "Review before saving"
                        : `Review ${entries.length} entries before saving`}
                  </p>
                  <p className="rv-summary-sub">
                    {isEdit
                      ? "Check the details below, then confirm your changes."
                      : "All fields validated. Confirm the details are correct."}
                  </p>
                </div>
              </div>
              <button
                className="xls-btn xls-btn-outline"
                onClick={() => setStep("entry")}
              >
                <FiEdit3 size={14} />
                Go Back & Edit
              </button>
            </div>

            <div className="rv-layout">
              {entries.length > 1 && (
                <div className="rv-sidebar">
                  <div className="rv-sidebar-head">
                    {entries.length} Entries
                  </div>
                  <div className="rv-sidebar-list">
                    {entries.map((entry, idx) => (
                      <button
                        key={entry.id}
                        className={`rv-sidebar-item${reviewIdx === idx ? " active" : ""}`}
                        onClick={() => setReviewIdx(idx)}
                      >
                        <span className="rv-sidebar-num">{idx + 1}</span>
                        <div className="rv-sidebar-info">
                          <div className="rv-sidebar-casenum">
                            {entry.BookAndPages || "No book & pages"}
                          </div>
                          <div className="rv-sidebar-name">
                            {entry.CaseNo || "No case no."}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="rv-panel">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={reviewIdx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                  >
                    <ReviewCard entry={entries[reviewIdx]} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="xls-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="xls-btn xls-btn-ghost"
                  onClick={() => setStep("entry")}
                >
                  <FiArrowLeft size={14} />
                  Back to Edit
                </button>
                {entries.length > 1 && (
                  <div className="rv-pager">
                    <button
                      className="xls-btn-icon"
                      onClick={() => setReviewIdx((i) => Math.max(0, i - 1))}
                      disabled={reviewIdx === 0}
                    >
                      <FiChevronLeft size={15} />
                    </button>
                    <span className="rv-pager-info">
                      {reviewIdx + 1} / {entries.length}
                    </span>
                    <button
                      className="xls-btn-icon"
                      onClick={() =>
                        setReviewIdx((i) => Math.min(entries.length - 1, i + 1))
                      }
                      disabled={reviewIdx === entries.length - 1}
                    >
                      <FiChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
              <button
                className="xls-btn xls-btn-success"
                style={{
                  height: 50,
                  paddingLeft: 30,
                  paddingRight: 30,
                  fontSize: 16,
                }}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="xls-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave size={17} />
                    {isEdit
                      ? "Save Changes"
                      : entries.length === 1
                        ? "Confirm & Save"
                        : `Save All ${entries.length} Entries`}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReceiveDrawer;
