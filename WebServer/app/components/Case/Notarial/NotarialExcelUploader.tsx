"use client";

import { createNotarial } from "@/app/components/Case/Notarial/NotarialActions";
import { NotarialSchema as NotarialExcelSchema } from "@/app/components/Case/Notarial/schema";
import { isMappedRowEmpty, normalizeRowBySchema } from "@/app/lib/excel";
import { IPC_CHANNELS, ModalBase } from "@rtc-database/shared";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type UploadRow = {
  title: string;
  name: string;
  attorney: string;
  date: string;
  path: string;
  normalizedPath: string;
  status: "pending" | "uploaded" | "missing" | "error";
  message?: string;
};

type FileIndex = {
  byPath: Map<string, File>;
  byBaseName: Map<string, File[]>;
  baseFolder?: string;
};

type Props = {
  onUploadCompleted?: () => Promise<void> | void;
};

const normalizePath = (value: string) =>
  value
    .replace(/\\/g, "/")
    .replace(/^(?:\.\/)+/, "")
    .trim();

const getLastPathSegment = (value: string) => {
  const normalized = normalizePath(value).replace(/\/+$/, "");
  if (!normalized) return "";
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
};

const getPathCandidates = (
  normalizedPath: string,
  baseFolder?: string | null,
) => {
  const normalized = normalizePath(normalizedPath);
  if (!normalized) return [] as string[];

  const candidates = new Set<string>();
  candidates.add(normalized);

  const withoutLeadingSlash = normalized.replace(/^\/+/, "");
  if (withoutLeadingSlash) {
    candidates.add(withoutLeadingSlash);
  }

  if (withoutLeadingSlash.includes("/")) {
    candidates.add(withoutLeadingSlash.split("/").slice(1).join("/"));
  }

  const baseFolderName = getLastPathSegment(baseFolder ?? "");
  if (baseFolderName) {
    const prefix = `${baseFolderName}/`;
    if (withoutLeadingSlash.startsWith(prefix)) {
      candidates.add(withoutLeadingSlash.slice(prefix.length));
    }
  }

  return Array.from(candidates).filter(Boolean);
};

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

const base64ToFile = (base64: string, name: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name);
};

const getFolderFromExcelFile = (file: File): string | null => {
  const fileWithPath = file as File & { path?: string };
  const rawPath = fileWithPath.path;
  if (!rawPath || rawPath.toLowerCase().includes("fakepath")) {
    return null;
  }

  const normalized = rawPath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return null;
  }

  return normalized.slice(0, lastSlash);
};

export default function NotarialExcelUploader({ onUploadCompleted }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [excelRows, setExcelRows] = useState<UploadRow[]>([]);
  const [manualFiles, setManualFiles] = useState<Record<number, File>>({});
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [baseFolder, setBaseFolder] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelMessage, setExcelMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    success: 0,
  });

  const ipc = typeof window !== "undefined" ? window.ipcRenderer : undefined;
  const isElectron = !!ipc?.invoke;

  const fileIndex = useMemo(
    () => buildFileIndex(selectedFiles),
    [selectedFiles],
  );

  const excelUploadedCount = useMemo(
    () => excelRows.filter((row) => row.status === "uploaded").length,
    [excelRows],
  );
  const excelMissingCount = useMemo(
    () => excelRows.filter((row) => row.status === "missing").length,
    [excelRows],
  );
  const excelErrorCount = useMemo(
    () => excelRows.filter((row) => row.status === "error").length,
    [excelRows],
  );

  const progressPct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;
  const successPct =
    progress.completed > 0
      ? Math.round((progress.success / progress.completed) * 100)
      : 0;

  const setManualFileForRow = (index: number, file: File | null) => {
    setManualFiles((prev) => {
      if (!file) {
        const { [index]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [index]: file,
      };
    });

    setExcelRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index || row.status === "uploaded") return row;
        return {
          ...row,
          status: file ? "pending" : row.status,
          message: file ? "Manual file selected." : row.message,
        };
      }),
    );
  };

  useEffect(() => {
    if (isElectron || excelRows.length === 0) return;

    setExcelRows((prev) =>
      prev.map((row) => {
        if (row.status === "uploaded") return row;
        const file = row.path ? findFileForRow(fileIndex, row.path) : null;

        if (!row.path) {
          return {
            ...row,
            status: "missing" as const,
            message: "Missing file path.",
          };
        }

        return file
          ? {
              ...row,
              status: "pending" as const,
              message: "File found.",
            }
          : {
              ...row,
              status: "missing" as const,
              message: "File not found in selected files.",
            };
      }),
    );
  }, [excelRows.length, fileIndex, isElectron]);

  const updateElectronExistence = async (
    rows: UploadRow[],
    folderOverride?: string | null,
  ) => {
    const folderToUse = folderOverride ?? baseFolder;
    if (!folderToUse || !ipc?.invoke) return rows;

    const rowCandidates = rows.map((row) =>
      getPathCandidates(row.normalizedPath, folderToUse),
    );

    const relativePaths = Array.from(
      new Set(rowCandidates.flat().filter((pathValue) => pathValue)),
    );

    const existsMap = (await ipc.invoke(IPC_CHANNELS.FILES_CHECK_EXISTS, {
      baseFolder: folderToUse,
      relativePaths,
    })) as Record<string, boolean>;

    return rows.map((row): UploadRow => {
      if (row.status === "uploaded") return row;
      if (!row.normalizedPath) {
        return {
          ...row,
          status: "missing",
          message: "Missing file path.",
        };
      }

      const candidates = getPathCandidates(row.normalizedPath, folderToUse);
      const resolvedPath = candidates.find(
        (candidate) => !!existsMap[candidate],
      );
      const exists = !!resolvedPath;
      return {
        ...row,
        normalizedPath: resolvedPath ?? row.normalizedPath,
        status: exists ? "pending" : "missing",
        message: exists ? "File found." : "File not found in base folder.",
      };
    });
  };

  const handleExcelChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    const defaultBaseFolder = file ? getFolderFromExcelFile(file) : null;

    if (isElectron && defaultBaseFolder) {
      setBaseFolder(defaultBaseFolder);
    }

    setExcelFile(file);
    setExcelRows([]);
    setManualFiles({});
    setProgress({ completed: 0, total: 0, success: 0 });
    setExcelMessage(null);

    if (!file) return;

    try {
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
        .map((row) => {
          const mapped = normalizeRowBySchema(NotarialExcelSchema, row) as {
            title?: unknown;
            name?: unknown;
            attorney?: unknown;
            date?: unknown;
            path?: unknown;
          };

          if (isMappedRowEmpty(mapped)) {
            return null;
          }

          const dateValue = mapped.date;
          const normalizedDate =
            dateValue instanceof Date && !Number.isNaN(dateValue.getTime())
              ? dateValue.toISOString().split("T")[0]
              : typeof dateValue === "string"
                ? dateValue
                : "";

          const pathValue =
            typeof mapped.path === "string" ? mapped.path.trim() : "";

          return {
            title: typeof mapped.title === "string" ? mapped.title.trim() : "",
            name: typeof mapped.name === "string" ? mapped.name.trim() : "",
            attorney:
              typeof mapped.attorney === "string" ? mapped.attorney.trim() : "",
            date: normalizedDate,
            path: pathValue,
            normalizedPath: normalizePath(pathValue),
            status: "pending" as const,
            message: "Ready",
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const rowsWithExistence = isElectron
        ? await updateElectronExistence(parsedRows, defaultBaseFolder)
        : parsedRows;

      setExcelRows(rowsWithExistence);
      setExcelMessage({
        type: "success",
        text: `Loaded ${rowsWithExistence.length} row(s) from Excel.`,
      });
    } catch (error) {
      setExcelMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to parse Excel file.",
      });
    }
  };

  const handleSelectBaseFolder = async () => {
    if (!ipc?.invoke) return;
    const selected = (await ipc.invoke(
      IPC_CHANNELS.FILES_SELECT_BASE_FOLDER,
    )) as string | null;
    setBaseFolder(selected ?? null);
    setExcelMessage(null);
    if (!selected || excelRows.length === 0) return;
    setExcelRows(await updateElectronExistence(excelRows, selected));
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setExcelMessage(null);
  };

  const handleUploadExcelRows = async () => {
    if (!excelFile || excelRows.length === 0) {
      setExcelMessage({
        type: "error",
        text: "Load an Excel file first.",
      });
      return;
    }

    if (isElectron) {
      if (!baseFolder) {
        setExcelMessage({
          type: "error",
          text: "Select a base folder first.",
        });
        return;
      }
    } else if (selectedFiles.length === 0) {
      setExcelMessage({
        type: "error",
        text: "Select the files folder first.",
      });
      return;
    }

    const targets = excelRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.status !== "uploaded");

    if (targets.length === 0) {
      setExcelMessage({
        type: "success",
        text: "All rows are already uploaded.",
      });
      return;
    }

    setExcelLoading(true);
    setExcelMessage(null);
    setProgress({ completed: 0, total: targets.length, success: 0 });

    const nextRows = [...excelRows];
    let success = 0;
    let completed = 0;

    for (const { row, index } of targets) {
      let fileToUpload: File | null = null;

      if (!row.path) {
        const manualFile = manualFiles[index] ?? null;
        if (!manualFile) {
          nextRows[index] = {
            ...row,
            status: "missing",
            message: "Missing file path. Select a manual file.",
          };
          completed += 1;
          setExcelRows([...nextRows]);
          setProgress({ completed, total: targets.length, success });
          continue;
        }

        fileToUpload = manualFile;
      }

      if (!fileToUpload && isElectron) {
        const candidates = getPathCandidates(row.normalizedPath, baseFolder);
        let readResult:
          | {
              success: boolean;
              result?: { base64: string; name: string };
              error?: string;
            }
          | undefined;
        let resolvedPath: string | null = null;

        for (const candidate of candidates) {
          const attempt = (await ipc.invoke(IPC_CHANNELS.FILES_READ, {
            baseFolder,
            relativePath: candidate,
          })) as {
            success: boolean;
            result?: { base64: string; name: string };
            error?: string;
          };

          if (attempt.success && attempt.result) {
            readResult = attempt;
            resolvedPath = candidate;
            break;
          }

          if (!readResult) {
            readResult = attempt;
          }
        }

        if (!readResult?.success || !readResult.result) {
          nextRows[index] = {
            ...row,
            status: "missing",
            message: readResult?.error || "File not found.",
          };
          completed += 1;
          setExcelRows([...nextRows]);
          setProgress({ completed, total: targets.length, success });
          continue;
        }

        if (resolvedPath && resolvedPath !== row.normalizedPath) {
          nextRows[index] = {
            ...nextRows[index],
            normalizedPath: resolvedPath,
            status: "pending",
            message: "Resolved file path.",
          };
        }

        fileToUpload = base64ToFile(
          readResult.result.base64,
          readResult.result.name,
        );
      } else if (!fileToUpload) {
        fileToUpload = findFileForRow(fileIndex, row.path);
        if (!fileToUpload) {
          const manualFile = manualFiles[index] ?? null;
          if (manualFile) {
            fileToUpload = manualFile;
          }
        }

        if (!fileToUpload) {
          nextRows[index] = {
            ...row,
            status: "missing",
            message: row.path
              ? "File not found in selected files. Select a manual file."
              : "Select a manual file.",
          };
          completed += 1;
          setExcelRows([...nextRows]);
          setProgress({ completed, total: targets.length, success });
          continue;
        }
      }

      const payload: Record<string, unknown> = {
        title: row.title || null,
        name: row.name || null,
        attorney: row.attorney || null,
        date: row.date ? new Date(row.date) : null,
        path: row.path,
        file: fileToUpload,
      };

      const createResult = await createNotarial(payload);
      if (createResult.success) {
        success += 1;
        nextRows[index] = {
          ...row,
          status: "uploaded",
          message: `Uploaded as ID ${createResult.result.id}`,
        };
      } else {
        nextRows[index] = {
          ...row,
          status: "error",
          message: createResult.error || "Create failed.",
        };
      }

      completed += 1;
      setExcelRows([...nextRows]);
      setProgress({ completed, total: targets.length, success });
    }

    setExcelLoading(false);
    setExcelMessage({
      type: success === targets.length ? "success" : "error",
      text: `Finished ${completed}/${targets.length}. Success: ${success}, Failed: ${targets.length - success}.`,
    });

    if (onUploadCompleted) {
      await onUploadCompleted();
    }
  };

  return (
    <>
      <div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setIsModalOpen(true)}
        >
          Upload Notarial Excel
        </button>
      </div>

      {isModalOpen && (
        <ModalBase onClose={() => setIsModalOpen(false)}>
          <div className="w-[95vw] max-w-6xl rounded-2xl bg-base-100 p-6 shadow-2xl border border-base-300">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-base-300 pb-3">
                <h2 className="text-xl font-bold text-base-content">
                  Excel Upload (One By One)
                </h2>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </button>
              </div>

              {!isElectron ? (
                <div className="alert alert-warning text-sm">
                  Use the desktop app to upload Notarial Excel files.
                </div>
              ) : (
                <>
                  <div className="grid gap-6 lg:grid-cols-2 text-sm">
                    <div className="space-y-4">
                      <label className="form-control w-full">
                        <div className="label">
                          <span className="label-text font-semibold">
                            Excel File
                          </span>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleExcelChange}
                          className="file-input file-input-bordered w-full"
                        />
                      </label>

                      {isElectron ? (
                        <div className="card bg-base-200 border border-base-300">
                          <div className="card-body p-4 gap-3">
                            <p className="font-semibold">Base Folder</p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => void handleSelectBaseFolder()}
                                disabled={excelLoading}
                              >
                                Select Base Folder
                              </button>
                              <span className="text-xs text-base-content/70 truncate">
                                {baseFolder || "No folder selected"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="form-control w-full">
                          <div className="label">
                            <span className="label-text font-semibold">
                              Files Folder
                            </span>
                          </div>
                          <input
                            type="file"
                            multiple
                            {...({
                              webkitdirectory: "true",
                            } as React.InputHTMLAttributes<HTMLInputElement>)}
                            onChange={handleFilesChange}
                            className="file-input file-input-bordered w-full"
                          />
                          {fileIndex.baseFolder && (
                            <div className="label">
                              <span className="label-text-alt">
                                Detected base folder: {fileIndex.baseFolder}
                              </span>
                            </div>
                          )}
                        </label>
                      )}

                      <button
                        type="button"
                        className="btn btn-primary w-full"
                        onClick={() => void handleUploadExcelRows()}
                        disabled={excelLoading}
                      >
                        {excelLoading
                          ? "Uploading..."
                          : "Upload Excel Rows One By One"}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="card bg-base-200 border border-base-300">
                        <div className="card-body p-4 gap-3">
                          <div className="flex justify-between text-xs text-base-content/70">
                            <span>Progress</span>
                            <span>
                              {progress.completed}/{progress.total} (
                              {progressPct}%)
                            </span>
                          </div>
                          <progress
                            className="progress progress-info w-full"
                            value={progressPct}
                            max={100}
                          />

                          <div className="flex justify-between text-xs text-base-content/70">
                            <span>Success Rate</span>
                            <span>{successPct}%</span>
                          </div>
                          <progress
                            className="progress progress-success w-full"
                            value={successPct}
                            max={100}
                          />

                          <div className="flex flex-wrap gap-2 pt-1">
                            <span className="badge badge-neutral">
                              Rows {excelRows.length}
                            </span>
                            <span className="badge badge-success">
                              Uploaded {excelUploadedCount}
                            </span>
                            <span className="badge badge-warning">
                              Missing {excelMissingCount}
                            </span>
                            <span className="badge badge-error">
                              Errors {excelErrorCount}
                            </span>
                          </div>
                        </div>
                      </div>

                      {excelMessage && (
                        <div
                          className={`alert ${
                            excelMessage.type === "success"
                              ? "alert-success"
                              : "alert-error"
                          } text-sm`}
                        >
                          <span>{excelMessage.text}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 card bg-base-100 border border-base-300">
                    <div className="card-body p-4">
                      <h2 className="text-lg font-semibold">Excel Preview</h2>
                      {excelRows.length === 0 ? (
                        <p className="text-sm text-base-content/60">
                          No rows loaded yet.
                        </p>
                      ) : (
                        <div className="max-h-[45vh] overflow-auto rounded-box border border-base-300">
                          <table className="table table-zebra table-sm w-full">
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Name</th>
                                <th>Attorney</th>
                                <th>Date</th>
                                <th>Path</th>
                                <th>Status</th>
                                <th>Message</th>
                              </tr>
                            </thead>
                            <tbody>
                              {excelRows.map((row, index) => (
                                <tr
                                  key={`${row.path}-${index}`}
                                  className="align-top"
                                >
                                  <td>{row.title || "-"}</td>
                                  <td>{row.name || "-"}</td>
                                  <td>{row.attorney || "-"}</td>
                                  <td>{row.date || "-"}</td>
                                  <td className="font-mono text-xs">
                                    {row.path || "-"}
                                  </td>
                                  <td>
                                    <span
                                      className={`badge badge-sm capitalize ${
                                        row.status === "uploaded"
                                          ? "badge-success"
                                          : row.status === "missing"
                                            ? "badge-warning"
                                            : row.status === "error"
                                              ? "badge-error"
                                              : "badge-ghost"
                                      }`}
                                    >
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className="text-xs text-base-content/70">
                                    <div className="space-y-2">
                                      <div>{row.message || ""}</div>
                                      {(row.status === "missing" ||
                                        !row.path) &&
                                        row.status !== "uploaded" && (
                                          <input
                                            type="file"
                                            className="file-input file-input-bordered file-input-xs w-full max-w-xs"
                                            onChange={(event) =>
                                              setManualFileForRow(
                                                index,
                                                event.target.files?.[0] ?? null,
                                              )
                                            }
                                          />
                                        )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalBase>
      )}
    </>
  );
}
