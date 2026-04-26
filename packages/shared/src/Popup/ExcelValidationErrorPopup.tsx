"use client";

import { AlertTriangle, Download } from "lucide-react";
import { useState } from "react";
import ModalBase from "./ModalBase";

export type DuplicateHandlingMode = "create" | "overwrite";

export type ExcelValidationErrorPopupProps = {
  errorCount: number;
  duplicateCount: number;
  inFileDuplicateCount: number;
  validCount: number;
  totalCount: number;
  failedExcel?: { fileName: string; base64: string };
  duplicateKeys?: string[];
  inFileDuplicateKeys?: string[];
  onContinue: (mode: DuplicateHandlingMode) => void;
  onCancel: () => void;
};

const ExcelValidationErrorPopup = ({
  errorCount,
  duplicateCount,
  inFileDuplicateCount,
  validCount,
  totalCount,
  failedExcel,
  duplicateKeys,
  inFileDuplicateKeys,
  onContinue,
  onCancel,
}: ExcelValidationErrorPopupProps) => {
  const [duplicateMode, setDuplicateMode] = useState<DuplicateHandlingMode | null>(null);

  const downloadFailedRows = () => {
    if (!failedExcel) return;

    const binaryString = atob(failedExcel.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = failedExcel.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasDbDuplicates = duplicateCount > 0;
  const hasInFileDuplicates = inFileDuplicateCount > 0;
  const hasValidationErrors = errorCount - inFileDuplicateCount > 0;

  const title = hasDbDuplicates
    ? "Duplicate Case Numbers Found"
    : hasInFileDuplicates
      ? "In-File Duplicates Found"
      : "Validation Issues";

  const canContinue = !hasDbDuplicates || duplicateMode !== null;

  return (
    <ModalBase onClose={onCancel}>
      <div className="bg-base-100 border border-warning/30 shadow-xl rounded-2xl px-6 py-5 max-w-lg w-full text-base-content">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning/10 text-warning">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-warning uppercase tracking-[0.18em]">
              {title}
            </p>
          </div>

          {/* Summary Stats */}
          <div className="bg-base-200/50 rounded-lg p-4 space-y-1.5 text-sm">
            <p className="text-base-content/70">
              <span className="font-semibold text-base-content">{validCount}</span>{" "}
              of{" "}
              <span className="font-semibold text-base-content">{totalCount}</span>{" "}
              rows validated
            </p>
            {hasValidationErrors && (
              <p className="text-base-content/70">
                <span className="font-semibold text-error">
                  {errorCount - inFileDuplicateCount}
                </span>{" "}
                row(s) with validation errors
              </p>
            )}
            {hasInFileDuplicates && (
              <p className="text-base-content/70">
                <span className="font-semibold text-warning">{inFileDuplicateCount}</span>{" "}
                row(s) with duplicate case numbers within the file
              </p>
            )}
            {hasDbDuplicates && (
              <p className="text-base-content/70">
                <span className="font-semibold text-warning">{duplicateCount}</span>{" "}
                row(s) matching existing database records
              </p>
            )}
          </div>

          {/* Failed Excel Download */}
          {failedExcel && (
            <button
              onClick={downloadFailedRows}
              className="btn btn-sm btn-outline gap-2 w-full"
            >
              <Download className="w-4 h-4" />
              Download Failed Rows
            </button>
          )}

          {/* In-file duplicates info */}
          {hasInFileDuplicates && (
            <div className="bg-base-200/50 rounded-lg p-3 text-sm space-y-1.5">
              <p className="font-semibold text-base-content/80">
                In-file duplicates (will be skipped):
              </p>
              <p className="text-base-content/60 text-xs">
                These rows share a case number with another row in the same file. They cannot be imported and will be excluded regardless.
              </p>
              {inFileDuplicateKeys && inFileDuplicateKeys.length <= 5 && (
                <ul className="space-y-0.5 text-base-content/60 text-xs pt-1">
                  {inFileDuplicateKeys.map((key) => (
                    <li key={key}>• {key}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* DB duplicates handling */}
          {hasDbDuplicates && (
            <div className="bg-base-200/50 rounded-lg p-3 text-sm space-y-3">
              <div>
                <p className="font-semibold text-base-content/80 mb-0.5">
                  Database duplicates — choose how to handle:
                </p>
                {duplicateKeys && duplicateKeys.length <= 5 && (
                  <ul className="space-y-0.5 text-base-content/60 text-xs mb-2">
                    {duplicateKeys.map((key) => (
                      <li key={key}>• {key}</li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="duplicateMode"
                  className="radio radio-sm mt-0.5"
                  checked={duplicateMode === "create"}
                  onChange={() => setDuplicateMode("create")}
                />
                <div>
                  <p className="text-sm font-medium text-base-content">
                    Create duplicate records
                  </p>
                  <p className="text-xs text-base-content/60">
                    Insert as new records alongside the existing ones.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="duplicateMode"
                  className="radio radio-sm mt-0.5"
                  checked={duplicateMode === "overwrite"}
                  onChange={() => setDuplicateMode("overwrite")}
                />
                <div>
                  <p className="text-sm font-medium text-base-content">
                    Overwrite existing records
                  </p>
                  <p className="text-xs text-base-content/60">
                    Delete the existing records and replace them with the imported data.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button onClick={onCancel} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={() => onContinue(duplicateMode ?? "create")}
              disabled={!canContinue}
              className="btn btn-primary flex-1"
            >
              Continue Import
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default ExcelValidationErrorPopup;
