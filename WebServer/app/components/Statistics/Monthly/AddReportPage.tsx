"use client";

import { getHeaderRowInfo } from "@rtc-database/shared";
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
  FiPlus,
  FiSave,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import AddRowsToolbar from "../Shared/AddRowsToolbar";
import { CATEGORY_OPTIONS } from "./MonthlyFieldConfig";
import { CATEGORY_BADGE } from "./MonthlyUtils";
import type { MonthlyRow } from "./Schema";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EditableRow {
  id: string;
  reportMonth: string;
  branch: string;
  criminal: number;
  civil: number;
}

export interface AddReportPageProps {
  month: string;
  initialCategory?: string;
  initialData?: MonthlyRow[];
  onBack: () => void;
  onSave: (rows: MonthlyRow[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

// category and branch options are defined in MonthlyFieldConfig

type SheetCell = string | number | null | undefined;

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const CURRENT_YEAR = CURRENT_MONTH.slice(0, 4);

const isMonthValue = (value: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const normalizeMonthValue = (value?: string): string =>
  value && isMonthValue(value) ? value : CURRENT_MONTH;

const toMonthLabel = (value: string): string => {
  if (!isMonthValue(value)) return value;
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const normalizeImportHeader = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const toCellText = (cell: SheetCell): string => {
  if (cell === null || cell === undefined) return "";
  return String(cell).replace(/\s+/g, " ").trim();
};

const toNumber = (value: SheetCell): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const HEADER_ALIASES = new Set([
  "category",
  "casecategory",
  "classification",
  "casetype",
  "branch",
  "branchno",
  "branchnumber",
  "branchstation",
  "station",
  "criminal",
  "criminalcases",
  "crim",
  "civil",
  "civilcases",
  "total",
]);

const BRANCH_HEADER_ALIASES = new Set([
  "branch",
  "branchno",
  "branchnumber",
  "branchstation",
  "station",
]);

const CRIMINAL_HEADER_ALIASES = new Set([
  "criminal",
  "criminalcases",
  "criminalcount",
  "crim",
]);

const CIVIL_HEADER_ALIASES = new Set(["civil", "civilcases", "civilcount"]);

const FOOTER_SECTION_MARKERS = new Set(["preparedby", "notedby"]);

const TITLE_TOKENS = [
  "monthlyreport",
  "regionaltrialcourt",
  "pendingcasesfor",
  "newcasesfiledfor",
  "casesdisposedfor",
];

const FOOTER_TOKENS = [
  "preparedby",
  "notedby",
  "statistician",
  "clerkofcourt",
  "attorney",
  "atty",
  "judge",
];

const hasAnyToken = (value: string, tokens: string[]): boolean =>
  tokens.some((token) => value.includes(token));

const isTotalLabel = (normalizedValue: string): boolean =>
  normalizedValue === "total" ||
  normalizedValue === "grandtotal" ||
  normalizedValue === "subtotal" ||
  normalizedValue.startsWith("grandtotal") ||
  normalizedValue.startsWith("subtotal");

const shouldSkipRemainingAsFooter = (normalizedRowValues: string[]): boolean =>
  normalizedRowValues.some((value) => FOOTER_SECTION_MARKERS.has(value));

const shouldIgnoreImportedRow = ({
  rawCategory,
  branch,
  rawCriminal,
  rawCivil,
  normalizedRowValues,
}: {
  rawCategory: string;
  branch: string;
  rawCriminal: string;
  rawCivil: string;
  normalizedRowValues: string[];
}): boolean => {
  const category = normalizeImportHeader(rawCategory);
  const branchText = normalizeImportHeader(branch);
  const criminalText = normalizeImportHeader(rawCriminal);
  const civilText = normalizeImportHeader(rawCivil);
  const hasCountCells = rawCriminal.trim() !== "" || rawCivil.trim() !== "";
  const combined =
    `${category} ${branchText} ${normalizedRowValues.join(" ")}`.trim();

  const looksLikeColumnHeaderRow =
    BRANCH_HEADER_ALIASES.has(branchText) &&
    CRIMINAL_HEADER_ALIASES.has(criminalText) &&
    CIVIL_HEADER_ALIASES.has(civilText);

  if (looksLikeColumnHeaderRow) return true;

  if (!branchText && !hasCountCells) return true;

  if (isTotalLabel(branchText) || isTotalLabel(category)) return true;

  if (
    !hasCountCells &&
    (HEADER_ALIASES.has(branchText) || HEADER_ALIASES.has(category))
  ) {
    return true;
  }

  if (hasAnyToken(combined, TITLE_TOKENS)) return true;

  if (hasAnyToken(combined, FOOTER_TOKENS)) return true;

  return false;
};

const resolveColumnIndex = (
  normalizedHeaderRow: string[],
  aliases: string[],
): number => {
  let bestIndex = -1;
  let bestScore = 0;

  normalizedHeaderRow.forEach((header, index) => {
    if (!header) return;

    let score = 0;
    if (aliases.includes(header)) {
      score = 3;
    } else if (
      aliases.some((alias) => header.includes(alias) || alias.includes(header))
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

const createRowId = (): string => {
  if (typeof globalThis !== "undefined") {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
  }

  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const emptyRow = (reportMonth: string): EditableRow => ({
  id: createRowId(),
  reportMonth,
  branch: "",
  criminal: 0,
  civil: 0,
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AddReportPage: React.FC<AddReportPageProps> = ({
  month,
  initialCategory,
  initialData,
  onBack,
  onSave,
}) => {
  const initialFilterMonth =
    initialData && initialData.length > 0
      ? normalizeMonthValue(initialData[0]?.month ?? month)
      : CURRENT_MONTH;
  const resolvedInitialCategory = useMemo(() => {
    if (initialCategory && CATEGORY_OPTIONS.includes(initialCategory)) {
      return initialCategory;
    }

    const categoryFromData = initialData?.find((row) =>
      CATEGORY_OPTIONS.includes(row.category),
    )?.category;

    return categoryFromData ?? CATEGORY_OPTIONS[0] ?? "New Cases Filed";
  }, [initialCategory, initialData]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    resolvedInitialCategory,
  );
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(
    initialFilterMonth.slice(5, 7),
  );
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>(
    initialFilterMonth.slice(0, 4),
  );

  const [rows, setRows] = useState<EditableRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map((r) => ({
        id: createRowId(),
        reportMonth: normalizeMonthValue(r.month),
        branch: r.branch,
        criminal: r.criminal,
        civil: r.civil,
      }));
    }
    return [emptyRow(CURRENT_MONTH)];
  });
  const [activeCell, setActiveCell] = useState<{
    rowIdx: number;
    col: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"edit" | "review">("edit");

  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const effectiveYearFilter = /^\d{4}$/.test(selectedYearFilter)
    ? selectedYearFilter
    : CURRENT_YEAR;
  const activeMonthFilter = `${effectiveYearFilter}-${selectedMonthFilter}`;
  const handleYearFilterChange = useCallback((value: string) => {
    setSelectedYearFilter(value.replace(/\D/g, "").slice(0, 4));
  }, []);
  const yearFilterOptions = useMemo(() => {
    const years = new Set<string>([CURRENT_YEAR]);
    const baseMonth = normalizeMonthValue(month);
    years.add(baseMonth.slice(0, 4));

    if (/^\d{4}$/.test(selectedYearFilter)) {
      years.add(selectedYearFilter);
    }

    rows.forEach((row) => {
      const normalized = normalizeMonthValue(row.reportMonth);
      years.add(normalized.slice(0, 4));
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [rows, month, selectedYearFilter]);

  const indexedRows = useMemo(
    () => rows.map((row, sourceIndex) => ({ row, sourceIndex })),
    [rows],
  );
  const displayedRows = useMemo(
    () =>
      indexedRows.filter(
        ({ row }) => normalizeMonthValue(row.reportMonth) === activeMonthFilter,
      ),
    [indexedRows, activeMonthFilter],
  );
  const displayedRowIds = useMemo(
    () => displayedRows.map(({ row }) => row.id),
    [displayedRows],
  );
  const visibleSourceIndexes = useMemo(
    () => displayedRows.map(({ sourceIndex }) => sourceIndex),
    [displayedRows],
  );
  const selectedVisibleCount = useMemo(
    () =>
      displayedRowIds.reduce(
        (count, id) => (selectedRows.has(id) ? count + 1 : count),
        0,
      ),
    [displayedRowIds, selectedRows],
  );
  const categoryLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    CATEGORY_OPTIONS.forEach((category) => {
      lookup.set(normalizeImportHeader(category), category);
    });
    return lookup;
  }, []);

  useEffect(() => {
    setSelectedCategory(resolvedInitialCategory);
  }, [resolvedInitialCategory]);

  useEffect(() => {
    if (!importFeedback) return;
    const t = setTimeout(() => setImportFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [importFeedback]);

  useEffect(() => {
    setSelectedRows(new Set());
    setActiveCell(null);
  }, [activeMonthFilter]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const expectedHeaders = [
        "Category",
        "Case Category",
        "Classification",
        "Branch",
        "Branch No",
        "Branch Number",
        "Branch/Station",
        "Station",
        "Criminal",
        "Criminal Cases",
        "Crim",
        "Civil",
        "Civil Cases",
      ];

      const importedRows: EditableRow[] = [];
      let skippedCount = 0;
      const detectedCategories = new Set<string>();

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        let skipRemainingRowsAsFooter = false;

        const headerInfo = getHeaderRowInfo(ws, expectedHeaders);
        const normalizedHeaderRow = headerInfo.headerRow.map((header) =>
          normalizeImportHeader(String(header ?? "")),
        );

        const categoryIndex = resolveColumnIndex(normalizedHeaderRow, [
          "category",
          "casecategory",
          "classification",
          "casetype",
        ]);
        const branchIndex = resolveColumnIndex(normalizedHeaderRow, [
          "branch",
          "branchstation",
          "station",
          "branchno",
          "branchnumber",
        ]);
        const criminalIndex = resolveColumnIndex(normalizedHeaderRow, [
          "criminal",
          "criminalcases",
          "criminalcount",
          "crim",
        ]);
        const civilIndex = resolveColumnIndex(normalizedHeaderRow, [
          "civil",
          "civilcases",
          "civilcount",
        ]);

        if (
          categoryIndex < 0 &&
          branchIndex < 0 &&
          criminalIndex < 0 &&
          civilIndex < 0
        ) {
          continue;
        }

        const rawRows = XLSX.utils.sheet_to_json<SheetCell[]>(ws, {
          header: 1,
          range: headerInfo.headerRowIndex + 1,
          blankrows: false,
        }) as SheetCell[][];

        for (const excelRow of rawRows) {
          const normalizedRowValues = excelRow
            .map((cell) => normalizeImportHeader(toCellText(cell)))
            .filter((value) => value.length > 0);

          if (skipRemainingRowsAsFooter) {
            skippedCount += 1;
            continue;
          }

          if (shouldSkipRemainingAsFooter(normalizedRowValues)) {
            skipRemainingRowsAsFooter = true;
            skippedCount += 1;
            continue;
          }

          const rawCategory =
            categoryIndex >= 0 ? toCellText(excelRow[categoryIndex]) : "";
          const matchedCategory = categoryLookup.get(
            normalizeImportHeader(rawCategory),
          );

          if (matchedCategory) {
            detectedCategories.add(matchedCategory);
          }

          const branch =
            branchIndex >= 0 ? toCellText(excelRow[branchIndex]) : "";
          const rawCriminalCell =
            criminalIndex >= 0 ? excelRow[criminalIndex] : undefined;
          const rawCivilCell =
            civilIndex >= 0 ? excelRow[civilIndex] : undefined;
          const rawCriminalText = toCellText(rawCriminalCell);
          const rawCivilText = toCellText(rawCivilCell);

          if (
            shouldIgnoreImportedRow({
              rawCategory,
              branch,
              rawCriminal: rawCriminalText,
              rawCivil: rawCivilText,
              normalizedRowValues,
            })
          ) {
            skippedCount += 1;
            continue;
          }

          const criminal = criminalIndex >= 0 ? toNumber(rawCriminalCell) : 0;
          const civil = civilIndex >= 0 ? toNumber(rawCivilCell) : 0;

          if (!branch && criminal === 0 && civil === 0) {
            skippedCount += 1;
            continue;
          }

          importedRows.push({
            id: createRowId(),
            reportMonth: activeMonthFilter,
            branch,
            criminal,
            civil,
          });
        }
      }

      if (importedRows.length > 0) {
        if (detectedCategories.size === 1) {
          setSelectedCategory(Array.from(detectedCategories)[0]);
        }

        setRows((prev) => {
          const hasData = prev.some((r) => r.branch || r.criminal || r.civil);
          return hasData ? [...prev, ...importedRows] : importedRows;
        });

        setImportFeedback(
          `✓ ${importedRows.length} row${importedRows.length !== 1 ? "s" : ""} imported from Excel${
            skippedCount > 0
              ? ` (${skippedCount} row${skippedCount !== 1 ? "s" : ""} skipped)`
              : ""
          }`,
        );
      } else {
        setImportFeedback(
          "No matching data found. Check headers like Branch, Criminal, Civil (Category is optional).",
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

  const monthLabel = toMonthLabel(activeMonthFilter);

  /* ---------------------------------------------------------------- */
  /*  Row helpers                                                      */
  /* ---------------------------------------------------------------- */

  const addRows = useCallback(
    (count: number = 1) => {
      setRows((prev) => [
        ...prev,
        ...Array.from({ length: count }, () => emptyRow(activeMonthFilter)),
      ]);
    },
    [activeMonthFilter],
  );

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setRows((prev) => prev.filter((r) => !selectedRows.has(r.id)));
    setSelectedRows(new Set());
  };

  const duplicateSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const dupes = rows
      .filter((r) => selectedRows.has(r.id))
      .map((r) => ({ ...r, id: createRowId() }));
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
      const allVisibleSelected = displayedRowIds.every((id) => next.has(id));

      if (allVisibleSelected) {
        displayedRowIds.forEach((id) => next.delete(id));
      } else {
        displayedRowIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Cell update                                                      */
  /* ---------------------------------------------------------------- */

  const updateCell = useCallback(
    (
      rowId: string,
      field: Exclude<keyof EditableRow, "id">,
      value: string | number,
    ) => {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /*  Keyboard navigation                                              */
  /* ---------------------------------------------------------------- */

  const COLS = useMemo(() => ["branch", "criminal", "civil"] as const, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, col: string) => {
      const colIdx = COLS.indexOf(col as (typeof COLS)[number]);
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
          if (col === "criminal" || col === "civil") {
            e.preventDefault();
            nextRow++;
            rowStep = 1;
          }
          break;
        case "ArrowUp":
          if (col === "criminal" || col === "civil") {
            e.preventDefault();
            nextRow--;
            rowStep = -1;
          }
          break;
        default:
          return;
      }

      if (rowStep !== 0) {
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
      }

      if (nextRow < 0) nextRow = 0;
      if (nextRow >= rows.length) {
        addRows(1);
        nextRow = rows.length;
      }
      if (nextCol < 0) nextCol = 0;
      if (nextCol >= COLS.length) nextCol = COLS.length - 1;

      setActiveCell({ rowIdx: nextRow, col: COLS[nextCol] });
    },
    [rows.length, COLS, addRows, visibleSourceIndexes],
  );

  /* ---------------------------------------------------------------- */
  /*  Paste from Excel                                                 */
  /* ---------------------------------------------------------------- */

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return;

      e.preventDefault();

      const pastedCategories = new Set<string>();
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

          if (shouldSkipRemainingAsFooter(normalizedRowValues)) {
            skipRemainingPastedRowsAsFooter = true;
            return null;
          }

          const firstCell = normalizeImportHeader(cells[0] ?? "");
          const matchedCategory = categoryLookup.get(firstCell);

          if (matchedCategory) {
            pastedCategories.add(matchedCategory);
          }

          const startIndex = matchedCategory ? 1 : 0;
          const branch = (cells[startIndex] ?? "").trim();
          const rawCriminalText = (cells[startIndex + 1] ?? "").trim();
          const rawCivilText = (cells[startIndex + 2] ?? "").trim();

          if (
            shouldIgnoreImportedRow({
              rawCategory: matchedCategory ? (cells[0] ?? "") : "",
              branch,
              rawCriminal: rawCriminalText,
              rawCivil: rawCivilText,
              normalizedRowValues,
            })
          ) {
            return null;
          }

          return {
            id: createRowId(),
            reportMonth: activeMonthFilter,
            branch,
            criminal: toNumber(rawCriminalText),
            civil: toNumber(rawCivilText),
          } as EditableRow;
        })
        .filter((row): row is EditableRow => row !== null)
        .filter((row) => row.branch || row.criminal || row.civil);

      if (pastedRows.length > 0) {
        if (pastedCategories.size === 1) {
          setSelectedCategory(Array.from(pastedCategories)[0]);
        }

        setRows((prev) => {
          const hasData = prev.some((r) => r.branch || r.criminal || r.civil);
          return hasData ? [...prev, ...pastedRows] : pastedRows;
        });
      }
    },
    [categoryLookup, activeMonthFilter],
  );

  /* ---------------------------------------------------------------- */
  /*  Save                                                             */
  /* ---------------------------------------------------------------- */

  const handleSave = () => {
    const validRows = displayedRows
      .map(({ row }) => row)
      .filter((r) => r.branch);
    if (validRows.length === 0) return;

    const mapped: MonthlyRow[] = validRows.map((r) => ({
      month: normalizeMonthValue(r.reportMonth),
      category: selectedCategory,
      branch: r.branch,
      criminal: r.criminal,
      civil: r.civil,
      total: r.criminal + r.civil,
    }));

    onSave(mapped);
    onBack();
  };

  const validRows = useMemo(
    () => displayedRows.map(({ row }) => row).filter((r) => r.branch),
    [displayedRows],
  );

  const validCount = validRows.length;

  const selectedCategoryBadge = useMemo(
    () =>
      CATEGORY_BADGE[selectedCategory] ?? {
        bg: "bg-neutral/10 text-neutral",
        ring: "ring-neutral/20",
      },
    [selectedCategory],
  );

  const reviewTotals = useMemo(
    () => ({
      criminal: validRows.reduce((s, r) => s + r.criminal, 0),
      civil: validRows.reduce((s, r) => s + r.civil, 0),
      total: validRows.reduce((s, r) => s + r.criminal + r.civil, 0),
    }),
    [validRows],
  );

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
              step === "review" ? "Back to Edit" : "Back to Monthly Reports"
            }
          >
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>Monthly Reports</span>
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
              <h1 className="text-5xl xls-title">Add Monthly Report</h1>
              <p className="text-lg mb-9 xls-subtitle">
                Entering data for{" "}
                <strong style={{ color: "var(--color-primary)" }}>
                  {monthLabel}
                </strong>
                . Use tabs to navigate or paste from Excel.{" "}
                <kbd className="xls-kbd">Tab</kbd> /{" "}
                <kbd className="xls-kbd">Enter</kbd> to move between cells.
              </p>
              <div className="xls-pills" style={{ marginTop: 10 }}>
                <span className="xls-pill xls-pill-neutral">
                  <span className="xls-pill-dot" />
                  {rows.length} {rows.length === 1 ? "row" : "rows"}
                </span>
                <span className="xls-pill xls-pill-neutral">
                  <span className="xls-pill-dot" />
                  {monthLabel}
                </span>
                <span className="xls-pill xls-pill-neutral">
                  <span className="xls-pill-dot" />
                  {displayedRows.length} shown
                </span>
                <span className="xls-pill xls-pill-neutral" style={{ gap: 6 }}>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${selectedCategoryBadge.bg}`}
                  >
                    {selectedCategory}
                  </span>
                </span>
                <span
                  className={`xls-pill ${validCount > 0 ? "xls-pill-ok" : "xls-pill-neutral"}`}
                >
                  <span className="xls-pill-dot" />
                  {validCount} valid
                </span>
                {displayedRows.length - validCount > 0 && (
                  <span className="xls-pill xls-pill-err">
                    <span className="xls-pill-dot" />
                    {displayedRows.length - validCount} incomplete
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
                width: `${displayedRows.length ? (validCount / displayedRows.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* ── Toolbar ── */}
          <AddRowsToolbar onAddRows={addRows}>

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
                  maxWidth: 280,
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
              disabled={selectedVisibleCount === 0}
            >
              <FiCopy size={15} />
              Duplicate
            </button>
            <button
              className="btn btn-error btn-outline gap-2"
              onClick={deleteSelectedRows}
              disabled={selectedVisibleCount === 0}
            >
              <FiTrash2 size={15} />
              Delete
              {selectedVisibleCount > 0 ? ` (${selectedVisibleCount})` : ""}
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
                Date Filter
              </span>
              <select
                className="xls-input"
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                style={{ width: 150, height: 36 }}
              >
                {MONTH_OPTIONS.map((monthOption) => (
                  <option key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                list="monthly-year-filter-options"
                className="xls-input"
                value={selectedYearFilter}
                onChange={(e) => handleYearFilterChange(e.target.value)}
                placeholder={CURRENT_YEAR}
                style={{ width: 110, height: 36 }}
              />
              <datalist id="monthly-year-filter-options">
                {yearFilterOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </datalist>
            </div>

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
                {CATEGORY_OPTIONS.map((category) => {
                  const isCurrent = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className="xls-btn"
                      style={{
                        height: 36,
                        padding: "0 14px",
                        fontSize: 13,
                        borderRadius: 8,
                        background: isCurrent
                          ? "var(--color-primary)"
                          : "transparent",
                        color: isCurrent
                          ? "var(--color-primary-content)"
                          : "var(--color-muted)",
                        boxShadow: isCurrent
                          ? "0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent)"
                          : "none",
                        fontWeight: 700,
                      }}
                      title={`Set category to ${category}`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </>
          </AddRowsToolbar>

          {/* ── Sheet ── */}
          <div className="xls-sheet-wrap">
            <div
              className="xls-table-outer"
              ref={tableRef}
              onPaste={handlePaste}
            >
              <table className="xls-table" style={{ width: "100%" }}>
                <colgroup>
                  <col style={{ width: 48 }} />
                  <col style={{ width: 44 }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr className="xls-thead-group">
                    <th style={{ width: 48 }} />
                    <th colSpan={2}>
                      <div className="xls-group-label">Entries</div>
                    </th>
                    <th colSpan={3}>
                      <div className="xls-group-label">Counts</div>
                    </th>
                  </tr>
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
                    <th>Branch</th>
                    <th style={{ textAlign: "center" }}>Criminal</th>
                    <th style={{ textAlign: "center" }}>Civil</th>
                    <th style={{ textAlign: "center" }}>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {displayedRows.map(({ row, sourceIndex }, idx) => {
                    const isSelected = selectedRows.has(row.id);
                    const total = row.criminal + row.civil;
                    const isActive = (col: string) =>
                      activeCell?.rowIdx === sourceIndex &&
                      activeCell?.col === col;

                    return (
                      <tr
                        key={row.id}
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
                            onChange={() => toggleSelectRow(row.id)}
                          />
                        </td>

                        {/* Row number */}
                        <td className="td-num">
                          <span className="xls-rownum">{idx + 1}</span>
                        </td>

                        {/* Branch */}
                        <td
                          style={
                            isActive("branch")
                              ? {
                                  boxShadow: `inset 0 0 0 2px var(--color-primary)`,
                                  borderRadius: 4,
                                }
                              : undefined
                          }
                          onClick={() =>
                            setActiveCell({
                              rowIdx: sourceIndex,
                              col: "branch",
                            })
                          }
                        >
                          <input
                            type="text"
                            className="xls-input"
                            value={row.branch}
                            placeholder="Type branch…"
                            onChange={(e) =>
                              updateCell(row.id, "branch", e.target.value)
                            }
                            onFocus={() =>
                              setActiveCell({
                                rowIdx: sourceIndex,
                                col: "branch",
                              })
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, sourceIndex, "branch")
                            }
                          />
                        </td>

                        {/* Criminal */}
                        <td
                          style={
                            isActive("criminal")
                              ? {
                                  boxShadow: `inset 0 0 0 2px var(--color-primary)`,
                                  borderRadius: 4,
                                }
                              : undefined
                          }
                          onClick={() =>
                            setActiveCell({
                              rowIdx: sourceIndex,
                              col: "criminal",
                            })
                          }
                        >
                          <input
                            type="number"
                            min={0}
                            className="xls-input xls-mono"
                            style={{ textAlign: "center" }}
                            value={row.criminal || ""}
                            placeholder="0"
                            onChange={(e) =>
                              updateCell(
                                row.id,
                                "criminal",
                                Number(e.target.value) || 0,
                              )
                            }
                            onFocus={(e) => {
                              setActiveCell({
                                rowIdx: sourceIndex,
                                col: "criminal",
                              });
                              e.target.select();
                            }}
                            onKeyDown={(e) =>
                              handleKeyDown(e, sourceIndex, "criminal")
                            }
                          />
                        </td>

                        {/* Civil */}
                        <td
                          style={
                            isActive("civil")
                              ? {
                                  boxShadow: `inset 0 0 0 2px var(--color-primary)`,
                                  borderRadius: 4,
                                }
                              : undefined
                          }
                          onClick={() =>
                            setActiveCell({ rowIdx: sourceIndex, col: "civil" })
                          }
                        >
                          <input
                            type="number"
                            min={0}
                            className="xls-input xls-mono"
                            style={{ textAlign: "center" }}
                            value={row.civil || ""}
                            placeholder="0"
                            onChange={(e) =>
                              updateCell(
                                row.id,
                                "civil",
                                Number(e.target.value) || 0,
                              )
                            }
                            onFocus={(e) => {
                              setActiveCell({
                                rowIdx: sourceIndex,
                                col: "civil",
                              });
                              e.target.select();
                            }}
                            onKeyDown={(e) =>
                              handleKeyDown(e, sourceIndex, "civil")
                            }
                          />
                        </td>

                        {/* Total (auto) */}
                        <td
                          className="td-num"
                          style={{ fontWeight: 700, fontSize: 15 }}
                        >
                          <span
                            style={{
                              color:
                                total > 0
                                  ? "var(--color-base-content)"
                                  : "var(--color-muted)",
                            }}
                          >
                            {total > 0 ? total.toLocaleString() : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
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
                <strong>{validCount}</strong> of{" "}
                <strong>{displayedRows.length}</strong> rows ready
              </span>
              <span style={{ color: "var(--color-subtle)", fontSize: 13 }}>
                Paste from Excel: Branch, Criminal, Civil columns (Category
                optional)
              </span>
            </div>
            <div className="xls-footer-right">
              <button className="xls-btn xls-btn-ghost" onClick={onBack}>
                Cancel
              </button>
              <button
                className="xls-btn xls-btn-primary"
                onClick={() => setStep("review")}
                disabled={validCount === 0}
                style={{ opacity: validCount === 0 ? 0.5 : 1 }}
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
                  Review {validCount} {validCount === 1 ? "entry" : "entries"}{" "}
                  before saving
                </p>
                <p className="font-light text-md mt-1">
                  Data for{" "}
                  <strong style={{ color: "var(--color-primary)" }}>
                    {monthLabel}
                  </strong>
                  . Confirm the details for{" "}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${selectedCategoryBadge.bg}`}
                  >
                    {selectedCategory}
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>

          {/*  
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card bg-base-200/50 shadow">
              <div className="card-body p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-base-content/50 font-bold">
                  Total Criminal
                </p>
                <p className="text-3xl font-black text-base-content">
                  {reviewTotals.criminal.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="card bg-base-200/50 shadow">
              <div className="card-body p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-base-content/50 font-bold">
                  Total Civil
                </p>
                <p className="text-3xl font-black text-base-content">
                  {reviewTotals.civil.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="card bg-primary/10 shadow">
              <div className="card-body p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-primary/70 font-bold">
                  Grand Total
                </p>
                <p className="text-3xl font-black text-primary">
                  {reviewTotals.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div> */}

          {/* ── Review table ── */}
          <div className="xls-sheet-wrap">
            <div className="xls-table-outer">
              <table className="xls-table" style={{ width: "100%" }}>
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr className="xls-thead-group">
                    <th colSpan={2}>
                      <div className="xls-group-label">Entries</div>
                    </th>
                    <th colSpan={3}>
                      <div className="xls-group-label">Counts</div>
                    </th>
                  </tr>
                  <tr className="xls-thead-cols">
                    <th style={{ textAlign: "center" }}>#</th>
                    <th>Branch</th>
                    <th style={{ textAlign: "center" }}>Criminal</th>
                    <th style={{ textAlign: "center" }}>Civil</th>
                    <th style={{ textAlign: "center" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row, idx) => (
                    <tr key={row.id} className="xls-row">
                      <td className="td-num">
                        <span className="xls-rownum">{idx + 1}</span>
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          fontWeight: 500,
                          fontSize: 15,
                        }}
                      >
                        {row.branch}
                      </td>
                      <td
                        className="xls-mono"
                        style={{
                          padding: "12px 14px",
                          textAlign: "center",
                          fontSize: 15,
                        }}
                      >
                        {row.criminal.toLocaleString()}
                      </td>
                      <td
                        className="xls-mono"
                        style={{
                          padding: "12px 14px",
                          textAlign: "center",
                          fontSize: 15,
                        }}
                      >
                        {row.civil.toLocaleString()}
                      </td>
                      <td
                        className="xls-mono"
                        style={{
                          padding: "12px 14px",
                          textAlign: "center",
                          fontSize: 15,
                          fontWeight: 600,
                        }}
                      >
                        {(row.criminal + row.civil).toLocaleString()}
                      </td>
                    </tr>
                  ))}

                  {/* Grand total */}
                  <tr className="bg-primary/80 text-primary-content">
                    <td
                      colSpan={2}
                      style={{
                        padding: "14px 14px",
                        fontWeight: 900,
                        fontSize: 13,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Grand Total
                    </td>
                    <td
                      className="xls-mono"
                      style={{
                        padding: "14px 14px",
                        textAlign: "center",
                        fontWeight: 900,
                        fontSize: 16,
                      }}
                    >
                      {reviewTotals.criminal.toLocaleString()}
                    </td>
                    <td
                      className="xls-mono"
                      style={{
                        padding: "14px 14px",
                        textAlign: "center",
                        fontWeight: 900,
                        fontSize: 16,
                      }}
                    >
                      {reviewTotals.civil.toLocaleString()}
                    </td>
                    <td
                      className="xls-mono"
                      style={{
                        padding: "14px 14px",
                        textAlign: "center",
                        fontWeight: 900,
                        fontSize: 20,
                      }}
                    >
                      {reviewTotals.total.toLocaleString()}
                    </td>
                  </tr>
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
              {validCount > 0 &&
                ` (${validCount} row${validCount !== 1 ? "s" : ""})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddReportPage;
