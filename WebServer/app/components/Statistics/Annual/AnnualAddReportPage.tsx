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
  const row: EditableRow = { _rowId: crypto.randomUUID() };
  for (const f of fields) {
    if (f.type === "date") {
      row[f.name] = new Date().toISOString().slice(0, 10);
    } else {
      row[f.name] = "";
    }
  }
  return row;
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
  const leafColumns = useMemo(() => flattenColumns(columns), [columns]);
  const hasGroups = columns.some(isGroupColumn);

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

  /* ---- Does visible tab have any numeric fields? ---- */
  const hasVisibleNumeric = useMemo(
    () => visibleFields.some((f) => isNumericField(f.name)),
    [visibleFields, isNumericField],
  );

  /* ---- State ---- */
  const [rows, setRows] = useState<EditableRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map((r) => {
        const row: EditableRow = { _rowId: crypto.randomUUID() };
        for (const f of fields) {
          const val = r[f.name];
          if (f.type === "date" && val) {
            row[f.name] = String(val).slice(0, 10);
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
  const [step, setStep] = useState<"edit" | "review">("edit");
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

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
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      const imported = rawData.map((excelRow) => {
        const row = buildEmptyRow(fields);
        const excelKeys = Object.keys(excelRow);
        for (const f of editableFields) {
          const matchKey = excelKeys.find(
            (k) =>
              k.trim().toLowerCase() === f.name.toLowerCase() ||
              k.trim().toLowerCase() === (f.label ?? "").toLowerCase(),
          );
          if (matchKey !== undefined) {
            const v = excelRow[matchKey];
            const numVal = Number(v);
            row[f.name] =
              !Number.isNaN(numVal) && v !== "" && v !== null
                ? numVal
                : String(v ?? "");
          }
        }
        return row;
      });
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
        setImportFeedback(
          `✓ ${imported.length} row${imported.length !== 1 ? "s" : ""} imported from Excel`,
        );
      } else {
        setImportFeedback(
          "No data found. Check the Excel file has data rows with matching column headers.",
        );
      }
    } catch (err) {
      console.error("Import failed:", err);
      setImportFeedback("Import failed. Check that the file is a valid Excel file.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Row helpers                                                      */
  /* ---------------------------------------------------------------- */

  const addRows = (count: number = 1) => {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => buildEmptyRow(fields)),
    ]);
  };

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setRows((prev) => prev.filter((r) => !selectedRows.has(r._rowId)));
    setSelectedRows(new Set());
  };

  const duplicateSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const dupes = rows
      .filter((r) => selectedRows.has(r._rowId))
      .map((r) => ({ ...r, _rowId: crypto.randomUUID() }));
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
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => r._rowId)));
    }
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

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            nextCol--;
            if (nextCol < 0) {
              nextCol = COLS.length - 1;
              nextRow--;
            }
          } else {
            nextCol++;
            if (nextCol >= COLS.length) {
              nextCol = 0;
              nextRow++;
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          nextRow++;
          break;
        case "ArrowDown":
          e.preventDefault();
          nextRow++;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextRow--;
          break;
        default:
          return;
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
    [rows.length, COLS],
  );

  /* ---------------------------------------------------------------- */
  /*  Paste from Excel                                                 */
  /* ---------------------------------------------------------------- */

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return;

      e.preventDefault();

      const pastedRows = text
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => {
          const cells = line.split("\t");
          const row = buildEmptyRow(fields);
          editableFields.forEach((f, i) => {
            if (i < cells.length) {
              const v = cells[i].trim();
              // Try to parse as number for numeric fields
              const numVal = Number(v);
              row[f.name] = !Number.isNaN(numVal) && v !== "" ? numVal : v;
            }
          });
          return row;
        });

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
    [fields, editableFields],
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

  const validRows = useMemo(() => rows.filter(isRowValid), [rows, isRowValid]);

  const handleSave = () => {
    if (validRows.length === 0) return;
    const mapped = validRows.map((r) => {
      const record: Record<string, unknown> = {};
      for (const f of fields) {
        record[f.name] = r[f.name];
      }
      return record;
    });
    onSave(mapped);
  };

  /* ---- Review totals (sum of all numeric fields) ---- */
  const reviewColumnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of leafColumns) {
      if (col.key.startsWith("_")) continue; // skip computed columns
      let sum = 0;
      let hasNum = false;
      for (const row of validRows) {
        const n = Number(row[col.key]);
        if (!Number.isNaN(n) && row[col.key] !== "") {
          sum += n;
          hasNum = true;
        }
      }
      if (hasNum) totals[col.key] = sum;
    }
    return totals;
  }, [validRows, leafColumns]);

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
              <div className="xls-pills" style={{ marginTop: 10 }}>
                <span className="xls-pill xls-pill-neutral">
                  <span className="xls-pill-dot" />
                  {rows.length} {rows.length === 1 ? "row" : "rows"}
                </span>
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
                          rows.length > 0 && selectedRows.size === rows.length
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
                        title={f.label}
                      >
                        {f.label}
                        {f.required && (
                          <span className="text-error ml-1">*</span>
                        )}
                      </th>
                    ))}
                    {(!isCompact || hasVisibleNumeric) && (
                      <th style={{ textAlign: "center" }}>Total</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, idx) => {
                    const isSelected = selectedRows.has(row._rowId);

                    // Compute total from all numeric fields
                    let total = 0;
                    editableFields.forEach((f) => {
                      if (isNumericField(f.name)) {
                        total += Number(row[f.name]) || 0;
                      }
                    });

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
                            activeCell?.rowIdx === idx &&
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
                                setActiveCell({ rowIdx: idx, col: f.name })
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
                                    setActiveCell({ rowIdx: idx, col: f.name })
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, idx, f.name)
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
                                  value={row[f.name] || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateCell(
                                      row._rowId,
                                      f.name,
                                      Number(e.target.value) || 0,
                                    )
                                  }
                                  onFocus={(e) => {
                                    setActiveCell({ rowIdx: idx, col: f.name });
                                    e.target.select();
                                  }}
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, idx, f.name)
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
                                    setActiveCell({ rowIdx: idx, col: f.name })
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, idx, f.name)
                                  }
                                />
                              )}
                            </td>
                          );
                        })}

                        {/* Total (auto) */}
                        {(!isCompact || hasVisibleNumeric) && (
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
                        )}
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
                          {rows
                            .reduce((s, r) => s + (Number(r[f.name]) || 0), 0)
                            .toLocaleString()}
                        </td>
                      );
                    })}
                    {(!isCompact || hasVisibleNumeric) && (
                      <td
                        className="xls-mono"
                        style={{
                          textAlign: "center",
                          fontWeight: 800,
                          fontSize: 15,
                          padding: "10px 14px",
                        }}
                      >
                        {rows
                          .reduce((s, r) => {
                            let t = 0;
                            editableFields.forEach((f) => {
                              if (isNumericField(f.name))
                                t += Number(r[f.name]) || 0;
                            });
                            return s + t;
                          }, 0)
                          .toLocaleString()}
                      </td>
                    )}
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
                <strong>{validCount}</strong> of <strong>{rows.length}</strong>{" "}
                rows ready
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
                disabled={validCount === 0}
                style={{ opacity: validCount === 0 ? 0.5 : 1 }}
              >
                <FiEye size={15} />
                Review{validCount > 0 ? ` (${validCount})` : ""}
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
                    {yearLabel}
                  </strong>
                  . Confirm the details are correct.
                </p>
              </div>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {editableFields
              .filter((f) => isNumericField(f.name))
              .slice(0, 2)
              .map((f) => {
                const total = validRows.reduce(
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
                  {validRows
                    .reduce((s, r) => {
                      let t = 0;
                      editableFields.forEach((f) => {
                        if (isNumericField(f.name)) t += Number(r[f.name]) || 0;
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
                  {validRows.map((row, idx) => {
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

                  {/* Grand total */}
                  {validRows.length > 0 && (
                    <tr className="bg-primary/80 text-primary-content">
                      <td
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
                      {leafColumns.map((col) => {
                        const total = reviewColumnTotals[col.key];
                        return (
                          <td
                            key={col.key}
                            className="xls-mono"
                            style={{
                              padding: "14px 14px",
                              textAlign:
                                col.align === "center"
                                  ? "center"
                                  : col.align === "right"
                                    ? "right"
                                    : "left",
                              fontWeight: 900,
                              fontSize: 16,
                            }}
                          >
                            {total != null ? total.toLocaleString() : ""}
                          </td>
                        );
                      })}
                    </tr>
                  )}
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

export default AnnualAddReportPage;
