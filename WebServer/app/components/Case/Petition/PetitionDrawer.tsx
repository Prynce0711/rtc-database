"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiCopy,
  FiEdit3,
  FiEye,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import { ReceiveLog } from "./PetitionRecord";

export enum ReceiveDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

interface EntryForm {
  id: string;
  caseNumber: string;
  raffledToBranch: string;
  dateFiled: string;
  petitioners: string;
  titleNo: string;
  nature: string;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
}

const today = new Date().toISOString().slice(0, 10);

const emptyEntry = (id: string): EntryForm => ({
  id,
  caseNumber: "",
  raffledToBranch: "",
  dateFiled: today,
  petitioners: "",
  titleNo: "",
  nature: "",
  errors: {},
  collapsed: false,
  saved: false,
});

const uid = () => Math.random().toString(36).slice(2, 9);

const REQUIRED_FIELDS = [
  "caseNumber",
  "raffledToBranch",
  "dateFiled",
  "petitioners",
  "titleNo",
  "nature",
] as const;

const COLUMNS: {
  key: (typeof REQUIRED_FIELDS)[number];
  label: string;
  placeholder: string;
}[] = [
  { key: "caseNumber", label: "Case Number", placeholder: "SPC-2026-0001" },
  { key: "dateFiled", label: "Date Filed", placeholder: "" },
  {
    key: "raffledToBranch",
    label: "Raffled to Branch",
    placeholder: "Branch 1",
  },
  { key: "titleNo", label: "Title No", placeholder: "T-12345" },
  { key: "petitioners", label: "Petitioners", placeholder: "Full name" },
  { key: "nature", label: "Nature", placeholder: "Petition for..." },
];

function validateEntry(entry: EntryForm): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "") {
      errs[k] = "Required";
    }
  });
  return errs;
}

/* ─── Main Page Component ────────────────────────────────────────── */
const PetitionEntryPage = ({
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
  const tableRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<EntryForm[]>(() => {
    if (isEdit && selectedLog) {
      return [
        {
          ...emptyEntry(uid()),
          caseNumber: selectedLog.caseNumber ?? selectedLog["Case No"] ?? "",
          raffledToBranch:
            selectedLog.RaffledToBranch ??
            selectedLog["Branch No"] ??
            selectedLog.branch ??
            "",
          dateFiled: selectedLog.dateReceived
            ? String(selectedLog.dateReceived).slice(0, 10)
            : today,
          petitioners: selectedLog.Petitioners ?? selectedLog.party ?? "",
          titleNo:
            selectedLog.TitleNo ??
            selectedLog.BookAndPages ??
            selectedLog.receiptNo ??
            "",
          nature:
            selectedLog.Nature ??
            selectedLog.Content ??
            selectedLog.documentType ??
            "",
        },
      ];
    }
    return [emptyEntry(uid())];
  });

  useEffect(() => {
    if (!isEdit) {
      setEntries([emptyEntry(uid())]);
      setStep("entry");
    }
  }, [type, selectedLog]);

  /* Handlers */
  const handleChange = (id: string, field: string, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              [field]: value,
              errors: { ...e.errors, [field]: "" },
            }
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback(() => {
    const newEntry = emptyEntry(uid());
    setEntries((prev) => [...prev, newEntry]);
    setTimeout(() => {
      tableRef.current?.scrollTo({
        top: tableRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 60);
  }, []);

  const handleRemove = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleDuplicate = (id: string) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: EntryForm = {
      ...source,
      id: uid(),
      caseNumber: "",
      errors: {},
      saved: false,
      collapsed: false,
    };
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  /* Tab on last cell of last row → auto-add new row */
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    entryId: string,
    colIndex: number,
  ) => {
    if (e.key === "Tab" && !e.shiftKey) {
      const isLastCol = colIndex === COLUMNS.length - 1;
      const isLastRow = entries[entries.length - 1]?.id === entryId;
      if (isLastCol && isLastRow && !isEdit) {
        e.preventDefault();
        handleAddEntry();
        setTimeout(() => {
          const rows = tableRef.current?.querySelectorAll("[data-row]");
          const lastRow = rows?.[rows.length - 1];
          const firstInput = lastRow?.querySelector("input");
          firstInput?.focus();
        }, 80);
      }
    }
  };

  const completedCount = entries.filter((e) =>
    REQUIRED_FIELDS.every((k) => e[k] && String(e[k]).trim() !== ""),
  ).length;

  const allValid = completedCount === entries.length && entries.length > 0;

  /* Go to review step */
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
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Final submit from review */
  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this petition entry?"
      : entries.length === 1
        ? "Create this petition entry?"
        : `Create ${entries.length} petition entries?`;

    if (!(await statusPopup.showConfirm(label))) return;

    setIsSubmitting(true);
    try {
      const payloads = entries.map((e) => ({
        id: isEdit ? (selectedLog?.id ?? 0) : 0,
        caseNumber: e.caseNumber,
        branch: e.raffledToBranch,
        dateReceived: e.dateFiled,
        party: e.petitioners,
        receiptNo: e.titleNo,
        documentType: e.nature,
        "Case No": e.caseNumber,
        "Branch No": e.raffledToBranch,
        BookAndPages: e.titleNo,
        Content: e.nature,
        RaffledToBranch: e.raffledToBranch,
        Petitioners: e.petitioners,
        TitleNo: e.titleNo,
        Nature: e.nature,
      }));

      if (isEdit) {
        onUpdate?.(payloads[0]);
        statusPopup.showSuccess("Petition entry updated successfully");
      } else {
        payloads.forEach((p) => onCreate?.(p));
        statusPopup.showSuccess(
          payloads.length === 1
            ? "Petition entry created successfully"
            : `${payloads.length} petition entries created successfully`,
        );
      }
      onClose();
    } catch {
      statusPopup.showError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* ─── Header ──────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={step === "review" ? () => setStep("entry") : onClose}
              className="btn btn-ghost btn-sm px-2"
            >
              <FiArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold text-base-content">
                {isEdit
                  ? "Edit Petition Entry"
                  : step === "review"
                    ? "Review Entries"
                    : "New Petition Entries"}
              </h2>
              <p className="text-xl text-base-content/70 mt-1">
                {step === "review"
                  ? "Verify all entries before saving"
                  : isEdit
                    ? "Update the petition details below"
                    : "Fill rows like a spreadsheet — Tab past the last cell to add a new row"}
              </p>
            </div>
          </div>

          {/* Step indicator + progress */}
          <div className="flex items-center justify-between mt-4">
            {/* Steps */}
            <div className="flex items-center gap-2">
              {(
                [
                  {
                    key: "entry" as Step,
                    label: "Data Entry",
                    icon: <FiEdit3 size={14} />,
                  },
                  {
                    key: "review" as Step,
                    label: "Review",
                    icon: <FiEye size={14} />,
                  },
                ] as const
              ).map((s, i, arr) => {
                const currentIdx = step === "review" ? 1 : 0;
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`
                          w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                          ${i < currentIdx ? "bg-success text-success-content" : i === currentIdx ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/40"}
                        `}
                      >
                        {i < currentIdx ? (
                          <FiCheck size={12} strokeWidth={3} />
                        ) : (
                          s.icon
                        )}
                      </div>
                      <span
                        className={`text-sm font-semibold ${i === currentIdx ? "text-base-content" : "text-base-content/40"}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div
                        className={`w-10 h-0.5 rounded ${i < currentIdx ? "bg-success" : "bg-base-300"}`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Progress stats */}
            {!isEdit && step === "entry" && (
              <div className="text-sm text-base-content/70">
                <span className="font-bold text-base-content">
                  {completedCount}
                </span>{" "}
                of{" "}
                <span className="font-bold text-base-content">
                  {entries.length}
                </span>{" "}
                rows complete
              </div>
            )}
          </div>

          {/* Progress bar */}
          {!isEdit && step === "entry" && (
            <div className="mt-3">
              <progress
                className="progress progress-primary w-full"
                value={completedCount}
                max={entries.length}
              />
            </div>
          )}
        </div>

        {/* ─── Content ───────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {step === "entry" ? (
            /* ─── STEP 1: Spreadsheet Entry ────────────────────── */
            <motion.div
              key="entry"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Table */}
              <div
                ref={tableRef}
                className="bg-base-100 rounded-lg shadow overflow-auto"
              >
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th className="text-center w-12">#</th>
                      {COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      <th className="text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {entries.map((entry, rowIdx) => {
                        const hasErrors = Object.keys(entry.errors).length > 0;
                        const isComplete = REQUIRED_FIELDS.every(
                          (k) => entry[k] && String(entry[k]).trim() !== "",
                        );

                        return (
                          <motion.tr
                            key={entry.id}
                            data-row
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`
                              ${hasErrors ? "bg-error/5" : isComplete ? "bg-success/5" : "bg-base-100"}
                              hover:bg-base-200 transition-colors
                            `}
                          >
                            {/* Row number */}
                            <td className="text-center">
                              <span
                                className={`
                                  inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                  ${hasErrors ? "bg-error/20 text-error" : isComplete ? "bg-success/20 text-success" : "bg-base-300 text-base-content/50"}
                                `}
                              >
                                {isComplete && !hasErrors ? (
                                  <FiCheck size={12} strokeWidth={3} />
                                ) : (
                                  rowIdx + 1
                                )}
                              </span>
                            </td>

                            {/* Data cells */}
                            {COLUMNS.map((col, colIdx) => (
                              <td key={col.key} className="p-0">
                                <input
                                  type={
                                    col.key === "dateFiled" ? "date" : "text"
                                  }
                                  value={entry[col.key]}
                                  placeholder={col.placeholder}
                                  onChange={(e) =>
                                    handleChange(
                                      entry.id,
                                      col.key,
                                      e.target.value,
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleCellKeyDown(e, entry.id, colIdx)
                                  }
                                  title={entry.errors[col.key] || ""}
                                  className={`
                                    input input-sm input-ghost w-full rounded-none text-sm
                                    ${entry.errors[col.key] ? "input-error bg-error/10" : ""}
                                  `}
                                />
                                {entry.errors[col.key] && (
                                  <span className="text-error text-[10px] px-2 pb-1 flex items-center gap-1">
                                    <FiAlertCircle size={10} />{" "}
                                    {entry.errors[col.key]}
                                  </span>
                                )}
                              </td>
                            ))}

                            {/* Action buttons */}
                            <td className="text-center">
                              <div className="flex justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(entry.id)}
                                  className="btn btn-ghost btn-xs px-1.5"
                                  title="Duplicate row"
                                >
                                  <FiCopy size={13} />
                                </button>
                                {entries.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemove(entry.id)}
                                    className="btn btn-ghost btn-xs px-1.5 text-error"
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

                {/* Add row button */}
                {!isEdit && (
                  <button
                    type="button"
                    onClick={handleAddEntry}
                    className="btn btn-ghost btn-sm w-full border-t border-dashed border-base-300 rounded-none text-primary"
                  >
                    <FiPlus size={14} strokeWidth={2.5} />
                    Add Row
                  </button>
                )}
              </div>

              {/* Entry footer */}
              <div className="mt-6 flex items-center justify-between">
                <div>
                  {!isEdit && entries.length > 1 && (
                    <p className="text-sm text-base-content/70">
                      <span className="font-bold text-base-content">
                        {entries.length} rows
                      </span>{" "}
                      ·{" "}
                      <span
                        className={
                          allValid
                            ? "text-success font-semibold"
                            : "text-warning font-semibold"
                        }
                      >
                        {completedCount} complete
                      </span>
                      {entries.length - completedCount > 0 && (
                        <span className="text-error font-semibold">
                          , {entries.length - completedCount} incomplete
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToReview}
                    className="btn btn-primary"
                  >
                    <FiEye size={16} />
                    Review{entries.length > 1 ? ` (${entries.length})` : ""}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ─── STEP 2: Review ───────────────────────────────── */
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Summary banner */}
              <div className="mb-5 flex items-center justify-between bg-base-300 rounded-lg shadow px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="stat-figure text-primary">
                    <FiEye size={24} />
                  </div>
                  <div>
                    <p className="text-base-content font-bold">
                      Review {entries.length}{" "}
                      {entries.length === 1 ? "Entry" : "Entries"}
                    </p>
                    <p className="text-sm text-base-content/70">
                      Please verify all information is correct before saving
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStep("entry")}
                  className="btn btn-outline btn-sm gap-1"
                >
                  <FiEdit3 size={14} />
                  Edit
                </button>
              </div>

              {/* Review table (read-only) */}
              <div className="bg-base-100 rounded-lg shadow overflow-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="text-center w-12">#</th>
                      {COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className="bg-base-100 hover:bg-base-200 transition-colors text-sm"
                      >
                        <td className="font-semibold text-center">{idx + 1}</td>
                        <td className="font-semibold">
                          {entry.caseNumber || "\u2014"}
                        </td>
                        <td className="text-base-content/70">
                          {entry.dateFiled
                            ? new Date(entry.dateFiled).toLocaleDateString()
                            : "\u2014"}
                        </td>
                        <td>{entry.raffledToBranch || "\u2014"}</td>
                        <td>{entry.titleNo || "\u2014"}</td>
                        <td>{entry.petitioners || "\u2014"}</td>
                        <td>{entry.nature || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Review footer */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("entry")}
                  className="btn btn-outline gap-2"
                >
                  <FiArrowLeft size={14} />
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`btn btn-primary gap-2 ${isSubmitting ? "loading" : ""}`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiCheck size={16} strokeWidth={2.5} />
                      {isEdit
                        ? "Save Changes"
                        : entries.length === 1
                          ? "Confirm & Save"
                          : `Confirm & Save ${entries.length} Entries`}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default PetitionEntryPage;
