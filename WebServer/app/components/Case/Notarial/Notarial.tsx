"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBarChart2,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit,
  FiEdit3,
  FiExternalLink,
  FiEye,
  FiFileText,
  FiFolder,
  FiLock,
  FiMoreHorizontal,
  FiPlus,
  FiSave,
  FiSearch,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import FilterModal from "../../Filter/FilterModal";
import { FilterOption, FilterValues } from "../../Filter/FilterTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotarialRecord = {
  id: number;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;
};

type NotarialFilterValues = {
  title?: string;
  name?: string;
  atty?: string;
  date?: { start?: string; end?: string };
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RECORDS: NotarialRecord[] = [
  {
    id: 1,
    title: "NO ENTRY REPORT (NOTARY)",
    name: "ATTY. MELBA G. AGUSTIN-DAVID",
    atty: "ATTY. JUSTIN G. SAMBILE",
    date: "",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. SAMBILE-NOTARIAL REPORT\\2025-09 - No Entry Report (Notary).pdf",
  },
  {
    id: 2,
    title: "NOTARIAL REGISTER",
    name: "ATTY. JOSE P. REYES",
    atty: "ATTY. MARIA S. SANTOS",
    date: "2025-08-15",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. REYES-NOTARIAL REGISTER\\2025-08 - Notarial Register.pdf",
  },
  {
    id: 3,
    title: "MONTHLY REPORT",
    name: "ATTY. ANA L. GARCIA",
    atty: "ATTY. CARLOS B. DELA CRUZ",
    date: "2025-07-30",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. GARCIA-MONTHLY REPORT\\2025-07 - Monthly Report.pdf",
  },
  {
    id: 4,
    title: "NO ENTRY REPORT (NOTARY)",
    name: "ATTY. ROBERTO M. VILLANUEVA",
    atty: "ATTY. ELENA C. FERNANDEZ",
    date: "2025-09-01",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. VILLANUEVA-NOTARIAL REPORT\\2025-09 - No Entry Report.pdf",
  },
  {
    id: 5,
    title: "ANNUAL NOTARIAL REPORT",
    name: "ATTY. LOURDES P. BAUTISTA",
    atty: "ATTY. DANTE R. MORALES",
    date: "2024-12-31",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. BAUTISTA-ANNUAL REPORT\\2024 - Annual Notarial Report.pdf",
  },
];

const NOTARIAL_FILTER_OPTIONS: FilterOption[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "atty", label: "Attorney", type: "text" },
  { key: "date", label: "Date", type: "daterange" },
];

// ─── Form Types ───────────────────────────────────────────────────────────────

type FormEntry = {
  id: string;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;

  file?: File | null; // ✅ ADD THIS

  errors: Record<string, string>;
  saved: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const createEmptyEntry = (id: string): FormEntry => ({
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

const recordToEntry = (id: string, r: NotarialRecord): FormEntry => ({
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

type ColDef = {
  key: keyof Omit<FormEntry, "id" | "errors" | "saved">;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};

const FROZEN_COLS: ColDef[] = [
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

const DETAIL_COLS: ColDef[] = [
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

const REQUIRED_FIELDS: Array<keyof Omit<FormEntry, "id" | "errors" | "saved">> =
  ["title", "name", "atty"];

function validateEntry(entry: FormEntry): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "")
      errs[k as string] = "Required";
  });
  return errs;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const PAGE_SIZE = 25;

// ─── Cell Input ───────────────────────────────────────────────────────────────

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

// ─── Review Card ──────────────────────────────────────────────────────────────

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
            {entry.atty || <span style={{ opacity: 0.4 }}>No Attorney</span>}
          </div>
          <div className="rv-hero-name">
            {entry.title || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No title entered
              </span>
            )}
          </div>
          {entry.name && <div className="rv-hero-charge">{entry.name}</div>}
        </div>
        <div className="rv-hero-badges">
          {entry.date && (
            <span className="rv-badge rv-badge-court">
              {fmtDate(entry.date)}
            </span>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Record Details</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">Title</div>
                <div className="rv-field-value">
                  {entry.title || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Name</div>
                <div className="rv-field-value">
                  {entry.name || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Attorney</div>
                <div className="rv-field-value">
                  {entry.atty || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.date) || <span className="rv-empty">—</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiFolder size={13} />
              <span>File Location</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field" style={{ gridColumn: "1 / -1" }}>
                <div className="rv-field-label">Link / File Path</div>
                <div
                  className="rv-field-value rv-mono"
                  style={{ fontSize: 12, wordBreak: "break-all" }}
                >
                  {entry.file ? (
                    <span>{entry.file.name}</span>
                  ) : entry.link ? (
                    <span>{entry.link}</span>
                  ) : (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add/Edit Full-Page Modal ─────────────────────────────────────────────────

type ModalType = "ADD" | "EDIT";
type Step = "entry" | "review";

const NotarialModal = ({
  type,
  selectedRecord,
  onClose,
  onCreate,
  onUpdate,
}: {
  type: ModalType;
  selectedRecord?: NotarialRecord | null;
  onClose: () => void;
  onCreate?: (data: NotarialRecord) => void;
  onUpdate?: (data: NotarialRecord) => void;
}) => {
  const isEdit = type === "EDIT";
  const [step, setStep] = useState<Step>("entry");
  const [reviewIdx, setReviewIdx] = useState(0);
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
  const [entries, setEntries] = useState<FormEntry[]>(() => {
    if (isEdit && selectedRecord) return [recordToEntry(uid(), selectedRecord)];
    return [createEmptyEntry(uid())];
  });

  useEffect(() => {
    if (!isEdit) {
      setEntries([createEmptyEntry(uid())]);
      setStep("entry");
    }
  }, [type, selectedRecord, isEdit]);

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
      alert("Please fill in all required fields before reviewing.");
      return;
    }
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this record?"
      : entries.length === 1
        ? "Create this record?"
        : `Create ${entries.length} records?`;
    if (!confirm(label)) return;
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    if (isEdit && selectedRecord) {
      const e = entries[0];
      onUpdate?.({
        ...selectedRecord,
        title: e.title,
        name: e.name,
        atty: e.atty,
        date: e.date,
        link: e.link,
      });
    } else {
      entries.forEach((e, i) => {
        onCreate?.({
          id: Date.now() + i,
          title: e.title,
          name: e.name,
          atty: e.atty,
          date: e.date,
          link: e.link,
        });
      });
    }
    setIsSubmitting(false);
    onClose();
  };

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
            <span>Notarial</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit ? "Edit Record" : "New Notarial Entries"}
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
                  {isEdit ? "Edit Notarial Record" : "New Notarial Entries"}
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
                <button className="xls-tab active">
                  <FiFileText size={13} />
                  Notarial Info
                </button>
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
                      {entries.map((entry, rowIdx) => {
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
                                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono max-w-[200px] truncate"
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
                        : `Review ${entries.length} records before saving`}
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

// ─── Sort TH ─────────────────────────────────────────────────────────────────

type SortConfig = { key: keyof NotarialRecord; order: "asc" | "desc" };

const SortTh = ({
  label,
  colKey,
  sortConfig,
  onSort,
}: {
  label: string;
  colKey: keyof NotarialRecord;
  sortConfig: SortConfig;
  onSort: (k: keyof NotarialRecord) => void;
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

// ─── Filter Logic ─────────────────────────────────────────────────────────────

const applyNotarialFilters = (
  filters: NotarialFilterValues,
  items: NotarialRecord[],
): NotarialRecord[] =>
  items.filter((r) => {
    if (
      filters.title &&
      !r.title.toLowerCase().includes(filters.title.toLowerCase())
    )
      return false;
    if (
      filters.name &&
      !r.name.toLowerCase().includes(filters.name.toLowerCase())
    )
      return false;
    if (
      filters.atty &&
      !r.atty.toLowerCase().includes(filters.atty.toLowerCase())
    )
      return false;
    if (filters.date) {
      if (!r.date) return false;
      const d = new Date(r.date);
      if (filters.date.start && d < new Date(filters.date.start)) return false;
      if (filters.date.end && d > new Date(filters.date.end)) return false;
    }
    return true;
  });

// ─── Row Component ────────────────────────────────────────────────────────────

const NotarialRow = ({
  record,
  onEdit,
  onDelete,
  onRowClick,
}: {
  record: NotarialRecord;
  onEdit: (r: NotarialRecord) => void;
  onDelete: (id: number) => void;
  onRowClick: (r: NotarialRecord) => void;
}) => (
  <tr
    className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
    onClick={() => onRowClick(record)}
  >
    <td onClick={(e) => e.stopPropagation()} className="text-center">
      <div className="flex justify-center">
        <div className="dropdown dropdown-start">
          <button tabIndex={0} className="btn btn-ghost btn-sm px-2">
            <FiMoreHorizontal size={18} />
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-44 border border-base-200"
            style={{ zIndex: 9999 }}
          >
            <li>
              <button
                className="flex items-center gap-3 text-info"
                onClick={(e) => {
                  e.stopPropagation();
                  onRowClick(record);
                }}
              >
                <FiEye size={16} />
                <span>View</span>
              </button>
            </li>
            <li>
              <button
                className="flex items-center gap-3 text-warning"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(record);
                }}
              >
                <FiEdit size={16} />
                <span>Edit</span>
              </button>
            </li>
            <li>
              <button
                className="flex items-center gap-3 text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(record.id);
                }}
              >
                <FiTrash2 size={16} />
                <span>Delete</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </td>
    <td className="font-semibold text-center max-w-[220px]">
      <span className="line-clamp-2">{record.title}</span>
    </td>
    <td className="text-center">{record.name}</td>
    <td className="text-center">{record.atty}</td>
    <td className="text-center text-base-content/70">
      {formatDate(record.date)}
    </td>
    <td className="text-center" onClick={(e) => e.stopPropagation()}>
      {record.link ? (
        <a
          href="#"
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono max-w-[200px] truncate"
          title={record.link}
        >
          <FiExternalLink size={12} />
          <span className="truncate">{record.link.split("\\").pop()}</span>
        </a>
      ) : (
        <span className="text-base-content/30">—</span>
      )}
    </td>
  </tr>
);

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
    const n = Number((val ?? ellipsisValue).trim());
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
          disabled={currentPage >= pageCount}
        >
          <GrFormNext className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const NotarialPage: React.FC = () => {
  const router = useRouter();
  const [records, setRecords] = useState<NotarialRecord[]>(MOCK_RECORDS);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    order: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<NotarialRecord | null>(
    null,
  );

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<NotarialFilterValues>(
    {},
  );
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<
    NotarialRecord[]
  >([]);

  const isAdminOrAtty = true;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, appliedFilters]);

  const handleSort = (key: keyof NotarialRecord) =>
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));

  const getSuggestions = (key: string, inputValue: string): string[] => {
    const textKeys = ["title", "name", "atty"];
    if (!textKeys.includes(key)) return [];
    const values = records
      .map((r) => (r[key as keyof NotarialRecord] as string) || "")
      .filter(Boolean);
    const unique = Array.from(new Set(values)).sort();
    if (!inputValue) return unique;
    return unique.filter((v) =>
      v.toLowerCase().includes(inputValue.toLowerCase()),
    );
  };

  const handleApplyFilters = (filters: FilterValues) => {
    const typed = filters as NotarialFilterValues;
    setAppliedFilters(typed);
    setFilteredByAdvanced(applyNotarialFilters(typed, records));
  };

  const filteredAndSorted = useMemo(() => {
    const baseList =
      Object.keys(appliedFilters).length > 0 ? filteredByAdvanced : records;
    let filtered = baseList;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = baseList.filter((r) =>
        Object.values(r).some((v) =>
          v?.toString().toLowerCase().includes(lower),
        ),
      );
    }
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      if (aVal < bVal) return sortConfig.order === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });
  }, [records, searchTerm, sortConfig, appliedFilters, filteredByAdvanced]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  const stats = useMemo(() => {
    const total = records.length;
    const now = new Date();
    const thisMonth = records.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    const attorneys = new Set(records.map((r) => r.atty)).size;
    const noDate = records.filter((r) => !r.date).length;
    return { total, thisMonth, attorneys, noDate };
  }, [records]);

  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
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

  // ── Full-page modal — same as Proceedings/CasePage ──
  if (modalType) {
    return (
      <NotarialModal
        type={modalType}
        selectedRecord={selectedRecord}
        onClose={() => {
          setModalType(null);
          setSelectedRecord(null);
        }}
        onCreate={(r) => setRecords((prev) => [r, ...prev])}
        onUpdate={(r) =>
          setRecords((prev) => prev.map((x) => (x.id === r.id ? r : x)))
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Notarial Records
          </h2>
          <p className="text-xl text-base-content/70">
            Manage notarial reports and filings
          </p>
        </div>

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
              <input
                type="text"
                placeholder="Search by title, name, attorney..."
                className="input input-bordered input-lg w-full pl-12 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              className={`btn btn-outline ${activeFilterCount > 0 ? "btn-primary" : ""}`}
              onClick={() => setFilterModalOpen((prev) => !prev)}
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
                  setSelectedRecord(null);
                  setModalType("ADD");
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
                Add Record
              </button>
            )}
          </div>

          <FilterModal
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={NOTARIAL_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            initialValues={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Records",
              value: stats.total ?? 0,
              subtitle: `${stats.noDate ?? 0} missing dates`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "This Month",
              value: stats.thisMonth ?? 0,
              subtitle: `${stats.thisMonth ?? 0} entries this month`,
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "Unique Attorneys",
              value: stats.attorneys ?? 0,
              subtitle: `${stats.attorneys ?? 0} attorneys`,
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "No Date",
              value: stats.noDate ?? 0,
              subtitle: `Records without date`,
              icon: FiLock,
              delay: 300,
            },
          ].map((card, idx) => {
            const Icon = card.icon as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >;
            return (
              <div
                key={idx}
                className={`transform hover:scale-105 card surface-card-hover group`}
                style={{
                  transitionDelay: `${card.delay}ms`,
                  transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                <div
                  className="card-body relative overflow-hidden"
                  style={{ padding: "var(--space-card-padding)" }}
                >
                  <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                    <Icon className="h-full w-full" />
                  </div>
                  <div className="relative text-center">
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-muted">
                        {card.label}
                      </span>
                    </div>
                    <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                      {card.value}
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-muted">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-base-300 rounded-lg shadow overflow-x-auto">
          <table className="table table-zebra w-full text-center">
            <thead>
              <tr className="text-center">
                {isAdminOrAtty && <th>ACTIONS</th>}
                <SortTh
                  label="TITLE"
                  colKey="title"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="NAME"
                  colKey="name"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="ATTORNEY"
                  colKey="atty"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE"
                  colKey="date"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th>LINK</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-base-content/50"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <NotarialRow
                    key={r.id}
                    record={r}
                    onEdit={(item) => {
                      setSelectedRecord(item);
                      setModalType("EDIT");
                    }}
                    onDelete={handleDelete}
                    onRowClick={(item) =>
                      router.push(`/user/cases/notarial/${item.id}`)
                    }
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
      </main>
    </div>
  );
};

export default NotarialPage;
