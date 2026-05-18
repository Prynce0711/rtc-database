"use client";

import {
  CaseEntryToolbar,
  getHeaderRowInfo,
  usePopup,
} from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiCopy,
  FiEdit3,
  FiEye,
  FiSave,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import * as XLSX from "xlsx";

export type SpreadsheetRecordField = {
  key: string;
  label: string;
  type: "text" | "date" | "textarea";
  placeholder?: string;
  required?: boolean;
  width?: number;
};

type SpreadsheetEntry = {
  _rowId: string;
  values: Record<string, string>;
  errors: Record<string, string>;
  saved: boolean;
};

type SaveResult = {
  success: boolean;
  error?: string;
};

type ActiveCell = {
  rowId: string;
  fieldIndex: number;
};

type SheetCell = string | number | boolean | Date | null | undefined;

type SpreadsheetRecordFormPageProps = {
  title: string;
  breadcrumbRoot: string;
  breadcrumbCurrent: string;
  subtitle: string;
  fields: readonly SpreadsheetRecordField[];
  initialValues?: Record<string, unknown>;
  isEditing?: boolean;
  canManage: boolean;
  onBack: () => void;
  onSave: (rows: Record<string, string>[]) => Promise<SaveResult | void>;
  successMessage?: string;
  emptyImportMessage?: string;
};

const createRowId = (): string => {
  if (typeof globalThis !== "undefined") {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }
  }

  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeImportHeader = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/#/g, "number")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const splitCamelCase = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

const buildFieldAliases = (field: SpreadsheetRecordField): string[] => {
  const labelWithoutNumberSymbol = field.label.replace(/#\s*/g, "");
  const aliases = [
    field.key,
    splitCamelCase(field.key),
    field.label,
    labelWithoutNumberSymbol,
    field.label.replace(/\//g, " "),
    field.label.replace(/#/g, "No"),
    field.label.replace(/#/g, "Number"),
  ];

  return Array.from(
    new Set(
      aliases
        .map(normalizeImportHeader)
        .filter((alias) => alias.length > 0),
    ),
  );
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeDateInputValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatDateForInput(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return [
        String(excelDate.y).padStart(4, "0"),
        String(excelDate.m).padStart(2, "0"),
        String(excelDate.d).padStart(2, "0"),
      ].join("-");
    }
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : formatDateForInput(parsed);
};

const normalizeFieldValue = (
  field: SpreadsheetRecordField,
  value: unknown,
): string => {
  if (field.type === "date") return normalizeDateInputValue(value);
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
};

const getFieldWidth = (field: SpreadsheetRecordField): number => {
  if (field.width) return field.width;
  if (field.type === "date") return 160;
  if (field.type === "textarea") return 280;
  if (field.key.toLowerCase().includes("case")) return 220;
  if (field.label.length > 24) return 260;
  return 210;
};

const createEntry = (
  fields: readonly SpreadsheetRecordField[],
  values?: Record<string, unknown>,
): SpreadsheetEntry => ({
  _rowId: createRowId(),
  values: fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = normalizeFieldValue(field, values?.[field.key]);
    return acc;
  }, {}),
  errors: {},
  saved: false,
});

const stripEntry = (
  entry: SpreadsheetEntry,
  fields: readonly SpreadsheetRecordField[],
): Record<string, string> =>
  fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = entry.values[field.key] ?? "";
    return acc;
  }, {});

const hasEntryContent = (
  entry: SpreadsheetEntry,
  fields: readonly SpreadsheetRecordField[],
): boolean =>
  fields.some((field) => (entry.values[field.key] ?? "").trim().length > 0);

const validateEntry = (
  entry: SpreadsheetEntry,
  fields: readonly SpreadsheetRecordField[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!hasEntryContent(entry, fields)) {
    errors._row = "Enter at least one value";
  }

  fields.forEach((field) => {
    if (!field.required) return;
    if ((entry.values[field.key] ?? "").trim() === "") {
      errors[field.key] = "Required";
    }
  });

  return errors;
};

const resolveFieldColumnIndex = (
  field: SpreadsheetRecordField,
  normalizedHeaders: string[],
): number => {
  const aliases = buildFieldAliases(field);
  const aliasSet = new Set(aliases);
  const exactIndex = normalizedHeaders.findIndex((header) =>
    aliasSet.has(header),
  );

  if (exactIndex >= 0) return exactIndex;

  let bestIndex = -1;
  let bestScore = 0;

  normalizedHeaders.forEach((header, index) => {
    if (header.length < 4) return;

    aliases.forEach((alias) => {
      if (alias.length < 4) return;

      const score =
        header.includes(alias) || alias.includes(header)
          ? Math.min(header.length, alias.length)
          : 0;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
  });

  return bestIndex;
};

const readRowsFromWorkbook = (
  workbook: XLSX.WorkBook,
  fields: readonly SpreadsheetRecordField[],
): Record<string, string>[] => {
  const importedRows: Record<string, string>[] = [];
  const expectedHeaders = fields.flatMap((field) => [
    field.key,
    splitCamelCase(field.key),
    field.label,
  ]);

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const headerInfo = getHeaderRowInfo(worksheet, expectedHeaders);
    const normalizedHeaders = headerInfo.headerRow.map((header) =>
      normalizeImportHeader(String(header ?? "")),
    );
    const fieldIndexes = new Map<string, number>();

    fields.forEach((field) => {
      const index = resolveFieldColumnIndex(field, normalizedHeaders);
      if (index >= 0) {
        fieldIndexes.set(field.key, index);
      }
    });

    if (fieldIndexes.size === 0) return;

    const sheetRows = XLSX.utils.sheet_to_json<SheetCell[]>(worksheet, {
      header: 1,
      range: headerInfo.headerRowIndex + 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as SheetCell[][];

    sheetRows.forEach((sheetRow) => {
      const values: Record<string, string> = {};

      fields.forEach((field) => {
        const index = fieldIndexes.get(field.key);
        values[field.key] =
          index === undefined
            ? ""
            : normalizeFieldValue(field, sheetRow[index]);
      });

      if (
        fields.some((field) => (values[field.key] ?? "").trim().length > 0)
      ) {
        importedRows.push(values);
      }
    });
  });

  return importedRows;
};

const readRowsFromExcelFile = async (
  file: File,
  fields: readonly SpreadsheetRecordField[],
): Promise<Record<string, string>[]> => {
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    throw new Error("Only Excel files (.xlsx/.xls) are allowed.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return readRowsFromWorkbook(workbook, fields);
};

const formatReviewValue = (
  field: SpreadsheetRecordField,
  value: string,
): string => {
  if (!value) return "-";
  if (field.type !== "date") return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

export default function SpreadsheetRecordFormPage({
  title,
  breadcrumbRoot,
  breadcrumbCurrent,
  subtitle,
  fields,
  initialValues,
  isEditing = false,
  canManage,
  onBack,
  onSave,
  successMessage = "Records saved successfully",
  emptyImportMessage = "No rows were found in the Excel file.",
}: SpreadsheetRecordFormPageProps) {
  const popup = usePopup();
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<SpreadsheetEntry[]>(() => [
    createEntry(fields, initialValues),
  ]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [step, setStep] = useState<"entry" | "review">("entry");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const contentEntries = useMemo(
    () => entries.filter((entry) => hasEntryContent(entry, fields)),
    [entries, fields],
  );

  const completedCount = useMemo(
    () =>
      contentEntries.filter(
        (entry) => Object.keys(validateEntry(entry, fields)).length === 0,
      ).length,
    [contentEntries, fields],
  );

  const incompleteCount = Math.max(0, contentEntries.length - completedCount);
  const allRowsSelected =
    !isEditing &&
    entries.length > 0 &&
    entries.every((entry) => selectedRows.has(entry._rowId));

  const handleChange = useCallback(
    (rowId: string, key: string, value: string) => {
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry._rowId !== rowId) return entry;

          const errors = { ...entry.errors };
          delete errors[key];
          delete errors._row;

          return {
            ...entry,
            values: { ...entry.values, [key]: value },
            errors,
            saved: false,
          };
        }),
      );
    },
    [],
  );

  const addRows = useCallback(
    (count = 1) => {
      const normalizedCount = Math.max(1, Math.floor(count));
      setEntries((prev) => [
        ...prev,
        ...Array.from({ length: normalizedCount }, () => createEntry(fields)),
      ]);
      window.setTimeout(() => {
        tableRef.current?.scrollTo({
          left: 0,
          top: tableRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 60);
    },
    [fields],
  );

  const handleClearTable = useCallback(async () => {
    if (
      !(await popup.showConfirm(
        entries.length === 1
          ? "Clear the table and reset the current row?"
          : `Clear all ${entries.length} rows and start over?`,
      ))
    ) {
      return;
    }

    setEntries([createEntry(fields)]);
    setSelectedRows(new Set());
    setActiveCell(null);
    setStep("entry");
  }, [entries.length, fields, popup]);

  const handleDuplicate = useCallback((rowId: string) => {
    setEntries((prev) => {
      const sourceIndex = prev.findIndex((entry) => entry._rowId === rowId);
      if (sourceIndex < 0) return prev;

      const duplicate: SpreadsheetEntry = {
        _rowId: createRowId(),
        values: { ...prev[sourceIndex].values },
        errors: {},
        saved: false,
      };

      const next = [...prev];
      next.splice(sourceIndex + 1, 0, duplicate);
      return next;
    });
  }, []);

  const handleRemove = useCallback(
    (rowId: string) => {
      if (entries.length <= 1) {
        setEntries([createEntry(fields)]);
        setSelectedRows(new Set());
        return;
      }

      setEntries((prev) => prev.filter((entry) => entry._rowId !== rowId));
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    },
    [entries.length, fields],
  );

  const handleRemoveSelected = useCallback(async () => {
    if (selectedRows.size === 0) return;

    if (
      !(await popup.showConfirm(
        `Remove ${selectedRows.size} selected row${selectedRows.size === 1 ? "" : "s"}?`,
      ))
    ) {
      return;
    }

    setEntries((prev) => {
      const next = prev.filter((entry) => !selectedRows.has(entry._rowId));
      return next.length > 0 ? next : [createEntry(fields)];
    });
    setSelectedRows(new Set());
  }, [fields, popup, selectedRows]);

  const toggleSelectRow = useCallback((rowId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      if (entries.length > 0 && entries.every((entry) => prev.has(entry._rowId))) {
        return new Set();
      }

      return new Set(entries.map((entry) => entry._rowId));
    });
  }, [entries]);

  const handleImportExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const importedRows = await readRowsFromExcelFile(file, fields);

      if (importedRows.length === 0) {
        popup.showError(emptyImportMessage);
        return;
      }

      setEntries(importedRows.map((row) => createEntry(fields, row)));
      setSelectedRows(new Set());
      setActiveCell(null);
      setStep("entry");
      popup.showSuccess(
        `Imported ${importedRows.length} row${importedRows.length === 1 ? "" : "s"}. Review and save to apply them.`,
      );
    } catch (error) {
      popup.showError(
        error instanceof Error ? error.message : "Failed to import Excel file.",
      );
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const text = event.clipboardData.getData("text");
      if (!activeCell || (!text.includes("\t") && !text.includes("\n"))) {
        return;
      }

      event.preventDefault();

      const pastedRows = text
        .replace(/\r/g, "")
        .split("\n")
        .filter((row, index, rows) => row.length > 0 || index < rows.length - 1)
        .map((row) => row.split("\t"));

      if (pastedRows.length === 0) return;

      setEntries((prev) => {
        const startIndex = prev.findIndex(
          (entry) => entry._rowId === activeCell.rowId,
        );
        if (startIndex < 0) return prev;

        const next = [...prev];
        const neededRows = startIndex + pastedRows.length - next.length;

        if (neededRows > 0 && !isEditing) {
          next.push(
            ...Array.from({ length: neededRows }, () => createEntry(fields)),
          );
        }

        pastedRows.forEach((pastedRow, rowOffset) => {
          const targetIndex = startIndex + rowOffset;
          const target = next[targetIndex];
          if (!target) return;

          const values = { ...target.values };
          const errors = { ...target.errors };

          pastedRow.forEach((cell, cellOffset) => {
            const field = fields[activeCell.fieldIndex + cellOffset];
            if (!field) return;

            values[field.key] = normalizeFieldValue(field, cell);
            delete errors[field.key];
            delete errors._row;
          });

          next[targetIndex] = {
            ...target,
            values,
            errors,
            saved: false,
          };
        });

        return next;
      });
    },
    [activeCell, fields, isEditing],
  );

  const handleCellKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      rowId: string,
      fieldIndex: number,
    ) => {
      if (isEditing) return;
      if (event.key !== "Tab" || event.shiftKey) return;
      if (fieldIndex !== fields.length - 1) return;

      const isLastRow = entries[entries.length - 1]?._rowId === rowId;
      if (!isLastRow) return;

      event.preventDefault();
      addRows(1);
      window.setTimeout(() => {
        const rows = tableRef.current?.querySelectorAll("[data-entry-row]");
        const lastRow = rows?.[rows.length - 1];
        (lastRow?.querySelector("input") as HTMLInputElement | null)?.focus();
      }, 80);
    },
    [addRows, entries, fields.length, isEditing],
  );

  const handleGoToReview = useCallback(() => {
    const rowsWithContent = entries.filter((entry) =>
      hasEntryContent(entry, fields),
    );

    if (rowsWithContent.length === 0) {
      setEntries((prev) => {
        const [first, ...rest] = prev.length > 0 ? prev : [createEntry(fields)];
        return [{ ...first, errors: { _row: "Enter at least one value" } }, ...rest];
      });
      popup.showError("Enter at least one row before reviewing.");
      return;
    }

    let invalidCount = 0;

    setEntries((prev) =>
      prev.map((entry) => {
        if (!hasEntryContent(entry, fields)) {
          return { ...entry, errors: {} };
        }

        const errors = validateEntry(entry, fields);
        if (Object.keys(errors).length > 0) invalidCount += 1;
        return { ...entry, errors };
      }),
    );

    if (invalidCount > 0) {
      popup.showError(
        `Fix ${invalidCount} incomplete row${invalidCount === 1 ? "" : "s"} before review.`,
      );
      return;
    }

    setStep("review");
  }, [entries, fields, popup]);

  const handleSave = useCallback(async () => {
    const readyRows = entries
      .filter((entry) => hasEntryContent(entry, fields))
      .filter((entry) => Object.keys(validateEntry(entry, fields)).length === 0)
      .map((entry) => stripEntry(entry, fields));

    if (readyRows.length === 0) {
      popup.showError("No rows are ready to save.");
      return;
    }

    setSaving(true);
    const result = await onSave(readyRows);
    setSaving(false);

    if (result && !result.success) {
      popup.showError(result.error || "Failed to save records.");
      return;
    }

    popup.showSuccess(successMessage);
    onBack();
  }, [entries, fields, onBack, onSave, popup, successMessage]);

  if (!canManage) {
    return (
      <div className="alert alert-error">
        <span>You do not have permission to manage this record.</span>
      </div>
    );
  }

  return (
    <div className="xls-root">
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button
            type="button"
            className="xls-back-btn"
            onClick={step === "review" ? () => setStep("entry") : onBack}
            title="Back"
          >
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>{breadcrumbRoot}</span>
            <span className="xls-breadcrumb-sep">/</span>
            <span className="xls-breadcrumb-current">{breadcrumbCurrent}</span>
            {step === "review" && (
              <>
                <span className="xls-breadcrumb-sep">/</span>
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
                <h1 className="text-5xl xls-title">{title}</h1>
                <p className="text-lg mb-9 xls-subtitle">{subtitle}</p>

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
                    {entries.length} {entries.length === 1 ? "row" : "rows"}
                  </span>
                  <span
                    className={`xls-pill ${completedCount > 0 ? "xls-pill-ok" : "xls-pill-neutral"}`}
                  >
                    <span className="xls-pill-dot" />
                    {completedCount} ready
                  </span>
                  {incompleteCount > 0 && (
                    <span className="xls-pill xls-pill-err">
                      <span className="xls-pill-dot" />
                      {incompleteCount} incomplete
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="xls-progress">
              <div
                className="xls-progress-fill"
                style={{
                  width: `${
                    contentEntries.length > 0
                      ? (completedCount / contentEntries.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {!isEditing && (
              <CaseEntryToolbar
                onAddRows={addRows}
                onClearAll={() => {
                  void handleClearTable();
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <button
                  type="button"
                  className={`btn btn-info btn-outline gap-2 ${uploading ? "loading" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <FiUpload size={15} />
                  {uploading ? "Importing..." : "Import Excel"}
                </button>
                {selectedRows.size > 0 && (
                  <button
                    type="button"
                    className="btn btn-error btn-outline gap-2"
                    onClick={() => void handleRemoveSelected()}
                  >
                    <FiTrash2 size={15} />
                    Remove Selected
                  </button>
                )}
              </CaseEntryToolbar>
            )}

            <div className="xls-sheet-wrap">
              <div
                className="xls-table-outer"
                ref={tableRef}
                onPaste={handlePaste}
              >
                <table className="xls-table xls-table-auto">
                  <colgroup>
                    {!isEditing && <col style={{ width: 48 }} />}
                    <col style={{ width: 52 }} />
                    {fields.map((field) => (
                      <col
                        key={field.key}
                        style={{ width: getFieldWidth(field) }}
                      />
                    ))}
                    {!isEditing && <col style={{ width: 92 }} />}
                  </colgroup>

                  <thead>
                    <tr className="xls-thead-group">
                      <th colSpan={isEditing ? 1 : 2}>
                        <div className="xls-group-label">Rows</div>
                      </th>
                      <th colSpan={fields.length}>
                        <div className="xls-group-label">Record Details</div>
                      </th>
                      {!isEditing && <th />}
                    </tr>
                    <tr className="xls-thead-cols">
                      {!isEditing && (
                        <th style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className="xls-checkbox"
                            checked={allRowsSelected}
                            onChange={toggleSelectAll}
                            aria-label="Select all rows"
                          />
                        </th>
                      )}
                      <th style={{ textAlign: "center" }}>#</th>
                      {fields.map((field) => (
                        <th
                          key={field.key}
                          className={field.required ? "req-col" : ""}
                          title={field.label}
                        >
                          {field.label}
                        </th>
                      ))}
                      {!isEditing && (
                        <th style={{ textAlign: "center" }}>Actions</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {entries.map((entry, rowIndex) => {
                      const rowSelected = selectedRows.has(entry._rowId);

                      return (
                        <tr
                          key={entry._rowId}
                          data-entry-row
                          className="xls-row"
                          style={
                            rowSelected
                              ? {
                                  background:
                                    "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                                }
                              : undefined
                          }
                        >
                          {!isEditing && (
                            <td className="td-num">
                              <input
                                type="checkbox"
                                className="xls-checkbox"
                                checked={rowSelected}
                                onChange={() => toggleSelectRow(entry._rowId)}
                                aria-label={`Select row ${rowIndex + 1}`}
                              />
                            </td>
                          )}
                          <td className="td-num">
                            <span
                              className="xls-rownum"
                              title={entry.errors._row || undefined}
                              style={
                                entry.errors._row
                                  ? {
                                      background: "var(--color-error-soft)",
                                      color: "var(--color-error)",
                                    }
                                  : undefined
                              }
                            >
                              {rowIndex + 1}
                            </span>
                            {entry.errors._row && (
                              <span className="xls-cell-err">
                                <FiAlertCircle size={10} />
                                {entry.errors._row}
                              </span>
                            )}
                          </td>

                          {fields.map((field, fieldIndex) => (
                            <td key={field.key}>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <input
                                  type={field.type === "date" ? "date" : "text"}
                                  className={`xls-input${entry.errors[field.key] ? " xls-input-err" : ""}`}
                                  value={entry.values[field.key] ?? ""}
                                  placeholder={field.placeholder ?? field.label}
                                  title={entry.errors[field.key] || field.label}
                                  onChange={(event) =>
                                    handleChange(
                                      entry._rowId,
                                      field.key,
                                      event.target.value,
                                    )
                                  }
                                  onFocus={() =>
                                    setActiveCell({
                                      rowId: entry._rowId,
                                      fieldIndex,
                                    })
                                  }
                                  onKeyDown={(event) =>
                                    handleCellKeyDown(
                                      event,
                                      entry._rowId,
                                      fieldIndex,
                                    )
                                  }
                                />
                                {entry.errors[field.key] && (
                                  <span className="xls-cell-err">
                                    <FiAlertCircle size={10} />
                                    {entry.errors[field.key]}
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}

                          {!isEditing && (
                            <td className="td-actions">
                              <div className="xls-row-actions">
                                <button
                                  type="button"
                                  className="xls-row-btn"
                                  onClick={() => handleDuplicate(entry._rowId)}
                                  title="Duplicate row"
                                >
                                  <FiCopy size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="xls-row-btn del"
                                  onClick={() => handleRemove(entry._rowId)}
                                  title="Remove row"
                                >
                                  <FiTrash2 size={13} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  className="xls-add-row"
                  onClick={() => addRows(1)}
                >
                  Add Row
                </button>
              )}
            </div>

            <div className="xls-footer">
              <div className="xls-footer-meta">
                <span>
                  <strong>{completedCount}</strong> of{" "}
                  <strong>{contentEntries.length || entries.length}</strong>{" "}
                  rows ready
                </span>
                <span style={{ color: "var(--color-subtle)", fontSize: 13 }}>
                  Paste from Excel is supported.
                </span>
              </div>
              <div className="xls-footer-right">
                <button
                  type="button"
                  className="xls-btn xls-btn-ghost"
                  onClick={onBack}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="xls-btn xls-btn-primary"
                  onClick={handleGoToReview}
                >
                  <FiEye size={15} />
                  Review
                  {contentEntries.length > 0 ? ` (${contentEntries.length})` : ""}
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
                    Review {contentEntries.length}{" "}
                    {contentEntries.length === 1 ? "entry" : "entries"} before
                    saving
                  </p>
                  <p className="font-light text-md mt-1">
                    Confirm the record details are correct.
                  </p>
                </div>
              </div>
            </div>

            <div className="xls-sheet-wrap">
              <div className="xls-table-outer">
                <table className="xls-table xls-table-auto">
                  <thead>
                    <tr className="xls-thead-cols">
                      <th style={{ textAlign: "center", width: 52 }}>#</th>
                      {fields.map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contentEntries.map((entry, index) => (
                      <tr key={entry._rowId} className="xls-row">
                        <td className="td-num">
                          <span className="xls-rownum">{index + 1}</span>
                        </td>
                        {fields.map((field) => (
                          <td
                            key={field.key}
                            style={{
                              minWidth: getFieldWidth(field),
                              padding: "12px 14px",
                              fontSize: 15,
                            }}
                          >
                            {formatReviewValue(
                              field,
                              entry.values[field.key] ?? "",
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xls-footer">
              <button
                type="button"
                className="xls-btn xls-btn-ghost"
                onClick={() => setStep("entry")}
              >
                <FiArrowLeft size={14} />
                Back to Edit
              </button>

              <button
                type="button"
                className="xls-btn xls-btn-success"
                style={{
                  height: 50,
                  paddingLeft: 30,
                  paddingRight: 30,
                  fontSize: 16,
                }}
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="xls-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave size={17} />
                    {isEditing
                      ? "Save Changes"
                      : `Confirm & Save (${contentEntries.length})`}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
