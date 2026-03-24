"use client";

import { CaseType } from "@/app/generated/prisma/enums";
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
  FiFolder,
  FiPlus,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import { doesCaseExist } from "../CaseActions";
import {
  createCivilCase,
  deleteCivilCase,
  updateCivilCase,
} from "./CivilActions";
import type { NotarialRecord } from "./CivilTypes";
import { CivilCaseSchema } from "./schema";

type FormEntry = {
  id: string;
  sourceId?: number;
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

const uid = () => Math.random().toString(36).slice(2, 9);
const normalizeCaseNumber = (value: string) => value.trim();

const createEmptyEntry = (id: string): FormEntry => ({
  id,
  sourceId: undefined,
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
  sourceId: r.id,
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

function validateEntry(entry: FormEntry): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "") {
      errs[k as string] = "Required";
    }
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

function ReviewCard({
  entry,
  isExistingCase,
}: {
  entry: FormEntry;
  isExistingCase: boolean;
}) {
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
      {isExistingCase && (
        <div className="alert alert-warning mb-4">
          <span>Case is already existing</span>
        </div>
      )}
      <div className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-hero-casenum">
            {entry.title || <span style={{ opacity: 0.4 }}>No Case No.</span>}
          </div>
          <div className="rv-hero-name">
            {entry.atty || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No petitioner/s
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

type UpdateType = "ADD" | "EDIT";
type Step = "entry" | "review";

export const NotarialUpdatePage = ({
  type,
  selectedRecord,
  selectedRecords,
  onCloseAction,
  onCreateAction,
  onUpdateAction,
}: {
  type: UpdateType;
  selectedRecord?: NotarialRecord | null;
  selectedRecords?: NotarialRecord[];
  onCloseAction: () => void;
  onCreateAction?: () => void;
  onUpdateAction?: () => void;
}) => {
  const statusPopup = usePopup();
  const editRecords =
    selectedRecords && selectedRecords.length > 0
      ? selectedRecords
      : selectedRecord
        ? [selectedRecord]
        : [];
  const isEdit = type === "EDIT" && editRecords.length > 0;
  const [step, setStep] = useState<Step>("entry");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCaseNumbers, setExistingCaseNumbers] = useState<string[]>([]);
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
    if (isEdit) {
      return editRecords.map((record) => recordToEntry(uid(), record));
    }
    return [createEmptyEntry(uid())];
  });

  useEffect(() => {
    setStep("entry");

    if (isEdit) {
      setEntries(editRecords.map((record) => recordToEntry(uid(), record)));
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
      sourceId: undefined,
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

  const isCaseAlreadyExisting = useCallback(
    (caseNumber: string) => {
      if (isEdit) return false;
      const normalized = normalizeCaseNumber(caseNumber);
      return !!normalized && existingCaseNumbers.includes(normalized);
    },
    [existingCaseNumbers, isEdit],
  );

  const existingCaseRowCount = entries.filter((entry) =>
    isCaseAlreadyExisting(entry.title),
  ).length;

  const refreshExistingCaseNumbers = useCallback(async (): Promise<
    string[]
  > => {
    if (isEdit) {
      setExistingCaseNumbers([]);
      return [];
    }

    const caseNumbers = Array.from(
      new Set(
        entries
          .map((entry) => normalizeCaseNumber(entry.title))
          .filter((value) => value.length > 0),
      ),
    );

    if (caseNumbers.length === 0) {
      setExistingCaseNumbers([]);
      return [];
    }

    const result = await doesCaseExist(caseNumbers, CaseType.CIVIL);
    if (!result.success || !result.result) {
      setExistingCaseNumbers([]);
      return [];
    }

    const normalized = result.result.map((value) => normalizeCaseNumber(value));
    setExistingCaseNumbers(normalized);
    return normalized;
  }, [entries, isEdit]);

  useEffect(() => {
    if (isEdit) {
      setExistingCaseNumbers([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshExistingCaseNumbers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [entries, isEdit, refreshExistingCaseNumbers]);

  const handleGoToReview = async () => {
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

    await refreshExistingCaseNumbers();

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
    const existingCases = await refreshExistingCaseNumbers();

    if (!isEdit && existingCases.length > 0) {
      const duplicateLabel =
        existingCases.length === 1
          ? `Case number ${existingCases[0]} already exists. Continue anyway?`
          : `${existingCases.length} case numbers already exist. Continue anyway?`;

      if (!(await statusPopup.showConfirm(duplicateLabel))) {
        return;
      }
    }

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

    const rollbackCreatedCases = async (
      createdIds: number[],
    ): Promise<string[]> => {
      if (createdIds.length === 0) return [];

      const rollbackResults = await Promise.allSettled(
        createdIds.map((id) => deleteCivilCase(id)),
      );

      const rollbackErrors: string[] = [];

      rollbackResults.forEach((result, index) => {
        if (result.status === "rejected") {
          const msg = `Rollback failed for case ID ${createdIds[index]}`;
          rollbackErrors.push(msg);
          console.warn(msg, result.reason);
        } else if (!result.value.success) {
          const msg = `Rollback failed for case ID ${createdIds[index]}: ${result.value.error || "Unknown rollback error"}`;
          rollbackErrors.push(msg);
          console.warn(msg);
        }
      });

      return rollbackErrors;
    };

    try {
      if (isEdit) {
        const originalById = new Map(
          editRecords.map((record) => [record.id, record]),
        );

        for (const entry of entries) {
          const sourceId = entry.sourceId;
          if (!sourceId) {
            throw new Error("Missing source case id for edit");
          }

          const original = originalById.get(sourceId);
          if (!original) {
            throw new Error("Original case not found for edit");
          }

          if (entry.title.trim() !== original.title.trim()) {
            throw new Error("Case number cannot be changed");
          }

          const parsed = buildPayload(entry);
          if (!parsed.success) throw new Error("Invalid case data");
          const response = await updateCivilCase(sourceId, parsed.data);
          if (!response.success) {
            throw new Error(response.error || "Failed to update case");
          }
        }

        onUpdateAction?.();
        statusPopup.showSuccess(
          entries.length === 1
            ? "Case updated successfully"
            : `${entries.length} cases updated successfully`,
        );
      } else {
        const createdCaseIds: number[] = [];
        let successfulCreates = 0;

        for (let idx = 0; idx < entries.length; idx++) {
          const entry = entries[idx];
          const parsed = buildPayload(entry);
          if (!parsed.success) {
            const rollbackErrors = await rollbackCreatedCases(createdCaseIds);
            setStep("entry");
            statusPopup.showError(
              [
                `Row ${idx + 1} has invalid data.`,
                rollbackErrors.length > 0
                  ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                  : "Any created rows in this batch were rolled back.",
              ].join(" "),
            );
            return;
          }

          const response = await createCivilCase(parsed.data);
          if (!response.success) {
            const rollbackErrors = await rollbackCreatedCases(createdCaseIds);
            setStep("entry");
            statusPopup.showError(
              [
                `Failed to create row ${idx + 1}: ${response.error || "Unknown error"}.`,
                rollbackErrors.length > 0
                  ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                  : "Any created rows in this batch were rolled back.",
              ].join(" "),
            );
            return;
          }

          successfulCreates += 1;

          if (response.result?.id) {
            createdCaseIds.push(response.result.id);
          }
        }

        if (successfulCreates !== entries.length) {
          const rollbackErrors = await rollbackCreatedCases(createdCaseIds);
          setStep("entry");
          console.error(
            `Only ${successfulCreates} of ${entries.length} cases were created successfully.`,
            rollbackErrors,
          );

          statusPopup.showError(
            [
              `Only ${successfulCreates} of ${entries.length} rows were confirmed created.`,
              rollbackErrors.length > 0
                ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                : "Any created rows in this batch were rolled back.",
            ].join(" "),
          );
          return;
        }

        onCreateAction?.();
        statusPopup.showSuccess(
          entries.length === 1
            ? "Case created successfully"
            : `${entries.length} cases created successfully`,
        );
      }

      onCloseAction();
    } catch (err) {
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to save case",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <div className="xls-root">
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button
            className="xls-back-btn"
            onClick={step === "review" ? () => setStep("entry") : onCloseAction}
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
                      Fill rows like a spreadsheet -{" "}
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
                    {existingCaseRowCount > 0 && (
                      <span
                        className="xls-pill"
                        style={{
                          background: "#fef3c7",
                          color: "#78350f",
                          borderColor: "#fbbf24",
                        }}
                        title="Case is already existing"
                      >
                        <span className="xls-pill-dot" />
                        {existingCaseRowCount} existing
                      </span>
                    )}
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
                        const rowHasExistingCase = isCaseAlreadyExisting(
                          entry.title,
                        );
                        return (
                          <motion.tr
                            key={entry.id}
                            data-row
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                            transition={{ duration: 0.12 }}
                            className={`xls-row ${rowHasExistingCase ? "bg-yellow-100/60 hover:bg-yellow-100" : ""}`}
                            title={
                              rowHasExistingCase
                                ? "Case is already existing"
                                : undefined
                            }
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
                                  disabled={isEdit}
                                >
                                  <FiCopy size={13} />
                                </button>
                                {entries.length > 1 && !isEdit && (
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
                <button
                  className="xls-btn xls-btn-ghost"
                  onClick={onCloseAction}
                >
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
                        : `Review ${entries.length} records before saving`}
                  </p>
                  <p className="font-light text-md mt-1">
                    {isEdit
                      ? "Check the details below, then confirm your changes."
                      : "All fields validated. Confirm the details are correct."}
                  </p>
                  {!isEdit && existingCaseRowCount > 0 && (
                    <p className="text-sm font-semibold text-warning mt-2">
                      {existingCaseRowCount} row
                      {existingCaseRowCount > 1 ? "s" : ""} already exist.
                    </p>
                  )}
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
                    {entries.map((entry, idx) =>
                      (() => {
                        const rowHasExistingCase = isCaseAlreadyExisting(
                          entry.title,
                        );
                        return (
                          <button
                            key={entry.id}
                            className={`rv-sidebar-item${reviewIdx === idx ? " active" : ""}${rowHasExistingCase ? " bg-yellow-100/60" : ""}`}
                            onClick={() => setReviewIdx(idx)}
                            title={
                              rowHasExistingCase
                                ? "Case is already existing"
                                : undefined
                            }
                          >
                            <span className="rv-sidebar-num">{idx + 1}</span>
                            <div className="rv-sidebar-info">
                              <div className="rv-sidebar-casenum">
                                {entry.title || "No case number"}
                              </div>
                              <div className="rv-sidebar-name">
                                {entry.atty || "No petitioners"}
                              </div>
                              {rowHasExistingCase && (
                                <div className="text-xs text-warning font-semibold">
                                  Case is already existing
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })(),
                    )}
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
                    <ReviewCard
                      entry={entries[reviewIdx]}
                      isExistingCase={isCaseAlreadyExisting(
                        entries[reviewIdx]?.title ?? "",
                      )}
                    />
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
