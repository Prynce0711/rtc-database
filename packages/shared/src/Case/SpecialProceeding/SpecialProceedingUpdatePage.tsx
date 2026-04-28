"use client";

import {
  CaseType,
  createEmptySpecialProceedingEntry,
  SpecialProceedingAdapter,
  SpecialProceedingData,
  SpecialProceedingEntry,
  SpecialProceedingSchema,
  usePopup,
} from "../../index";

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
  FiPlus,
  FiSave,
  FiTrash2,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import CaseEntryToolbar from "../CaseEntryToolbar";
import {
  buildDirectCaseImportSuccessMessage,
  CASE_IMPORT_DRAFT_KEYS,
  consumeCaseImportDraft,
  downloadImportFailedExcel,
  formatImportFileSize,
  getCaseImportConflictModeLabel,
  previewSpecialProceedingImport,
  shouldPreferDirectCaseImport,
  shouldPreferDirectCaseImportByRowCount,
  shouldLoadCaseImportDraft,
} from "../importPreview";

type ColDef = {
  key: keyof Omit<
    SpecialProceedingEntry,
    | "id"
    | "createdAt"
    | "errors"
    | "collapsed"
    | "saved"
    | "branch"
    | "assistantBranch"
    | "dateFiled"
    | "caseType"
    | "updatedAt"
  >;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};

type ModalType = "ADD" | "EDIT";
type Step = "entry" | "review";
type ImportConflictMode = "create" | "update-existing";

const FROZEN_COLS: ColDef[] = [
  {
    key: "caseNumber",
    label: "Case Number",
    placeholder: "SPC-2026-0001",
    type: "text",
    width: 220,
    required: true,
    mono: true,
  },
  {
    key: "date",
    label: "Date Filed",
    placeholder: "",
    type: "date",
    width: 148,
    mono: true,
  },
];

const TAB_GROUP_COLS: ColDef[] = [
  {
    key: "raffledTo",
    label: "Branch",
    placeholder: "Branch 1",
    type: "text",
    width: 148,
  },
  {
    key: "petitioner",
    label: "Petitioners",
    placeholder: "Full name of petitioner(s)",
    type: "text",
    width: 220,
  },
  {
    key: "nature",
    label: "Nature",
    placeholder: "e.g. Petition for Adoption",
    type: "text",
    width: 240,
  },
  {
    key: "respondent",
    label: "Respondent",
    placeholder: "e.g. Republic of the Philippines",
    type: "text",
    width: 260,
  },
];

const REQUIRED_FIELDS: Array<
  keyof Omit<SpecialProceedingEntry, "id" | "errors" | "saved">
> = ["caseNumber"];
const normalizeCaseNumber = (value: string) => value.trim();
const TODAY = new Date().toISOString().slice(0, 10);
const AUTO_DEFAULT_AREA = "M";
const AUTO_DEFAULT_YEAR = new Date().getFullYear();
const normalizeAreaCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8);

const parseCaseNumberParts = (
  value: string,
): { area: string; year: number; number: number } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numberFirst = trimmed.match(/^\s*(\d+)-([A-Za-z]*)-(\d{4})/);
  if (numberFirst) {
    const number = Number.parseInt(numberFirst[1], 10);
    const year = Number.parseInt(numberFirst[3], 10);
    if (Number.isNaN(number) || Number.isNaN(year)) return null;

    return {
      number,
      area: numberFirst[2].toUpperCase(),
      year,
    };
  }

  const areaFirst = trimmed.match(/^\s*([A-Za-z]+)-(\d+)-(\d{4})/);
  if (areaFirst) {
    const number = Number.parseInt(areaFirst[2], 10);
    const year = Number.parseInt(areaFirst[3], 10);
    if (Number.isNaN(number) || Number.isNaN(year)) return null;

    return {
      area: areaFirst[1].toUpperCase(),
      number,
      year,
    };
  }

  return null;
};

const formatCaseNumber = (area: string, number: number, year: number): string =>
  `${String(number).padStart(2, "0")}-${area.toUpperCase()}-${year}`;

const getAreaFromCaseNumber = (value: string, fallbackArea: string): string =>
  parseCaseNumberParts(value)?.area ?? normalizeAreaCode(fallbackArea);

const getYearFromDateField = (value?: string | Date | null): number => {
  if (value == null || value === "") {
    return AUTO_DEFAULT_YEAR;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return AUTO_DEFAULT_YEAR;
  }

  return parsed.getFullYear();
};

const applyAreaToCaseNumber = (
  value: string,
  area: string,
  year: number,
): string => {
  const normalizedArea = normalizeAreaCode(area);
  const parsed = parseCaseNumberParts(value);

  return formatCaseNumber(normalizedArea, parsed?.number ?? 1, year);
};

const hydrateStoredCaseNumber = ({
  caseNumber,
  area,
  number,
  year,
}: {
  caseNumber?: string | null;
  area?: string | null;
  number?: number | null;
  year?: number | null;
}): string => {
  const normalizedCaseNumber = String(caseNumber ?? "").trim();
  const parsed = parseCaseNumberParts(normalizedCaseNumber);
  if (parsed?.area) {
    return normalizedCaseNumber;
  }

  const normalizedArea = normalizeAreaCode(area ?? "");
  if (
    normalizedArea &&
    typeof number === "number" &&
    !Number.isNaN(number) &&
    typeof year === "number" &&
    !Number.isNaN(year)
  ) {
    return formatCaseNumber(normalizedArea, number, year);
  }

  return normalizedCaseNumber;
};

const withResolvedAutoCaseNumber = (
  entry: SpecialProceedingEntry,
  fallbackArea: string,
): SpecialProceedingEntry => {
  if (entry.isManual) {
    return entry;
  }

  return {
    ...entry,
    caseNumber: applyAreaToCaseNumber(
      String(entry.caseNumber ?? ""),
      getAreaFromCaseNumber(String(entry.caseNumber ?? ""), fallbackArea),
      getYearFromDateField(entry.date),
    ),
  };
};

const importedSpecialProceedingRowToEntry = (
  row: SpecialProceedingSchema,
): SpecialProceedingEntry => {
  const baseEntry = createEmptySpecialProceedingEntry();

  return {
    ...baseEntry,
    ...row,
    id: baseEntry.id,
    baseCaseID: baseEntry.baseCaseID,
    isManual: true,
    errors: {},
    collapsed: false,
    saved: false,
  };
};

function validateEntry(
  entry: SpecialProceedingEntry,
  options: { requireCaseNumber: boolean },
): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (k === "caseNumber" && !options.requireCaseNumber) {
      return;
    }

    if (!entry[k] || String(entry[k]).trim() === "")
      errs[k as string] = "Required";
  });

  if (!options.requireCaseNumber && !entry.isManual) {
    const parsed = parseCaseNumberParts(String(entry.caseNumber ?? ""));
    if (!parsed || !parsed.area) {
      errs.caseNumber = "Area is required in auto mode";
    }
  }

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

const toInputValue = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
};

function ReviewCard({
  entry,
  displayCaseNumber,
  isExistingCase,
}: {
  entry: SpecialProceedingEntry;
  displayCaseNumber: string;
  isExistingCase: boolean;
}) {
  const fmtDate = (value: Date | string | null | undefined) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
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
              <span style={{ opacity: 0.4 }}>No Case Number</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.petitioner || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No petitioner entered
              </span>
            )}
          </div>
          {entry.nature && <div className="rv-hero-charge">{entry.nature}</div>}
        </div>
        <div className="rv-hero-badges">
          {entry.raffledTo && (
            <span className="rv-badge rv-badge-court">{entry.raffledTo}</span>
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
                <div className="rv-field-label">Case Number</div>
                <div className="rv-field-value rv-mono">
                  {displayCaseNumber || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Branch</div>
                <div className="rv-field-value">
                  {entry.raffledTo || <span className="rv-empty">—</span>}
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
              <FiUsers size={13} />
              <span>Petition Details</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Petitioners</div>
                <div className="rv-field-value">
                  {entry.petitioner || <span className="rv-empty">—</span>}
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

const SpecialProceedingUpdatePage = ({
  type,
  selectedCase,
  selectedCases,
  onClose,
  onCreate,
  onUpdate,
  adapter,
}: {
  type: ModalType;
  selectedCase?: SpecialProceedingData | null;
  selectedCases?: SpecialProceedingData[];
  onClose: () => void;
  onCreate?: () => void;
  onUpdate?: () => void;
  adapter: SpecialProceedingAdapter;
}) => {
  const isEdit = type === "EDIT";
  const editCases =
    selectedCases && selectedCases.length > 0
      ? selectedCases
      : selectedCase
        ? [selectedCase]
        : [];
  const statusPopup = usePopup();
  const [step, setStep] = useState<Step>("entry");
  const [entryPage, setEntryPage] = useState(1);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingCaseNumbers, setExistingCaseNumbers] = useState<string[]>([]);
  const [autoCaseNumbersByRow, setAutoCaseNumbersByRow] = useState<
    Record<number, string>
  >({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [importConflictMode, setImportConflictMode] =
    useState<ImportConflictMode>("create");
  const supportsDirectExcelUpload =
    !isEdit && adapter.supportsDirectExcelUpload === true;
  const [defaultArea, setDefaultArea] = useState(AUTO_DEFAULT_AREA);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const nextTempIdRef = useRef<number>(-1000);

  const [entries, setEntries] = useState<SpecialProceedingEntry[]>(() => {
    if (isEdit && editCases.length > 0) {
      return editCases.map((item) =>
        withResolvedAutoCaseNumber(
          {
            ...item,
            caseNumber: hydrateStoredCaseNumber(item),
            errors: {},
            collapsed: false,
            saved: false,
          },
          AUTO_DEFAULT_AREA,
        ),
      );
    }
    return [
      {
        ...createEmptySpecialProceedingEntry(),
        id: nextTempIdRef.current--,
        caseNumber: formatCaseNumber(
          AUTO_DEFAULT_AREA,
          1,
          getYearFromDateField(TODAY),
        ),
        date: TODAY,
        dateFiled: TODAY,
      },
    ];
  });

  useEffect(() => {
    setStep("entry");
    setEntryPage(1);

    if (isEdit) {
      if (editCases.length > 0) {
        setEntries(
          editCases.map((item) =>
            withResolvedAutoCaseNumber(
              {
                ...item,
                caseNumber: hydrateStoredCaseNumber(item),
                errors: {},
                collapsed: false,
                saved: false,
              },
              AUTO_DEFAULT_AREA,
            ),
          ),
        );
      }
      return;
    }

    setEntries([
      {
        ...createEmptySpecialProceedingEntry(),
        id: nextTempIdRef.current--,
        caseNumber: formatCaseNumber(
          AUTO_DEFAULT_AREA,
          1,
          getYearFromDateField(TODAY),
        ),
        date: TODAY,
        dateFiled: TODAY,
      },
    ]);
  }, [type, selectedCase, selectedCases, isEdit]);

  useEffect(() => {
    if (isEdit || !shouldLoadCaseImportDraft()) return;

    const importedRows = consumeCaseImportDraft<SpecialProceedingSchema>(
      CASE_IMPORT_DRAFT_KEYS.specialProceeding,
    );

    if (!importedRows || importedRows.length === 0) {
      return;
    }

    setEntries(importedRows.map(importedSpecialProceedingRowToEntry));
    setStep("entry");
    setEntryPage(1);
    setReviewIdx(0);
    setExistingCaseNumbers([]);
    setAutoCaseNumbersByRow({});
  }, [isEdit]);

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
          const parsed = parseCaseNumberParts(String(entry.caseNumber ?? ""));
          if (!parsed || !parsed.area) return;

          const key = `${parsed.area}|${parsed.year}`;
          const current = manualMaxPerBucket.get(key) ?? 0;
          if (parsed.number > current) {
            manualMaxPerBucket.set(key, parsed.number);
          }
        });

      const rowBuckets = autoRows.map((entry) => {
        const parsed = parseCaseNumberParts(String(entry.caseNumber ?? ""));
        return {
          entryId: entry.id,
          area: parsed?.area ?? "",
          year: getYearFromDateField(entry.date),
        };
      });

      const uniqueBuckets = Array.from(
        new Set(
          rowBuckets
            .filter((row) => row.area)
            .map((row) => `${row.area}|${row.year}`),
        ),
      );

      const nextPerBucket = new Map<string, number>();

      for (const bucket of uniqueBuckets) {
        const [area, yearRaw] = bucket.split("|");
        const year = Number.parseInt(yearRaw, 10);
        const preview = await adapter.getSpecialProceedingCaseNumberPreview(
          area,
          year,
        );
        nextPerBucket.set(
          bucket,
          preview.success ? preview.result!.nextNumber : 1,
        );
      }

      const offsetPerBucket = new Map<string, number>();
      const nextByRow: Record<number, string> = {};

      rowBuckets.forEach((row) => {
        if (!row.area) {
          nextByRow[row.entryId] = "";
          return;
        }

        const key = `${row.area}|${row.year}`;
        const dbBase = nextPerBucket.get(key) ?? 1;
        const manualBase = (manualMaxPerBucket.get(key) ?? 0) + 1;
        const bucketBase = Math.max(dbBase, manualBase);
        const offset = offsetPerBucket.get(key) ?? 0;
        const sequence = bucketBase + offset;
        nextByRow[row.entryId] = formatCaseNumber(row.area, sequence, row.year);
        offsetPerBucket.set(key, offset + 1);
      });

      setAutoCaseNumbersByRow(nextByRow);
      setIsPreviewLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [adapter, defaultArea, entries, isEdit]);

  const getExistingCasesByCaseNumber = useCallback(async () => {
    if (isEdit) {
      return new Map<string, SpecialProceedingData>();
    }

    const caseNumbers = Array.from(
      new Set(
        entries
          .map((entry) => normalizeCaseNumber(getDisplayCaseNumber(entry)))
          .filter((value) => value.length > 0),
      ),
    );

    if (caseNumbers.length === 0) {
      return new Map<string, SpecialProceedingData>();
    }

    const result =
      await adapter.getSpecialProceedingsByCaseNumbers(caseNumbers);
    if (!result.success || !result.result) {
      return new Map<string, SpecialProceedingData>();
    }

    const byCaseNumber = new Map<string, SpecialProceedingData>();
    result.result.forEach((item) => {
      const normalized = normalizeCaseNumber(String(item.caseNumber ?? ""));
      if (!normalized || byCaseNumber.has(normalized)) return;
      byCaseNumber.set(normalized, item);
    });

    return byCaseNumber;
  }, [adapter, entries, isEdit]);

  const handleAreaChange = useCallback((id: number, areaInput: string) => {
    const normalizedArea = normalizeAreaCode(areaInput);

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              caseNumber: applyAreaToCaseNumber(
                String(entry.caseNumber ?? ""),
                normalizedArea,
                getYearFromDateField(entry.date),
              ),
              errors: {
                ...entry.errors,
                caseNumber: "",
              },
            }
          : entry,
      ),
    );
  }, []);

  const handleApplyDefaultAreaToRows = useCallback(() => {
    const effectiveDefaultArea = normalizeAreaCode(defaultArea);
    setDefaultArea(effectiveDefaultArea);

    setEntries((prev) =>
      prev.map((entry) => {
        return {
          ...entry,
          caseNumber: applyAreaToCaseNumber(
            String(entry.caseNumber ?? ""),
            effectiveDefaultArea,
            getYearFromDateField(entry.date),
          ),
        };
      }),
    );
  }, [defaultArea]);

  const handleChange = (id: number, field: string, value: string | boolean) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? withResolvedAutoCaseNumber(
              {
                ...e,
                [field]: value,
                errors: { ...e.errors, [field]: "" },
              },
              defaultArea,
            )
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback(
    (count: number = 1) => {
      const normalizedCount = Math.max(1, Math.floor(count));
      const nextRows = Array.from({ length: normalizedCount }, () => ({
        ...createEmptySpecialProceedingEntry(),
        id: nextTempIdRef.current--,
        date: TODAY,
        dateFiled: TODAY,
        caseNumber: formatCaseNumber(
          normalizeAreaCode(defaultArea),
          1,
          getYearFromDateField(TODAY),
        ),
      }));

      setEntries((prev) => {
        const next = [...prev, ...nextRows];
        setEntryPage(Math.max(1, Math.ceil(next.length / ENTRY_ROWS_PER_PAGE)));
        return next;
      });
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 60);
    },
    [defaultArea],
  );

  const getDisplayCaseNumber = (entry: SpecialProceedingEntry): string => {
    if (entry.isManual || isEdit) {
      return String(entry.caseNumber ?? "");
    }

    return autoCaseNumbersByRow[entry.id] ?? "";
  };

  const handleClearTable = useCallback(async () => {
    const label =
      entries.length === 1
        ? "Clear the table and reset the current row?"
        : `Clear all ${entries.length} rows and start over?`;

    if (!(await statusPopup.showConfirm(label))) return;

    setEntries([
      {
        ...createEmptySpecialProceedingEntry(),
        id: nextTempIdRef.current--,
        date: TODAY,
        dateFiled: TODAY,
        caseNumber: formatCaseNumber(
          normalizeAreaCode(defaultArea),
          1,
          getYearFromDateField(TODAY),
        ),
      },
    ]);
    setEntryPage(1);
    setAutoCaseNumbersByRow({});
    setExistingCaseNumbers([]);
  }, [defaultArea, entries.length, statusPopup]);

  const handleImportExcel = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const runDirectExcelUpload = async (): Promise<boolean> => {
      if (!supportsDirectExcelUpload) {
        return false;
      }

      try {
        statusPopup.showLoading("Uploading Excel directly...");

        const result = await adapter.uploadSpecialProceedingExcel(
          file,
          false,
          importConflictMode,
        );
        const failedExcel = result.success
          ? result.result?.failedExcel
          : result.errorResult?.failedExcel;
        const errorMessage = result.success ? undefined : result.error;

        downloadImportFailedExcel(failedExcel);

        if (!result.success || !result.result) {
          statusPopup.showError(
            errorMessage ||
              (failedExcel
                ? "No rows were imported. Failed rows were downloaded for review."
                : "Failed to upload Excel file."),
          );
          return true;
        }

        onCreate?.();
        statusPopup.showSuccess(
          buildDirectCaseImportSuccessMessage(result.result.meta),
        );
        onClose();
      } catch (error) {
        console.error("Direct special proceeding Excel upload failed", error);
        statusPopup.showError("Failed to upload Excel file.");
      }

      return true;
    };

    if (supportsDirectExcelUpload && shouldPreferDirectCaseImport(file)) {
      const shouldUploadDirectly = await statusPopup.showConfirm(
        `This file is ${formatImportFileSize(file.size)}. Loading it into the editor may be slow. Upload it directly to the database in "${getCaseImportConflictModeLabel(importConflictMode)}" mode instead?`,
      );

      if (shouldUploadDirectly) {
        setUploading(true);
        try {
          await runDirectExcelUpload();
        } finally {
          setUploading(false);
          input.value = "";
        }
        return;
      }
    }

    setUploading(true);
    try {
      const result = await previewSpecialProceedingImport(file);

      downloadImportFailedExcel(result.failedExcel);

      if (!result.success || result.rows.length === 0) {
        statusPopup.showError(
          result.error ||
            (result.failedExcel
              ? "No valid rows were loaded. Failed rows were downloaded for review."
              : "No valid rows were loaded."),
        );
        return;
      }

      if (
        supportsDirectExcelUpload &&
        shouldPreferDirectCaseImportByRowCount(result.rows.length)
      ) {
        const shouldUploadDirectly = await statusPopup.showConfirm(
          `${result.rows.length.toLocaleString()} rows were loaded. Opening that many rows in the editor may still be slow. Upload them directly to the database in "${getCaseImportConflictModeLabel(importConflictMode)}" mode instead?`,
        );

        if (shouldUploadDirectly) {
          await runDirectExcelUpload();
          return;
        }
      }

      setEntries(result.rows.map(importedSpecialProceedingRowToEntry));
      setStep("entry");
      setEntryPage(1);
      setReviewIdx(0);
      setExistingCaseNumbers([]);
      setAutoCaseNumbersByRow({});
      statusPopup.showSuccess(
        result.failedExcel
          ? "Excel data loaded into the draft. Failed rows were downloaded for review."
          : "Excel data loaded into the draft. Review and save to apply it.",
      );
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handleRemove = (id: number) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: number) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: SpecialProceedingEntry = {
      ...source,
      id: nextTempIdRef.current--,
      caseNumber: source.isManual ? "" : source.caseNumber,
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

  const completedCount = entries.filter(
    (e) =>
      (e.isManual ||
        isEdit ||
        Boolean(parseCaseNumberParts(String(e.caseNumber ?? ""))?.area)) &&
      REQUIRED_FIELDS.every(
        (k) =>
          (k === "caseNumber" && !e.isManual && !isEdit) ||
          (e[k] && String(e[k]).trim() !== ""),
      ),
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

  const existingCaseRowCount = entries.filter(
    (entry) =>
      entry.isManual && isCaseAlreadyExisting(String(entry.caseNumber)),
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
          .map((entry) => normalizeCaseNumber(String(entry.caseNumber ?? "")))
          .filter((value) => value.length > 0),
      ),
    );

    if (caseNumbers.length === 0) {
      setExistingCaseNumbers([]);
      return [];
    }

    const result = await adapter.doesCaseExist(caseNumbers, CaseType.SCA);
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

  const buildPayload = (entry: SpecialProceedingEntry) => {
    const caseNumberForPayload =
      !isEdit && !entry.isManual
        ? autoCaseNumbersByRow[entry.id] ||
          formatCaseNumber(
            getAreaFromCaseNumber(
              String(entry.caseNumber ?? ""),
              defaultArea,
            ),
            1,
            getYearFromDateField(entry.date),
          )
        : String(entry.caseNumber ?? "");

    return {
      caseNumber: caseNumberForPayload,
      raffledTo: entry.raffledTo?.toString().trim() || null,
      date: entry.date ? new Date(String(entry.date)) : null,
      petitioner: entry.petitioner?.toString().trim() || null,
      nature: entry.nature?.toString().trim() || null,
      respondent: entry.respondent?.toString().trim() || null,
      isManual: entry.isManual,
    };
  };

  const handleSubmit = async () => {
    const existingCases = await refreshExistingCaseNumbers();
    let existingCaseMap = new Map<string, SpecialProceedingData>();

    if (
      !isEdit &&
      importConflictMode === "create" &&
      existingCases.length > 0
    ) {
      const duplicateLabel =
        existingCases.length === 1
          ? `Case number ${existingCases[0]} already exists. Continue anyway?`
          : `${existingCases.length} case numbers already exist. Continue anyway?`;

      if (!(await statusPopup.showConfirm(duplicateLabel))) {
        return;
      }
    }

    if (!isEdit && importConflictMode === "update-existing") {
      existingCaseMap = await getExistingCasesByCaseNumber();
      const rowsToUpdate = entries.filter((entry) =>
        existingCaseMap.has(normalizeCaseNumber(getDisplayCaseNumber(entry))),
      ).length;
      const rowsToCreate = entries.length - rowsToUpdate;

      const importModeLabel =
        rowsToUpdate > 0
          ? `Update ${rowsToUpdate} existing ${rowsToUpdate === 1 ? "case" : "cases"} and create ${rowsToCreate} new ${rowsToCreate === 1 ? "case" : "cases"}?`
          : `No matching existing case numbers were found. Create ${entries.length} ${entries.length === 1 ? "case" : "cases"}?`;

      if (!(await statusPopup.showConfirm(importModeLabel))) {
        return;
      }
    }

    const label = isEdit
      ? entries.length === 1
        ? "Save changes to this case?"
        : `Save changes to ${entries.length} cases?`
      : importConflictMode === "update-existing"
        ? entries.length === 1
          ? "Save this imported row?"
          : `Save ${entries.length} imported rows?`
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
        createdIds.map((id) => adapter.deleteSpecialProceeding(id)),
      );

      const rollbackErrors: string[] = [];

      rollbackResults.forEach((result, index) => {
        if (result.status === "rejected") {
          rollbackErrors.push(
            `Rollback failed for case ID ${createdIds[index]}`,
          );
          return;
        }

        if (!result.value.success) {
          const message =
            "error" in result.value
              ? result.value.error
              : "Unknown rollback error";
          rollbackErrors.push(
            `Rollback failed for case ID ${createdIds[index]}: ${message}`,
          );
        }
      });

      return rollbackErrors;
    };

    try {
      if (isEdit) {
        if (entries.length !== editCases.length) {
          statusPopup.showError(
            "Proceedings row count mismatch. Please reload.",
          );
          return;
        }

        for (let index = 0; index < entries.length; index++) {
          const e = entries[index];
          const target = editCases[index];

          if (!target?.id) {
            statusPopup.showError(`Missing case id for row ${index + 1}`);
            return;
          }

          const payload = buildPayload(e);
          const result = await adapter.updateSpecialProceeding(
            target.id,
            payload,
          );
          if (!result.success) {
            statusPopup.showError(
              result.error || `Update failed for row ${index + 1}`,
            );
            return;
          }
        }

        statusPopup.showSuccess(
          entries.length === 1
            ? "Case updated successfully"
            : `${entries.length} cases updated successfully`,
        );
        onUpdate?.();
      } else {
        const createdIds: number[] = [];
        let successfulCreates = 0;
        let successfulUpdates = 0;
        for (let index = 0; index < entries.length; index++) {
          const e = entries[index];
          const payload = buildPayload(e);

          const existingCase =
            importConflictMode === "update-existing"
              ? existingCaseMap.get(
                  normalizeCaseNumber(getDisplayCaseNumber(e)),
                )
              : undefined;

          const result = existingCase?.id
            ? await adapter.updateSpecialProceeding(existingCase.id, payload)
            : await adapter.createSpecialProceeding(payload);

          if (!result.success) {
            const rollbackErrors = await rollbackCreatedCases(createdIds);
            setStep("entry");
            statusPopup.showError(
              [
                `${existingCase?.id ? "Failed to update" : "Failed to create"} row ${index + 1}: ${result.error || "Save failed"}.`,
                rollbackErrors.length > 0
                  ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                  : existingCase?.id
                    ? "Any newly created rows in this batch were rolled back."
                    : "Any created rows in this batch were rolled back.",
              ].join(" "),
            );
            return;
          }

          if (existingCase?.id) {
            successfulUpdates += 1;
          } else {
            successfulCreates += 1;
          }

          if (!existingCase?.id && result.result?.id) {
            createdIds.push(result.result.id);
          }
        }
        onCreate?.();
        if (
          importConflictMode === "update-existing" &&
          successfulUpdates > 0 &&
          successfulCreates > 0
        ) {
          statusPopup.showSuccess(
            `${successfulUpdates} updated, ${successfulCreates} created successfully`,
          );
        } else if (
          importConflictMode === "update-existing" &&
          successfulUpdates > 0
        ) {
          statusPopup.showSuccess(
            successfulUpdates === 1
              ? "Case updated successfully"
              : `${successfulUpdates} cases updated successfully`,
          );
        } else {
          statusPopup.showSuccess(
            `${entries.length} case${entries.length > 1 ? "s" : ""} created successfully`,
          );
        }
      }
      onClose();
    } catch (error) {
      statusPopup.showError(
        error instanceof Error ? error.message : "An error occurred",
      );
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allCols = [...TAB_GROUP_COLS];
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
              {isEdit
                ? entries.length === 1
                  ? "Edit Petition"
                  : "Edit Petitions"
                : "New Proceedings Entries"}
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
                  {isEdit
                    ? entries.length === 1
                      ? "Edit Petition"
                      : "Edit Petitions"
                    : "New Proceedings Entries"}
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
                      Existing case no.:{" "}
                      {importConflictMode === "create"
                        ? "Create duplicate"
                        : "Update existing"}
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
                {!isEdit && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{ fontSize: 13, color: "var(--color-subtle)" }}
                    >
                      Default Area
                    </span>
                    <input
                      className="xls-input xls-mono"
                      style={{ width: 88, height: 36 }}
                      value={defaultArea}
                      onChange={(e) =>
                        setDefaultArea(normalizeAreaCode(e.target.value))
                      }
                      placeholder="M"
                      title="Default area for auto numbering"
                    />
                    <button
                      type="button"
                      className="xls-btn xls-btn-ghost"
                      onClick={handleApplyDefaultAreaToRows}
                    >
                      Update All To This Area
                    </button>
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

            {!isEdit && (
              <CaseEntryToolbar
                onAddRows={handleAddEntry}
                onClearAll={() => {
                  void handleClearTable();
                }}
              >
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <button
                  type="button"
                  className={`btn btn-info btn-outline gap-2 ${uploading ? "loading" : ""}`}
                  onClick={() => importFileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FiUpload size={15} />
                  {uploading ? "Importing..." : "Import Excel"}
                </button>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-base-content/60">
                    Existing case no.
                  </span>
                  <select
                    className="select select-sm select-bordered"
                    value={importConflictMode}
                    onChange={(e) =>
                      setImportConflictMode(
                        e.target.value as ImportConflictMode,
                      )
                    }
                  >
                    <option value="create">Create duplicate</option>
                    <option value="update-existing">Update existing</option>
                  </select>
                </div>
              </CaseEntryToolbar>
            )}

            <div className="xls-sheet-wrap">
              {/* Tab bar */}
              <div className="xls-tab-bar">
                <button className="xls-tab active">
                  Special Proceeding Info
                </button>
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
                        <div className="xls-group-label">
                          Special Proceeding Info
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
                      {pagedEntries.map((entry, rowIdx) => {
                        const lastColIdx = allCols.length - 1;
                        const displayCaseNumber = getDisplayCaseNumber(entry);
                        const autoCasePreview =
                          autoCaseNumbersByRow[entry.id] ||
                          String(entry.caseNumber ?? "");
                        const autoParsedCaseNumber =
                          parseCaseNumberParts(autoCasePreview);
                        const autoNumberPart = String(
                          autoParsedCaseNumber?.number ?? 1,
                        ).padStart(2, "0");
                        const autoYearPart = String(
                          autoParsedCaseNumber?.year ??
                            getYearFromDateField(entry.date),
                        );
                        const autoAreaValue = getAreaFromCaseNumber(
                          String(entry.caseNumber ?? ""),
                          defaultArea,
                        );
                        const autoAreaMissing = !autoAreaValue;
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
                              <span className="xls-rownum">
                                {entryPageStart + rowIdx + 1}
                              </span>
                            </td>
                            {FROZEN_COLS.map((col) => (
                              <td key={col.key}>
                                {col.key === "caseNumber" ? (
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
                                      {entry.isManual ? (
                                        <input
                                          className="xls-input xls-mono"
                                          style={{ width: "100%" }}
                                          value={String(entry.caseNumber ?? "")}
                                          onChange={(e) =>
                                            handleChange(
                                              entry.id,
                                              "caseNumber",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="Enter case no."
                                          title="Manual case number"
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                              "64px minmax(0, 1fr) 76px",
                                            gap: 6,
                                          }}
                                        >
                                          <input
                                            className="xls-input xls-mono"
                                            style={{
                                              width: "100%",
                                              minWidth: 0,
                                              padding: "0 8px",
                                            }}
                                            value={`${autoNumberPart}-`}
                                            readOnly
                                            title="Auto sequence"
                                          />
                                          <input
                                            className={`xls-input xls-mono${autoAreaMissing ? " xls-input-err" : ""}`}
                                            style={{
                                              width: "100%",
                                              minWidth: 0,
                                              padding: "0 8px",
                                              textAlign: "center",
                                            }}
                                            value={autoAreaValue}
                                            onChange={(e) =>
                                              handleAreaChange(
                                                entry.id,
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Area"
                                            title="Area code for this row"
                                          />
                                          <input
                                            className="xls-input xls-mono"
                                            style={{
                                              width: "100%",
                                              minWidth: 0,
                                              padding: "0 8px",
                                            }}
                                            value={`-${autoYearPart}`}
                                            readOnly
                                            title="Auto year"
                                          />
                                        </div>
                                      )}
                                    </div>
                                    {!entry.isManual && autoAreaMissing && (
                                      <span className="xls-cell-err">
                                        <FiAlertCircle size={10} />
                                        Area is required in auto mode
                                      </span>
                                    )}
                                    {entry.errors[col.key as string] && (
                                      <span className="xls-cell-err">
                                        <FiAlertCircle size={10} />
                                        {entry.errors[col.key as string]}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <CellInput
                                    col={col}
                                    value={toInputValue(
                                      entry[col.key] as Date | string | null,
                                    )}
                                    error={entry.errors[col.key as string]}
                                    onChange={(v) =>
                                      handleChange(
                                        entry.id,
                                        col.key as string,
                                        v,
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      handleCellKeyDown(e, entry.id, false)
                                    }
                                  />
                                )}
                              </td>
                            ))}
                            {allCols.map((col, colIdx) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={toInputValue(
                                    entry[col.key] as Date | string | null,
                                  )}
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
                        : `Review ${entries.length} cases before saving`}
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

            <div className="rv-layout rv-layout-fixed-sidebar">
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
                                {displayCaseNumber || "No case no."}
                              </div>
                              <div className="rv-sidebar-name">
                                {entry.petitioner || "No petitioner"}
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
                                        <FiAlertCircle size={10} />
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
                                          Duplicate case number in current rows
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
                                        <FiAlertCircle size={10} />
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
                      displayCaseNumber={
                        entries[reviewIdx]
                          ? getDisplayCaseNumber(entries[reviewIdx])
                          : ""
                      }
                      isExistingCase={isCaseAlreadyExisting(
                        entries[reviewIdx]
                          ? getDisplayCaseNumber(entries[reviewIdx])
                          : "",
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

export default SpecialProceedingUpdatePage;
