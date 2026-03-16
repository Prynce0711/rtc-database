"use client";

import TipCell from "@/app/components/Table/TipCell";
import { CaseType } from "@/app/generated/prisma/enums";
import { useSession } from "@/app/lib/authClient";
import { isTextFieldKey } from "@/app/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBarChart2,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiDownload,
  FiEdit,
  FiEdit3,
  FiEye,
  FiFileText,
  FiFolder,
  FiLock,
  FiMoreHorizontal,
  FiPlus,
  FiSave,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import FilterModal from "../../Filter/FilterModal";
import {
  ExactMatchMap,
  FilterOption,
  FilterValues,
} from "../../Filter/FilterTypes";
import { usePopup } from "../../Popup/PopupProvider";
import { PageListSkeleton } from "../../Skeleton/SkeletonTable";
import {
  createCivilCase,
  deleteCivilCase,
  getCivilCases,
  getCivilCaseStats,
  updateCivilCase,
} from "./CivilActions";
import { exportCasesExcel, uploadExcel } from "./ExcelActions";
import {
  calculateCivilCaseStats,
  CivilCaseSchema,
  type CivilCaseData,
  type CivilCaseFilters,
  type CivilCasesFilterOptions,
  type CivilCaseStats,
} from "./schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotarialRecord = {
  id: number;
  title: string;
  name: string;
  atty: string;
  defendant?: string;
  date: string;
  notes?: string;
  nature?: string;
};

type CaseFilterValues = CivilCaseFilters;
type SortKey = NonNullable<CivilCasesFilterOptions["sortKey"]>;
type CaseFilters = NonNullable<CivilCasesFilterOptions["filters"]>;

const CASE_FILTER_OPTIONS: FilterOption[] = [
  { key: "branch", label: "Branch", type: "text" },
  { key: "assistantBranch", label: "Assistant Branch", type: "text" },
  { key: "caseNumber", label: "Case Number", type: "text" },
  { key: "petitioners", label: "Petitioner/s", type: "text" },
  { key: "defendants", label: "Defendant/s", type: "text" },
  { key: "dateFiled", label: "Date Filed", type: "daterange" },
  { key: "notes", label: "Notes", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
];

// ─── Form Types ───────────────────────────────────────────────────────────────

type FormEntry = {
  id: string;
  title: string;
  name: string;
  atty: string;
  defendant?: string;
  date: string;
  notes?: string;
  nature?: string;

  file?: File | null;

  errors: Record<string, string>;
  saved: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const createEmptyEntry = (id: string): FormEntry => ({
  id,
  title: "",
  name: "",
  atty: "",
  defendant: "",
  date: "",
  notes: "",
  nature: "",
  file: null,

  errors: {},
  saved: false,
});

const recordToEntry = (id: string, r: NotarialRecord): FormEntry => ({
  id,
  title: r.title,
  name: r.name,
  atty: r.atty,
  defendant: r.defendant ?? "",
  date: r.date,
  notes: r.notes ?? "",
  nature: r.nature ?? "",

  errors: {},
  saved: false,
});

const caseToRecord = (c: CivilCaseData): NotarialRecord => ({
  id: c.id,
  title: c.caseNumber ?? "",
  name: c.branch ?? "",
  atty: c.petitioners ?? "",
  defendant: c.defendants ?? "",
  date: c.dateFiled ? new Date(c.dateFiled).toISOString().slice(0, 10) : "",
  notes: c.notes ?? "",
  nature: c.nature ?? "",
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
    label: "Case Number",
    placeholder: "01-M-2006",
    type: "text",
    width: 260,
    required: true,
  },
  {
    key: "name",
    label: "Branch",
    placeholder: "18",
    type: "text",
    width: 240,
    required: true,
  },
];

const DETAIL_COLS: ColDef[] = [
  {
    key: "atty",
    label: "Petitioner/s",
    placeholder: "MARICEL L. PINEDA",
    type: "text",
    width: 300,
    required: true,
  },
  {
    key: "defendant",
    label: "Defendant/s",
    placeholder: "MUNER JAHER",
    type: "text",
    width: 300,
  },
  {
    key: "date",
    label: "Date Filed",
    placeholder: "",
    type: "date",
    width: 148,
    mono: true,
  },
  {
    key: "notes",
    label: "Notes/Appealed",
    placeholder: "Appealed",
    type: "text",
    width: 240,
    mono: true,
  },
  {
    key: "nature",
    label: "Nature of Petition",
    placeholder: "Support",
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

const PAGE_SIZE = 15;

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
            {entry.title || (
              <span style={{ opacity: 0.4 }}>No case number</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.atty || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>No petitioners</span>
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
                <div className="rv-field-label">Case Number</div>
                <div className="rv-field-value">
                  {entry.title || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Branch</div>
                <div className="rv-field-value">
                  {entry.name || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Petitioner/s</div>
                <div className="rv-field-value">
                  {entry.atty || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date Filed</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.date) || <span className="rv-empty">—</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiFolder size={13} />
              <span>File</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field" style={{ gridColumn: "1 / -1" }}>
                <div className="rv-field-label">Attachment</div>
                <div
                  className="rv-field-value rv-mono"
                  style={{ fontSize: 12, wordBreak: "break-all" }}
                >
                  {entry.file ? (
                    <span>{entry.file.name}</span>
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
  onCreate?: () => void;
  onUpdate?: () => void;
}) => {
  const statusPopup = usePopup();
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
      statusPopup.showError(
        "Please fill in all required fields before reviewing.",
      );
      return;
    }
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildPayload = (entry: FormEntry) => {
    const payload = {
      caseNumber: entry.title.trim(),
      branch: entry.name.trim() || null,
      assistantBranch: entry.name.trim() || null,
      dateFiled: entry.date ? new Date(entry.date).toISOString() : null,
      caseType: CaseType.CIVIL,
      petitioners: entry.atty.trim() || null,
      defendants: entry.defendant?.trim() || null,
      notes: entry.notes?.trim() || null,
      nature: entry.nature?.trim() || null,
      originCaseNumber: null,
      reRaffleDate: null,
      reRaffleBranch: null,
      consolitationDate: null,
      consolidationBranch: null,
      dateRemanded: null,
      remandedNote: null,
    };

    return CivilCaseSchema.safeParse(payload);
  };

  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this case?"
      : entries.length === 1
        ? "Create this case?"
        : `Create ${entries.length} cases?`;
    if (!(await statusPopup.showConfirm(label))) return;
    setIsSubmitting(true);
    statusPopup.showLoading(
      isEdit ? "Updating case..." : "Creating case(s)...",
    );
    try {
      if (isEdit && selectedRecord) {
        const entry = entries[0];
        if (entry.title.trim() !== selectedRecord.title.trim()) {
          throw new Error("Case number cannot be changed");
        }
        const parsed = buildPayload(entry);
        if (!parsed.success) throw new Error("Invalid case data");
        const response = await updateCivilCase(selectedRecord.id, parsed.data);
        if (!response.success)
          throw new Error(response.error || "Failed to update case");
        onUpdate?.();
        statusPopup.showSuccess("Case updated successfully");
      } else {
        for (const entry of entries) {
          const parsed = buildPayload(entry);
          if (!parsed.success) throw new Error("Invalid case data");
          const response = await createCivilCase(parsed.data);
          if (!response.success)
            throw new Error(response.error || "Failed to create case");
          onCreate?.();
        }
        statusPopup.showSuccess(
          entries.length === 1
            ? "Case created successfully"
            : `${entries.length} cases created successfully`,
        );
      }

      onClose();
    } catch (err) {
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to save case",
      );
    } finally {
      setIsSubmitting(false);
      statusPopup.hidePopup();
    }
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
            <span>Civil Cases</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit ? "Edit Civil Case" : "New Civil Case"}
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
                  {isEdit ? "Edit Civil Case" : "New Civil Case"}
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
                  Civil Case Info
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
                        <div className="xls-group-label">Civil Case Info</div>
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
                            {entry.title || "No case number"}
                          </div>
                          <div className="rv-sidebar-name">
                            {entry.atty || "No petitioners"}
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

type SortConfig = { key: SortKey; order: "asc" | "desc" };

const SortTh = ({
  label,
  colKey,
  sortConfig,
  onSort,
}: {
  label: string;
  colKey: SortKey;
  sortConfig: SortConfig;
  onSort: (k: SortKey) => void;
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
    <TipCell
      label="Case Number"
      value={record.title}
      truncate
      className="font-semibold"
    />
    <TipCell label="Branch" value={record.name} truncate />
    <TipCell label="Petitioner/s" value={record.atty} truncate />
    <TipCell label="Defendant/s" value={record.defendant} truncate />
    <TipCell
      label="Date Filed"
      value={formatDate(record.date)}
      className="text-base-content/70"
    />
    <TipCell label="Notes/Appealed" value={record.notes} />
    <TipCell label="Nature of Petition" value={record.nature} />
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

const Civil: React.FC = () => {
  const router = useRouter();
  const statusPopup = usePopup();
  const [records, setRecords] = useState<NotarialRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<NotarialRecord | null>(
    null,
  );
  const [stats, setStats] = useState<CivilCaseStats>({
    totalCases: 0,
    reRaffledCases: 0,
    remandedCases: 0,
    recentlyFiled: 0,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "dateFiled",
    order: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<CaseFilterValues>({});
  const [exactMatchMap, setExactMatchMap] = useState<ExactMatchMap>({});

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === "admin" ||
    session?.data?.user?.role === "atty";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const fetchCases = useCallback(
    async (page = currentPage) => {
      try {
        setLoading(true);
        const [casesRes, statsRes] = await Promise.all([
          getCivilCases({
            page,
            pageSize: PAGE_SIZE,
            filters: appliedFilters,
            sortKey: sortConfig.key,
            sortOrder: sortConfig.order,
            exactMatchMap,
          }),
          getCivilCaseStats({
            filters: appliedFilters,
            exactMatchMap,
          }),
        ]);

        if (!casesRes.success) {
          statusPopup.showError(casesRes.error || "Failed to fetch cases");
          return;
        }

        if (!casesRes.result) {
          statusPopup.showError("Failed to fetch cases");
          return;
        }

        const result = casesRes.result;
        setRecords(result.items.map(caseToRecord));
        setTotalCount(result.total ?? result.items.length);
        setStats(calculateCivilCaseStats(result.items));

        if (statsRes.success && statsRes.result) {
          setStats(statsRes.result);
        } else if (!statsRes.success) {
          console.error("Failed to fetch case stats", statsRes.error);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch cases");
        console.error("Error fetching cases:", err);
      } finally {
        setLoading(false);
      }
    },
    [
      appliedFilters,
      currentPage,
      exactMatchMap,
      sortConfig.key,
      sortConfig.order,
      statusPopup,
    ],
  );

  useEffect(() => {
    fetchCases(currentPage);
  }, [fetchCases, currentPage]);

  const getCaseSuggestions = async (
    key: string,
    inputValue: string,
  ): Promise<string[]> => {
    const isTextField = isTextFieldKey(
      CASE_FILTER_OPTIONS.reduce(
        (acc, opt) => {
          acc[opt.key] = opt.type;
          return acc;
        },
        {} as Record<string, string>,
      ),
      key,
    );

    if (!isTextField) return [];

    const res = await getCivilCases({
      page: 1,
      pageSize: 10,
      filters: { [key]: inputValue } as CaseFilters,
      exactMatchMap: { [key]: false },
      sortKey: key as SortKey,
      sortOrder: "asc",
    });

    if (!res.success || !res.result) return [];
    const items = Array.isArray(res.result)
      ? res.result
      : (res.result.items as CivilCaseData[]);

    const values = items
      .map((c) => (c[key as keyof CivilCaseData] as string | null) || "")
      .filter((v) => v.length > 0);

    return Array.from(new Set(values)).sort().slice(0, 10);
  };

  const handleApplyFilters = (
    filters: FilterValues,
    exactMatchMapParam: ExactMatchMap,
  ) => {
    const typed = filters as CaseFilterValues;
    setAppliedFilters(typed);
    setExactMatchMap(exactMatchMapParam);
    setCurrentPage(1);
  };

  const totalItems = totalCount;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const handleDelete = async (id: number) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this case?",
      ))
    )
      return;

    const result = await deleteCivilCase(id);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete case");
      return;
    }

    statusPopup.showSuccess("Case deleted successfully");
    await fetchCases();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadExcel(file, CaseType.CIVIL);
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to import cases");
      } else {
        statusPopup.showSuccess("Cases imported successfully");
        await fetchCases();
      }

      if (result.success && result.result?.failedExcel) {
        const { fileName, base64 } = result.result.failedExcel;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        statusPopup.showSuccess(
          "Import complete. Failed rows have been downloaded for review.",
        );
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportCasesExcel();
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to export cases");
        return;
      }

      if (!result.result) {
        statusPopup.showError("No export data available");
        return;
      }

      const { fileName, base64 } = result.result;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={7} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <FiAlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (modalType) {
    return (
      <NotarialModal
        type={modalType}
        selectedRecord={selectedRecord}
        onClose={() => {
          setModalType(null);
          setSelectedRecord(null);
          fetchCases();
        }}
        onCreate={() => fetchCases()}
        onUpdate={() => fetchCases()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Civil Cases
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Manage civil cases and filings
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-info/10 border border-info/20 text-info text-xs font-medium select-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Hover over table cells to see full details</span>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
              <input
                type="text"
                placeholder="Search by case number, branch, petitioner..."
                className="input input-bordered input-lg w-full pl-12 text-base"
                value={appliedFilters?.caseNumber || ""}
                onChange={(e) =>
                  setAppliedFilters((prev) => ({
                    ...prev,
                    caseNumber: e.target.value,
                  }))
                }
              />
            </div>

            <button
              className={`btn btn-outline ${appliedFilters && Object.keys(appliedFilters).length > 0 ? "btn-primary" : ""}`}
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
              {appliedFilters && Object.keys(appliedFilters).length > 0 && (
                <span className="badge badge-sm badge-primary ml-1">
                  {Object.keys(appliedFilters).length}
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
                <FiUpload className="h-5 w-5" />
                {uploading ? "Importing..." : "Import Excel"}
              </button>
            )}
            {isAdminOrAtty && (
              <button
                className={`btn btn-outline ${exporting ? "loading" : ""}`}
                onClick={handleExport}
                disabled={exporting}
              >
                <FiDownload className="h-5 w-5" />
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
            options={CASE_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            initialValues={appliedFilters}
            getSuggestions={getCaseSuggestions}
            initialExactMatchMap={exactMatchMap}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "TOTAL CASES",
              value: (stats.totalCases ?? 0).toLocaleString(),
              subtitle: "All civil cases",
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "RECENTLY FILED",
              value: (stats.recentlyFiled ?? 0).toLocaleString(),
              subtitle: "Filed in the last 30 days",
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "RE-RAFFLED",
              value: (stats.reRaffledCases ?? 0).toLocaleString(),
              subtitle: "Re-raffled cases",
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "REMANDED",
              value: (stats.remandedCases ?? 0).toLocaleString(),
              subtitle: "Cases remanded",
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
        <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
          <table className="table table-zebra w-full text-center">
            <thead className="bg-base-300">
              <tr className="text-center">
                {isAdminOrAtty && <th>ACTIONS</th>}
                <SortTh
                  label="CASE NUMBER"
                  colKey="caseNumber"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="BRANCH"
                  colKey="branch"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="PETITIONER/S"
                  colKey="petitioners"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DEFENDANT/S"
                  colKey="defendants"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE FILED"
                  colKey="dateFiled"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <th>NOTES/APPEALED</th>
                <th>NATURE OF PETITION</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrAtty ? 8 : 7}>
                    <div className="flex flex-col items-center justify-center py-20 text-base-content/40 min-h-55">
                      <div className="flex items-center justify-center mb-4">
                        <FiFileText className="w-15 h-15 opacity-50" />
                      </div>
                      <p className="text-lg uppercase font-semibold text-base-content/50">
                        No records found
                      </p>
                      <p className="text-sm mt-1 uppercase text-base-content/35">
                        No civil cases match your current filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <NotarialRow
                    key={r.id}
                    record={r}
                    onEdit={(item) => {
                      setSelectedRecord(item);
                      setModalType("EDIT");
                    }}
                    onDelete={handleDelete}
                    onRowClick={(item) => {
                      try {
                        localStorage.setItem(
                          "__temp_case",
                          JSON.stringify(item),
                        );
                        localStorage.setItem(
                          "__temp_cases",
                          JSON.stringify(records || []),
                        );
                      } catch (e) {
                        // ignore
                      }
                      router.push(`/user/cases/civil/${item.id}`);
                    }}
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

export default Civil;
