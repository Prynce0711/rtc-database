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
  FiEye,
  FiFileText,
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

type SpecialCase = {
  id: number;
  spcNo: string;
  raffledToBranch: string;
  dateFiled: string;
  petitioners: string;
  nature: string;
  respondent: string;
  titleNo?: string;
};

type SPFilterValues = {
  spcNo?: string;
  raffledToBranch?: string;
  petitioners?: string;
  nature?: string;
  respondent?: string;
  dateFiled?: { start?: string; end?: string };
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

// ─── Form Types ───────────────────────────────────────────────────────────────

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
  titleNo: "",
  petitioners: c.petitioners,
  nature: c.nature,
  respondent: c.respondent,
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

// Frozen columns — always visible on the left (matching CaseDrawer's FROZEN_COLS sizing)
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

// Tab group columns — scrollable detail area
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

// Keep DETAIL_COLS alias so existing code still compiles
const DETAIL_COLS = TAB_GROUP_COLS;

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

// ─── Excel-style Add/Edit Page ────────────────────────────────────────────────

type ModalType = "ADD" | "EDIT";
type Step = "entry" | "review";

const SPCaseModal = ({
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
    // Simulate API call
    await new Promise((r) => setTimeout(r, 600));
    if (isEdit && selectedCase) {
      const e = entries[0];
      onUpdate?.({
        ...selectedCase,
        spcNo: e.spcNo,
        raffledToBranch: e.raffledToBranch,
        dateFiled: e.dateFiled,
        petitioners: e.petitioners,
        nature: e.nature,
        respondent: e.respondent,
      });
    } else {
      entries.forEach((e, i) => {
        onCreate?.({
          id: Date.now() + i,
          spcNo: e.spcNo,
          raffledToBranch: e.raffledToBranch,
          dateFiled: e.dateFiled,
          petitioners: e.petitioners,
          nature: e.nature,
          respondent: e.respondent,
        });
      });
    }
    setIsSubmitting(false);
    onClose();
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
              {/* Tab bar — matches CaseDrawer's xls-tab-bar */}
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
                        : `Review ${entries.length} cases before saving`}
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
                  <div className="rv-sidebar-head">{entries.length} Cases</div>
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
                            {entry.spcNo || "No SPC no."}
                          </div>{" "}
                          <div className="rv-sidebar-name">
                            {entry.petitioners || "No petitioner"}
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
                        : `Save All ${entries.length} Cases`}
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

// ─── SPCaseRow ────────────────────────────────────────────────────────────────

const SPCaseRow = ({
  caseItem,
  onEdit,
  onDelete,
  onRowClick,
}: {
  caseItem: SpecialCase;
  onEdit: (c: SpecialCase) => void;
  onDelete: (id: number) => void;
  onRowClick: (c: SpecialCase) => void;
}) => (
  <tr
    className="bg-base-100 hover:bg-base-200 transition-colors cursor-pointer text-sm"
    onClick={() => onRowClick(caseItem)}
  >
    <td onClick={(e) => e.stopPropagation()} className="relative text-center">
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
                  onRowClick(caseItem);
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
                  onEdit(caseItem);
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
                  onDelete(caseItem.id);
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

const Proceedings: React.FC = () => {
  const router = useRouter();
  const [cases, setCases] = useState<SpecialCase[]>(MOCK_CASES);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "dateFiled",
    order: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Instead of drawer, we use an active full page
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [selectedCase, setSelectedCase] = useState<SpecialCase | null>(null);

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

  const handleApplyFilters = (filters: FilterValues) => {
    const typed = filters as SPFilterValues;
    setAppliedFilters(typed);
    setFilteredByAdvanced(applySPFilters(typed, cases));
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

  // ── If modal is open, show full-page Excel editor ──
  if (modalType) {
    return (
      <SPCaseModal
        type={modalType}
        selectedCase={selectedCase}
        onClose={() => {
          setModalType(null);
          setSelectedCase(null);
        }}
        onCreate={(newCase) => setCases((prev) => [...prev, newCase])}
        onUpdate={(updatedCase) =>
          setCases((prev) =>
            prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)),
          )
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
            Special Proceedings Cases
          </h2>
          <p className="text-xl text-base-content/70">
            Manage all special proceedings
          </p>
        </div>

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-4">
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
                  setSelectedCase(null);
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
                Add Case
              </button>
            )}
          </div>

          <FilterModal
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={SP_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            initialValues={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Cases",
              value: stats.total ?? 0,
              subtitle: `${stats.thisMonth ?? 0} this month`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "This Month",
              value: stats.thisMonth ?? 0,
              subtitle: `Last 30 days`,
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "Case Types",
              value: stats.natures ?? 0,
              subtitle: `Distinct types`,
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "Branches",
              value: stats.branches ?? 0,
              subtitle: `Active branches`,
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
                    onEdit={(item) => {
                      setSelectedCase(item);
                      setModalType("EDIT");
                    }}
                    onDelete={handleDelete}
                    onRowClick={(item) =>
                      router.push(`/user/cases/proceedings/${item.id}`)
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

export default Proceedings;
