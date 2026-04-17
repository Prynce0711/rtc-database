"use client";

import {
  CaseType,
  createEmptySherriffEntry,
  SheriffCaseData,
  SheriffCaseSchema,
  SherriffCaseAdapter,
  SherriffCaseEntry,
  sherriffCaseToEntry,
  usePopup,
} from "@rtc-database/shared";

import { AnimatePresence, motion } from "framer-motion";
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
import { createTempId } from "../../utils";
import CaseEntryToolbar from "../CaseEntryToolbar";

type SherriffColKey =
  | "caseNumber"
  | "sheriffName"
  | "mortgagee"
  | "mortgagor"
  | "dateFiled"
  | "remarks";

type ColDef = {
  key: SherriffColKey;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};

const FROZEN_COLS: ColDef[] = [
  {
    key: "caseNumber",
    label: "Case Number",
    placeholder: "01-2026",
    type: "text",
    width: 200,
    required: true,
  },
];

const DETAIL_COLS: ColDef[] = [
  {
    key: "sheriffName",
    label: "Sheriff Name",
    placeholder: "Name of Sheriff",
    type: "text",
    width: 240,
  },
  {
    key: "mortgagee",
    label: "Mortgagee",
    placeholder: "Mortgagee name",
    type: "text",
    width: 240,
  },
  {
    key: "mortgagor",
    label: "Mortgagor",
    placeholder: "Mortgagor name",
    type: "text",
    width: 240,
  },
  {
    key: "dateFiled",
    label: "Date Filed",
    placeholder: "",
    type: "date",
    width: 148,
    mono: true,
  },
  {
    key: "remarks",
    label: "Remarks",
    placeholder: "Optional remarks",
    type: "text",
    width: 280,
  },
];
const REQUIRED_FIELDS = ["caseNumber"] as const;

const normalizeCaseNumber = (value: string) => value.trim();
const AUTO_DEFAULT_YEAR = new Date().getFullYear();

const parseSheriffCaseNumberParts = (
  value: string,
): { year: number; number: number } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Sheriff case number format: 01-2026 (number-year)
  const match = trimmed.match(/^\s*(\d+)-(\d{4})/);
  if (match) {
    const number = Number.parseInt(match[1], 10);
    const year = Number.parseInt(match[2], 10);
    if (Number.isNaN(number) || Number.isNaN(year)) return null;

    return { number, year };
  }

  return null;
};

const formatSheriffCaseNumber = (number: number, year: number): string =>
  `${String(number).padStart(2, "0")}-${year}`;

const getAutoYearFromDate = (
  value: string | Date | null | undefined,
): number => {
  if (!value) return AUTO_DEFAULT_YEAR;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return AUTO_DEFAULT_YEAR;
  return date.getFullYear();
};

function validateEntry(
  entry: SherriffCaseEntry,
  options: { requireCaseNumber: boolean },
): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!options.requireCaseNumber && k === "caseNumber") return;
    if (
      !entry[k as keyof SherriffCaseEntry] ||
      String(entry[k as keyof SherriffCaseEntry]).trim() === ""
    )
      errs[k] = "Required";
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
  value: string | Date | null | undefined;
  error?: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => {
  const inputValue =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <input
        type={col.type === "date" ? "date" : "text"}
        value={inputValue}
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
};

function ReviewCard({
  entry,
  displayCaseNumber,
  isExistingCase,
}: {
  entry: SherriffCaseEntry;
  displayCaseNumber: string;
  isExistingCase: boolean;
}) {
  const fmtDate = (d: Date | string | null | undefined) => {
    if (!d) return null;
    // Accept Date objects or ISO/string values from server
    const date = d instanceof Date ? d : new Date(String(d));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
            {displayCaseNumber || (
              <span style={{ opacity: 0.4 }}>No Case No.</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.sheriffName || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No sheriff name
              </span>
            )}
          </div>
        </div>
        <div className="rv-hero-badges">
          {entry.dateFiled && (
            <span className="rv-badge rv-badge-court">
              {fmtDate(entry.dateFiled) || <span className="rv-empty">—</span>}
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
                  {displayCaseNumber || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Sheriff Name</div>
                <div className="rv-field-value">
                  {entry.sheriffName || <span className="rv-empty">—</span>}
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
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiFolder size={13} />
              <span>Party Details</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Mortgagee</div>
                <div className="rv-field-value">
                  {entry.mortgagee || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Mortgagor</div>
                <div className="rv-field-value">
                  {entry.mortgagor || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field" style={{ gridColumn: "1 / -1" }}>
                <div className="rv-field-label">Remarks</div>
                <div className="rv-field-value">
                  {entry.remarks || <span className="rv-empty">—</span>}
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

export const SherriffCaseUpdatePage = ({
  type,
  selectedRecord,
  selectedRecords,
  onCloseAction,
  onCreateAction,
  onUpdateAction,
  adapter,
}: {
  type: UpdateType;
  selectedRecord?: SheriffCaseData | null;
  selectedRecords?: SheriffCaseData[];
  onCloseAction: () => void;
  onCreateAction?: () => void;
  onUpdateAction?: () => void;
  adapter: SherriffCaseAdapter;
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
  const [autoCaseNumbersByRow, setAutoCaseNumbersByRow] = useState<
    Record<string, string>
  >({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<SherriffCaseEntry[]>(() => {
    if (isEdit) {
      return editRecords.map(sherriffCaseToEntry);
    }
    return [createEmptySherriffEntry()];
  });

  useEffect(() => {
    setStep("entry");

    if (isEdit) {
      setEntries(editRecords.map(sherriffCaseToEntry));
      return;
    }

    setEntries([createEmptySherriffEntry()]);
  }, [type, selectedRecord, selectedRecords, isEdit]);

  useEffect(() => {
    if (isEdit) {
      setAutoCaseNumbersByRow({});
      return;
    }

    const timer = window.setTimeout(async () => {
      const autoRows = entries.filter((entry) => !entry.isManual);
      if (autoRows.length === 0) {
        setAutoCaseNumbersByRow({});
        return;
      }

      setIsPreviewLoading(true);

      const manualMaxPerBucket = new Map<string, number>();
      entries
        .filter((entry) => entry.isManual)
        .forEach((entry) => {
          const parsed = parseSheriffCaseNumberParts(entry.caseNumber);
          if (!parsed) return;

          const key = `${parsed.year}`;
          const current = manualMaxPerBucket.get(key) ?? 0;
          if (parsed.number > current) {
            manualMaxPerBucket.set(key, parsed.number);
          }
        });

      const rowBuckets = autoRows.map((entry) => {
        const parsed = parseSheriffCaseNumberParts(entry.caseNumber);

        return {
          entryId: entry.id,
          year: getAutoYearFromDate(entry.dateFiled),
        };
      });

      const uniqueBuckets = Array.from(
        new Set(rowBuckets.map((row) => `${row.year}`)),
      );

      const nextPerBucket = new Map<string, number>();

      for (const bucket of uniqueBuckets) {
        const year = Number.parseInt(bucket, 10);
        const preview = await adapter.getSheriffCaseNumberPreview(year);
        nextPerBucket.set(
          bucket,
          preview.success ? preview.result!.nextNumber : 1,
        );
      }

      const offsetPerBucket = new Map<string, number>();
      const nextByRow: Record<string, string> = {};

      rowBuckets.forEach((row) => {
        const key = `${row.year}`;
        const dbBase = nextPerBucket.get(key) ?? 1;
        const manualBase = (manualMaxPerBucket.get(key) ?? 0) + 1;
        const bucketBase = Math.max(dbBase, manualBase);
        const offset = offsetPerBucket.get(key) ?? 0;
        const sequence = bucketBase + offset;
        nextByRow[row.entryId] = formatSheriffCaseNumber(sequence, row.year);
        offsetPerBucket.set(key, offset + 1);
      });

      setAutoCaseNumbersByRow(nextByRow);
      setIsPreviewLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [entries, isEdit]);

  const handleChange = (id: number, field: string, value: string | boolean) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: value, errors: { ...e.errors, [field]: "" } }
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback((count: number = 1) => {
    const normalizedCount = Math.max(1, Math.floor(count));
    const nextRows = Array.from({ length: normalizedCount }, () =>
      createEmptySherriffEntry(),
    );

    setEntries((prev) => [...prev, ...nextRows]);
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

    setEntries([createEmptySherriffEntry()]);
    setAutoCaseNumbersByRow({});
    setExistingCaseNumbers([]);
  }, [entries.length, statusPopup]);

  const handleRemove = (id: number) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: number) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: SherriffCaseEntry = {
      ...source,
      id: createTempId(),
      caseNumber: source.isManual ? "" : source.caseNumber,
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
    REQUIRED_FIELDS.every(
      (k) =>
        (k === "caseNumber" && !e.isManual && !isEdit) ||
        (e[k] && String(e[k]).trim() !== ""),
    ),
  ).length;
  const incompleteCount = entries.length - completedCount;

  const getDisplayCaseNumber = (entry: SherriffCaseEntry): string => {
    if (entry.isManual || isEdit) {
      return entry.caseNumber || "";
    }

    return autoCaseNumbersByRow[entry.id] ?? "";
  };

  const isCaseAlreadyExisting = useCallback(
    (caseNumber: string) => {
      if (isEdit) return false;
      const normalized = normalizeCaseNumber(caseNumber);
      return !!normalized && existingCaseNumbers.includes(normalized);
    },
    [existingCaseNumbers, isEdit],
  );

  const existingCaseRowCount = entries.filter(
    (entry) => entry.isManual && isCaseAlreadyExisting(entry.caseNumber),
  ).length;

  const duplicateCaseNumbers = useMemo(() => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
      const displayCaseNumber = normalizeCaseNumber(
        getDisplayCaseNumber(entry),
      );
      if (!displayCaseNumber) return;
      counts.set(displayCaseNumber, (counts.get(displayCaseNumber) ?? 0) + 1);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([value]) => value),
    );
  }, [entries, autoCaseNumbersByRow, isEdit]);

  const isCaseDuplicateInBatch = useCallback(
    (caseNumber: string) => {
      const normalized = normalizeCaseNumber(caseNumber);
      return !!normalized && duplicateCaseNumbers.has(normalized);
    },
    [duplicateCaseNumbers],
  );

  const duplicateCaseRowCount = entries.filter((entry) =>
    isCaseDuplicateInBatch(getDisplayCaseNumber(entry)),
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
          .filter((entry) => entry.isManual)
          .map((entry) => normalizeCaseNumber(entry.caseNumber))
          .filter((value) => value.length > 0),
      ),
    );

    if (caseNumbers.length === 0) {
      setExistingCaseNumbers([]);
      return [];
    }

    const result = await adapter.doesCaseExist(caseNumbers, CaseType.SHERRIFF);
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
      const errs = validateEntry(e, {
        requireCaseNumber: isEdit || e.isManual,
      });
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

  const buildPayload = (entry: SherriffCaseEntry) => {
    const { id, errors, collapsed, saved, isManual, ...caseInput } = entry;

    const caseNumberForPayload =
      !isEdit && !isManual
        ? autoCaseNumbersByRow[entry.id] ||
          formatSheriffCaseNumber(1, getAutoYearFromDate(caseInput.dateFiled))
        : caseInput.caseNumber;

    return SheriffCaseSchema.safeParse({
      ...caseInput,
      caseNumber: caseNumberForPayload,
      caseType: "SHERRIFF",
    });
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
        createdIds.map((id) => adapter.deleteSheriffCase(id)),
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
          editRecords.map((item) => [item.id, item]),
        );

        for (const entry of entries) {
          const original = originalById.get(entry.id);
          if (!original) {
            throw new Error("Original case not found for edit");
          }

          const parsed = buildPayload(entry);
          if (!parsed.success) throw new Error("Invalid case data");
          const response = await adapter.updateSheriffCase(
            original.id,
            parsed.data,
          );
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

          const response = await adapter.createSheriffCase({
            ...parsed.data,
            isManual: entry.isManual,
          });
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
            <span>Sheriff Cases</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit ? "Edit Sheriff Case" : "New Sheriff Case"}
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
                  {isEdit ? "Edit Sheriff Case" : "New Sheriff Case"}
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
                      Per-row mode (default: Auto)
                    </span>
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
                        title="At least one manual case number already exists in the database."
                      >
                        <span className="xls-pill-dot" />
                        {existingCaseRowCount} existing
                      </span>
                    )}
                    {duplicateCaseRowCount > 0 && (
                      <span
                        className="xls-pill"
                        style={{
                          background: "#ffedd5",
                          color: "#9a3412",
                          borderColor: "#fdba74",
                        }}
                        title="At least two rows in this batch share the same case number."
                      >
                        <span className="xls-pill-dot" />
                        {duplicateCaseRowCount} duplicate
                      </span>
                    )}
                    {incompleteCount > 0 && (
                      <span
                        className="xls-pill xls-pill-err"
                        title="One or more required fields are missing in these rows."
                      >
                        <span className="xls-pill-dot" />
                        {incompleteCount} incomplete
                      </span>
                    )}
                  </div>
                )}
                {!isEdit && (
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: "var(--color-subtle)",
                    }}
                  >
                    Auto: system assigns the next case number based on sequence.
                    Manual: you type the case number yourself (duplicates
                    allowed).
                  </p>
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

            {!isEdit && (
              <CaseEntryToolbar
                onAddRows={handleAddEntry}
                onClearAll={() => {
                  void handleClearTable();
                }}
              />
            )}

            <div className="xls-sheet-wrap">
              <div className="xls-tab-bar">
                <button className="xls-tab active">
                  <FiFileText size={13} />
                  Sheriff Case Info
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
                        <div className="xls-group-label">Sheriff Case Info</div>
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
                        const displayCaseNumber = getDisplayCaseNumber(entry);
                        const rowHasExistingCase =
                          isCaseAlreadyExisting(displayCaseNumber);
                        const rowHasDuplicate =
                          isCaseDuplicateInBatch(displayCaseNumber);
                        return (
                          <motion.tr
                            key={entry.id}
                            data-row
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                            transition={{ duration: 0.12 }}
                            className={`xls-row ${rowHasExistingCase ? "bg-yellow-100/60 hover:bg-yellow-100" : ""}${!rowHasExistingCase && rowHasDuplicate ? " bg-orange-100/60 hover:bg-orange-100" : ""}`}
                            title={
                              rowHasExistingCase && rowHasDuplicate
                                ? "Case is already existing and duplicate in current rows"
                                : rowHasExistingCase
                                  ? "Case is already existing"
                                  : rowHasDuplicate
                                    ? "Duplicate case number in current batch"
                                    : undefined
                            }
                          >
                            <td className="td-num">
                              <span className="xls-rownum">{rowIdx + 1}</span>
                            </td>
                            {FROZEN_COLS.map((col) => (
                              <td key={col.key}>
                                {!isEdit && col.key === "caseNumber" ? (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ display: "grid", gap: 6 }}>
                                      <select
                                        className="xls-input xls-mono"
                                        style={{ width: "100%", height: 32 }}
                                        value={
                                          entry.isManual ? "manual" : "auto"
                                        }
                                        onChange={(e) =>
                                          handleChange(
                                            entry.id,
                                            "isManual",
                                            e.target.value === "manual",
                                          )
                                        }
                                        title="Numbering mode"
                                      >
                                        <option value="auto">Auto</option>
                                        <option value="manual">Manual</option>
                                      </select>
                                      <input
                                        className="xls-input xls-mono"
                                        style={{ width: "100%" }}
                                        value={
                                          entry.isManual
                                            ? String(entry.caseNumber ?? "")
                                            : (autoCaseNumbersByRow[entry.id] ??
                                              "")
                                        }
                                        readOnly={!entry.isManual}
                                        onChange={(e) =>
                                          handleChange(
                                            entry.id,
                                            "caseNumber",
                                            e.target.value,
                                          )
                                        }
                                        placeholder={
                                          entry.isManual
                                            ? "Enter case no."
                                            : isPreviewLoading
                                              ? "Generating..."
                                              : "Auto"
                                        }
                                        title={
                                          entry.isManual
                                            ? "Manual case number"
                                            : "Auto-generated case number"
                                        }
                                      />
                                    </div>
                                    {entry.errors.caseNumber && (
                                      <span className="xls-cell-err">
                                        <FiAlertCircle size={10} />
                                        {entry.errors.caseNumber}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <CellInput
                                    col={col}
                                    value={entry[col.key]}
                                    error={entry.errors[col.key as string]}
                                    onChange={(v) =>
                                      handleChange(
                                        entry.id,
                                        col.key as string,
                                        v,
                                      )
                                    }
                                  />
                                )}
                              </td>
                            ))}
                            {DETAIL_COLS.map((col, colIdx) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={entry[col.key]}
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
                                {!isEdit && (
                                  <button
                                    type="button"
                                    className="xls-row-btn"
                                    onClick={() => handleDuplicate(entry.id)}
                                    title="Duplicate row"
                                  >
                                    <FiCopy size={13} />
                                  </button>
                                )}
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
                  onClick={() => handleAddEntry()}
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
                  {!isEdit && duplicateCaseRowCount > 0 && (
                    <p
                      className="text-sm font-semibold mt-2"
                      style={{ color: "#9a3412" }}
                    >
                      {duplicateCaseRowCount} row
                      {duplicateCaseRowCount > 1 ? "s" : ""} have duplicate case
                      numbers in this batch.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rv-layout">
              {entries.length > 1 && (
                <div className="rv-sidebar">
                  <div className="rv-sidebar-head">{entries.length} Cases</div>
                  <div className="rv-sidebar-list">
                    {entries.map((entry, idx) =>
                      (() => {
                        const displayCaseNumber = getDisplayCaseNumber(entry);
                        const rowHasExistingCase =
                          isCaseAlreadyExisting(displayCaseNumber);
                        const rowHasDuplicate =
                          isCaseDuplicateInBatch(displayCaseNumber);
                        return (
                          <button
                            key={entry.id}
                            className={`rv-sidebar-item${reviewIdx === idx ? " active" : ""}${rowHasExistingCase ? " bg-yellow-100/60" : ""}${!rowHasExistingCase && rowHasDuplicate ? " bg-orange-100/60" : ""}`}
                            onClick={() => setReviewIdx(idx)}
                            title={
                              rowHasExistingCase
                                ? "Case is already existing"
                                : rowHasDuplicate
                                  ? "Duplicate case number in current batch"
                                  : undefined
                            }
                          >
                            <span className="rv-sidebar-num">{idx + 1}</span>
                            <div className="rv-sidebar-info">
                              <div className="rv-sidebar-casenum">
                                {displayCaseNumber || "No case number"}
                              </div>
                              <div className="rv-sidebar-name">
                                {entry.sheriffName || "No sheriff name"}
                              </div>
                              {(rowHasExistingCase || rowHasDuplicate) && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 2,
                                    alignItems: "center",
                                  }}
                                >
                                  {rowHasExistingCase && (
                                    <div
                                      className="tooltip tooltip-bottom"
                                      role="presentation"
                                    >
                                      <div className="tooltip-content z-50">
                                        <span className="text-xs font-medium">
                                          Case is already existing
                                        </span>
                                      </div>
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium"
                                        style={{
                                          background: "#fef3c7",
                                          color: "#78350f",
                                          borderColor: "#fbbf24",
                                        }}
                                      >
                                        Existing
                                      </span>
                                    </div>
                                  )}
                                  {rowHasDuplicate && (
                                    <div
                                      className="tooltip tooltip-bottom"
                                      role="presentation"
                                    >
                                      <div className="tooltip-content z-50">
                                        <span className="text-xs font-medium">
                                          Duplicate case number in current batch
                                        </span>
                                      </div>
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium"
                                        style={{
                                          background: "#ffedd5",
                                          color: "#9a3412",
                                          borderColor: "#fdba74",
                                        }}
                                      >
                                        Duplicate
                                      </span>
                                    </div>
                                  )}
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
                      displayCaseNumber={getDisplayCaseNumber(
                        entries[reviewIdx],
                      )}
                      isExistingCase={isCaseAlreadyExisting(
                        getDisplayCaseNumber(entries[reviewIdx]),
                      )}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="xls-footer">
              <div className="xls-footer-left">
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

export default SherriffCaseUpdatePage;
