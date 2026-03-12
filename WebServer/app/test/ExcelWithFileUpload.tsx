"use client";

import { uploadFileToGarage } from "@/app/lib/garageActions";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ExcelRow = {
  title: string;
  filePath: string;
  status: "pending" | "uploaded" | "missing" | "error";
  message?: string;
};

type FileIndex = {
  byPath: Map<string, File>;
  byBaseName: Map<string, File[]>;
};

const normalizePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\.(\/)/, "");

const buildFileIndex = (files: File[]): FileIndex => {
  const byPath = new Map<string, File>();
  const byBaseName = new Map<string, File[]>();

  files.forEach((file) => {
    const rawPath = file.webkitRelativePath || file.name;
    const normalized = normalizePath(rawPath);
    const baseName = normalized.split("/").pop() || normalized;

    byPath.set(normalized, file);
    const list = byBaseName.get(baseName) ?? [];
    list.push(file);
    byBaseName.set(baseName, list);
  });

  return { byPath, byBaseName };
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

export default function ExcelWithFileUpload() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        status: "pending" as const,
      }));

    setRows(parsedRows);
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

    if (selectedFiles.length === 0) {
      setMessage("Select the files folder or files to upload.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const nextRows: ExcelRow[] = [];

    for (const row of rows) {
      const file = row.filePath
        ? findFileForRow(fileIndex, row.filePath)
        : null;
      if (!file) {
        nextRows.push({
          ...row,
          status: "missing",
          message: "File not found in selected files.",
        });
        continue;
      }

      const newFileName = buildFileName(row.title, file.name);
      const result = await uploadFileToGarage(file, newFileName);
      if (result.success) {
        nextRows.push({
          ...row,
          status: "uploaded",
          message: newFileName,
        });
      } else {
        nextRows.push({
          ...row,
          status: "error",
          message: result.error || "Upload failed",
        });
      }
    }

    setRows(nextRows);
    setLoading(false);
  };

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
              Select the folder that contains the files referenced by the Excel
              file.
            </p>
          </div>

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
