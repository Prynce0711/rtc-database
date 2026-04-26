"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FiArrowLeft,
  FiFileText,
  FiFolder,
  FiGrid,
  FiMinus,
  FiPlus,
  FiSave,
  FiUpload,
} from "react-icons/fi";
import { ArchiveEntryType } from "../../generated/prisma/enums";
import { useAdaptiveNavigation } from "../../lib/nextCompat";
import { usePopup } from "../../Popup/PopupProvider";
import { ButtonStyles } from "../../Utils/ButtonStyles";
import type { ArchiveAdapter } from "./ArchiveAdapter";
import {
  archiveEntryToForm,
  createEmptyArchiveSheet,
  getArchiveExtension,
  normalizeArchivePath,
  type ArchiveEntryData,
  type ArchiveEntryForm,
} from "./ArchiveSchema";

type ArchiveUpdateMode = "ADD" | "EDIT";
type ArchiveTemplate = "folder" | "document" | "spreadsheet" | "file";

const templateToType: Record<ArchiveTemplate, ArchiveEntryType> = {
  folder: ArchiveEntryType.FOLDER,
  document: ArchiveEntryType.DOCUMENT,
  spreadsheet: ArchiveEntryType.SPREADSHEET,
  file: ArchiveEntryType.FILE,
};

const detectArchiveTypeFromFile = (
  file: File,
): ArchiveEntryType => {
  const extension = getArchiveExtension(file.name);
  if (["xlsx", "xls", "csv"].includes(extension)) {
    return ArchiveEntryType.SPREADSHEET;
  }

  if (
    ["txt", "md", "html", "htm", "json", "xml"].includes(extension) ||
    file.type.startsWith("text/") ||
    file.type === "application/json"
  ) {
    return ArchiveEntryType.DOCUMENT;
  }

  return ArchiveEntryType.FILE;
};

const parseSpreadsheetFile = async (file: File): Promise<string[][]> => {
  const extension = getArchiveExtension(file.name);
  const workbook =
    extension === "csv"
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;

  if (!firstSheet) {
    return createEmptyArchiveSheet();
  }

  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
  }) as unknown[];

  if (!Array.isArray(rows) || rows.length === 0) {
    return createEmptyArchiveSheet();
  }

  const normalizedRows = rows.map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell == null ? "" : String(cell))) : [String(row ?? "")]
  );
  const maxColumns = Math.max(1, ...normalizedRows.map((row) => row.length));

  return normalizedRows.map((row) =>
    Array.from({ length: maxColumns }, (_unused, index) => row[index] ?? ""),
  );
};

const formatTemplateLabel = (entryType: ArchiveEntryType): string => {
  switch (entryType) {
    case ArchiveEntryType.FOLDER:
      return "Folder";
    case ArchiveEntryType.DOCUMENT:
      return "Document";
    case ArchiveEntryType.SPREADSHEET:
      return "Spreadsheet";
    default:
      return "File";
  }
};

const getQueryParams = () => {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
};

const buildExplorerHref = (path: string) => {
  const normalized = normalizeArchivePath(path);
  return normalized
    ? `/user/cases/archive?path=${encodeURIComponent(normalized)}`
    : "/user/cases/archive";
};

const SpreadsheetEditor = ({
  value,
  onChange,
}: {
  value: string[][];
  onChange: (nextValue: string[][]) => void;
}) => {
  const rows = value.length;
  const cols = value[0]?.length ?? 0;

  const handleCellChange = (
    rowIndex: number,
    columnIndex: number,
    nextValue: string,
  ) => {
    onChange(
      value.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) =>
              currentColumnIndex === columnIndex ? nextValue : cell,
            )
          : row,
      ),
    );
  };

  const addRow = () => {
    onChange([
      ...value,
      Array.from({ length: cols || 6 }, () => ""),
    ]);
  };

  const removeRow = () => {
    if (rows <= 1) return;
    onChange(value.slice(0, -1));
  };

  const addColumn = () => {
    onChange(value.map((row) => [...row, ""]));
  };

  const removeColumn = () => {
    if (cols <= 1) return;
    onChange(value.map((row) => row.slice(0, -1)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm btn-outline" onClick={addRow}>
          <FiPlus size={13} />
          Row
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={removeRow}>
          <FiMinus size={13} />
          Row
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={addColumn}>
          <FiPlus size={13} />
          Column
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={removeColumn}>
          <FiMinus size={13} />
          Column
        </button>
      </div>

      <div className="overflow-auto rounded-3xl border border-base-200 bg-base-100 shadow-xl">
        <table className="table table-pin-rows table-sm">
          <thead>
            <tr>
              <th className="bg-base-200">#</th>
              {Array.from({ length: cols }).map((_unused, columnIndex) => (
                <th key={columnIndex} className="bg-base-200">
                  {String.fromCharCode(65 + columnIndex)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="font-semibold text-base-content/50">{rowIndex + 1}</td>
                {row.map((cell, columnIndex) => (
                  <td key={`${rowIndex}-${columnIndex}`} className="p-1 min-w-32">
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full"
                      value={cell}
                      onChange={(event) =>
                        handleCellChange(rowIndex, columnIndex, event.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ArchiveUpdatePage = ({
  adapter,
  mode,
}: {
  adapter: ArchiveAdapter;
  mode: ArchiveUpdateMode;
}) => {
  const router = useAdaptiveNavigation();
  const statusPopup = usePopup();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<ArchiveEntryForm>(() =>
    archiveEntryToForm(null),
  );
  const [entryId, setEntryId] = useState<number | null>(null);
  const [existingEntry, setExistingEntry] = useState<ArchiveEntryData | null>(null);
  const [loading, setLoading] = useState(mode === "EDIT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = getQueryParams();
    const path = normalizeArchivePath(params.get("path"));

    if (mode === "ADD") {
      const template = (params.get("template") || "document") as ArchiveTemplate;
      const entryType = templateToType[template] ?? ArchiveEntryType.DOCUMENT;
      setDraft((prev) => ({
        ...prev,
        parentPath: path,
        entryType,
        name:
          entryType === ArchiveEntryType.FOLDER
            ? "New Folder"
            : entryType === ArchiveEntryType.SPREADSHEET
              ? "New Spreadsheet.xlsx"
              : entryType === ArchiveEntryType.FILE
                ? "New File"
                : "New Document.txt",
        extension:
          entryType === ArchiveEntryType.SPREADSHEET
            ? "xlsx"
            : entryType === ArchiveEntryType.DOCUMENT
              ? "txt"
              : "",
        sheetData:
          entryType === ArchiveEntryType.SPREADSHEET
            ? createEmptyArchiveSheet()
            : prev.sheetData,
      }));
      setLoading(false);
      return;
    }

    const id = Number(params.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      setError("Missing archive entry id");
      setLoading(false);
      return;
    }

    const loadEntry = async () => {
      setLoading(true);
      const result = await adapter.getArchiveEntryById(id);
      if (!result.success) {
        setError(result.error || "Failed to load archive entry");
        setLoading(false);
        return;
      }

      setEntryId(id);
      setExistingEntry(result.result);
      setDraft(archiveEntryToForm(result.result));
      setError(null);
      setLoading(false);
    };

    void loadEntry();
  }, [adapter, mode]);

  const pageTitle = useMemo(() => {
    if (mode === "EDIT") {
      return existingEntry?.name ? `Edit ${existingEntry.name}` : "Edit Archive Entry";
    }

    return `New ${formatTemplateLabel(draft.entryType)}`;
  }, [draft.entryType, existingEntry?.name, mode]);

  const updateDraft = <K extends keyof ArchiveEntryForm>(
    key: K,
    value: ArchiveEntryForm[K],
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
      errors: {
        ...prev.errors,
        [String(key)]: "",
      },
    }));
  };

  const handleFileSelection = async (file: File | null) => {
    if (!file) {
      updateDraft("file", null);
      return;
    }

    const detectedType = detectArchiveTypeFromFile(file);
    const extension = getArchiveExtension(file.name);

    updateDraft("file", file);
    updateDraft("name", file.name);
    updateDraft("extension", extension);

    if (detectedType === ArchiveEntryType.DOCUMENT) {
      updateDraft("entryType", ArchiveEntryType.DOCUMENT);
      updateDraft("textContent", await file.text());
      return;
    }

    if (detectedType === ArchiveEntryType.SPREADSHEET) {
      updateDraft("entryType", ArchiveEntryType.SPREADSHEET);
      updateDraft("sheetData", await parseSpreadsheetFile(file));
      return;
    }

    updateDraft("entryType", ArchiveEntryType.FILE);
  };

  const validateDraft = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!draft.name.trim()) {
      nextErrors.name = "Name is required";
    }

    if (
      draft.entryType === ArchiveEntryType.FILE &&
      !draft.file &&
      !existingEntry?.file
    ) {
      nextErrors.file = "Upload a file first";
    }

    setDraft((prev) => ({
      ...prev,
      errors: nextErrors,
    }));

    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateDraft()) {
      statusPopup.showError("Please complete the required fields first.");
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      name: draft.name,
      parentPath: draft.parentPath,
      entryType: draft.entryType,
      description: draft.description || null,
      extension: draft.extension || null,
      textContent:
        draft.entryType === ArchiveEntryType.DOCUMENT ? draft.textContent : null,
      sheetData:
        draft.entryType === ArchiveEntryType.SPREADSHEET ? draft.sheetData : null,
      file: draft.file ?? undefined,
      removeFile: draft.removeFile || undefined,
    };

    const result =
      mode === "EDIT" && entryId
        ? await adapter.updateArchiveEntry(entryId, payload)
        : await adapter.createArchiveEntry(payload);

    setSaving(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to save archive entry");
      return;
    }

    statusPopup.showSuccess("Archive entry saved");
    router.push(`/user/cases/archive/${result.result.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-md text-primary/40" />
          <p className="text-[12px] font-bold uppercase tracking-widest text-base-content/25 select-none">
            Loading editor…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/user/cases/archive")}
        >
          Back to Archive Explorer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push(buildExplorerHref(draft.parentPath))}
            className="flex items-center gap-2 text-[13px] font-semibold text-base-content/40 hover:text-base-content transition-colors duration-150 shrink-0"
          >
            <FiArrowLeft size={15} />
            Back
          </button>

          <div className="text-sm font-semibold text-base-content/35 truncate">
            Archive / {pageTitle}
          </div>

          <button
            className={`${ButtonStyles.primary} ${saving ? "loading" : ""}`}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            <FiSave className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-10 space-y-8">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Archive Editor
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {pageTitle}
          </h1>
          <p className="text-base text-base-content/55 max-w-3xl">
            Uploaded spreadsheets and text-like files are converted into editable archive records automatically.
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl p-6 space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/35 mb-2">
                  Properties
                </p>
                <h2 className="text-xl font-bold text-base-content">
                  File Metadata
                </h2>
              </div>

              <label className="form-control">
                <span className="label-text font-semibold">Name</span>
                <input
                  type="text"
                  className={`input input-bordered ${draft.errors.name ? "input-error" : ""}`}
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                />
                {draft.errors.name && (
                  <span className="mt-1 text-xs text-error">{draft.errors.name}</span>
                )}
              </label>

              <label className="form-control">
                <span className="label-text font-semibold">Folder Path</span>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="Finance/2026"
                  value={draft.parentPath}
                  onChange={(event) =>
                    updateDraft("parentPath", normalizeArchivePath(event.target.value))
                  }
                />
              </label>

              <label className="form-control">
                <span className="label-text font-semibold">Type</span>
                <select
                  className="select select-bordered"
                  value={draft.entryType}
                  disabled={mode === "EDIT"}
                  onChange={(event) =>
                    updateDraft("entryType", event.target.value as ArchiveEntryType)
                  }
                >
                  <option value={ArchiveEntryType.FOLDER}>Folder</option>
                  <option value={ArchiveEntryType.DOCUMENT}>Document</option>
                  <option value={ArchiveEntryType.SPREADSHEET}>Spreadsheet</option>
                  <option value={ArchiveEntryType.FILE}>File Upload</option>
                </select>
                {mode === "EDIT" && (
                  <span className="mt-1 text-xs text-base-content/45">
                    Type stays fixed on edit to keep existing archive data consistent.
                  </span>
                )}
              </label>

              <label className="form-control">
                <span className="label-text font-semibold">Description</span>
                <textarea
                  className="textarea textarea-bordered min-h-28"
                  value={draft.description}
                  onChange={(event) =>
                    updateDraft("description", event.target.value)
                  }
                  placeholder="Optional note about this archive item"
                />
              </label>

              {draft.entryType !== ArchiveEntryType.FOLDER && (
                <div className="space-y-3 rounded-2xl border border-base-200 bg-base-200/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-base-content">
                        {existingEntry?.file ? "Replace File" : "Attach File"}
                      </p>
                      <p className="text-xs text-base-content/50">
                        Uploading `.xlsx`, `.csv`, `.txt`, `.md`, `.json`, or `.html` makes the archive editable.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FiUpload size={14} />
                      Browse
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) =>
                      void handleFileSelection(event.target.files?.[0] || null)
                    }
                  />

                  <div className="rounded-xl border border-dashed border-base-300 px-4 py-3 text-sm">
                    <p className="font-medium text-base-content">
                      {draft.file?.name ||
                        existingEntry?.file?.fileName ||
                        "No file selected yet"}
                    </p>
                    {(draft.errors.file || existingEntry?.file?.mimeType) && (
                      <p className="mt-1 text-xs text-base-content/45">
                        {draft.errors.file || existingEntry?.file?.mimeType}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-6">
            {draft.entryType === ArchiveEntryType.FOLDER && (
              <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl p-8 text-center">
                <FiFolder className="mx-auto h-12 w-12 text-warning" />
                <h2 className="mt-4 text-2xl font-bold">Folder Setup</h2>
                <p className="mt-2 text-base-content/55">
                  This item will act like a directory in the archive explorer and can contain files, documents, and spreadsheets.
                </p>
              </div>
            )}

            {draft.entryType === ArchiveEntryType.DOCUMENT && (
              <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl overflow-hidden">
                <div className="border-b border-base-200 px-6 py-4 flex items-center gap-3">
                  <FiFileText className="h-5 w-5 text-info" />
                  <div>
                    <h2 className="text-xl font-bold">Document Editor</h2>
                    <p className="text-sm text-base-content/50">
                      Use this for Word-like notes, letters, and archive text files.
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <textarea
                    className="textarea textarea-bordered min-h-[55vh] w-full text-base leading-7"
                    value={draft.textContent}
                    onChange={(event) =>
                      updateDraft("textContent", event.target.value)
                    }
                    placeholder="Start writing the archive document here..."
                  />
                </div>
              </div>
            )}

            {draft.entryType === ArchiveEntryType.SPREADSHEET && (
              <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl overflow-hidden">
                <div className="border-b border-base-200 px-6 py-4 flex items-center gap-3">
                  <FiGrid className="h-5 w-5 text-success" />
                  <div>
                    <h2 className="text-xl font-bold">Spreadsheet Editor</h2>
                    <p className="text-sm text-base-content/50">
                      Manage rows and columns directly inside the archive.
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <SpreadsheetEditor
                    value={draft.sheetData}
                    onChange={(nextValue) => updateDraft("sheetData", nextValue)}
                  />
                </div>
              </div>
            )}

            {draft.entryType === ArchiveEntryType.FILE && (
              <div className="rounded-3xl border border-base-200 bg-base-100 shadow-xl p-8 text-center">
                <FiUpload className="mx-auto h-12 w-12 text-primary" />
                <h2 className="mt-4 text-2xl font-bold">Upload a File</h2>
                <p className="mt-2 text-base-content/55">
                  Use binary uploads for PDFs, images, and Office files you want to store as-is.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiUpload size={15} />
                  Choose File
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ArchiveUpdatePage;
