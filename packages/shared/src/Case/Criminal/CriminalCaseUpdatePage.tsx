"use client";

import {
  CaseType,
  createEmptyCriminalEntry,
  CriminalCaseAdapter,
  CriminalCaseData,
  CriminalCaseEntry,
  CriminalCaseSchema,
  criminalCaseToEntry,
  usePopup,
  useToast,
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
  FiDollarSign,
  FiEdit3,
  FiEye,
  FiFileText,
  FiMapPin,
  FiPlus,
  FiSave,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import { createTempId } from "../../utils";

export enum CriminalCaseUpdateType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

const REQUIRED_FIELDS = ["name", "caseNumber"] as const;
const normalizeCaseNumber = (value: string) => value.trim();
const AUTO_DEFAULT_AREA = "M";
const AUTO_DEFAULT_YEAR = new Date().getFullYear();
const getAutoYearFromDate = (
  value: string | Date | null | undefined,
): number => {
  if (!value) return AUTO_DEFAULT_YEAR;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return AUTO_DEFAULT_YEAR;
  return date.getFullYear();
};
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

const applyAreaToCaseNumber = (
  value: string,
  area: string,
  year?: number,
): string => {
  const normalizedArea = normalizeAreaCode(area);
  const parsed = parseCaseNumberParts(value);
  const resolvedYear = year ?? parsed?.year ?? AUTO_DEFAULT_YEAR;
  if (!parsed) {
    return formatCaseNumber(normalizedArea, 1, resolvedYear);
  }

  return formatCaseNumber(normalizedArea, parsed.number, resolvedYear);
};

type ColDef = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "number" | "checkbox" | "select";
  width: number;
  required?: boolean;
  mono?: boolean;
  options?: { value: string; label: string }[];
};

const FROZEN_COLS: ColDef[] = [
  {
    key: "caseNumber",
    label: "Case No.",
    placeholder: "CR-2026-0001",
    type: "text",
    width: 220,
    required: true,
    mono: true,
  },
  {
    key: "name",
    label: "Accused Name",
    placeholder: "Full name",
    type: "text",
    width: 200,
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
    label: "Case Identity",
    cols: [
      {
        key: "branch",
        label: "Branch",
        placeholder: "Branch 1",
        type: "text",
        width: 115,
      },
      {
        key: "assistantBranch",
        label: "Asst. Branch",
        placeholder: "Branch 2",
        type: "text",
        width: 115,
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
        key: "raffleDate",
        label: "Raffle Date",
        placeholder: "",
        type: "date",
        width: 148,
        mono: true,
      },
      {
        key: "infoSheet",
        label: "Info Sheet",
        placeholder: "IS-001",
        type: "text",
        width: 115,
      },
      {
        key: "court",
        label: "Court",
        placeholder: "RTC Br. 1",
        type: "text",
        width: 125,
      },
      {
        key: "consolidation",
        label: "Consolidation",
        placeholder: "N/A",
        type: "text",
        width: 135,
      },
    ],
  },
  {
    id: "accused",
    label: "Accused Info",
    cols: [
      {
        key: "charge",
        label: "Charge",
        placeholder: "Charge description",
        type: "text",
        width: 210,
      },
      {
        key: "detained",
        label: "Detained",
        placeholder: "Yes/No",
        type: "text",
        width: 88,
      },
      {
        key: "bond",
        label: "Bond",
        placeholder: "Enter bond amount",
        type: "text",
        width: 125,
      },
      {
        key: "eqcNumber",
        label: "EQC No.",
        placeholder: "—",
        type: "number",
        width: 100,
        mono: true,
      },
    ],
  },
  {
    id: "personnel",
    label: "Personnel",
    cols: [
      {
        key: "judge",
        label: "Judge",
        placeholder: "Judge name",
        type: "text",
        width: 165,
      },
      {
        key: "ao",
        label: "AO",
        placeholder: "AO name",
        type: "text",
        width: 145,
      },
      {
        key: "complainant",
        label: "Complainant",
        placeholder: "Complainant name",
        type: "text",
        width: 175,
      },
      {
        key: "committee1",
        label: "Committee 1",
        placeholder: "—",
        type: "text",
        width: 108,
        mono: true,
      },
      {
        key: "committee2",
        label: "Committee 2",
        placeholder: "—",
        type: "text",
        width: 108,
        mono: true,
      },
    ],
  },
  {
    id: "address",
    label: "Address",
    cols: [
      {
        key: "houseNo",
        label: "House No.",
        placeholder: "123",
        type: "text",
        width: 92,
      },
      {
        key: "street",
        label: "Street",
        placeholder: "Street name",
        type: "text",
        width: 155,
      },
      {
        key: "barangay",
        label: "Barangay",
        placeholder: "Brgy.",
        type: "text",
        width: 135,
      },
      {
        key: "municipality",
        label: "Municipality",
        placeholder: "Municipality",
        type: "text",
        width: 150,
      },
      {
        key: "province",
        label: "Province",
        placeholder: "Province",
        type: "text",
        width: 135,
      },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    cols: [
      {
        key: "counts",
        label: "Counts",
        placeholder: "0",
        type: "text",
        width: 84,
        mono: true,
      },
      {
        key: "amountInvolved",
        label: "Amt. Involved",
        placeholder: "0.00",
        type: "text",
        width: 138,
        mono: true,
      },
      {
        key: "jdf",
        label: "JDF",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "sajj",
        label: "SAJJ",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "sajj2",
        label: "SAJJ 2",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "mf",
        label: "MF",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "stf",
        label: "STF",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "lrf",
        label: "LRF",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "vcf",
        label: "VCF",
        placeholder: "0.00",
        type: "text",
        width: 95,
        mono: true,
      },
      {
        key: "total",
        label: "Total",
        placeholder: "0.00",
        type: "text",
        width: 115,
        mono: true,
      },
    ],
  },
];

function validateEntry(
  entry: CriminalCaseEntry,
  options: { requireCaseNumber: boolean },
): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!options.requireCaseNumber && k === "caseNumber") return;
    if (
      !entry[k as keyof CriminalCaseEntry] ||
      String(entry[k as keyof CriminalCaseEntry]).trim() === ""
    )
      errs[k] = "Required";
  });

  if (!options.requireCaseNumber && !entry.isManual) {
    const parsed = parseCaseNumberParts(String(entry.caseNumber ?? ""));
    if (!parsed || !parsed.area) {
      errs.caseNumber = "Area is required in auto mode";
    }
  }

  return errs;
}

/* ─── Cell Input ─────────────────────────────────────────────── */
const CellInput = ({
  col,
  value,
  error,
  onChange,
  onKeyDown,
  readOnly,
}: {
  col: ColDef;
  value: string | boolean | number | Date | null | undefined;
  error?: string;
  onChange: (v: string | boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}) => {
  // Convert null/undefined to empty string, Date objects to YYYY-MM-DD format
  const stringValue =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value);
  if (col.type === "checkbox") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 44,
          padding: "0 12px",
        }}
      >
        <input
          type="checkbox"
          className="xls-checkbox"
          checked={value as boolean}
          onChange={(e) => onChange(e.target.checked)}
          title="Detained?"
        />
      </div>
    );
  }
  if (col.type === "select") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <select
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          title={error || col.label}
          className={`xls-input${error ? " xls-input-err" : ""}`}
          style={{ height: 44 }}
        >
          {col.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="xls-cell-err">
            <FiAlertCircle size={10} />
            {error}
          </span>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <input
        type={
          col.type === "date"
            ? "date"
            : col.type === "number"
              ? "number"
              : "text"
        }
        step={col.type === "number" ? "0.01" : undefined}
        value={stringValue}
        placeholder={col.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
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

/* ─── Review: single case card ───────────────────────────────── */
function ReviewCard({
  entry,
  displayCaseNumber,
  isExistingCase,
}: {
  entry: CriminalCaseEntry;
  displayCaseNumber: string;
  isExistingCase: boolean;
}) {
  const filledAddress =
    [
      entry.houseNo,
      entry.street,
      entry.barangay,
      entry.municipality,
      entry.province,
    ]
      .filter(Boolean)
      .join(", ") || null;

  const financialRows = [
    { label: "Counts", value: entry.counts || null, isCurrency: false },
    {
      label: "Amt. Involved",
      value: entry.amountInvolved,
      isCurrency: true,
    },
    { label: "JDF", value: entry.jdf, isCurrency: true },
    { label: "SAJJ", value: entry.sajj, isCurrency: true },
    { label: "SAJJ 2", value: entry.sajj2, isCurrency: true },
    { label: "MF", value: entry.mf, isCurrency: true },
    { label: "STF", value: entry.stf, isCurrency: true },
    { label: "LRF", value: entry.lrf, isCurrency: true },
    { label: "VCF", value: entry.vcf, isCurrency: true },
    { label: "Total", value: entry.total, isCurrency: true, isTotal: true },
  ]
    .filter((r) => r.value && r.value !== "")
    .map((r) => ({
      ...r,
      display:
        r.isCurrency && r.value
          ? `₱ ${(typeof r.value === "number" ? r.value : parseFloat(r.value)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
          : r.value,
    }));

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
            {entry.name || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No name entered
              </span>
            )}
          </div>
          {entry.charge && <div className="rv-hero-charge">{entry.charge}</div>}
        </div>
        <div className="rv-hero-badges">
          <span
            className={`rv-badge ${entry.detained && entry.detained.trim() ? "rv-badge-detained" : "rv-badge-released"}`}
          >
            {entry.detained && entry.detained.trim()
              ? entry.detained
              : "Released"}
          </span>
          {entry.court && (
            <span className="rv-badge rv-badge-court">{entry.court}</span>
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
                <div className="rv-field-label">Info Sheet</div>
                <div className="rv-field-value rv-mono">
                  {entry.infoSheet || <span className="rv-empty">—</span>}
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
                <div className="rv-field-label">Raffle Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.raffleDate) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Consolidation</div>
                <div className="rv-field-value">
                  {entry.consolidation || <span className="rv-empty">—</span>}
                </div>
              </div>
              {entry.eqcNumber && (
                <div className="rv-field">
                  <div className="rv-field-label">EQC No.</div>
                  <div className="rv-field-value rv-mono">
                    {entry.eqcNumber}
                  </div>
                </div>
              )}
              {entry.bond && (
                <div className="rv-field">
                  <div className="rv-field-label">Bond</div>
                  <div className="rv-field-value rv-mono">{entry.bond}</div>
                </div>
              )}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiUsers size={13} />
              <span>Personnel</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Judge</div>
                <div className="rv-field-value">
                  {entry.judge || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Administrative Officer</div>
                <div className="rv-field-value">
                  {entry.ao || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Complainant</div>
                <div className="rv-field-value">
                  {entry.complainant || <span className="rv-empty">—</span>}
                </div>
              </div>
              {entry.committee1 && (
                <div className="rv-field">
                  <div className="rv-field-label">Committee 1</div>
                  <div className="rv-field-value rv-mono">
                    {entry.committee1}
                  </div>
                </div>
              )}
              {entry.committee2 && (
                <div className="rv-field">
                  <div className="rv-field-label">Committee 2</div>
                  <div className="rv-field-value rv-mono">
                    {entry.committee2}
                  </div>
                </div>
              )}
            </div>
          </div>

          {filledAddress && (
            <div className="rv-section">
              <div className="rv-section-header">
                <FiMapPin size={13} />
                <span>Address</span>
              </div>
              <div className="rv-address-line">{filledAddress}</div>
            </div>
          )}
        </div>

        {financialRows.length > 0 && (
          <div className="rv-fin-sidebar">
            <div className="rv-section-header" style={{ marginBottom: 12 }}>
              <FiDollarSign size={13} />
              <span>Financials</span>
            </div>
            <div className="rv-fin-table">
              {financialRows.map((row) => (
                <div
                  key={row.label}
                  className={`rv-fin-row${row.isTotal ? " rv-fin-total" : ""}`}
                >
                  <span className="rv-fin-label">{row.label}</span>
                  <span className="rv-fin-value">{row.display}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
const CriminalCaseUpdatePage = ({
  onClose,
  selectedCase = null,
  selectedCases,
  onCreate,
  onUpdate,
  adapter,
}: {
  onClose?: () => void;
  selectedCase?: CriminalCaseData | null;
  selectedCases?: CriminalCaseData[];
  onCreate?: () => void;
  onUpdate?: () => void;
  adapter: CriminalCaseAdapter;
}) => {
  const editCases =
    selectedCases && selectedCases.length > 0
      ? selectedCases
      : selectedCase
        ? [selectedCase]
        : [];
  const isEdit = editCases.length > 0;
  const isMultiEdit = isEdit && editCases.length > 1;
  const statusPopup = usePopup();
  const toast = useToast();
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const router = useAdaptiveNavigation();

  const makeFromCase = (sc: CriminalCaseData): CriminalCaseEntry =>
    criminalCaseToEntry({ ...sc, id: sc.id ?? createTempId() });

  const [entries, setEntries] = useState<CriminalCaseEntry[]>(() => {
    if (isEdit) return editCases.map(makeFromCase);
    const newEntry = createEmptyCriminalEntry();
    return [
      {
        ...newEntry,
        caseNumber: formatCaseNumber(
          AUTO_DEFAULT_AREA,
          1,
          getAutoYearFromDate(newEntry.dateFiled),
        ),
      },
    ];
  });

  useEffect(() => {
    setStep("entry");
    setActiveTab(0);
    setEntryPage(1);

    if (isEdit) {
      setEntries(editCases.map(makeFromCase));
      return;
    }

    const newEntry = createEmptyCriminalEntry();
    setEntries([
      {
        ...newEntry,
        caseNumber: formatCaseNumber(
          AUTO_DEFAULT_AREA,
          1,
          getAutoYearFromDate(newEntry.dateFiled),
        ),
      },
    ]);
  }, [isEdit, selectedCase, selectedCases]);

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
          area: parsed?.area ?? "",
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
        const preview = await adapter.getCriminalCaseNumberPreview(area, year);
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
  }, [entries, isEdit]);

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
    const effectiveDefaultArea = normalizeAreaCode(defaultArea);
    setDefaultArea(effectiveDefaultArea);

    setEntries((prev) =>
      prev.map((entry) => {
        return {
          ...entry,
          caseNumber: applyAreaToCaseNumber(
            String(entry.caseNumber ?? ""),
            effectiveDefaultArea,
            getAutoYearFromDate(entry.dateFiled),
          ),
        };
      }),
    );
  }, [defaultArea]);

  const handleChange = (id: number, field: string, value: string | boolean) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: value, errors: { ...e.errors, [field]: "" } }
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback(
    (count: number = 1) => {
      const normalizedCount = Math.max(1, Math.floor(count));
      setEntries((prev) => {
        const next = [
          ...prev,
          ...Array.from({ length: normalizedCount }, () => {
            const newEntry = createEmptyCriminalEntry();
            return {
              ...newEntry,
              caseNumber: formatCaseNumber(
                normalizeAreaCode(defaultArea),
                1,
                getAutoYearFromDate(newEntry.dateFiled),
              ),
            };
          }),
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

    const newEntry = createEmptyCriminalEntry();
    setEntries([
      {
        ...newEntry,
        caseNumber: formatCaseNumber(
          normalizeAreaCode(defaultArea),
          1,
          getAutoYearFromDate(newEntry.dateFiled),
        ),
      },
    ]);
    setEntryPage(1);
    setAutoCaseNumbersByRow({});
    setExistingCaseNumbers([]);
  }, [defaultArea, entries.length, statusPopup]);

  const handleRemove = (id: number) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: number) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: CriminalCaseEntry = {
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

  const completedCount = entries.filter(
    (e) =>
      (e.isManual ||
        isEdit ||
        Boolean(parseCaseNumberParts(String(e.caseNumber ?? ""))?.area)) &&
      REQUIRED_FIELDS.every(
        (k) =>
          (k === "caseNumber" && !e.isManual && !isEdit) ||
          (e[k as keyof CriminalCaseEntry] &&
            String(e[k as keyof CriminalCaseEntry]).trim() !== ""),
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
    (entry) => entry.isManual && isCaseAlreadyExisting(entry.caseNumber),
  ).length;

  const getDisplayCaseNumber = (entry: CriminalCaseEntry): string => {
    if (entry.isManual || isEdit) {
      return entry.caseNumber || "";
    }

    return autoCaseNumbersByRow[entry.id] ?? "";
  };

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

    const result = await adapter.doesCaseExist(caseNumbers, CaseType.CRIMINAL);
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

  const buildPayload = (e: CriminalCaseEntry) => {
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

    return CriminalCaseSchema.safeParse({
      ...caseInput,
      caseNumber: caseNumberForPayload,
      caseType: "CRIMINAL",
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
        createdIds.map((id) => adapter.deleteCriminalCase(id)),
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
        const originalById = new Map(editCases.map((item) => [item.id, item]));

        for (const entry of entries) {
          const original = originalById.get(entry.id);
          if (!original) {
            setStep("entry");
            statusPopup.showError("Invalid case selection for edit");
            return;
          }

          const parsed = buildPayload(entry);
          if (!parsed.success) {
            setStep("entry");
            statusPopup.showError(
              "Invalid data. Please review required fields.",
            );
            return;
          }

          const payload = parsed.data;
          const response = await adapter.updateCriminalCase(original.id, {
            ...payload,
            dateFiled: payload.dateFiled
              ? new Date(payload.dateFiled).toISOString()
              : null,
            raffleDate: payload.raffleDate
              ? new Date(payload.raffleDate).toISOString()
              : null,
          });

          if (!response.success) {
            console.error("Failed to update criminal case", {
              caseId: original.id,
              response,
            });
            setStep("entry");
            statusPopup.showError(response.error || "Failed to update case");
            return;
          }
        }

        onUpdate?.();
        toast.success(
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
          const payload = parsed.data;
          const response = await adapter.createCriminalCase({
            ...payload,
            isManual: entry.isManual,
            dateFiled: payload.dateFiled
              ? new Date(payload.dateFiled).toISOString()
              : null,
            raffleDate: payload.raffleDate
              ? new Date(payload.raffleDate).toISOString()
              : null,
          });

          if (!response.success) {
            console.error("Failed to create criminal case", {
              row: idx + 1,
              response,
            });

            const responseError = response.error || "Unknown error";

            const rollbackErrors = await rollbackCreatedCases(createdCaseIds);
            setStep("entry");
            statusPopup.showError(
              [
                `Failed to create row ${idx + 1}: ${responseError}.`,
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

        onCreate?.();
        toast.success(
          entries.length === 1
            ? "Case created successfully"
            : `${entries.length} cases created successfully`,
        );
      }

      statusPopup.hidePopup();
      handleClose();
    } catch (err) {
      setStep("entry");
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to save case",
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
    entries.some((e) => TAB_GROUPS[tabIdx].cols.some((c) => e.errors[c.key]));

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
    <>
      <div className="xls-root">
        {/* ══ TOPBAR ══ */}
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
              <span>Criminal Cases</span>
              <FiChevronRight size={12} className="xls-breadcrumb-sep" />
              <span className="xls-breadcrumb-current">
                {isEdit
                  ? isMultiEdit
                    ? "Edit Criminal Cases"
                    : "Edit Criminal Case"
                  : "New Criminal Case"}
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
              <div
                className={`xls-step ${step === "entry" ? "active" : "done"}`}
              >
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
                      ? isMultiEdit
                        ? "Edit Criminal Cases"
                        : "Edit Criminal Case"
                      : "New Criminal Case"}
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
                      Auto: system assigns the next case number based on
                      sequence. Manual: you type the case number yourself
                      (duplicates allowed).
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-success gap-2"
                    onClick={() => handleAddEntry(1)}
                  >
                    <FiPlus size={15} />
                    Add Row
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-outline gap-2"
                    onClick={() => handleAddEntry(5)}
                  >
                    <FiPlus size={15} />
                    +5 Rows
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-outline gap-2"
                    onClick={() => handleAddEntry(10)}
                  >
                    <FiPlus size={15} />
                    +10 Rows
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning btn-outline"
                    onClick={() => void handleClearTable()}
                  >
                    Clear All
                  </button>
                </div>
              )}

              <div className="xls-sheet-wrap">
                <div className="xls-tab-bar">
                  {TAB_GROUPS.map((grp, idx) => {
                    const hasErr = tabHasErrors(idx);
                    return (
                      <button
                        key={grp.id}
                        className={`xls-tab${activeTab === idx ? " active" : ""}`}
                        onClick={() => setActiveTab(idx)}
                      >
                        {grp.label}
                        {hasErr && <span className="xls-tab-errbadge">!</span>}
                      </button>
                    );
                  })}
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
                        {pagedEntries.map((entry, rowIdx) => {
                          const lastColIdx = currentTabCols.length - 1;
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
                              getAutoYearFromDate(entry.dateFiled),
                          );
                          const autoAreaValue = getAreaFromCaseNumber(
                            String(entry.caseNumber ?? ""),
                            "",
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
                              exit={{
                                opacity: 0,
                                height: 0,
                                overflow: "hidden",
                              }}
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
                                            value={String(
                                              entry.caseNumber ?? "",
                                            )}
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
                                      {entry.errors[col.key] && (
                                        <span className="xls-cell-err">
                                          <FiAlertCircle size={10} />
                                          {entry.errors[col.key]}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <CellInput
                                      col={col}
                                      value={(entry as any)[col.key]}
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
                                  {!isEdit && entries.length > 1 && (
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
                  <button
                    className="xls-btn xls-btn-ghost"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="xls-btn xls-btn-primary"
                    onClick={handleGoToReview}
                  >
                    <FiEye size={15} />
                    Review
                    {!isEdit && entries.length > 1
                      ? ` (${entries.length})`
                      : ""}
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
                        {duplicateCaseRowCount > 1 ? "s" : ""} have duplicate
                        case numbers in this batch.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rv-layout">
                {entries.length > 1 && (
                  <div className="rv-sidebar">
                    <div className="rv-sidebar-head">
                      {entries.length} Cases
                    </div>
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
                                  {entry.name || "No name"}
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
                                            Duplicate case number in current
                                            rows
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
                          setReviewIdx((i) =>
                            Math.min(entries.length - 1, i + 1),
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
    </>
  );
};

export default CriminalCaseUpdatePage;
