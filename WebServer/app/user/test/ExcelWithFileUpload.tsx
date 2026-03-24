"use client";

import { uploadFileToGarage } from "@/app/lib/garageActions";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ExcelRow = {
  title: string;
  filePath: string;
  normalizedPath: string;
  status: "pending" | "uploaded" | "missing" | "error";
  message?: string;
};

type FileIndex = {
  byPath: Map<string, File>;
  byBaseName: Map<string, File[]>;
  baseFolder?: string;
};

const normalizePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\.(\/)/, "");

const buildFileIndex = (files: File[]): FileIndex => {
  const byPath = new Map<string, File>();
  const byBaseName = new Map<string, File[]>();
  let baseFolder: string | undefined;

  files.forEach((file) => {
    const rawPath = file.webkitRelativePath || file.name;
    const normalized = normalizePath(rawPath);
    const segments = normalized.split("/");
    const rootFolder = segments.length > 1 ? segments[0] : "";
    const relativePath =
      segments.length > 1 ? segments.slice(1).join("/") : normalized;
    const baseName = segments[segments.length - 1] || normalized;

    if (!baseFolder && rootFolder) {
      baseFolder = rootFolder;
    }

    byPath.set(normalized, file);
    if (relativePath && relativePath !== normalized) {
      byPath.set(relativePath, file);
    }
    const list = byBaseName.get(baseName) ?? [];
    list.push(file);
    byBaseName.set(baseName, list);
  });

  return { byPath, byBaseName, baseFolder };
};

const findFileForRow = (index: FileIndex, pathValue: string) => {
  const normalized = normalizePath(pathValue);
  const direct = index.byPath.get(normalized);
  if (direct) return direct;

  const baseName = normalized.split("/").pop() || normalized;
  const matches = index.byBaseName.get(baseName);
  if (matches && matches.length === 1) return matches[0];
  return null;
};

const buildFileName = (title: string, originalName: string) => {
  const trimmedTitle = title.trim();
  return trimmedTitle ? `${trimmedTitle}-${originalName}` : originalName;
};

const base64ToFile = (base64: string, name: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name);
};

export default function ExcelWithFileUpload() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const ipc = typeof window !== "undefined" ? window.ipcRenderer : undefined;
  const isElectron = !!ipc?.invoke;

  const fileIndex = useMemo(
    () => buildFileIndex(selectedFiles),
    [selectedFiles],
  );

  const handleExcelChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setExcelFile(file);
    setRows([]);
    setMessage(null);

    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      {
        defval: "",
      },
    );

    const parsedRows = rawRows
      .map((row) => ({
        title: String(row["Title"] ?? "").trim(),
        filePath: String(row["File"] ?? "").trim(),
      }))
      .filter((row) => row.title || row.filePath)
      .map((row) => ({
        ...row,
        normalizedPath: normalizePath(row.filePath),
        status: "pending" as const,
      }));

    if (isElectron) {
      setRows(await updateElectronExistence(parsedRows));
    } else {
      setRows(parsedRows);
    }
  };

  const handleSelectBaseFolder = async () => {
    if (!ipc?.invoke) return;
    const selected = (await ipc.invoke("files:select-base-folder")) as
      | string
      | null;
    setBaseFolder(selected ?? null);
    setMessage(null);
  };

  const updateElectronExistence = async (nextRows: ExcelRow[]) => {
    if (!baseFolder || !ipc?.invoke) return nextRows;
    const relativePaths = nextRows
      .map((row) => row.normalizedPath)
      .filter((pathValue) => pathValue);

    const existsMap = (await ipc.invoke("files:check-exists", {
      baseFolder,
      relativePaths,
    })) as Record<string, boolean>;

    return nextRows.map((row) => {
      if (row.status === "uploaded") return row;
      if (!row.normalizedPath) return row;
      const exists = !!existsMap[row.normalizedPath];
      return {
        ...row,
        status: exists ? ("pending" as const) : ("missing" as const),
        message: exists ? "File found." : "File not found in base folder.",
      };
    });
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setMessage(null);
  };

  const handleUploadAll = async () => {
    if (!excelFile || rows.length === 0) {
      setMessage("Upload an Excel file first.");
      return;
    }

    if (isElectron) {
      if (!baseFolder) {
        setMessage("Select a base folder first.");
        return;
      }
    } else if (selectedFiles.length === 0) {
      setMessage("Select the files folder or files to upload.");
      return;
    }

    setLoading(true);
    setMessage(null);

    setProgress({ completed: 0, total: rows.length });

    const nextRows: ExcelRow[] = rows.map((row) => ({ ...row }));

    const updateRow = (index: number, row: ExcelRow) => {
      nextRows[index] = row;
      setRows([...nextRows]);
      setProgress((prev) => ({
        completed: Math.min(prev.completed + 1, prev.total),
        total: prev.total,
      }));
    };

    for (const [index, row] of rows.entries()) {
      if (isElectron) {
        if (!row.normalizedPath) {
          updateRow(index, {
            ...row,
            status: "missing",
            message: "Missing file path.",
          });
          continue;
        }

        const readResult = (await ipc.invoke("files:read", {
          baseFolder,
          relativePath: row.normalizedPath,
        })) as {
          success: boolean;
          result?: { base64: string; name: string };
          error?: string;
        };

        if (!readResult.success || !readResult.result) {
          updateRow(index, {
            ...row,
            status: "missing",
            message: readResult.error || "File not found.",
          });
          continue;
        }

        const file = base64ToFile(
          readResult.result.base64,
          readResult.result.name,
        );
        const newFileName = buildFileName(row.title, file.name);
        const result = await uploadFileToGarage(file, newFileName);
        if (result.success) {
          updateRow(index, {
            ...row,
            status: "uploaded",
            message: newFileName,
          });
        } else {
          updateRow(index, {
            ...row,
            status: "error",
            message: result.error || "Upload failed",
          });
        }
      } else {
        const file = row.filePath
          ? findFileForRow(fileIndex, row.filePath)
          : null;
        if (!file) {
          updateRow(index, {
            ...row,
            status: "missing",
            message: "File not found in selected files.",
          });
          continue;
        }

        const newFileName = buildFileName(row.title, file.name);
        const result = await uploadFileToGarage(file, newFileName);
        if (result.success) {
          updateRow(index, {
            ...row,
            status: "uploaded",
            message: newFileName,
          });
        } else {
          updateRow(index, {
            ...row,
            status: "error",
            message: result.error || "Upload failed",
          });
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isElectron || !baseFolder || rows.length === 0) return;
    const refresh = async () => {
      const updated = await updateElectronExistence(rows);
      setRows(updated);
    };
    void refresh();
  }, [isElectron, baseFolder]);

  const successCount = rows.filter((row) => row.status === "uploaded").length;
  const missingCount = rows.filter((row) => row.status === "missing").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Excel File Upload Tester</h1>
            <p className="text-sm text-gray-600">
              Excel headers required: Title, File
            </p>
          </div>
          <button
            type="button"
            onClick={handleUploadAll}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Uploading..." : "Upload All"}
          </button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelChange}
              className="block w-full text-sm text-gray-600"
            />
          </div>

          {isElectron ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Folder
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectBaseFolder}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Select Base Folder
                </button>
                <span className="text-xs text-gray-500">
                  {baseFolder || "No folder selected"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Excel paths are resolved relative to the selected base folder.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Files Folder
              </label>
              <input
                type="file"
                multiple
                {...({
                  webkitdirectory: "true",
                } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={handleFilesChange}
                className="block w-full text-sm text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Select the base folder that contains the files referenced by the
                Excel file. Excel paths can be relative to this folder.
                {fileIndex.baseFolder
                  ? ` Detected base folder: ${fileIndex.baseFolder}`
                  : ""}
              </p>
            </div>
          )}

          {message && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {message}
            </div>
          )}

          <div className="text-sm text-gray-600">
            <span>Rows: {rows.length}</span>
            <span className="mx-2">|</span>
            <span>Uploaded: {successCount}</span>
            <span className="mx-2">|</span>
            <span>Missing: {missingCount}</span>
            <span className="mx-2">|</span>
            <span>Errors: {errorCount}</span>
            {progress.total > 0 && (
              <>
                <span className="mx-2">|</span>
                <span>
                  Progress: {progress.completed}/{progress.total}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Preview</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">No rows loaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.filePath}-${index}`} className="border-b">
                      <td className="px-3 py-2">{row.title || "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.filePath || "-"}
                      </td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {row.message || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
