import {
  CellInput,
  usePopup,
  useToast,
  type ColDef,
} from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiEye,
  FiFileText,
  FiPlus,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import { NotarialFormEntry } from "./Notarial";
import ReviewCard from "./NotarialReviewCard";
import { NotarialRecord } from "./NotarialRow";

export type ModalType = "ADD" | "EDIT";
export type Step = "entry" | "review";

const uid = () => Math.random().toString(36).slice(2, 9);

const createEmptyEntry = (id: string): NotarialFormEntry => ({
  id,
  title: "",
  name: "",
  atty: "",
  date: "",
  link: "",
  file: null, // ✅ ADD

  errors: {},
  saved: false,
});

const recordToEntry = (id: string, r: NotarialRecord): NotarialFormEntry => ({
  id,
  title: r.title,
  name: r.name,
  atty: r.atty,
  date: r.date,
  link: r.link,

  errors: {},
  saved: false,
});

// ─── Column Definitions ───────────────────────────────────────────────────────

const FROZEN_COLS: ColDef<NotarialFormEntry>[] = [
  {
    key: "title",
    label: "Title",
    placeholder: "NO ENTRY REPORT (NOTARY)",
    type: "text",
    width: 260,
    required: true,
  },
  {
    key: "name",
    label: "Name",
    placeholder: "ATTY. JUAN DELA CRUZ",
    type: "text",
    width: 240,
    required: true,
  },
];

const DETAIL_COLS: ColDef<NotarialFormEntry>[] = [
  {
    key: "atty",
    label: "Attorney",
    placeholder: "ATTY. MARIA SANTOS",
    type: "text",
    width: 240,
    required: true,
  },
  {
    key: "date",
    label: "Date",
    placeholder: "",
    type: "date",
    width: 148,
    mono: true,
  },
  {
    key: "link",
    label: "File / Link",
    placeholder: "RTC-Data\\Notarial Files\\...",
    type: "text",
    width: 360,
    mono: true,
  },
];

const REQUIRED_FIELDS: Array<
  keyof Omit<NotarialFormEntry, "id" | "errors" | "saved">
> = ["title", "name", "atty"];

function validateEntry(entry: NotarialFormEntry): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "")
      errs[k as string] = "Required";
  });
  return errs;
}

const NotarialEdit = ({
  type,
  selectedRecord,
  selectedRecords,
  onClose,
  onCreate,
  onUpdate,
}: {
  type: ModalType;
  selectedRecord?: NotarialRecord | null;
  selectedRecords?: NotarialRecord[];
  onClose: () => void;
  onCreate?: (entries: NotarialFormEntry[]) => Promise<string | null>;
  onUpdate?: (entries: NotarialFormEntry[]) => Promise<string | null>;
}) => {
  const statusPopup = usePopup();
  const toast = useToast();
  const isEdit = type === "EDIT";
  const editRecords =
    selectedRecords && selectedRecords.length > 0
      ? selectedRecords
      : selectedRecord
        ? [selectedRecord]
        : [];
  const [step, setStep] = useState<Step>("entry");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [entryPage, setEntryPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const handleFileChange = (id: string, file: File | null) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              file,
              link: file ? file.name : e.link, // auto fill link display
            }
          : e,
      ),
    );
  };
  const [entries, setEntries] = useState<NotarialFormEntry[]>(() => {
    if (isEdit && editRecords.length > 0) {
      return editRecords.map((record) => recordToEntry(uid(), record));
    }
    return [createEmptyEntry(uid())];
  });

  useEffect(() => {
    setStep("entry");
    setEntryPage(1);

    if (isEdit) {
      if (editRecords.length > 0) {
        setEntries(editRecords.map((record) => recordToEntry(uid(), record)));
      }
      return;
    }

    setEntries([createEmptyEntry(uid())]);
  }, [type, selectedRecord, selectedRecords, isEdit]);

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
    setEntries((prev) => {
      const next = [...prev, createEmptyEntry(uid())];
      setEntryPage(Math.max(1, Math.ceil(next.length / ENTRY_ROWS_PER_PAGE)));
      return next;
    });
    setTimeout(() => {
      scrollAreaRef.current?.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
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

    setEntries([createEmptyEntry(uid())]);
    setEntryPage(1);
  }, [entries.length, statusPopup]);

  const handleRemove = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: string) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: NotarialFormEntry = {
      ...source,
      id: uid(),
      title: "",
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
      statusPopup.showError(
        "Please fill in all required fields before reviewing.",
      );
      return;
    }
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const label = isEdit
      ? entries.length === 1
        ? "Save changes to this record?"
        : `Save changes to ${entries.length} records?`
      : entries.length === 1
        ? "Create this record?"
        : `Create ${entries.length} records?`;
    const isConfirmed = await statusPopup.showConfirm(label);
    if (!isConfirmed) return;
    setIsSubmitting(true);
    let errorMessage: string | null = null;

    if (isEdit) {
      errorMessage = (await onUpdate?.(entries)) ?? null;
    } else {
      errorMessage = (await onCreate?.(entries)) ?? null;
    }

    if (errorMessage) {
      statusPopup.showError(errorMessage);
      setIsSubmitting(false);
      return;
    }

    toast.success(
      isEdit
        ? entries.length === 1
          ? "Notarial entry updated."
          : `${entries.length} notarial entries updated.`
        : entries.length === 1
          ? "Notarial entry created."
          : `${entries.length} notarial entries created.`,
    );
    setIsSubmitting(false);
    onClose();
  };

  const ROW_NUM_W = 48;
  const ACTION_W = 72;
  const ENTRY_ROWS_PER_PAGE = 10;
  const entryPageCount = Math.max(
    1,
    Math.ceil(entries.length / ENTRY_ROWS_PER_PAGE),
  );
  const entryPageStart = (entryPage - 1) * ENTRY_ROWS_PER_PAGE;
  const pagedEntries = entries.slice(
    entryPageStart,
    entryPageStart + ENTRY_ROWS_PER_PAGE,
  );

  useEffect(() => {
    setEntryPage((prev) => Math.min(prev, entryPageCount));
  }, [entryPageCount]);

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
            <span>Notarial</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit
                ? entries.length === 1
                  ? "Edit Record"
                  : "Edit Records"
                : "New Notarial Entries"}
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
                      ? "Edit Notarial Record"
                      : "Edit Notarial Records"
                    : "New Notarial Entries"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update record details. Required fields are marked *."
                  ) : (
                    <>
                      Fill rows like a spreadsheet —{" "}
                      <kbd className="xls-kbd">Tab</kbd> past the last cell to
                      add a new row.
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
                <button className="xls-tab active">
                  <FiFileText size={13} />
                  Notarial Info
                </button>
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
                    {DETAIL_COLS.map((c) => (
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
                      <th colSpan={DETAIL_COLS.length}>
                        <div className="xls-group-label">Notarial Info</div>
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
                      {DETAIL_COLS.map((col) => (
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
                      {pagedEntries.map((entry, rowIdx) => {
                        const lastColIdx = DETAIL_COLS.length - 1;
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
                              <span className="xls-rownum">
                                {entryPageStart + rowIdx + 1}
                              </span>
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
                                />
                              </td>
                            ))}
                            {DETAIL_COLS.map((col, colIdx) => (
                              <td key={col.key}>
                                {col.key === "link" ? (
                                  <div className="flex flex-col gap-1">
                                    {/* Upload File */}
                                    <input
                                      type="file"
                                      className="file-input file-input-xs file-input-bordered w-full"
                                      onChange={(e) =>
                                        handleFileChange(
                                          entry.id,
                                          e.target.files?.[0] || null,
                                        )
                                      }
                                    />

                                    {entry.link ? (
                                      <a
                                        href={entry.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono max-w-50 truncate"
                                      >
                                        {entry.link}
                                      </a>
                                    ) : null}
                                  </div>
                                ) : (
                                  <CellInput
                                    col={col}
                                    value={entry[col.key] as string}
                                    error={entry.errors[col.key as string]}
                                    onChange={(v) =>
                                      handleChange(
                                        entry.id,
                                        col.key as string,
                                        v,
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      handleCellKeyDown(
                                        e,
                                        entry.id,
                                        colIdx === lastColIdx,
                                      )
                                    }
                                  />
                                )}
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

              {entryPageCount > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-base-200/70 bg-base-100">
                  <span className="text-xs text-base-content/60">
                    Page {entryPage} of {entryPageCount}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="xls-btn-icon"
                      onClick={() =>
                        setEntryPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={entryPage === 1}
                      aria-label="Previous entry page"
                    >
                      <FiChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      className="xls-btn-icon"
                      onClick={() =>
                        setEntryPage((prev) =>
                          Math.min(entryPageCount, prev + 1),
                        )
                      }
                      disabled={entryPage === entryPageCount}
                      aria-label="Next entry page"
                    >
                      <FiChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

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
          /* ══ REVIEW ══ */
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
                        : `Review ${entries.length} records before saving`}
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
                    {entries.length} Records
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
                            {entry.title || "No title"}
                          </div>
                          <div className="rv-sidebar-name">
                            {entry.name || "No name"}
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
                        : `Save All ${entries.length} Records`}
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

export default NotarialEdit;
