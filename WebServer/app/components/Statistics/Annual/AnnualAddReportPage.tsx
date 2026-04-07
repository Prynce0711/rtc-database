"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    FiArrowLeft,
    FiCheck,
    FiChevronRight,
    FiCopy,
    FiEdit3,
    FiEye,
    FiFileText,
    FiGrid,
    FiPlus,
    FiSave,
    FiTrash2,
    FiUpload,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import { AnyColumnDef, flattenColumns, isGroupColumn } from "./AnnualColumnDef";
import { FieldConfig } from "./AnnualFieldConfig";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EditableRow {
  _rowId: string;
  [key: string]: string | number;
}

export interface AnnualAddReportPageProps {
  title: string;
  fields: FieldConfig[];
  columns: AnyColumnDef[];
  selectedYear?: string;
  initialData?: Record<string, unknown>[];
  activeView?: string;
  onSwitchView?: (view: string) => void;
  /** If provided, only show these view buttons in the toolbar (e.g. ["MTC","RTC"]) */
  allowedViews?: string[];
  /** Optional pre-defined tabs to show instead of the auto-computed grouping */
  customTabs?: { label: string; fields: FieldConfig[] }[] | null;
  onBack: () => void;
  onSave: (rows: Record<string, unknown>[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const buildEmptyRow = (fields: FieldConfig[]): EditableRow => {
  const row: EditableRow = { _rowId: createRowId() };
  for (const f of fields) {
    if (f.type === "date") {
      row[f.name] = new Date().toISOString().slice(0, 10);
    } else {
      row[f.name] = "";
    }
  }
  return row;
};

const createRowId = (): string => {
  if (typeof globalThis !== "undefined") {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
  }

  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

type SheetCell = string | number | null;

type HeaderRowInfo = {
  headerRowIndex: number;
  headerRow: string[];
  matchScore: number;
};

const normalizeImportHeader = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const toCellText = (cell: SheetCell | undefined): string => {
  if (cell === null || cell === undefined) return "";
  const asString = typeof cell === "string" ? cell : String(cell);
  return asString.replace(/\s+/g, " ").trim();
};

const normalizeDateOnly = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (text === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeYearOnly = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (text === "") return "";
  if (/^\d{4}$/.test(text)) return text;

  const normalizedDate = normalizeDateOnly(text);
  return normalizedDate ? normalizedDate.slice(0, 4) : "";
};

const extractYearFromHeader = (value: string): number | undefined => {
  const match = value.match(/(?:19|20)\d{2}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : undefined;
};

const isPercentageFieldName = (fieldName: string): boolean =>
  normalizeImportHeader(fieldName).includes("percentage");

const toPercentNumber = (value: string | number): number | undefined => {
  const rawText = typeof value === "number" ? String(value) : value;
  const cleaned = rawText.replace(/,/g, "").trim();
  if (cleaned === "") return undefined;

  const hasPercentSign = cleaned.includes("%");
  const parsed = Number(cleaned.replace(/%/g, ""));
  if (!Number.isFinite(parsed)) return undefined;

  const percentValue =
    !hasPercentSign && parsed >= 0 && parsed <= 1 ? parsed * 100 : parsed;
  return Number(percentValue.toFixed(2));
};

const IMPORT_FOOTER_SECTION_MARKERS = new Set([
  "preparedby",
  "notedby",
  "remarks",
]);

const IMPORT_TITLE_TOKENS = [
  "monthlyreport",
  "annualreport",
  "judgmentday",
  "judgementday",
  "nationwidejudgmentweek",
  "nationwidejudgementweek",
  "regionaltrialcourt",
  "municipaltrialcourt",
];

const IMPORT_FOOTER_TOKENS = [
  "preparedby",
  "notedby",
  "statistician",
  "clerkofcourt",
  "attorney",
  "atty",
  "judge",
];

const IMPORT_BRANCH_HEADER_TOKENS = new Set([
  "branch",
  "branches",
  "branchno",
  "branchesno",
  "no",
  "branchnumber",
]);

const IMPORT_NON_DATA_IDENTIFIER_VALUES = new Set([
  "branch",
  "branches",
  "no",
  "branchno",
  "branchesno",
  "branchnumber",
  "remarks",
  "remark",
  "total",
  "grand",
  "grandtotal",
  "subtotal",
]);

const IMPORT_CASE_HEADER_TOKENS = [
  "civil",
  "criminal",
  "total",
  "heard",
  "disposed",
  "summaryproc",
  "pdl",
  "cicl",
  "fine",
];

const hasImportToken = (
  normalizedValues: string[],
  tokens: string[],
): boolean =>
  normalizedValues.some((value) =>
    tokens.some((token) => value.includes(token)),
  );

const isImportHeaderLikeRow = (normalizedValues: string[]): boolean => {
  const hasBranchToken = normalizedValues.some((value) =>
    IMPORT_BRANCH_HEADER_TOKENS.has(value),
  );
  const hasCaseToken = normalizedValues.some((value) =>
    IMPORT_CASE_HEADER_TOKENS.some((token) => value.includes(token)),
  );

  return hasBranchToken && hasCaseToken;
};

const shouldIgnoreAnnualImportRow = ({
  normalizedRowValues,
  identifierValue,
  hasTextContent,
  hasNumericNonZero,
}: {
  normalizedRowValues: string[];
  identifierValue: string;
  hasTextContent: boolean;
  hasNumericNonZero: boolean;
}): boolean => {
  if (normalizedRowValues.length === 0) return true;

  if (
    IMPORT_FOOTER_SECTION_MARKERS.has(identifierValue) ||
    hasImportToken(normalizedRowValues, IMPORT_FOOTER_TOKENS)
  ) {
    return true;
  }

  if (
    IMPORT_NON_DATA_IDENTIFIER_VALUES.has(identifierValue) ||
    identifierValue.startsWith("egbranch")
  ) {
    return true;
  }

  if (
    normalizedRowValues.some((value) =>
      IMPORT_NON_DATA_IDENTIFIER_VALUES.has(value),
    )
  ) {
    return true;
  }

  if (isImportHeaderLikeRow(normalizedRowValues)) return true;

  if (
    !hasNumericNonZero &&
    hasImportToken(normalizedRowValues, IMPORT_TITLE_TOKENS)
  ) {
    return true;
  }

  // Prevent empty/zero-only rows from being imported as fake entries.
  if (!hasTextContent && !hasNumericNonZero) return true;

  return false;
};

const IMPORT_FIELD_ALIASES: Record<string, string[]> = {
  branchno: ["Branches", "Branches No.", "Branch No", "Branch Number", "No."],
  civilv: [
    "Civil V",
    "Civil Voluntary",
    "Number of Cases Heard/Tried Civil V",
    "Cases Heard Civil V",
    "Cases Heard/Tried Civil V",
  ],
  civilinc: [
    "Civil In-C",
    "Civil Inc",
    "Civil InC",
    "Civil L",
    "Number of Cases Heard/Tried Civil In-C",
  ],
  criminalv: [
    "Criminal V",
    "Criminal Voluntary",
    "Crim V",
    "Number of Cases Heard/Tried Criminal V",
    "Cases Heard Criminal V",
  ],
  criminalinc: [
    "Criminal In-C",
    "Criminal Inc",
    "Criminal InC",
    "Crim In-C",
    "Crim Inc",
    "Criminal L",
    "Number of Cases Heard/Tried Criminal In-C",
  ],
  totalheard: [
    "Total Cases Heard",
    "Total Heard",
    "Cases Heard",
    "Total Cases Heard/Tried",
  ],
  disposedcivil: [
    "Disposed Civil",
    "Cases Disposed Civil",
    "Number of Cases Disposed Civil",
    "Civil Heard",
  ],
  disposedcrim: [
    "Disposed Crim",
    "Disposed Criminal",
    "Cases Disposed Criminal",
    "Number of Cases Disposed Criminal",
    "Crim Heard",
    "Criminal Heard",
  ],
  summaryproc: ["Summary Proc", "Summary Procedure", "Cases Proc"],
  casesdisposed: [
    "Cases Disposed",
    "Total Cases Disposed",
    "TOTAL Cases Disposed",
  ],
  totaldisposed: [
    "Total Cases Disposed",
    "TOTAL Cases Disposed",
    "Cases Disposed",
    "Total Disposed",
  ],
  pdlm: ["PDL M", "PDL/CICL M", "PDL CICL M"],
  pdlf: ["PDL F", "PDL/CICL F", "PDL CICL F"],
  pdlcicl: ["PDL CICL", "PDL/CICL CICL"],
  pdltotal: [
    "PDL Total",
    "PDL/CICL Total",
    "Number of Detainees Ordered Released Total",
    "Detainees Ordered Released Total",
  ],
  pdlv: ["PDL Released V", "Released V"],
  pdli: ["PDL I", "PDL In-C", "PDL Inc", "Released In-C"],
  pdlinc: ["PDL Released In-C", "PDL In-C", "PDL Inc", "Released In-C"],
  pdlbail: ["PDL Bail", "Bail", "Released on Bail"],
  pdlrecognizance: [
    "PDL Recognizance",
    "Recognizance",
    "Released on Bail/Recognizance",
  ],
  pdlminror: ["PDL Min/Ror", "Min/Ror", "Min Ror", "Minror"],
  pdlmaxsentence: [
    "PDL Max Sentence",
    "Max Sentence",
    "Convicted",
    "Convicted (Transferred to BOC)",
  ],
  pdldismissal: ["PDL Dismissal", "Dismissal", "Cases Dismissed"],
  pdlacquittal: ["PDL Acquittal", "Acquittal", "Acquitted"],
  pdlminsentence: ["PDL Min Sentence", "Min Sentence"],
  pdlothers: ["PDL Others", "Others"],
  pdlprobation: ["PDL Probation", "Probation", "Others"],
  ciclm: ["CICL M", "PDL Released M"],
  ciclf: ["CICL F", "PDL Released F"],
  ciclv: ["CICL V", "PDL Released V"],
  ciclinc: [
    "CICL In-C",
    "CICL Inc",
    "CICL InC",
    "CICL L",
    "PDL Released In-c",
    "PDL Released In-C",
  ],
  fine: [
    "Fine",
    "Full Service of Sentence,Fine,etc",
    "Full Service of Sentence Fine etc",
    "PDL Released Fine",
  ],
  total: ["TOTAL", "Grand Total", "PDL Released TOTAL"],
};

const buildFieldAliases = (field: FieldConfig): string[] => {
  const normalizedName = normalizeImportHeader(field.name);
  const camelWords = field.name.replace(/([a-z])([A-Z])/g, "$1 $2");

  const aliases = [field.name, field.label, camelWords];

  if (normalizedName === "branch" || normalizedName === "branchno") {
    aliases.push("Branches", "Branches No.", "Branch No", "Branch Number");
  }

  if (normalizedName === "pendingthisyear") {
    aliases.push("Pending This Year", "Pending Year Now");
  }

  if (normalizedName === "raffledoradded") {
    aliases.push("Raffled/Added", "Raffled Added");
  }

  if (normalizedName === "percentageofdisposition") {
    aliases.push("% Disposition", "Disposition Percentage");
  }

  const extraAliases = IMPORT_FIELD_ALIASES[normalizedName];
  if (extraAliases && extraAliases.length > 0) {
    aliases.push(...extraAliases);
  }

  return Array.from(
    new Set(
      aliases
        .map((candidate) => normalizeImportHeader(candidate))
        .filter((candidate) => candidate.length > 0),
    ),
  );
};

type InventoryMetricFieldName =
  | "civilSmallClaimsFiled"
  | "criminalCasesFiled"
  | "civilSmallClaimsDisposed"
  | "criminalCasesDisposed";

const includesAnyToken = (value: string, tokens: string[]): boolean =>
  tokens.some((token) => value.includes(token));

const getInventoryMetricColumnIndexes = (
  normalizedHeaders: string[],
): Partial<Record<InventoryMetricFieldName, number>> => {
  const isCivilHeader = (header: string): boolean =>
    includesAnyToken(header, ["civil", "smallclaims", "spproc", "lrc"]);
  const isCriminalHeader = (header: string): boolean =>
    header.includes("criminal");
  const isFiledHeader = (header: string): boolean => header.includes("filed");
  const isDisposedHeader = (header: string): boolean =>
    header.includes("disposed");

  const findByPhaseAndType = (
    phaseMatcher: (header: string) => boolean,
    typeMatcher: (header: string) => boolean,
  ): number =>
    normalizedHeaders.findIndex(
      (header) =>
        header.length > 0 && phaseMatcher(header) && typeMatcher(header),
    );

  const civilIndexes = normalizedHeaders
    .map((header, index) => (isCivilHeader(header) ? index : -1))
    .filter((index) => index >= 0);
  const criminalIndexes = normalizedHeaders
    .map((header, index) => (isCriminalHeader(header) ? index : -1))
    .filter((index) => index >= 0);

  const result: Partial<Record<InventoryMetricFieldName, number>> = {
    civilSmallClaimsFiled: findByPhaseAndType(isFiledHeader, isCivilHeader),
    criminalCasesFiled: findByPhaseAndType(isFiledHeader, isCriminalHeader),
    civilSmallClaimsDisposed: findByPhaseAndType(
      isDisposedHeader,
      isCivilHeader,
    ),
    criminalCasesDisposed: findByPhaseAndType(
      isDisposedHeader,
      isCriminalHeader,
    ),
  };

  if ((result.civilSmallClaimsFiled ?? -1) < 0 && civilIndexes.length > 0) {
    result.civilSmallClaimsFiled = civilIndexes[0];
  }
  if ((result.civilSmallClaimsDisposed ?? -1) < 0 && civilIndexes.length > 1) {
    result.civilSmallClaimsDisposed = civilIndexes[1];
  }
  if ((result.criminalCasesFiled ?? -1) < 0 && criminalIndexes.length > 0) {
    result.criminalCasesFiled = criminalIndexes[0];
  }
  if ((result.criminalCasesDisposed ?? -1) < 0 && criminalIndexes.length > 1) {
    result.criminalCasesDisposed = criminalIndexes[1];
  }

  return result;
};

const buildMergedAwareRow = (
  row: SheetCell[] | undefined,
  maxCols: number,
): string[] => {
  const mergedAware: string[] = [];
  let carry = "";

  for (let colIndex = 0; colIndex < maxCols; colIndex += 1) {
    const value = toCellText(row?.[colIndex]);
    if (value !== "") {
      carry = value;
      mergedAware.push(value);
    } else {
      mergedAware.push(carry);
    }
  }

  return mergedAware;
};

const buildCompositeHeaderRow = (
  rows: SheetCell[][],
  headerRowIndex: number,
): string[] => {
  const rowLengths = [
    rows[headerRowIndex]?.length ?? 0,
    rows[headerRowIndex - 1]?.length ?? 0,
    rows[headerRowIndex - 2]?.length ?? 0,
  ];
  const maxCols = Math.max(...rowLengths);

  const nonEmptyCounts = rows.map(
    (row) => row.filter((cell) => toCellText(cell) !== "").length,
  );

  const mergedAwareRows: Record<number, string[]> = {
    [headerRowIndex]: buildMergedAwareRow(rows[headerRowIndex], maxCols),
    [headerRowIndex - 1]: buildMergedAwareRow(
      rows[headerRowIndex - 1],
      maxCols,
    ),
    [headerRowIndex - 2]: buildMergedAwareRow(
      rows[headerRowIndex - 2],
      maxCols,
    ),
  };

  return Array.from({ length: maxCols }).map((_, colIndex) => {
    const parts: string[] = [];

    for (let offset = 2; offset >= 1; offset -= 1) {
      const rowIndex = headerRowIndex - offset;
      if (rowIndex < 0) continue;
      if (nonEmptyCounts[rowIndex] < 2) continue;
      const value = mergedAwareRows[rowIndex]?.[colIndex] ?? "";
      if (value) parts.push(value);
    }

    const headerValue = mergedAwareRows[headerRowIndex]?.[colIndex] ?? "";
    if (headerValue) parts.push(headerValue);

    return parts.join(" ").trim();
  });
};

const detectHeaderRowInfo = (
  worksheet: XLSX.WorkSheet,
  fields: FieldConfig[],
): HeaderRowInfo => {
  const rows = XLSX.utils.sheet_to_json<SheetCell[]>(worksheet, {
    header: 1,
    range: 0,
    blankrows: false,
  }) as SheetCell[][];

  const aliases = Array.from(
    new Set(fields.flatMap((field) => buildFieldAliases(field))),
  );
  const aliasSet = new Set(aliases);

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestNonEmpty = -1;

  for (let i = 0; i < Math.min(rows.length, 75); i += 1) {
    const composite = buildCompositeHeaderRow(rows, i)
      .map((cell) => normalizeImportHeader(cell))
      .filter((value) => value.length > 0);

    const currentRow = (rows[i] ?? [])
      .map((cell) => normalizeImportHeader(toCellText(cell)))
      .filter((value) => value.length > 0);

    const headers = composite.length > 0 ? composite : currentRow;

    if (headers.length === 0) continue;

    let score = 0;
    for (const header of headers) {
      if (aliasSet.has(header)) {
        score += 2;
        continue;
      }

      if (
        aliases.some(
          (alias) => alias.includes(header) || header.includes(alias),
        )
      ) {
        score += 1;
      }
    }

    if (
      score > bestScore ||
      (score === bestScore && headers.length > bestNonEmpty)
    ) {
      bestScore = score;
      bestIndex = i;
      bestNonEmpty = headers.length;
    }
  }

  const headerRowIndex = bestScore > 0 ? bestIndex : 0;
  const compositeHeaderRow = buildCompositeHeaderRow(rows, headerRowIndex);
  const fallbackHeaderRow = (rows[headerRowIndex] ?? []).map((cell) =>
    toCellText(cell),
  );
  const headerRow = compositeHeaderRow.some((value) => value !== "")
    ? compositeHeaderRow
    : fallbackHeaderRow;

  return {
    headerRowIndex,
    headerRow,
    matchScore: Number.isFinite(bestScore) ? bestScore : 0,
  };
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const viewButtons: { label: string; value: string; icon: React.ElementType }[] =
  [
    { label: "MTC", value: "MTC", icon: FiFileText },
    { label: "RTC", value: "RTC", icon: FiFileText },
    { label: "Inventory", value: "Inventory", icon: FiGrid },
  ];

const AnnualAddReportPage: React.FC<AnnualAddReportPageProps> = ({
  title,
  fields,
  columns,
  selectedYear,
  initialData,
  activeView,
  onSwitchView,
  allowedViews,
  customTabs,
  onBack,
  onSave,
}) => {
  const yearLabel = selectedYear ?? new Date().getFullYear().toString();
  const selectedReportYear = Number(yearLabel);
  const hasValidYear = Number.isInteger(selectedReportYear);
  const leafColumns = useMemo(() => flattenColumns(columns), [columns]);
  const hasGroups = columns.some(isGroupColumn);
  const fieldLabelByName = useMemo(() => {
    const labels = new Map<string, string>();
    for (const col of leafColumns) {
      labels.set(col.key, col.label);
    }
    return labels;
  }, [leafColumns]);
  const getFieldDisplayLabel = useCallback(
    (field: FieldConfig): string =>
      fieldLabelByName.get(field.name) ?? field.label,
    [fieldLabelByName],
  );
  const dateFilterField = useMemo(
    () => fields.find((f) => f.type === "date") ?? null,
    [fields],
  );

  /* ---- Editable field keys (only non-date fields users type into) ---- */
  const editableFields = useMemo(
    () => fields.filter((f) => f.type !== "date"),
    [fields],
  );

  /* ---- Compact mode when many columns ---- */
  const isCompact = editableFields.length > 6;

  /* ---- Determine if a field is numeric ---- */
  const isNumericField = useCallback(
    (fieldName: string) => {
      const f = fields.find((x) => x.name === fieldName);
      if (!f) return false;
      return (
        f.placeholder === "0" ||
        f.placeholder?.match(/^\d/) != null ||
        fieldName.toLowerCase().includes("pending") ||
        fieldName.toLowerCase().includes("disposed") ||
        fieldName.toLowerCase().includes("raffled") ||
        fieldName.toLowerCase().includes("filed") ||
        fieldName.toLowerCase().includes("percentage") ||
        fieldName.toLowerCase().includes("criminal") ||
        fieldName.toLowerCase().includes("civil")
      );
    },
    [fields],
  );

  /* ---- Tabbed field groups for compact / inventory mode ---- */
  const computedFieldTabs = useMemo(() => {
    if (!isCompact) return null;

    const textFields = editableFields.filter((f) => !isNumericField(f.name));
    const numericFields = editableFields.filter((f) => isNumericField(f.name));
    const filedFields = editableFields.filter((f) =>
      f.name.toLowerCase().includes("filed"),
    );
    const disposedFields = editableFields.filter((f) =>
      f.name.toLowerCase().includes("disposed"),
    );

    // Preserve the default annual workflow split.
    if (filedFields.length > 0 && disposedFields.length > 0) {
      const remainingNumeric = numericFields.filter(
        (f) =>
          !f.name.toLowerCase().includes("filed") &&
          !f.name.toLowerCase().includes("disposed"),
      );

      const tabs = [
        { label: "Location", fields: textFields },
        { label: "Cases Filed", fields: filedFields },
        { label: "Cases Disposed", fields: disposedFields },
      ];

      if (remainingNumeric.length > 0) {
        tabs.push({ label: "Other Metrics", fields: remainingNumeric });
      }

      return tabs.filter((tab) => tab.fields.length > 0);
    }

    const hasKeyword = (name: string, keywords: string[]) =>
      keywords.some((keyword) => name.includes(keyword));

    const isCaseMetricName = (name: string) =>
      hasKeyword(name, [
        "civil",
        "criminal",
        "heard",
        "case",
        "summary",
        "pending",
        "raffled",
        "filed",
        "disposed",
      ]);

    const isPdlReleaseFlowName = (name: string) =>
      name.startsWith("pdl") &&
      (hasKeyword(name, ["bail", "recognizance", "minror", "fine", "others"]) ||
        name === "pdlv" ||
        name === "pdli" ||
        name === "pdlinc");

    const isPdlReleaseOutcomeName = (name: string) =>
      name.startsWith("pdl") &&
      hasKeyword(name, ["sentence", "dismissal", "acquittal", "probation"]);

    const isPdlReleaseName = (name: string) =>
      isPdlReleaseFlowName(name) || isPdlReleaseOutcomeName(name);

    const isCiclMetricName = (name: string) =>
      name.includes("cicl") && !name.startsWith("pdl");

    const used = new Set<string>();
    const pick = (predicate: (name: string) => boolean) => {
      return numericFields.filter((f) => {
        const normalized = f.name.toLowerCase();
        if (used.has(f.name)) return false;
        if (!predicate(normalized)) return false;
        used.add(f.name);
        return true;
      });
    };

    const caseMetrics = pick(isCaseMetricName);
    const pdlSnapshot = pick(
      (name) =>
        name.startsWith("pdl") &&
        !isPdlReleaseName(name) &&
        !name.includes("total"),
    );
    const pdlReleaseFlow = pick(isPdlReleaseFlowName);
    const pdlReleaseOutcomes = pick(isPdlReleaseOutcomeName);
    const ciclMetrics = pick(isCiclMetricName);
    const totalsAndRates = pick(
      (name) => name.includes("total") || name.includes("percentage"),
    );
    const remainingNumeric = numericFields.filter((f) => !used.has(f.name));

    const compactTabs = [
      { label: "Details", fields: textFields },
      { label: "Case Metrics", fields: caseMetrics },
      { label: "PDL Snapshot", fields: pdlSnapshot },
      { label: "PDL Release Flow", fields: pdlReleaseFlow },
      { label: "PDL Release Outcomes", fields: pdlReleaseOutcomes },
      { label: "CICL Metrics", fields: ciclMetrics },
      { label: "Totals & Rates", fields: totalsAndRates },
      { label: "Other Numeric", fields: remainingNumeric },
    ].filter((tab) => tab.fields.length > 0);

    // Fallback to the original two-tab experience if grouping is too sparse.
    if (compactTabs.length <= 2) {
      return [
        { label: "Details", fields: textFields },
        { label: "Numeric Data", fields: numericFields },
      ].filter((tab) => tab.fields.length > 0);
    }

    return compactTabs;
  }, [isCompact, editableFields, isNumericField]);

  // If the caller supplies `customTabs`, prefer that over the computed grouping.
  // We pick it from props by reading the incoming props object above.
  // Note: keep the runtime check simple — if `customTabs` is set, use it.
  const fieldTabs = (customTabs ?? computedFieldTabs) as
    | { label: string; fields: FieldConfig[] }[]
    | null;

  const [activeFieldTab, setActiveFieldTab] = useState(0);

  useEffect(() => {
    if (!fieldTabs) {
      if (activeFieldTab !== 0) setActiveFieldTab(0);
      return;
    }
    if (activeFieldTab >= fieldTabs.length) {
      setActiveFieldTab(0);
    }
  }, [fieldTabs, activeFieldTab]);

  const visibleFields = useMemo(() => {
    if (!fieldTabs) return editableFields;
    return fieldTabs[activeFieldTab]?.fields ?? editableFields;
  }, [fieldTabs, activeFieldTab, editableFields]);

  /* ---- Column keys for keyboard nav (only visible fields) ---- */
  const COLS = useMemo(() => visibleFields.map((f) => f.name), [visibleFields]);

  /* ---- State ---- */
  const [rows, setRows] = useState<EditableRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map((r) => {
        const row: EditableRow = { _rowId: createRowId() };
        for (const f of fields) {
          const val = r[f.name];
          if (f.type === "date" && val) {
            row[f.name] = String(val).slice(0, 10);
          } else if (isPercentageFieldName(f.name) && val != null) {
            const normalizedPercentage = toPercentNumber(
              typeof val === "number" ? val : String(val),
            );
            row[f.name] =
              normalizedPercentage ??
              (typeof val === "number" ? val : String(val));
          } else {
            row[f.name] =
              val != null ? (typeof val === "number" ? val : String(val)) : "";
          }
        }
        return row;
      });
    }
    return [buildEmptyRow(fields)];
  });

  const [activeCell, setActiveCell] = useState<{
    rowIdx: number;
    col: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>(() =>
    /^\d{4}$/.test(yearLabel) ? yearLabel : "",
  );
  const [step, setStep] = useState<"edit" | "review">("edit");
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const effectiveYearFilter = useMemo(
    () => (/^\d{4}$/.test(dateFilter) ? dateFilter : ""),
    [dateFilter],
  );

  const handleYearFilterChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 4);
    setDateFilter(sanitized);
  }, []);

  const indexedRows = useMemo(
    () => rows.map((row, sourceIndex) => ({ row, sourceIndex })),
    [rows],
  );

  const yearFilterOptions = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);

    if (/^\d{4}$/.test(yearLabel)) {
      years.add(yearLabel);
    }

    if (dateFilterField) {
      for (const row of rows) {
        const rowYear = normalizeYearOnly(row[dateFilterField.name]);
        if (rowYear) {
          years.add(rowYear);
        }
      }
    }

    if (/^\d{4}$/.test(dateFilter)) {
      years.add(dateFilter);
    }

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [rows, dateFilterField, yearLabel, dateFilter]);

  const displayedRows = useMemo(() => {
    if (!dateFilterField || effectiveYearFilter === "") return indexedRows;
    return indexedRows.filter(
      ({ row }) =>
        normalizeYearOnly(row[dateFilterField.name]) === effectiveYearFilter,
    );
  }, [indexedRows, dateFilterField, effectiveYearFilter]);

  const displayedRowIds = useMemo(
    () => displayedRows.map(({ row }) => row._rowId),
    [displayedRows],
  );

  const visibleSourceIndexes = useMemo(
    () => displayedRows.map(({ sourceIndex }) => sourceIndex),
    [displayedRows],
  );
  const isDateFilterActive = Boolean(
    dateFilterField && effectiveYearFilter !== "",
  );
  const selectedVisibleCount = useMemo(
    () =>
      displayedRowIds.reduce(
        (count, rowId) => (selectedRows.has(rowId) ? count + 1 : count),
        0,
      ),
    [displayedRowIds, selectedRows],
  );

  useEffect(() => {
    if (!importFeedback) return;
    const t = setTimeout(() => setImportFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [importFeedback]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const bestSheet = wb.SheetNames.map((sheetName) => {
        const worksheet = wb.Sheets[sheetName];
        return {
          sheetName,
          worksheet,
          headerInfo: detectHeaderRowInfo(worksheet, fields),
        };
      }).sort(
        (left, right) =>
          right.headerInfo.matchScore - left.headerInfo.matchScore,
      )[0];

      if (!bestSheet) {
        setImportFeedback("No worksheet found in this Excel file.");
        return;
      }

      const { worksheet, headerInfo } = bestSheet;
      const isJudgementLayout =
        editableFields.some((field) => field.name === "branchNo") &&
        editableFields.some((field) => field.name === "civilV") &&
        editableFields.some((field) => field.name === "totalHeard");
      const isJudgementRtcLayout =
        editableFields.some((field) => field.name === "branchNo") &&
        editableFields.some((field) => field.name === "casesDisposed") &&
        editableFields.some((field) => field.name === "pdlProbation");
      const isJudgementStrictMode = isJudgementLayout;

      const rawRows = XLSX.utils.sheet_to_json<SheetCell[]>(worksheet, {
        header: 1,
        range: isJudgementLayout ? 0 : headerInfo.headerRowIndex + 1,
        blankrows: false,
      });

      const normalizedHeaderRow = headerInfo.headerRow.map((header) =>
        normalizeImportHeader(header),
      );

      const pendingYearColumns = headerInfo.headerRow
        .map((header, index) => {
          const normalized = normalizeImportHeader(header);
          if (!normalized.includes("pending")) return null;

          const yearFromRaw = extractYearFromHeader(header);
          const yearFromNormalized = extractYearFromHeader(normalized);
          const year = yearFromRaw ?? yearFromNormalized;

          if (!year) return null;
          return { index, year };
        })
        .filter(
          (item): item is { index: number; year: number } => item != null,
        );

      const inferredReportYear = hasValidYear
        ? selectedReportYear
        : pendingYearColumns.length > 0
          ? Math.max(...pendingYearColumns.map((item) => item.year))
          : new Date().getFullYear();

      const getPendingColumnIndex = (year: number): number =>
        pendingYearColumns.find((item) => item.year === year)?.index ?? -1;

      const resolveColumnIndex = (
        fieldName: string,
        aliases: string[],
      ): number => {
        // For Judgement imports, only allow exact normalized header matches.
        // This prevents values from being pulled from similarly named columns.
        const exactMatchIndexes: number[] = [];
        for (let index = 0; index < normalizedHeaderRow.length; index += 1) {
          const header = normalizedHeaderRow[index];
          if (!header) continue;
          if (aliases.includes(header)) {
            exactMatchIndexes.push(index);
          }
        }

        if (exactMatchIndexes.length > 0 && isJudgementStrictMode) {
          // RTC templates can contain duplicate labels for PDL and CICL sub-sections.
          // Keep mapping exact by choosing first-match for PDL fields and last-match
          // for CICL/fine/total fields that live in the trailing section.
          const preferLastFields = new Set([
            "ciclM",
            "ciclF",
            "ciclV",
            "ciclInC",
            "fine",
            "total",
          ]);
          return preferLastFields.has(fieldName)
            ? exactMatchIndexes[exactMatchIndexes.length - 1]
            : exactMatchIndexes[0];
        }

        if (exactMatchIndexes.length > 0) {
          return exactMatchIndexes[0];
        }

        if (isJudgementStrictMode) {
          return -1;
        }

        let bestIndex = -1;
        let bestScore = 0;

        normalizedHeaderRow.forEach((header, index) => {
          if (!header) return;

          let score = 0;
          if (aliases.includes(header)) {
            score = 3;
          } else if (
            aliases.some(
              (alias) => header.includes(alias) || alias.includes(header),
            )
          ) {
            score = 1;
          }

          if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });

        return bestIndex;
      };

      const fieldColumnIndex = new Map<string, number>();
      editableFields.forEach((field) => {
        let colIndex = -1;

        if (field.name === "pendingLastYear") {
          colIndex = getPendingColumnIndex(inferredReportYear - 1);
        } else if (field.name === "pendingThisYear") {
          colIndex = getPendingColumnIndex(inferredReportYear);
        }

        if (colIndex < 0) {
          colIndex = resolveColumnIndex(field.name, buildFieldAliases(field));
        }

        if (colIndex >= 0) {
          fieldColumnIndex.set(field.name, colIndex);
        }
      });

      if (isJudgementRtcLayout && !isJudgementStrictMode) {
        const findHeaderIndex = (
          predicate: (header: string) => boolean,
          fromEnd: boolean = false,
        ): number => {
          if (fromEnd) {
            for (
              let index = normalizedHeaderRow.length - 1;
              index >= 0;
              index -= 1
            ) {
              const header = normalizedHeaderRow[index];
              if (header && predicate(header)) return index;
            }
            return -1;
          }

          return normalizedHeaderRow.findIndex(
            (header) => header.length > 0 && predicate(header),
          );
        };

        const setFallbackFieldIndex = (
          fieldName: string,
          predicate: (header: string) => boolean,
          fromEnd: boolean = false,
        ) => {
          if (fieldColumnIndex.has(fieldName)) return;
          const index = findHeaderIndex(predicate, fromEnd);
          if (index >= 0) {
            fieldColumnIndex.set(fieldName, index);
          }
        };

        const setPreferredFieldIndex = (
          fieldName: string,
          predicate: (header: string) => boolean,
          fromEnd: boolean = false,
        ) => {
          const index = findHeaderIndex(predicate, fromEnd);
          if (index >= 0) {
            fieldColumnIndex.set(fieldName, index);
          }
        };

        const heardCivilIndexes = normalizedHeaderRow
          .map((header, index) =>
            header.includes("civil") &&
            (header.includes("heard") || header.includes("tried")) &&
            !header.includes("disposed")
              ? index
              : -1,
          )
          .filter((index) => index >= 0);

        const heardCriminalIndexes = normalizedHeaderRow
          .map((header, index) =>
            (header.includes("criminal") || header.includes("crim")) &&
            (header.includes("heard") || header.includes("tried")) &&
            !header.includes("disposed")
              ? index
              : -1,
          )
          .filter((index) => index >= 0);

        if (!fieldColumnIndex.has("civilV") && heardCivilIndexes.length > 0) {
          fieldColumnIndex.set("civilV", heardCivilIndexes[0]);
        }
        if (!fieldColumnIndex.has("civilInC") && heardCivilIndexes.length > 1) {
          fieldColumnIndex.set("civilInC", heardCivilIndexes[1]);
        }
        if (
          !fieldColumnIndex.has("criminalV") &&
          heardCriminalIndexes.length > 0
        ) {
          fieldColumnIndex.set("criminalV", heardCriminalIndexes[0]);
        }
        if (
          !fieldColumnIndex.has("criminalInC") &&
          heardCriminalIndexes.length > 1
        ) {
          fieldColumnIndex.set("criminalInC", heardCriminalIndexes[1]);
        }

        setFallbackFieldIndex(
          "branchNo",
          (header) =>
            header.includes("branch") &&
            (header.includes("no") || header === "branches" || header === "no"),
        );
        setFallbackFieldIndex(
          "totalHeard",
          (header) => header.includes("heard") && header.includes("total"),
        );
        setFallbackFieldIndex(
          "disposedCivil",
          (header) =>
            header.includes("civil") &&
            header.includes("disposed") &&
            !header.includes("total"),
        );
        setFallbackFieldIndex(
          "disposedCrim",
          (header) =>
            (header.includes("criminal") || header.includes("crim")) &&
            header.includes("disposed") &&
            !header.includes("total"),
        );
        setFallbackFieldIndex(
          "summaryProc",
          (header) =>
            header.includes("summaryproc") ||
            header.includes("casesproc") ||
            (header.includes("summary") && header.includes("disposed")),
        );
        setFallbackFieldIndex(
          "casesDisposed",
          (header) =>
            header.includes("casesdisposed") ||
            (header.includes("disposed") && header.includes("total")),
        );

        setFallbackFieldIndex(
          "pdlM",
          (header) =>
            (header.includes("pdlcicl") && header.endsWith("m")) ||
            header.endsWith("pdlm"),
        );
        setFallbackFieldIndex(
          "pdlF",
          (header) =>
            (header.includes("pdlcicl") && header.endsWith("f")) ||
            header.endsWith("pdlf"),
        );
        setFallbackFieldIndex(
          "pdlCICL",
          (header) =>
            header.includes("pdlciclcicl") ||
            (header.includes("pdlcicl") && header.endsWith("cicl")),
        );
        setFallbackFieldIndex(
          "pdlTotal",
          (header) =>
            (header.includes("pdlcicl") && header.includes("total")) ||
            (header.includes("detaineesorderedreleased") &&
              header.includes("total")),
        );

        setFallbackFieldIndex(
          "pdlV",
          (header) =>
            header.includes("pdlreleasedv") ||
            (header.includes("pdlreleased") && header.endsWith("v")),
        );
        setFallbackFieldIndex(
          "pdlInC",
          (header) =>
            header.includes("pdlreleasedinc") ||
            header.includes("pdlreleasedl") ||
            header.includes("pdlinc"),
        );
        setFallbackFieldIndex("pdlBail", (header) => header.includes("bail"));
        setFallbackFieldIndex(
          "pdlRecognizance",
          (header) =>
            header.includes("recognizance") ||
            header.includes("bailrecognizance"),
        );
        setFallbackFieldIndex("pdlMinRor", (header) =>
          header.includes("minror"),
        );
        setFallbackFieldIndex(
          "pdlMaxSentence",
          (header) =>
            header.includes("maxsentence") ||
            header.includes("convicted") ||
            header.includes("transferredtoboc"),
        );
        setFallbackFieldIndex(
          "pdlDismissal",
          (header) =>
            header.includes("dismissal") ||
            header.includes("casesdismissed") ||
            header.endsWith("dismissed"),
        );
        setFallbackFieldIndex(
          "pdlAcquittal",
          (header) =>
            header.includes("acquittal") || header.includes("acquitted"),
        );
        setFallbackFieldIndex("pdlMinSentence", (header) =>
          header.includes("minsentence"),
        );
        setFallbackFieldIndex(
          "pdlProbation",
          (header) => header.includes("probation") || header.includes("others"),
        );

        setFallbackFieldIndex(
          "ciclM",
          (header) => header.includes("ciclm") && !header.includes("pdlcicl"),
        );
        setFallbackFieldIndex(
          "ciclF",
          (header) => header.includes("ciclf") && !header.includes("pdlcicl"),
        );
        setFallbackFieldIndex(
          "ciclV",
          (header) => header.includes("ciclv") && !header.includes("pdlcicl"),
        );
        setFallbackFieldIndex(
          "ciclInC",
          (header) =>
            (header.includes("ciclinc") || header.includes("cicll")) &&
            !header.includes("pdlcicl"),
        );
        setFallbackFieldIndex(
          "fine",
          (header) =>
            header.includes("fine") || header.includes("fullserviceofsentence"),
        );

        setFallbackFieldIndex(
          "total",
          (header) =>
            header === "total" ||
            (header.includes("grand") && header.includes("total")),
          true,
        );

        // Override ambiguous initial alias hits with deterministic choices.
        setPreferredFieldIndex(
          "totalHeard",
          (header) =>
            header.includes("totalcasesheard") ||
            (header.includes("heard") && header.includes("total")),
        );
        setPreferredFieldIndex(
          "casesDisposed",
          (header) =>
            header.includes("casesdisposed") ||
            header.includes("totalcasesdisposed") ||
            (header.includes("disposed") && header.includes("total")),
        );
        setPreferredFieldIndex(
          "pdlTotal",
          (header) =>
            (header.includes("pdlcicl") && header.includes("total")) ||
            (header.includes("detaineesorderedreleased") &&
              header.includes("total")),
        );
        setPreferredFieldIndex(
          "fine",
          (header) =>
            header.includes("fullserviceofsentence") || header.includes("fine"),
        );
        setPreferredFieldIndex(
          "pdlMaxSentence",
          (header) =>
            header.includes("maxsentence") ||
            header.includes("convicted") ||
            header.includes("transferredtoboc"),
        );
        setPreferredFieldIndex(
          "total",
          (header) =>
            header === "total" ||
            (header.includes("grand") && header.includes("total")),
          true,
        );

        const pdlBailIndex = fieldColumnIndex.get("pdlBail");
        const pdlRecognizanceIndex = fieldColumnIndex.get("pdlRecognizance");
        if (
          pdlBailIndex !== undefined &&
          pdlRecognizanceIndex !== undefined &&
          pdlBailIndex === pdlRecognizanceIndex
        ) {
          const sharedHeader = normalizedHeaderRow[pdlBailIndex] ?? "";
          if (sharedHeader.includes("bailrecognizance")) {
            fieldColumnIndex.delete("pdlBail");
          }
        }

        const pdlMaxSentenceIndex = fieldColumnIndex.get("pdlMaxSentence");
        const fineIndex = fieldColumnIndex.get("fine");
        if (
          pdlMaxSentenceIndex !== undefined &&
          fineIndex !== undefined &&
          pdlMaxSentenceIndex === fineIndex
        ) {
          const sharedHeader = normalizedHeaderRow[fineIndex] ?? "";
          if (
            sharedHeader.includes("fullserviceofsentence") ||
            sharedHeader.includes("fine")
          ) {
            fieldColumnIndex.delete("pdlMaxSentence");
          }
        }

        const totalIndex = fieldColumnIndex.get("total");
        const pdlTotalIndex = fieldColumnIndex.get("pdlTotal");
        if (
          totalIndex !== undefined &&
          pdlTotalIndex !== undefined &&
          totalIndex === pdlTotalIndex
        ) {
          fieldColumnIndex.delete("pdlTotal");
        }
      }

      const inventoryMetricFieldNames: InventoryMetricFieldName[] = [
        "civilSmallClaimsFiled",
        "criminalCasesFiled",
        "civilSmallClaimsDisposed",
        "criminalCasesDisposed",
      ];
      const hasInventoryMetricFields = inventoryMetricFieldNames.some((name) =>
        editableFields.some((field) => field.name === name),
      );

      if (hasInventoryMetricFields) {
        const inventoryMetricIndexes =
          getInventoryMetricColumnIndexes(normalizedHeaderRow);

        for (const fieldName of inventoryMetricFieldNames) {
          const index = inventoryMetricIndexes[fieldName];
          if (index !== undefined && index >= 0) {
            fieldColumnIndex.set(fieldName, index);
          }
        }
      }

      const imported: EditableRow[] = [];
      let skippedCount = 0;
      let skipRemainingRowsAsFooter = false;
      const requiresBranchIdentifier = editableFields.some(
        (field) => normalizeImportHeader(field.name) === "branchno",
      );

      for (const excelRow of rawRows) {
        const normalizedRowValues = excelRow
          .map((cell) => normalizeImportHeader(toCellText(cell)))
          .filter((value) => value.length > 0);

        if (skipRemainingRowsAsFooter) {
          skippedCount += 1;
          continue;
        }

        if (
          normalizedRowValues.some((value) =>
            IMPORT_FOOTER_SECTION_MARKERS.has(value),
          )
        ) {
          skipRemainingRowsAsFooter = true;
          skippedCount += 1;
          continue;
        }

        const row = buildEmptyRow(fields);
        if (dateFilterField && effectiveYearFilter !== "") {
          row[dateFilterField.name] = `${effectiveYearFilter}-01-01`;
        }
        let matchedFieldCount = 0;
        let hasTextContent = false;
        let hasNumericNonZero = false;
        let identifierValue = "";

        for (const f of editableFields) {
          const colIndex = fieldColumnIndex.get(f.name);
          if (colIndex === undefined) continue;

          matchedFieldCount += 1;
          const rawValue = excelRow[colIndex];
          const textValue = toCellText(rawValue);

          if (isNumericField(f.name)) {
            if (textValue === "") {
              row[f.name] = "";
              continue;
            }

            if (isPercentageFieldName(f.name)) {
              const percentage = toPercentNumber(textValue);
              row[f.name] = percentage ?? textValue;
              if (percentage !== undefined) {
                if (percentage !== 0) {
                  hasNumericNonZero = true;
                }
              } else if (textValue !== "") {
                hasNumericNonZero = true;
              }
              continue;
            }

            const parsed = Number(textValue.replace(/,/g, ""));
            row[f.name] = Number.isFinite(parsed) ? parsed : textValue;
            if (Number.isFinite(parsed)) {
              if (parsed !== 0) {
                hasNumericNonZero = true;
              }
            } else if (textValue !== "") {
              hasNumericNonZero = true;
            }
          } else {
            row[f.name] = textValue;
            if (textValue !== "") {
              hasTextContent = true;

              const normalizedFieldName = normalizeImportHeader(f.name);
              if (
                normalizedFieldName === "branch" ||
                normalizedFieldName === "branchno"
              ) {
                identifierValue = normalizeImportHeader(textValue);
              }
            }
          }
        }

        if (requiresBranchIdentifier && identifierValue === "") {
          skippedCount += 1;
          continue;
        }

        if (
          matchedFieldCount > 0 &&
          !shouldIgnoreAnnualImportRow({
            normalizedRowValues,
            identifierValue,
            hasTextContent,
            hasNumericNonZero,
          })
        ) {
          imported.push(row);
        } else {
          skippedCount += 1;
        }
      }

      if (imported.length > 0) {
        setRows((prev) => {
          const hasData = prev.some((r) =>
            editableFields.some((f) => {
              const v = r[f.name];
              return v != null && v !== "" && v !== 0;
            }),
          );
          return hasData ? [...prev, ...imported] : imported;
        });

        setStep("edit");
        setImportFeedback(
          `✓ ${imported.length} row${imported.length !== 1 ? "s" : ""} imported from Excel${
            skippedCount > 0
              ? ` (${skippedCount} row${skippedCount !== 1 ? "s" : ""} skipped)`
              : ""
          }`,
        );
      } else {
        setImportFeedback(
          "No matching data found. Check the Excel headers and ensure rows contain values.",
        );
      }
    } catch (err) {
      console.error("Import failed:", err);
      setImportFeedback(
        "Import failed. Check that the file is a valid Excel file.",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Row helpers                                                      */
  /* ---------------------------------------------------------------- */

  const addRows = useCallback(
    (count: number = 1) => {
      setRows((prev) => [
        ...prev,
        ...Array.from({ length: count }, () => {
          const nextRow = buildEmptyRow(fields);
          if (dateFilterField && effectiveYearFilter !== "") {
            nextRow[dateFilterField.name] = `${effectiveYearFilter}-01-01`;
          }
          return nextRow;
        }),
      ]);
    },
    [fields, dateFilterField, effectiveYearFilter],
  );

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setRows((prev) => prev.filter((r) => !selectedRows.has(r._rowId)));
    setSelectedRows(new Set());
  };

  const duplicateSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const dupes = rows
      .filter((r) => selectedRows.has(r._rowId))
      .map((r) => ({ ...r, _rowId: createRowId() }));
    setRows((prev) => [...prev, ...dupes]);
    setSelectedRows(new Set());
  };

  const clearAll = () => {
    setRows([]);
    setActiveCell(null);
    setSelectedRows(new Set());
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (displayedRowIds.length === 0) return;

    setSelectedRows((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = displayedRowIds.every((rowId) =>
        next.has(rowId),
      );

      if (allVisibleSelected) {
        displayedRowIds.forEach((rowId) => next.delete(rowId));
      } else {
        displayedRowIds.forEach((rowId) => next.add(rowId));
      }

      return next;
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Cell update                                                      */
  /* ---------------------------------------------------------------- */

  const updateCell = useCallback(
    (rowId: string, field: string, value: string | number) => {
      setRows((prev) =>
        prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /*  Keyboard navigation                                              */
  /* ---------------------------------------------------------------- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, col: string) => {
      const colIdx = COLS.indexOf(col);
      if (colIdx === -1) return;

      let nextRow = rowIdx;
      let nextCol = colIdx;
      let rowStep = 0;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            nextCol--;
            if (nextCol < 0) {
              nextCol = COLS.length - 1;
              nextRow--;
              rowStep = -1;
            }
          } else {
            nextCol++;
            if (nextCol >= COLS.length) {
              nextCol = 0;
              nextRow++;
              rowStep = 1;
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          nextRow++;
          rowStep = 1;
          break;
        case "ArrowDown":
          e.preventDefault();
          nextRow++;
          rowStep = 1;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextRow--;
          rowStep = -1;
          break;
        default:
          return;
      }

      if (isDateFilterActive && rowStep !== 0) {
        const currentVisibleIndex = visibleSourceIndexes.indexOf(rowIdx);
        if (currentVisibleIndex !== -1 && visibleSourceIndexes.length > 0) {
          const targetVisibleIndex = Math.max(
            0,
            Math.min(
              visibleSourceIndexes.length - 1,
              currentVisibleIndex + rowStep,
            ),
          );
          nextRow = visibleSourceIndexes[targetVisibleIndex];
        }
      } else {
        if (nextRow < 0) nextRow = 0;
        if (nextRow >= rows.length) {
          addRows(1);
          nextRow = rows.length;
        }
      }

      if (nextCol < 0) nextCol = 0;
      if (nextCol >= COLS.length) nextCol = COLS.length - 1;

      setActiveCell({ rowIdx: nextRow, col: COLS[nextCol] });
    },
    [rows.length, COLS, addRows, isDateFilterActive, visibleSourceIndexes],
  );

  /* ---------------------------------------------------------------- */
  /*  Paste from Excel                                                 */
  /* ---------------------------------------------------------------- */

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return;

      e.preventDefault();
      let skipRemainingPastedRowsAsFooter = false;

      const pastedRows = text
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => {
          const cells = line.split("\t");
          const normalizedRowValues = cells
            .map((cell) => normalizeImportHeader(cell ?? ""))
            .filter((value) => value.length > 0);

          if (skipRemainingPastedRowsAsFooter) {
            return null;
          }

          if (
            normalizedRowValues.some((value) =>
              IMPORT_FOOTER_SECTION_MARKERS.has(value),
            )
          ) {
            skipRemainingPastedRowsAsFooter = true;
            return null;
          }

          const row = buildEmptyRow(fields);
          if (dateFilterField && effectiveYearFilter !== "") {
            row[dateFilterField.name] = `${effectiveYearFilter}-01-01`;
          }
          let hasTextContent = false;
          let hasNumericNonZero = false;
          let identifierValue = "";

          editableFields.forEach((f, i) => {
            if (i < cells.length) {
              const v = cells[i].trim();
              if (isNumericField(f.name)) {
                if (isPercentageFieldName(f.name)) {
                  const percentage = toPercentNumber(v);
                  row[f.name] = percentage ?? v;
                  if (percentage !== undefined) {
                    if (percentage !== 0) {
                      hasNumericNonZero = true;
                    }
                  } else if (v !== "") {
                    hasNumericNonZero = true;
                  }
                } else {
                  const numVal = Number(v);
                  row[f.name] = !Number.isNaN(numVal) && v !== "" ? numVal : v;
                  if (!Number.isNaN(numVal) && v !== "") {
                    if (numVal !== 0) {
                      hasNumericNonZero = true;
                    }
                  } else if (v !== "") {
                    hasNumericNonZero = true;
                  }
                }
              } else {
                row[f.name] = v;
                if (v !== "") {
                  hasTextContent = true;

                  const normalizedFieldName = normalizeImportHeader(f.name);
                  if (
                    normalizedFieldName === "branch" ||
                    normalizedFieldName === "branchno"
                  ) {
                    identifierValue = normalizeImportHeader(v);
                  }
                }
              }
            }
          });

          if (
            shouldIgnoreAnnualImportRow({
              normalizedRowValues,
              identifierValue,
              hasTextContent,
              hasNumericNonZero,
            })
          ) {
            return null;
          }

          return row;
        })
        .filter((row): row is EditableRow => row !== null);

      if (pastedRows.length > 0) {
        setRows((prev) => {
          const hasData = prev.some((r) =>
            editableFields.some((f) => {
              const v = r[f.name];
              return v != null && v !== "" && v !== 0;
            }),
          );
          return hasData ? [...prev, ...pastedRows] : pastedRows;
        });
      }
    },
    [
      fields,
      editableFields,
      isNumericField,
      dateFilterField,
      effectiveYearFilter,
    ],
  );

  /* ---------------------------------------------------------------- */
  /*  Validation & Save                                                */
  /* ---------------------------------------------------------------- */

  const requiredFields = useMemo(
    () => fields.filter((f) => f.required),
    [fields],
  );

  const isRowValid = useCallback(
    (row: EditableRow) => {
      return requiredFields.every((f) => {
        const v = row[f.name];
        return v != null && String(v).trim() !== "";
      });
    },
    [requiredFields],
  );

  const validCount = useMemo(
    () => rows.filter(isRowValid).length,
    [rows, isRowValid],
  );

  const displayedValidRows = useMemo(
    () =>
      displayedRows.filter(({ row }) => isRowValid(row)).map(({ row }) => row),
    [displayedRows, isRowValid],
  );

  const displayedValidCount = displayedValidRows.length;

  const handleSave = () => {
    const sourceRows = displayedRows.map(({ row }) => row);

    if (sourceRows.length === 0) {
      setImportFeedback(
        isDateFilterActive
          ? "No rows match the selected year filter."
          : "No rows to save.",
      );
      return;
    }

    const inventoryLocationFields = [
      "region",
      "province",
      "court",
      "cityMunicipality",
      "branch",
    ];
    const isInventoryForm = inventoryLocationFields.every((name) =>
      fields.some((field) => field.name === name),
    );

    const rowsForSave = isInventoryForm
      ? (() => {
          const carryForwardValues = new Map<string, string>();
          return sourceRows.map((sourceRow) => {
            const nextRow: EditableRow = { ...sourceRow };

            for (const fieldName of inventoryLocationFields) {
              const value = String(nextRow[fieldName] ?? "").trim();
              if (value !== "") {
                carryForwardValues.set(fieldName, value);
                continue;
              }

              const previousValue = carryForwardValues.get(fieldName);
              if (previousValue !== undefined) {
                nextRow[fieldName] = previousValue;
              }
            }

            const branchValue = String(nextRow.branch ?? "").trim();
            if (branchValue === "") {
              const cityMunicipalityValue = String(
                nextRow.cityMunicipality ?? "",
              ).trim();
              if (cityMunicipalityValue !== "") {
                nextRow.branch = cityMunicipalityValue;
              }
            }

            return nextRow;
          });
        })()
      : sourceRows;

    const validRowsForSave = rowsForSave.filter(isRowValid);

    if (validRowsForSave.length === 0) {
      setImportFeedback("No valid rows to save. Fill required fields first.");
      return;
    }

    const mapped = validRowsForSave.map((r) => {
      const record: Record<string, unknown> = {};
      for (const f of fields) {
        const value = r[f.name];
        if (
          isPercentageFieldName(f.name) &&
          (typeof value === "number" || typeof value === "string")
        ) {
          record[f.name] = toPercentNumber(value) ?? value;
        } else {
          record[f.name] = value;
        }
      }
      return record;
    });

    if (validRowsForSave.length < rowsForSave.length) {
      setImportFeedback(
        `Saving ${validRowsForSave.length} row${validRowsForSave.length !== 1 ? "s" : ""}. ${rowsForSave.length - validRowsForSave.length} row${rowsForSave.length - validRowsForSave.length !== 1 ? "s" : ""} skipped due missing required fields.`,
      );
    }

    onSave(mapped);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="xls-root">
      {/* ══ TOPBAR ══ */}
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button
            className="xls-back-btn"
            onClick={step === "review" ? () => setStep("edit") : onBack}
            title={
              step === "review" ? "Back to Edit" : "Back to Annual Reports"
            }
          >
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>Annual Reports</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span>{title}</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {step === "edit" ? "Add Report" : "Review"}
            </span>
          </nav>
        </div>
        <div className="xls-topbar-right">
          <div className="xls-stepper">
            <div className={`xls-step ${step === "edit" ? "active" : "done"}`}>
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
      {step === "edit" ? (
        <div className="xls-main">
          {/* ── Title row ── */}
          <div className="xls-title-row">
            <div>
              <h1 className="text-5xl xls-title">Add {title} Report</h1>
              <p className="text-lg mb-9 xls-subtitle">
                Entering data for{" "}
                <strong style={{ color: "var(--color-primary)" }}>
                  {yearLabel}
                </strong>
                . Use tabs to navigate or paste from Excel.{" "}
                <kbd className="xls-kbd">Tab</kbd> /{" "}
                <kbd className="xls-kbd">Enter</kbd> to move between cells.
              </p>
              {hasValidYear && (
                <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
                  For this report: <strong>Pending Last Year</strong> refers to{" "}
                  {selectedReportYear - 1}, and{" "}
                  <strong>Pending Year Now</strong> refers to{" "}
                  {selectedReportYear}.
                </p>
              )}
              <div className="xls-pills" style={{ marginTop: 10 }}>
                <span className="xls-pill xls-pill-neutral">
                  <span className="xls-pill-dot" />
                  {rows.length} {rows.length === 1 ? "row" : "rows"}
                </span>
                {isDateFilterActive && (
                  <span className="xls-pill xls-pill-neutral">
                    <span className="xls-pill-dot" />
                    {displayedRows.length} shown
                  </span>
                )}
                <span
                  className={`xls-pill ${validCount > 0 ? "xls-pill-ok" : "xls-pill-neutral"}`}
                >
                  <span className="xls-pill-dot" />
                  {validCount} valid
                </span>
                {rows.length - validCount > 0 && (
                  <span className="xls-pill xls-pill-err">
                    <span className="xls-pill-dot" />
                    {rows.length - validCount} incomplete
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Progress bar ── */}
          <div className="xls-progress">
            <div
              className="xls-progress-fill"
              style={{
                width: `${rows.length ? (validCount / rows.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* ── Toolbar ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn-success gap-2"
              onClick={() => addRows(1)}
            >
              <FiPlus size={15} />
              Add Row
            </button>
            <button
              className="btn btn-success btn-outline gap-2"
              onClick={() => addRows(5)}
            >
              <FiPlus size={15} />
              +5 Rows
            </button>
            <button
              className="btn btn-success btn-outline gap-2"
              onClick={() => addRows(10)}
            >
              <FiPlus size={15} />
              +10 Rows
            </button>

            <div
              style={{
                width: 1,
                height: 28,
                background: "var(--surface-border)",
                margin: "0 4px",
              }}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <button
              className={`btn btn-outline btn-info gap-2${uploading ? " loading" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FiUpload size={15} />
              {uploading ? "Importing..." : "Import"}
            </button>

            {importFeedback && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: importFeedback.startsWith("✓")
                    ? "var(--color-success, #22c55e)"
                    : "var(--color-error, #ef4444)",
                  maxWidth: 300,
                }}
              >
                {importFeedback}
              </span>
            )}

            <div
              style={{
                width: 1,
                height: 28,
                background: "var(--surface-border)",
                margin: "0 4px",
              }}
            />

            <button
              className="btn btn-info btn-outline gap-2"
              onClick={duplicateSelectedRows}
              disabled={selectedRows.size === 0}
            >
              <FiCopy size={15} />
              Duplicate
            </button>
            <button
              className="btn btn-error btn-outline gap-2"
              onClick={deleteSelectedRows}
              disabled={selectedRows.size === 0}
            >
              <FiTrash2 size={15} />
              Delete{selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}
            </button>

            <div
              style={{
                width: 1,
                height: 28,
                background: "var(--surface-border)",
                margin: "0 4px",
              }}
            />

            <button className="btn btn-warning btn-outline" onClick={clearAll}>
              Clear All
            </button>

            {onSwitchView && (
              <>
                <div
                  style={{
                    width: 1,
                    height: 28,
                    background: "var(--surface-border)",
                    margin: "0 8px",
                  }}
                />

                <div
                  style={{
                    display: "inline-flex",
                    background: "var(--surface-inset)",
                    borderRadius: 12,
                    padding: 4,
                    gap: 4,
                    border: "1px solid var(--surface-border)",
                  }}
                >
                  {viewButtons
                    .filter(
                      (b) => !allowedViews || allowedViews.includes(b.value),
                    )
                    .map(({ label, value, icon: Icon }) => {
                      const isCurrent = activeView === value;
                      return (
                        <button
                          key={value}
                          onClick={() => onSwitchView(value)}
                          className="xls-btn"
                          style={{
                            height: 36,
                            padding: "0 16px",
                            fontSize: 14,
                            borderRadius: 8,
                            gap: 6,
                            background: isCurrent
                              ? "var(--color-primary)"
                              : "transparent",
                            color: isCurrent
                              ? "var(--color-primary-content)"
                              : "var(--color-muted)",
                            boxShadow: isCurrent
                              ? "0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent)"
                              : "none",
                          }}
                        >
                          <Icon size={15} />
                          {label}
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            {dateFilterField && (
              <>
                <div
                  style={{
                    width: 1,
                    height: 28,
                    background: "var(--surface-border)",
                    margin: "0 4px",
                  }}
                />
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--color-subtle)" }}>
                    Year Filter
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    list="annual-year-filter-options"
                    className="xls-input"
                    value={dateFilter}
                    onChange={(e) => handleYearFilterChange(e.target.value)}
                    placeholder="YYYY"
                    style={{ width: 120, height: 36 }}
                  />
                  <datalist id="annual-year-filter-options">
                    {yearFilterOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </datalist>
                  {dateFilter && (
                    <button
                      className="btn btn-outline"
                      onClick={() => setDateFilter("")}
                      style={{ height: 36 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── FIELD TABS (compact / inventory) ── */}
          {fieldTabs && (
            <div className="xls-tab-bar">
              {fieldTabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveFieldTab(i)}
                  className={`xls-tab ${activeFieldTab === i ? "active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Sheet ── */}
          <div className="xls-sheet-wrap">
            <div
              className="xls-table-outer"
              ref={tableRef}
              onPaste={handlePaste}
            >
              <table className="xls-table xls-table-auto">
                <thead>
                  <tr className="xls-thead-cols">
                    <th style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className="xls-checkbox"
                        checked={
                          displayedRows.length > 0 &&
                          selectedVisibleCount === displayedRows.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th style={{ textAlign: "center" }}>#</th>
                    {visibleFields.map((f) => (
                      <th
                        key={f.name}
                        style={{
                          textAlign: isNumericField(f.name) ? "center" : "left",
                          whiteSpace: "nowrap",
                        }}
                        title={getFieldDisplayLabel(f)}
                      >
                        {getFieldDisplayLabel(f)}
                        {f.required && (
                          <span className="text-error ml-1">*</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {displayedRows.map(({ row, sourceIndex }, idx) => {
                    const isSelected = selectedRows.has(row._rowId);

                    return (
                      <tr
                        key={row._rowId}
                        className="xls-row"
                        style={
                          isSelected
                            ? {
                                background:
                                  "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                              }
                            : undefined
                        }
                      >
                        {/* Checkbox */}
                        <td className="td-num">
                          <input
                            type="checkbox"
                            className="xls-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row._rowId)}
                          />
                        </td>

                        {/* Row number */}
                        <td className="td-num">
                          <span className="xls-rownum">{idx + 1}</span>
                        </td>

                        {/* Dynamic fields */}
                        {visibleFields.map((f) => {
                          const isNum = isNumericField(f.name);
                          const isActive =
                            activeCell?.rowIdx === sourceIndex &&
                            activeCell?.col === f.name;

                          return (
                            <td
                              key={f.name}
                              style={
                                isActive
                                  ? {
                                      boxShadow: `inset 0 0 0 2px var(--color-primary)`,
                                      borderRadius: 4,
                                    }
                                  : undefined
                              }
                              onClick={() =>
                                setActiveCell({
                                  rowIdx: sourceIndex,
                                  col: f.name,
                                })
                              }
                            >
                              {f.type === "select" && f.options ? (
                                <select
                                  className="xls-input"
                                  value={String(row[f.name] ?? "")}
                                  onChange={(e) =>
                                    updateCell(
                                      row._rowId,
                                      f.name,
                                      e.target.value,
                                    )
                                  }
                                  onFocus={() =>
                                    setActiveCell({
                                      rowIdx: sourceIndex,
                                      col: f.name,
                                    })
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, sourceIndex, f.name)
                                  }
                                >
                                  <option value="" disabled>
                                    Select…
                                  </option>
                                  {f.options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : isNum ? (
                                <input
                                  type="number"
                                  min={0}
                                  className="xls-input xls-mono"
                                  style={{ textAlign: "center" }}
                                  value={
                                    row[f.name] === undefined ||
                                    row[f.name] === ""
                                      ? ""
                                      : row[f.name]
                                  }
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateCell(
                                      row._rowId,
                                      f.name,
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                    )
                                  }
                                  onFocus={(e) => {
                                    setActiveCell({
                                      rowIdx: sourceIndex,
                                      col: f.name,
                                    });
                                    e.target.select();
                                  }}
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, sourceIndex, f.name)
                                  }
                                />
                              ) : (
                                <input
                                  type="text"
                                  className="xls-input"
                                  value={String(row[f.name] ?? "")}
                                  placeholder={f.placeholder ?? ""}
                                  onChange={(e) =>
                                    updateCell(
                                      row._rowId,
                                      f.name,
                                      e.target.value,
                                    )
                                  }
                                  onFocus={() =>
                                    setActiveCell({
                                      rowIdx: sourceIndex,
                                      col: f.name,
                                    })
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, sourceIndex, f.name)
                                  }
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* ── Footer totals ── */}
                <tfoot>
                  <tr className="xls-thead-cols">
                    <td
                      colSpan={2}
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--color-muted)",
                        padding: "10px 14px",
                      }}
                    >
                      Totals
                    </td>
                    {visibleFields.map((f) => {
                      if (!isNumericField(f.name)) {
                        return <td key={f.name} />;
                      }
                      return (
                        <td
                          key={f.name}
                          className="xls-mono"
                          style={{
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 15,
                            padding: "10px 14px",
                          }}
                        >
                          {displayedRows
                            .reduce(
                              (s, entry) =>
                                s + (Number(entry.row[f.name]) || 0),
                              0,
                            )
                            .toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Add row button */}
            <button
              type="button"
              className="xls-add-row"
              onClick={() => addRows(1)}
            >
              <FiPlus size={14} strokeWidth={2.5} />
              Add Row
            </button>
          </div>

          {/* ── Footer ── */}
          <div className="xls-footer">
            <div className="xls-footer-meta">
              <span>
                <strong>{displayedValidCount}</strong> of{" "}
                <strong>{displayedRows.length}</strong> rows ready
              </span>
              <span style={{ color: "var(--color-subtle)", fontSize: 13 }}>
                Paste from Excel supported. Use Tab/Enter to navigate cells.
              </span>
            </div>
            <div className="xls-footer-right">
              <button className="xls-btn xls-btn-ghost" onClick={onBack}>
                Cancel
              </button>
              <button
                className="xls-btn xls-btn-primary"
                onClick={() => setStep("review")}
                disabled={displayedRows.length === 0}
                style={{ opacity: displayedRows.length === 0 ? 0.5 : 1 }}
              >
                <FiEye size={15} />
                Review
                {displayedRows.length > 0 ? ` (${displayedRows.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="xls-main">
          {/* ── Review summary ── */}
          <div className="border-none rv-summary">
            <div className="rv-summary-left">
              <div>
                <p className="text-4xl font-black">
                  Review {displayedRows.length}{" "}
                  {displayedRows.length === 1 ? "entry" : "entries"} before
                  saving
                </p>
                <p className="font-light text-md mt-1">
                  Data for{" "}
                  <strong style={{ color: "var(--color-primary)" }}>
                    {yearLabel}
                  </strong>
                  . Confirm the details are correct.{" "}
                  <strong>{displayedValidCount}</strong>{" "}
                  {displayedValidCount === 1 ? "row is" : "rows are"} ready to
                  save.
                </p>
                {isDateFilterActive && (
                  <p
                    className="font-light text-sm mt-1"
                    style={{ color: "var(--color-subtle)" }}
                  >
                    Showing records for year {effectiveYearFilter}.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {editableFields
              .filter(
                (f) => isNumericField(f.name) && !isPercentageFieldName(f.name),
              )
              .slice(0, 2)
              .map((f) => {
                const total = displayedValidRows.reduce(
                  (s, r) => s + (Number(r[f.name]) || 0),
                  0,
                );
                return (
                  <div key={f.name} className="card bg-base-200/50 shadow">
                    <div className="card-body p-4 text-center">
                      <p className="text-xs uppercase tracking-wider text-base-content/50 font-bold">
                        Total {f.label}
                      </p>
                      <p className="text-3xl font-black text-base-content">
                        {total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            <div className="card bg-primary/10 shadow">
              <div className="card-body p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-primary/70 font-bold">
                  Grand Total
                </p>
                <p className="text-3xl font-black text-primary">
                  {displayedValidRows
                    .reduce((s, r) => {
                      let t = 0;
                      editableFields.forEach((f) => {
                        if (
                          isNumericField(f.name) &&
                          !isPercentageFieldName(f.name)
                        ) {
                          t += Number(r[f.name]) || 0;
                        }
                      });
                      return s + t;
                    }, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* ── Review table ── */}
          <div className="xls-sheet-wrap">
            <div className="xls-table-outer">
              <table className="xls-table xls-table-auto">
                <thead>
                  <tr className="xls-thead-cols">
                    <th style={{ textAlign: "center", width: 48 }}>#</th>
                    {columns.map((col, i) => {
                      if (isGroupColumn(col)) {
                        return (
                          <th
                            key={col.title + i}
                            colSpan={col.children.length}
                            style={{ textAlign: "center" }}
                          >
                            <div className="xls-group-label">{col.title}</div>
                          </th>
                        );
                      }
                      return (
                        <th
                          key={col.key}
                          rowSpan={hasGroups ? 2 : 1}
                          style={{
                            textAlign:
                              col.align === "center"
                                ? "center"
                                : col.align === "right"
                                  ? "right"
                                  : "left",
                            verticalAlign: "middle",
                            whiteSpace: "nowrap",
                            minWidth: 120,
                          }}
                        >
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>

                  {/* Second header row for group children */}
                  {hasGroups && (
                    <tr className="xls-thead-cols">
                      {columns.flatMap((col, gi) => {
                        if (!isGroupColumn(col)) return [];
                        return col.children.map((child) => (
                          <th
                            key={child.key + gi}
                            style={{
                              textAlign:
                                child.align === "center"
                                  ? "center"
                                  : child.align === "right"
                                    ? "right"
                                    : "left",
                              whiteSpace: "nowrap",
                              minWidth: 120,
                            }}
                          >
                            {child.label}
                          </th>
                        ));
                      })}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {displayedRows.map(({ row }, idx) => {
                    // Build a Record<string, unknown> for column renderers
                    const record: Record<string, unknown> = {};
                    for (const f of fields) {
                      record[f.name] = row[f.name];
                    }
                    return (
                      <tr key={row._rowId} className="xls-row">
                        <td className="td-num">
                          <span className="xls-rownum">{idx + 1}</span>
                        </td>
                        {leafColumns.map((col) => (
                          <td
                            key={col.key}
                            className="xls-mono"
                            style={{
                              padding: "12px 14px",
                              textAlign:
                                col.align === "center"
                                  ? "center"
                                  : col.align === "right"
                                    ? "right"
                                    : "left",
                              fontSize: 15,
                            }}
                          >
                            {col.render(record)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="xls-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="xls-btn xls-btn-ghost"
                onClick={() => setStep("edit")}
              >
                <FiArrowLeft size={14} />
                Back to Edit
              </button>
            </div>
            <button
              className="xls-btn xls-btn-success"
              style={{
                height: 50,
                paddingLeft: 30,
                paddingRight: 30,
                fontSize: 16,
              }}
              onClick={handleSave}
            >
              <FiSave size={17} />
              Confirm & Save
              {displayedValidCount > 0 &&
                ` (${displayedValidCount} row${displayedValidCount !== 1 ? "s" : ""})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnualAddReportPage;
