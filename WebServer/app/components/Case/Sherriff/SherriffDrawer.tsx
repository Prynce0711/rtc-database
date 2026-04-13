"use client";

import { Sherriff } from "@/app/generated/prisma/client";
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
import { usePopup } from "@rtc-database/shared";
import {
  createSheriffCase,
  deleteSheriffCase,
  updateSheriffCase,
} from "./SherriffActions";

export enum SherriffDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

const today = new Date().toISOString().slice(0, 10);

type SherriffEntry = {
  id: number;
  ejfCaseNumber: string;
  date: string;
  name: string;
  mortgagee: string;
  mortgagor: string;
  remarks: string;
  updatedAt: Date | null;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
};

const emptyEntry = (id: number): SherriffEntry => ({
  id,
  ejfCaseNumber: "",
  date: today,
  name: "",
  mortgagee: "",
  mortgagor: "",
  remarks: "",
  updatedAt: null,
  errors: {},
  collapsed: false,
  saved: false,
});

const REQUIRED_FIELDS = ["ejfCaseNumber", "date", "name"] as const;

type ColDef = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};

const FROZEN_COLS: ColDef[] = [
  {
    key: "ejfCaseNumber",
    label: "EJF Case Number",
    placeholder: "EJF-2026-0001",
    type: "text",
    width: 220,
    required: true,
    mono: true,
  },
  {
    key: "date",
    label: "Date",
    placeholder: "",
    type: "date",
    width: 160,
    required: true,
    mono: true,
  },
];

type TabGroup = { id: string; label: string; cols: ColDef[] };

const TAB_GROUPS: TabGroup[] = [
  {
    id: "party",
    label: "Party Details",
    cols: [
      {
        key: "name",
        label: "Sheriff Name",
        placeholder: "Full name",
        type: "text",
        width: 240,
        required: true,
      },
      {
        key: "mortgagee",
        label: "Mortgagee",
        placeholder: "Mortgagee",
        type: "text",
        width: 240,
      },
      {
        key: "mortgagor",
        label: "Mortgagor",
        placeholder: "Mortgagor",
        type: "text",
        width: 240,
      },
      {
        key: "remarks",
        label: "Remarks",
        placeholder: "Optional remarks",
        type: "text",
        width: 280,
      },
    ],
  },
];

function validateEntry(entry: SherriffEntry): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "") errs[k] = "Required";
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

function ReviewCard({ entry }: { entry: SherriffEntry }) {
  const fmtDate = (d: Date | string | null) =>
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
            {entry.ejfCaseNumber || (
              <span style={{ opacity: 0.4 }}>No EJF case number</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.name || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No sheriff name entered
              </span>
            )}
          </div>
          {entry.remarks && (
            <div className="rv-hero-charge">{entry.remarks}</div>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Record Information</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">EJF Case Number</div>
                <div className="rv-field-value rv-mono">
                  {entry.ejfCaseNumber || <span className="rv-empty">-</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.date) || <span className="rv-empty">-</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Sheriff Name</div>
                <div className="rv-field-value">
                  {entry.name || <span className="rv-empty">-</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiMapPin size={13} />
              <span>Party Details</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Mortgagee</div>
                <div className="rv-field-value">
                  {entry.mortgagee || <span className="rv-empty">-</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Mortgagor</div>
                <div className="rv-field-value">
                  {entry.mortgagor || <span className="rv-empty">-</span>}
                </div>
              </div>
              {entry.remarks && (
                <div className="rv-field">
                  <div className="rv-label">Remarks</div>
                  <div className="rv-field-value">{entry.remarks}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SherriffDrawer = ({
  type,
  onClose,
  selectedLog = null,
  selectedLogs,
}: {
  type: SherriffDrawerType;
  onClose: () => void;
  selectedLog?: Sherriff | null;
  selectedLogs?: Array<Sherriff>;
}) => {
  const isEdit = type === SherriffDrawerType.EDIT;
  const editLogs =
    selectedLogs && selectedLogs.length > 0
      ? selectedLogs
      : selectedLog
        ? [selectedLog]
        : [];

  const statusPopup = usePopup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [activeTab, setActiveTab] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const nextTempIdRef = useRef<number>(-1000);

  const makeFromLog = (log: Sherriff): SherriffEntry => ({
    id: log.id ?? nextTempIdRef.current--,
    ejfCaseNumber: log.ejfCaseNumber ?? "",
    date: log.date ? String(log.date).slice(0, 10) : today,
    name: log.name ?? "",
    mortgagee: log.mortgagee ?? "",
    mortgagor: log.mortgagor ?? "",
    remarks: log.remarks ?? "",
    updatedAt: log.updatedAt ? new Date(log.updatedAt) : null,
    errors: {},
    collapsed: false,
    saved: false,
  });

  const [entries, setEntries] = useState<SherriffEntry[]>(() => {
    if (isEdit && editLogs.length > 0) return editLogs.map(makeFromLog);
    return [emptyEntry(nextTempIdRef.current--)];
  });

  useEffect(() => {
    if (isEdit) {
      if (editLogs.length > 0) {
        setEntries(editLogs.map(makeFromLog));
      }
    } else {
      setEntries([emptyEntry(nextTempIdRef.current--)]);
    }
    setStep("entry");
    setActiveTab(0);
  }, [type, selectedLog, selectedLogs]);

  const handleChange = (id: number, field: string, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: value, errors: { ...e.errors, [field]: "" } }
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback(() => {
    setEntries((prev) => [...prev, emptyEntry(nextTempIdRef.current--)]);
    setTimeout(() => {
      scrollAreaRef.current?.scrollTo({
        top: scrollAreaRef.current?.scrollHeight ?? 0,
        behavior: "smooth",
      });
    }, 60);
  }, []);

  const handleClearTable = useCallback(async () => {
    const label =
      entries.length === 1
        ? "Clear the table and reset the current row?"
        : `Clear all ${entries.length} rows and start over?`;

    if (!(await statusPopup.showConfirm(label))) return;

    setEntries([emptyEntry(nextTempIdRef.current--)]);
  }, [entries.length, statusPopup]);

  const handleRemove = (id: number) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: number) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: SherriffEntry = {
      ...source,
      id: nextTempIdRef.current--,
      ejfCaseNumber: "",
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
    entryId: number,
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

  const buildPayload = (e: SherriffEntry) => ({
    ejfCaseNumber: e.ejfCaseNumber,
    date: e.date,
    name: e.name,
    mortgagee: e.mortgagee || null,
    mortgagor: e.mortgagor || null,
    remarks: e.remarks || null,
  });

  const handleSubmit = async () => {
    const label = isEdit
      ? entries.length === 1
        ? "Save changes to this sheriff entry?"
        : `Save changes to ${entries.length} sheriff entries?`
      : entries.length === 1
        ? "Create this sheriff entry?"
        : `Create ${entries.length} sheriff entries?`;
    if (!(await statusPopup.showConfirm(label))) return;

    setIsSubmitting(true);
    statusPopup.showLoading(
      isEdit ? "Updating entry..." : "Creating entry(ies)...",
    );

    const rollbackCreatedLogs = async (
      createdIds: number[],
    ): Promise<string[]> => {
      if (createdIds.length === 0) return [];

      const rollbackResults = await Promise.allSettled(
        createdIds.map((id) => deleteSheriffCase(id)),
      );

      const rollbackErrors: string[] = [];

      rollbackResults.forEach((result, index) => {
        if (result.status === "rejected") {
          rollbackErrors.push(
            `Rollback failed for sheriff ID ${createdIds[index]}`,
          );
          return;
        }

        if (!result.value.success) {
          const message =
            "error" in result.value
              ? result.value.error
              : "Unknown rollback error";
          rollbackErrors.push(
            `Rollback failed for sheriff ID ${createdIds[index]}: ${message}`,
          );
        }
      });

      return rollbackErrors;
    };

    try {
      if (isEdit) {
        if (entries.length !== editLogs.length) {
          statusPopup.showError("Sheriff row count mismatch. Please reload.");
          return;
        }

        for (let index = 0; index < entries.length; index++) {
          const target = editLogs[index];
          if (!target?.id) {
            statusPopup.showError(`Missing sheriff id for row ${index + 1}`);
            return;
          }

          const result = await updateSheriffCase(
            target.id,
            buildPayload(entries[index]),
          );
          if (!result.success || !result.result) {
            statusPopup.showError(`Update failed for row ${index + 1}`);
            return;
          }
        }

        statusPopup.showSuccess(
          entries.length === 1
            ? "Sheriff record updated successfully"
            : `${entries.length} sheriff records updated successfully`,
        );
      } else {
        const createdIds: number[] = [];

        for (let index = 0; index < entries.length; index++) {
          const entry = entries[index];
          const result = await createSheriffCase(buildPayload(entry));
          if (!result.success || !result.result) {
            const rollbackErrors = await rollbackCreatedLogs(createdIds);
            setStep("entry");
            statusPopup.showError(
              [
                `Failed to create row ${index + 1}.`,
                rollbackErrors.length > 0
                  ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                  : "Any created rows in this batch were rolled back.",
              ].join(" "),
            );
            return;
          }

          createdIds.push(result.result.id);
        }

        statusPopup.showSuccess(
          entries.length === 1
            ? "Sheriff record created successfully"
            : `${entries.length} sheriff records created successfully`,
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
    }
  };

  const currentTabCols = TAB_GROUPS[activeTab].cols;
  const tabHasErrors = (tabIdx: number) =>
    entries.some((e) => TAB_GROUPS[tabIdx].cols.some((c) => e.errors[c.key]));
  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <div className="xls-root">
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
            <span>Sheriff</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit
                ? entries.length === 1
                  ? "Edit Entry"
                  : "Edit Entries"
                : "New Entries"}
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
                  {isEdit
                    ? entries.length === 1
                      ? "Edit Sheriff Entry"
                      : "Edit Sheriff Entries"
                    : "New Sheriff Entries"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update entry details. Required fields are marked *."
                  ) : (
                    <>
                      Fill rows like a spreadsheet -{" "}
                      <kbd className="xls-kbd">Tab</kbd>
                      past the last cell to add a new row.
                    </>
                  )}
                </p>
                {!isEdit && (
                  <div
                    className="xls-pills"
                    style={{
                      marginTop: 10,
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
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
                {!isEdit && (
                  <button
                    type="button"
                    className="xls-btn xls-btn-ghost"
                    onClick={() => void handleClearTable()}
                    style={{ marginLeft: "auto" }}
                  >
                    <FiTrash2 size={14} />
                    Clear Table
                  </button>
                )}
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
          <motion.div
            key="review"
            className="xls-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="border-none rv-summary">
              <div className="rv-summary-left">
                <div>
                  <p className="text-4xl font-black">
                    {isEdit
                      ? "Review your edits"
                      : entries.length === 1
                        ? "Review before saving"
                        : `Review ${entries.length} entries before saving`}
                  </p>
                  <p className="font-light text-md mt-1">
                    {isEdit
                      ? "Check the details below, then confirm your changes."
                      : "All fields validated. Confirm the details are correct."}
                  </p>
                </div>
              </div>
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
                            {entry.ejfCaseNumber || "No EJF case number"}
                          </div>
                          <div className="rv-sidebar-name">
                            {entry.name || "No sheriff name"}
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

export default SherriffDrawer;

