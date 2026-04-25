"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
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
  FiSave,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import { CaseType } from "../../generated/prisma/enums";
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import { usePopup } from "../../Popup/PopupProvider";
import { createTempId } from "../../utils";
import CaseEntryToolbar from "../CaseEntryToolbar";
import {
  CASE_IMPORT_DRAFT_KEYS,
  consumeCaseImportDraft,
  downloadImportFailedExcel,
  previewCivilCaseImport,
  shouldLoadCaseImportDraft,
} from "../importPreview";
import type { CivilCaseAdapter } from "./CivilCaseAdapter";
import {
  CivilCaseEntry,
  CivilCaseSchema,
  civilCaseToEntry,
  createEmptyCivilEntry,
  type CivilCaseData,
} from "./CivilCaseSchema";

export enum CivilCaseUpdateType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

type FormEntry = {
  id: number;
  sourceId?: number;
  caseNumber: string;
  isManual: boolean;
  branch: string;
  assistantBranch: string;
  petitioners: string;
  defendants: string;
  dateFiled: string;
  notes: string;
  nature: string;
  originCaseNumber: string;
  reRaffleDate: string;
  reRaffleBranch: string;
  consolitationDate: string;
  consolidationBranch: string;
  dateRemanded: string;
  remandedNote: string;
  errors: Record<string, string>;
  saved: boolean;
};

type ColDef = {
  key: Exclude<
    keyof FormEntry,
    "id" | "sourceId" | "errors" | "saved" | "isManual"
  >;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};

const REQUIRED_FIELDS: Array<"caseNumber" | "branch" | "petitioners"> = [
  "caseNumber",
  "branch",
  "petitioners",
];

const FROZEN_COLS: ColDef[] = [
  {
    key: "caseNumber",
    label: "Case Number",
    placeholder: "01-M-2026",
    type: "text",
    width: 240,
    required: true,
    mono: true,
  },
  {
    key: "branch",
    label: "Branch",
    placeholder: "18",
    type: "text",
    width: 160,
    required: true,
  },
];

type TabGroup = {
  id: string;
  label: string;
  cols: ColDef[];
};

const TAB_GROUPS: TabGroup[] = [
  {
    id: "identity",
    label: "Identity",
    cols: [
      {
        key: "assistantBranch",
        label: "Asst. Branch",
        placeholder: "18",
        type: "text",
        width: 160,
      },
      {
        key: "dateFiled",
        label: "Date Filed",
        placeholder: "",
        type: "date",
        width: 150,
        mono: true,
      },
      {
        key: "originCaseNumber",
        label: "Origin Case Number",
        placeholder: "Optional",
        type: "text",
        width: 220,
        mono: true,
      },
    ],
  },
  {
    id: "parties",
    label: "Parties",
    cols: [
      {
        key: "petitioners",
        label: "Petitioner/s",
        placeholder: "Petitioner names",
        type: "text",
        width: 260,
        required: true,
      },
      {
        key: "defendants",
        label: "Defendant/s",
        placeholder: "Defendant names",
        type: "text",
        width: 260,
      },
      {
        key: "nature",
        label: "Nature",
        placeholder: "Nature of petition",
        type: "text",
        width: 240,
      },
      {
        key: "notes",
        label: "Notes/Appealed",
        placeholder: "Notes",
        type: "text",
        width: 220,
      },
    ],
  },
  {
    id: "status",
    label: "Status",
    cols: [
      {
        key: "reRaffleDate",
        label: "Re-Raffle Date",
        placeholder: "",
        type: "date",
        width: 150,
        mono: true,
      },
      {
        key: "reRaffleBranch",
        label: "Re-Raffle Branch",
        placeholder: "Branch",
        type: "text",
        width: 180,
      },
      {
        key: "consolitationDate",
        label: "Consolidation Date",
        placeholder: "",
        type: "date",
        width: 170,
        mono: true,
      },
      {
        key: "consolidationBranch",
        label: "Consolidation Branch",
        placeholder: "Branch",
        type: "text",
        width: 210,
      },
      {
        key: "dateRemanded",
        label: "Date Remanded",
        placeholder: "",
        type: "date",
        width: 150,
        mono: true,
      },
      {
        key: "remandedNote",
        label: "Remanded Note",
        placeholder: "Optional",
        type: "text",
        width: 220,
      },
    ],
  },
];

const AUTO_DEFAULT_AREA = "M";
const AUTO_DEFAULT_YEAR = new Date().getFullYear();

const toDateInput = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getAutoYearFromDate = (
  value: string | Date | null | undefined,
): number => {
  if (!value) return AUTO_DEFAULT_YEAR;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return AUTO_DEFAULT_YEAR;
  return date.getFullYear();
};

const normalizeCaseNumber = (value: string) => value.trim();

const normalizeAreaCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8);

const resolveAreaCode = (value: string) =>
  normalizeAreaCode(value) || AUTO_DEFAULT_AREA;

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
  parseCaseNumberParts(value)?.area || resolveAreaCode(fallbackArea);

const applyAreaToCaseNumber = (
  value: string,
  area: string,
  year?: number,
): string => {
  const normalizedArea = resolveAreaCode(area);
  const parsed = parseCaseNumberParts(value);
  const resolvedYear = year ?? parsed?.year ?? AUTO_DEFAULT_YEAR;
  if (!parsed) {
    return formatCaseNumber(normalizedArea, 1, resolvedYear);
  }

  return formatCaseNumber(normalizedArea, parsed.number, resolvedYear);
};

const withDefaultAreaForAutoEntry = (
  entry: CivilCaseEntry,
  defaultArea: string,
): CivilCaseEntry => {
  if (entry.isManual) return entry;

  return {
    ...entry,
    caseNumber: applyAreaToCaseNumber(
      entry.caseNumber ?? "",
      defaultArea,
      getAutoYearFromDate(entry.dateFiled),
    ),
  };
};

const importedCivilRowToEntry = (row: CivilCaseSchema): CivilCaseEntry => ({
  ...createEmptyCivilEntry(),
  ...row,
  id: createTempId(),
  isManual: true,
  errors: {},
  collapsed: false,
  saved: false,
});

function validateEntry(
  entry: CivilCaseEntry,
  options: { requireCaseNumber: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};

  REQUIRED_FIELDS.forEach((field) => {
    if (field === "caseNumber" && !options.requireCaseNumber) {
      return;
    }

    if (!entry[field] || String(entry[field]).trim() === "") {
      errors[field] = "Required";
    }
  });

  if (!options.requireCaseNumber && !entry.isManual) {
    const parsed = parseCaseNumberParts(entry.caseNumber);
    if (!parsed || !parsed.area) {
      errors.caseNumber = "Area is required in auto mode";
    }
  }

  return errors;
}

const toCellInputValue = (entry: CivilCaseEntry, col: ColDef): string => {
  const rawValue = entry[col.key];

  if (col.type === "date") {
    return toDateInput(rawValue as string | Date | null | undefined);
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (rawValue == null) {
    return "";
  }

  return String(rawValue);
};

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
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
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
  displayCaseNumber,
  isExistingCase,
}: {
  entry: CivilCaseEntry;
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
            {entry.petitioners || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No petitioner/s
              </span>
            )}
          </div>
          {entry.branch && (
            <div className="rv-hero-charge">Branch {entry.branch}</div>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Civil Case Details</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">Case Number</div>
                <div className="rv-field-value">
                  {displayCaseNumber || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Branch</div>
                <div className="rv-field-value">
                  {entry.branch || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Asst. Branch</div>
                <div className="rv-field-value">
                  {entry.assistantBranch || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Petitioner/s</div>
                <div className="rv-field-value">
                  {entry.petitioners || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Defendant/s</div>
                <div className="rv-field-value">
                  {entry.defendants || <span className="rv-empty">—</span>}
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
              <div className="rv-field">
                <div className="rv-field-label">Nature</div>
                <div className="rv-field-value">
                  {entry.nature || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Notes/Appealed</div>
                <div className="rv-field-value">
                  {entry.notes || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Origin Case No.</div>
                <div className="rv-field-value rv-mono">
                  {entry.originCaseNumber || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Re-Raffle Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.reRaffleDate) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Re-Raffle Branch</div>
                <div className="rv-field-value">
                  {entry.reRaffleBranch || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Consolidation Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.consolitationDate) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Consolidation Branch</div>
                <div className="rv-field-value">
                  {entry.consolidationBranch || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date Remanded</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.dateRemanded) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Remanded Note</div>
                <div className="rv-field-value">
                  {entry.remandedNote || <span className="rv-empty">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CivilCaseUpdatePage = ({
  onClose,
  selectedCase = null,
  selectedCases,
  onCreate,
  onUpdate,
  adapter,
}: {
  onClose?: () => void;
  selectedCase?: CivilCaseData | null;
  selectedCases?: CivilCaseData[];
  onCreate?: () => void;
  onUpdate?: () => void;
  adapter: CivilCaseAdapter;
}) => {
  const router = useAdaptiveNavigation();
  const statusPopup = usePopup();

  const editCases =
    selectedCases && selectedCases.length > 0
      ? selectedCases
      : selectedCase
        ? [selectedCase]
        : [];
  const isEdit = editCases.length > 0;
  const isMultiEdit = isEdit && editCases.length > 1;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [activeTab, setActiveTab] = useState(0);
  const [entryPage, setEntryPage] = useState(1);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [existingCaseNumbers, setExistingCaseNumbers] = useState<string[]>([]);
  const [autoCaseNumbersByRow, setAutoCaseNumbersByRow] = useState<
    Record<number, string>
  >({});
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [defaultArea, setDefaultArea] = useState(AUTO_DEFAULT_AREA);
  const [uploading, setUploading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState<CivilCaseEntry[]>(() => {
    if (isEdit) return editCases.map(civilCaseToEntry);
    return [withDefaultAreaForAutoEntry(createEmptyCivilEntry(), defaultArea)];
  });

  useEffect(() => {
    setStep("entry");
    setActiveTab(0);
    setEntryPage(1);

    if (isEdit) {
      setEntries(editCases.map(civilCaseToEntry));
      return;
    }

    setEntries([
      withDefaultAreaForAutoEntry(createEmptyCivilEntry(), defaultArea),
    ]);
  }, [isEdit, selectedCase, selectedCases]);

  useEffect(() => {
    if (isEdit || !shouldLoadCaseImportDraft()) return;

    const importedRows = consumeCaseImportDraft<CivilCaseSchema>(
      CASE_IMPORT_DRAFT_KEYS.civil,
    );

    if (!importedRows || importedRows.length === 0) {
      return;
    }

    setEntries(importedRows.map(importedCivilRowToEntry));
    setStep("entry");
    setActiveTab(0);
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
          const parsed = parseCaseNumberParts(entry.caseNumber);
          if (!parsed || !parsed.area) return;

          const key = `${parsed.area}|${parsed.year}`;
          const current = manualMaxPerBucket.get(key) ?? 0;
          if (parsed.number > current) {
            manualMaxPerBucket.set(key, parsed.number);
          }
        });

      const rowBuckets = autoRows.map((entry) => {
        const parsed = parseCaseNumberParts(entry.caseNumber);
        return {
          entryId: entry.id,
          area: parsed?.area || resolveAreaCode(defaultArea),
          year: getAutoYearFromDate(entry.dateFiled),
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
        const preview = await adapter.getCivilCaseNumberPreview(area, year);
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
  }, [adapter, entries, isEdit, defaultArea]);

  const handleAreaChange = useCallback((id: number, areaInput: string) => {
    const normalizedArea = resolveAreaCode(areaInput);

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              caseNumber: applyAreaToCaseNumber(
                entry.caseNumber,
                normalizedArea,
                getAutoYearFromDate(entry.dateFiled),
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
    const effectiveDefaultArea = resolveAreaCode(defaultArea);
    setDefaultArea(effectiveDefaultArea);

    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        caseNumber: applyAreaToCaseNumber(
          entry.caseNumber,
          effectiveDefaultArea,
          getAutoYearFromDate(entry.dateFiled),
        ),
      })),
    );
  }, [defaultArea]);

  const handleChange = (
    id: number,
    field: keyof FormEntry,
    value: string | boolean,
  ) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: value,
              errors: {
                ...entry.errors,
                [field]: "",
              },
            }
          : entry,
      ),
    );
  };

  const handleAddEntry = useCallback(
    (count = 1) => {
      const normalizedCount = Math.max(1, Math.floor(count));
      setEntries((prev) => {
        const next = [
          ...prev,
          ...Array.from({ length: normalizedCount }, () =>
            withDefaultAreaForAutoEntry(createEmptyCivilEntry(), defaultArea),
          ),
        ];
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

  const handleClearTable = useCallback(async () => {
    const label =
      entries.length === 1
        ? "Clear the table and reset the current row?"
        : `Clear all ${entries.length} rows and start over?`;

    if (!(await statusPopup.showConfirm(label))) return;

    setEntries([
      withDefaultAreaForAutoEntry(createEmptyCivilEntry(), defaultArea),
    ]);
    setEntryPage(1);
    setAutoCaseNumbersByRow({});
    setExistingCaseNumbers([]);
  }, [defaultArea, entries.length, statusPopup]);

  const handleImportExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await previewCivilCaseImport(file);

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

      setEntries(result.rows.map(importedCivilRowToEntry));
      setStep("entry");
      setActiveTab(0);
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

  const handleRemove = (id: number) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleDuplicate = (id: number) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: CivilCaseEntry = {
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
    event: KeyboardEvent<HTMLInputElement>,
    entryId: number,
    isLastColOfTab: boolean,
  ) => {
    if (event.key === "Tab" && !event.shiftKey && isLastColOfTab) {
      const isLastRow = entries[entries.length - 1]?.id === entryId;
      if (isLastRow && !isEdit) {
        event.preventDefault();
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
    (entry) =>
      (entry.isManual ||
        isEdit ||
        Boolean(parseCaseNumberParts(entry.caseNumber)?.area)) &&
      REQUIRED_FIELDS.every(
        (field) =>
          (field === "caseNumber" && !entry.isManual && !isEdit) ||
          (entry[field] && String(entry[field]).trim() !== ""),
      ),
  ).length;

  const incompleteCount = entries.length - completedCount;

  const getDisplayCaseNumber = (entry: CivilCaseEntry): string => {
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

    const result = await adapter.doesCaseExist(caseNumbers, CaseType.CIVIL);
    if (!result.success || !result.result) {
      setExistingCaseNumbers([]);
      return [];
    }

    const normalized = result.result.map((value) => normalizeCaseNumber(value));
    setExistingCaseNumbers(normalized);
    return normalized;
  }, [adapter, entries, isEdit]);

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
    const validated = entries.map((entry) => {
      const errors = validateEntry(entry, {
        requireCaseNumber: isEdit || entry.isManual,
      });
      if (Object.keys(errors).length > 0) {
        anyError = true;
        return { ...entry, errors };
      }
      return entry;
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

  const buildPayload = (e: CivilCaseEntry) => {
    const { id, errors, collapsed, saved, isManual, ...caseInput } = e;

    const caseNumberForPayload =
      !isEdit && !isManual
        ? autoCaseNumbersByRow[e.id] ||
          formatCaseNumber(
            getAreaFromCaseNumber(String(caseInput.caseNumber ?? ""), ""),
            1,
            getAutoYearFromDate(caseInput.dateFiled),
          )
        : caseInput.caseNumber;

    return CivilCaseSchema.safeParse({
      ...caseInput,
      caseNumber: caseNumberForPayload,
      caseType: "CIVIL",
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
      ? entries.length === 1
        ? "Save changes to this case?"
        : `Save changes to ${entries.length} cases?`
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
        createdIds.map((id) => adapter.deleteCivilCase(id)),
      );

      const rollbackErrors: string[] = [];

      rollbackResults.forEach((result, index) => {
        if (result.status === "rejected") {
          const msg = `Rollback failed for case ID ${createdIds[index]}`;
          rollbackErrors.push(msg);
        } else if (!result.value.success) {
          const msg = `Rollback failed for case ID ${createdIds[index]}: ${result.value.error || "Unknown rollback error"}`;
          rollbackErrors.push(msg);
        }
      });

      return rollbackErrors;
    };

    try {
      if (isEdit) {
        const originalById = new Map(editCases.map((item) => [item.id, item]));

        for (const entry of entries) {
          const original = originalById.get(entry.id);
          if (!original) {
            throw new Error("Missing original case for edit");
          }

          const parsed = buildPayload(entry);
          if (!parsed.success) throw new Error("Invalid case data");

          const response = await adapter.updateCivilCase(
            original.id,
            parsed.data,
          );
          if (!response.success) {
            throw new Error(response.error || "Failed to update case");
          }
        }

        onUpdate?.();
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

          const response = await adapter.createCivilCase({
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

        onCreate?.();
        statusPopup.showSuccess(
          entries.length === 1
            ? "Case created successfully"
            : `${entries.length} cases created successfully`,
        );
      }

      statusPopup.hidePopup();
      handleClose();
    } catch (error) {
      setStep("entry");
      statusPopup.showError(
        error instanceof Error ? error.message : "Failed to save case",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  }

  const currentTabCols = TAB_GROUPS[activeTab].cols;
  const tabHasErrors = (tabIdx: number) =>
    entries.some((entry) =>
      TAB_GROUPS[tabIdx].cols.some((col) => entry.errors[col.key]),
    );

  const currentEntry = entries[reviewIdx];

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
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button
            className="xls-back-btn"
            onClick={step === "review" ? () => setStep("entry") : handleClose}
            title="Back"
          >
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>Civil Cases</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit
                ? isMultiEdit
                  ? "Edit Civil Cases"
                  : "Edit Civil Case"
                : "New Civil Case"}
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
                    ? isMultiEdit
                      ? "Edit Civil Cases"
                      : "Edit Civil Case"
                    : "New Civil Case"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update record details. Required fields are marked *."
                  ) : (
                    <>
                      Use tabs to switch between field groups.{" "}
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
                      >
                        <span className="xls-pill-dot" />
                        {duplicateCaseRowCount} duplicate
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
                    {isPreviewLoading && (
                      <span className="text-xs text-base-content/50">
                        Previewing numbers...
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
              </CaseEntryToolbar>
            )}

            <div className="xls-sheet-wrap">
              <div className="xls-tab-bar">
                {TAB_GROUPS.map((group, idx) => {
                  const hasError = tabHasErrors(idx);
                  return (
                    <button
                      key={group.id}
                      className={`xls-tab${activeTab === idx ? " active" : ""}`}
                      onClick={() => setActiveTab(idx)}
                    >
                      {group.label}
                      {hasError && <span className="xls-tab-errbadge">!</span>}
                    </button>
                  );
                })}
              </div>

              <div className="xls-table-outer" ref={scrollAreaRef}>
                <table className="xls-table">
                  <colgroup>
                    <col style={{ width: ROW_NUM_W }} />
                    {FROZEN_COLS.map((col) => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                    {currentTabCols.map((col) => (
                      <col key={col.key} style={{ width: col.width }} />
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
                      {pagedEntries.map((entry, rowIdx) => {
                        const lastColIdx = currentTabCols.length - 1;
                        const displayCaseNumber = getDisplayCaseNumber(entry);
                        const autoCasePreview =
                          autoCaseNumbersByRow[entry.id] || entry.caseNumber;
                        const autoParsed =
                          parseCaseNumberParts(autoCasePreview);
                        const autoNumberPart = String(
                          autoParsed?.number ?? 1,
                        ).padStart(2, "0");
                        const autoYearPart = String(
                          autoParsed?.year ??
                            getAutoYearFromDate(entry.dateFiled),
                        );
                        const autoAreaValue = getAreaFromCaseNumber(
                          entry.caseNumber,
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
                          >
                            <td className="td-num">
                              <span className="xls-rownum">
                                {entryPageStart + rowIdx + 1}
                              </span>
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

                                      {entry.isManual ? (
                                        <input
                                          className="xls-input xls-mono"
                                          style={{ width: "100%" }}
                                          value={entry.caseNumber ?? ""}
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
                                              "72px minmax(0, 1fr) 84px",
                                            gap: 6,
                                          }}
                                        >
                                          <input
                                            className="xls-input xls-mono"
                                            style={{ width: "100%" }}
                                            value={`${autoNumberPart}-`}
                                            readOnly
                                            title="Auto sequence"
                                          />
                                          <input
                                            className={`xls-input xls-mono${autoAreaMissing ? " xls-input-err" : ""}`}
                                            style={{
                                              width: "100%",
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
                                            style={{ width: "100%" }}
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
                                    value={toCellInputValue(entry, col)}
                                    error={entry.errors[col.key]}
                                    onChange={(v) =>
                                      handleChange(entry.id, col.key, v)
                                    }
                                  />
                                )}
                              </td>
                            ))}

                            {currentTabCols.map((col, colIdx) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={toCellInputValue(entry, col)}
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
                <button className="xls-btn xls-btn-ghost" onClick={handleClose}>
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
                      numbers.
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
                    {entries.map((entry, idx) => {
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
                        >
                          <span className="rv-sidebar-num">{idx + 1}</span>
                          <div className="rv-sidebar-info">
                            <div className="rv-sidebar-casenum">
                              {displayCaseNumber || "No case number"}
                            </div>
                            <div className="rv-sidebar-name">
                              {entry.petitioners || "No petitioners"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
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
                    {currentEntry && (
                      <ReviewCard
                        entry={currentEntry}
                        displayCaseNumber={getDisplayCaseNumber(currentEntry)}
                        isExistingCase={isCaseAlreadyExisting(
                          getDisplayCaseNumber(currentEntry),
                        )}
                      />
                    )}
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
                      onClick={() =>
                        setReviewIdx((idx) => Math.max(0, idx - 1))
                      }
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
                        setReviewIdx((idx) =>
                          Math.min(entries.length - 1, idx + 1),
                        )
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

export const NotarialUpdatePage = CivilCaseUpdatePage;

export default CivilCaseUpdatePage;
