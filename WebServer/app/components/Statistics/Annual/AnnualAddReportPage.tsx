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
  FiCalendar,
  FiCheck,
  FiCopy,
  FiEdit3,
  FiEye,
  FiFileText,
  FiGrid,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
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
  const fieldTabs = useMemo(() => {
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
    <div className="space-y-0 flex flex-col h-full min-h-[calc(100vh-6rem)]">
      {/* ── HEADER ── */}
      <header className="card bg-base-100 shadow-xl rounded-b-none">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                className="btn btn-ghost btn-circle"
                onClick={step === "review" ? () => setStep("edit") : onBack}
                title={
                  step === "review" ? "Back to Edit" : "Back to Annual Reports"
                }
              >
                <FiArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-base-content">
                  {step === "edit"
                    ? `Add ${title} Entry`
                    : `Review ${title} Entry`}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                  <FiCalendar className="shrink-0" />
                  <span>
                    {step === "edit" ? (
                      <>
                        Entering data for{" "}
                        <span className="text-primary font-semibold">
                          {yearLabel}
                        </span>{" "}
                        — type directly or paste from Excel
                      </>
                    ) : (
                      <>
                        Review your entries for{" "}
                        <span className="text-primary font-semibold">
                          {yearLabel}
                        </span>{" "}
                        before saving
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* ── STEP INDICATOR ── */}
            <div className="flex items-center gap-0">
              {/* Step 1 */}
              <button
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setStep("edit")}
              >
                <div
                  className={`flex items-center justify-center h-9 w-9 rounded-full font-bold text-sm transition-all ${
                    step === "edit"
                      ? "bg-primary text-primary-content shadow-lg shadow-primary/30 scale-110"
                      : "bg-success text-success-content"
                  }`}
                >
                  {step === "review" ? (
                    <FiCheck className="h-4 w-4" />
                  ) : (
                    <FiEdit3 className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-bold hidden sm:inline ${
                    step === "edit" ? "text-primary" : "text-success"
                  }`}
                >
                  Enter Data
                </span>
              </button>

              {/* Connector */}
              <div
                className={`w-12 sm:w-20 h-1 mx-2 rounded-full transition-colors ${
                  step === "review" ? "bg-primary" : "bg-base-300"
                }`}
              />

              {/* Step 2 */}
              <button
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => validCount > 0 && setStep("review")}
                disabled={validCount === 0 && step === "edit"}
              >
                <div
                  className={`flex items-center justify-center h-9 w-9 rounded-full font-bold text-sm transition-all ${
                    step === "review"
                      ? "bg-primary text-primary-content shadow-lg shadow-primary/30 scale-110"
                      : "bg-base-300 text-base-content/40"
                  }`}
                >
                  <FiEye className="h-4 w-4" />
                </div>
                <span
                  className={`text-sm font-bold hidden sm:inline ${
                    step === "review" ? "text-primary" : "text-base-content/40"
                  }`}
                >
                  Review & Save
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── STEP CONTENT ── */}
      {step === "edit" ? (
        <>
          {/* ── TOOLBAR ── */}
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-y border-base-300 bg-base-200/40">
            <button
              className="btn btn-outline btn-success gap-2"
              onClick={() => addRows(1)}
            >
              <FiPlus className="h-5 w-5" />
              Add Row
            </button>
            <button
              className="btn btn-outline gap-2"
              onClick={() => addRows(5)}
            >
              <FiPlus className="h-5 w-5" />
              Add 5 Rows
            </button>
            <button
              className="btn btn-outline gap-2"
              onClick={() => addRows(10)}
            >
              <FiPlus className="h-5 w-5" />
              Add 10 Rows
            </button>

            <div className="divider divider-horizontal mx-1 h-8" />

            <button
              className="btn btn-outline btn-info gap-2"
              onClick={duplicateSelectedRows}
              disabled={selectedRows.size === 0}
            >
              <FiCopy className="h-5 w-5" />
              Duplicate
            </button>
            <button
              className="btn btn-outline btn-error gap-2"
              onClick={deleteSelectedRows}
              disabled={selectedRows.size === 0}
            >
              <FiTrash2 className="h-5 w-5" />
              Delete
              {selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}
            </button>

            <div className="divider divider-horizontal mx-1 h-8" />

            <button
              className="btn btn-outline btn-warning gap-2"
              onClick={clearAll}
            >
              Clear All
            </button>

            {onSwitchView && (
              <>
                <div className="divider divider-horizontal mx-3 h-8" />

                <div className="inline-flex bg-base-300/50 rounded-xl p-1 gap-1">
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
                          className={`btn btn-md gap-3 rounded-lg transition-all ${
                            isCurrent
                              ? "btn-primary shadow-lg"
                              : "btn-ghost text-base-content/60 hover:text-base-content"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
              {rows.length} row{rows.length !== 1 && "s"} •{" "}
              <span className="text-success font-semibold">
                {validCount} valid
              </span>
            </span>
          </div>

          {/* ── FIELD TABS (compact / inventory) ── */}
          {fieldTabs && (
            <div className="flex items-center border-b border-base-300 bg-base-100 px-4 sm:px-6">
              {fieldTabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveFieldTab(i)}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeFieldTab === i
                      ? "border-primary text-primary"
                      : "border-transparent text-base-content/50 hover:text-base-content/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── EXCEL-LIKE TABLE ── */}
          <div
            ref={tableRef}
            className="flex-1 overflow-auto bg-base-100 border-x border-base-300/50"
            onPaste={handlePaste}
          >
            <table className="table w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                  <th
                    className={`${isCompact ? "py-2.5 px-2" : "py-3 px-3"} text-center border-r border-base-content/10`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={
                        rows.length > 0 && selectedRows.size === rows.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th
                    className={`${isCompact ? "py-2.5 px-2" : "py-3 px-3"} text-center font-extrabold border-r border-base-content/10`}
                  >
                    #
                  </th>
                  {visibleFields.map((f) => (
                    <th
                      key={f.name}
                      className={`${isCompact ? "py-2.5 px-2 text-xs" : "py-3 px-4"} font-extrabold border-r border-base-content/10 ${
                        isNumericField(f.name) ? "text-center" : "text-left"
                      } whitespace-nowrap`}
                      title={f.label}
                    >
                      {f.label}
                      {f.required && <span className="text-error ml-1">*</span>}
                    </th>
                  ))}
                  {(!isCompact || hasVisibleNumeric) && (
                    <th
                      className={`${isCompact ? "py-2.5 px-2" : "py-3 px-4"} text-center font-extrabold bg-base-content/5`}
                    >
                      Total
                    </th>
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
                      className={`group transition-colors duration-75 ${
                        isSelected
                          ? "bg-primary/10"
                          : idx % 2 === 0
                            ? "bg-base-100"
                            : "bg-base-200/30"
                      } hover:bg-primary/5`}
                    >
                      {/* Checkbox */}
                      <td
                        className={`${isCompact ? "px-2 py-1.5" : "px-3 py-2"} text-center border-r border-base-300/40`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row._rowId)}
                        />
                      </td>

                      {/* Row number */}
                      <td
                        className={`${isCompact ? "px-2 py-1.5" : "px-3 py-2"} text-center text-sm text-base-content/40 font-mono border-r border-base-300/40 select-none`}
                      >
                        {idx + 1}
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
                            className={`${isCompact ? "px-2 py-1.5" : "px-2 py-2"} border-r border-base-300/40 ${
                              isActive ? "ring-2 ring-primary ring-inset" : ""
                            }`}
                            onClick={() =>
                              setActiveCell({ rowIdx: idx, col: f.name })
                            }
                          >
                            {f.type === "select" && f.options ? (
                              <select
                                className={`select select-ghost w-full font-medium`}
                                value={String(row[f.name] ?? "")}
                                onChange={(e) =>
                                  updateCell(row._rowId, f.name, e.target.value)
                                }
                                onFocus={() =>
                                  setActiveCell({ rowIdx: idx, col: f.name })
                                }
                                onKeyDown={(e) => handleKeyDown(e, idx, f.name)}
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
                                className={`input input-ghost w-full text-center tabular-nums font-medium`}
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
                                onKeyDown={(e) => handleKeyDown(e, idx, f.name)}
                              />
                            ) : (
                              <input
                                type="text"
                                className={`input input-ghost w-full font-medium`}
                                value={String(row[f.name] ?? "")}
                                placeholder={f.placeholder ?? ""}
                                onChange={(e) =>
                                  updateCell(row._rowId, f.name, e.target.value)
                                }
                                onFocus={() =>
                                  setActiveCell({ rowIdx: idx, col: f.name })
                                }
                                onKeyDown={(e) => handleKeyDown(e, idx, f.name)}
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Total (auto) */}
                      {(!isCompact || hasVisibleNumeric) && (
                        <td
                          className={`${isCompact ? "px-2 py-1.5" : "px-4 py-2"} text-center tabular-nums font-bold text-base bg-base-content/3`}
                        >
                          <span
                            className={
                              total > 0
                                ? "text-base-content"
                                : "text-base-content/30"
                            }
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
              <tfoot className="sticky bottom-0">
                <tr className="bg-base-300 font-bold text-sm">
                  <td
                    colSpan={2}
                    className={`${isCompact ? "px-2 py-2.5" : "px-3 py-3"} text-right uppercase tracking-wider text-base-content/60`}
                  >
                    Totals
                  </td>
                  {visibleFields.map((f) => {
                    if (!isNumericField(f.name)) {
                      return (
                        <td
                          key={f.name}
                          className={isCompact ? "px-2 py-2.5" : "px-3 py-3"}
                        />
                      );
                    }
                    return (
                      <td
                        key={f.name}
                        className={`${isCompact ? "px-2 py-2.5" : "px-3 py-3 text-base"} text-center tabular-nums`}
                      >
                        {rows
                          .reduce((s, r) => s + (Number(r[f.name]) || 0), 0)
                          .toLocaleString()}
                      </td>
                    );
                  })}
                  {(!isCompact || hasVisibleNumeric) && (
                    <td
                      className={`${isCompact ? "px-2 py-2.5" : "px-3 py-3 text-base"} text-center tabular-nums font-extrabold bg-base-content/5`}
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

          {/* ── BOTTOM BAR (Edit) ── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-base-300 bg-base-200/50 rounded-b-xl shadow-xl">
            <p className="text-xs text-base-content/40">
              Tip: You can paste data directly from Excel. Use Tab/Enter to
              navigate cells.
            </p>
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost" onClick={onBack}>
                Cancel
              </button>
              <button
                className="btn btn-outline btn-primary gap-2"
                onClick={() => setStep("review")}
                disabled={validCount === 0}
              >
                <FiEye className="h-5 w-5" />
                Review
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── REVIEW VIEW ── */}
          <div className="flex-1 overflow-auto bg-base-100 border-x border-base-300/50 p-4 sm:p-6 space-y-6">
            {/* Summary cards */}
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
                          if (isNumericField(f.name))
                            t += Number(r[f.name]) || 0;
                        });
                        return s + t;
                      }, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Review table */}
            <div className="bg-base-100 rounded-xl shadow-lg border border-base-300/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    {/* Primary header row */}
                    <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                      <th className="py-3 px-4 text-center font-extrabold">
                        #
                      </th>
                      {columns.map((col, i) => {
                        if (isGroupColumn(col)) {
                          return (
                            <th
                              key={col.title + i}
                              colSpan={col.children.length}
                              className="py-3 px-4 text-center font-extrabold border-b border-base-200 bg-base-content/5"
                            >
                              {col.title}
                            </th>
                          );
                        }
                        return (
                          <th
                            key={col.key}
                            rowSpan={hasGroups ? 2 : 1}
                            className={`py-3 px-4 font-extrabold align-middle ${
                              col.align === "center"
                                ? "text-center"
                                : col.align === "right"
                                  ? "text-right"
                                  : "text-left"
                            }`}
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>

                    {/* Second header row for group children */}
                    {hasGroups && (
                      <tr className="bg-base-300/80 text-base-content text-xs uppercase tracking-widest">
                        {columns.flatMap((col, gi) => {
                          if (!isGroupColumn(col)) return [];
                          return col.children.map((child) => (
                            <th
                              key={child.key + gi}
                              className={`py-2 px-4 font-extrabold ${
                                child.align === "center"
                                  ? "text-center"
                                  : child.align === "right"
                                    ? "text-right"
                                    : "text-left"
                              }`}
                            >
                              {child.label}
                            </th>
                          ));
                        })}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-base-200">
                    {validRows.map((row, idx) => {
                      // Build a Record<string, unknown> for column renderers
                      const record: Record<string, unknown> = {};
                      for (const f of fields) {
                        record[f.name] = row[f.name];
                      }
                      return (
                        <tr
                          key={row._rowId}
                          className={`${
                            idx % 2 === 0 ? "bg-base-100" : "bg-base-200/25"
                          } hover:bg-primary/5 transition-colors`}
                        >
                          <td className="px-4 py-3 text-center text-sm font-mono text-base-content/40">
                            {idx + 1}
                          </td>
                          {leafColumns.map((col) => (
                            <td
                              key={col.key}
                              className={`px-4 py-3 tabular-nums text-base ${
                                col.align === "center"
                                  ? "text-center"
                                  : col.align === "right"
                                    ? "text-right"
                                    : ""
                              }`}
                            >
                              {col.render(record)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}

                    {/* Grand total */}
                    {validRows.length > 0 && (
                      <tr className="bg-primary text-primary-content">
                        <td className="px-4 py-4 font-black text-sm uppercase tracking-widest">
                          Total
                        </td>
                        {leafColumns.map((col) => {
                          const total = reviewColumnTotals[col.key];
                          return (
                            <td
                              key={col.key}
                              className={`px-4 py-4 font-black tabular-nums text-base ${
                                col.align === "center"
                                  ? "text-center"
                                  : col.align === "right"
                                    ? "text-right"
                                    : ""
                              }`}
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
          </div>

          {/* ── BOTTOM BAR (Review) ── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-base-300 bg-base-200/50 rounded-b-xl shadow-xl">
            <button
              className="btn btn-outline gap-2"
              onClick={() => setStep("edit")}
            >
              <FiEdit3 className="h-5 w-5" />
              Go Back to Edit
            </button>
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost" onClick={onBack}>
                Cancel
              </button>
              <button
                className="btn btn-outline btn-success gap-2"
                onClick={handleSave}
              >
                <FiCheck className="h-5 w-5" />
                Confirm & Save{" "}
                {validCount > 0 &&
                  `(${validCount} row${validCount !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnnualAddReportPage;
