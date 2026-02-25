"use client";

import { exportReceiveLogsExcel } from "@/app/components/Case/ReceivingLogs/ExcelActions";
import {
  deleteAllReceiveLogs,
  uploadReceiveExcel,
} from "@/app/test/TestActions";
import { useRef, useState } from "react";

export default function ExcelImportExportTester() {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setOutput("");

    try {
      const result = await uploadReceiveExcel(file);
      if (result.success && result.result) {
        const { rawData, mappedData, validationResults } = result.result;

        let output = `✓ Import successful! File: ${file.name}\n\n`;
        output += `═══════════════════════════════════════════════════════════════════════════════════════════════════════\n`;
        output += `📊 SUMMARY\n`;
        output += `═══════════════════════════════════════════════════════════════════════════════════════════════════════\n`;
        output += `Total Rows in Excel: ${rawData.length}\n`;
        output += `Valid Entries: ${validationResults.valid}/${validationResults.total}\n`;
        output += `Errors: ${validationResults.errors.length}\n\n`;

        if (validationResults.errors.length > 0) {
          output += `═══════════════════════════════════════════════════════════════════════════════════════════════════════\n`;
          output += `❌ VALIDATION ERRORS\n`;
          output += `═══════════════════════════════════════════════════════════════════════════════════════════════════════\n`;
          validationResults.errors.forEach(({ row, errors }) => {
            output += `Row ${row}: ${errors.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}\n`;
          });
          output += `\n`;
        }

        // Display first 5 rows with side-by-side comparison
        const displayCount = Math.min(5, rawData.length);
        for (let i = 0; i < displayCount; i++) {
          output += `\n═══════════════════════════════════════════════════════════════════════════════════════════════════════\n`;
          output += `ROW ${i + 1} - INPUT vs OUTPUT COMPARISON\n`;
          output += `═══════════════════════════════════════════════════════════════════════════════════════════════════════\n\n`;

          const raw = rawData[i];
          const mapped = mappedData[i];

          // Get all unique keys from both objects
          const allKeys = new Set([
            ...Object.keys(raw),
            ...Object.keys(mapped),
          ]);

          output += `${"EXCEL COLUMN".padEnd(25)} | ${"RAW VALUE".padEnd(35)} | ${"MAPPED FIELD".padEnd(25)} | MAPPED VALUE\n`;
          output += `${"-".repeat(25)}-+-${"-".repeat(35)}-+-${"-".repeat(25)}-+-${"-".repeat(30)}\n`;

          // Display raw data
          Object.keys(raw).forEach((key) => {
            const rawValue = String(raw[key] || "").substring(0, 33);
            output += `${key.padEnd(25)} | ${rawValue.padEnd(35)} | `;

            // Try to find corresponding mapped field
            const mappedKey = Object.keys(mapped).find((mk) => {
              const rawValStr = String(raw[key] || "").toLowerCase();
              const mappedValStr = String(mapped[mk] || "").toLowerCase();
              return (
                rawValStr === mappedValStr || mappedValStr.includes(rawValStr)
              );
            });

            if (mappedKey) {
              const mappedValue = String(mapped[mappedKey] || "").substring(
                0,
                28,
              );
              output += `${mappedKey.padEnd(25)} | ${mappedValue}\n`;
            } else {
              output += `${" ".repeat(25)} | [not mapped]\n`;
            }
          });

          output += `\n📄 FULL RAW DATA:\n${JSON.stringify(raw, null, 2)}\n`;
          output += `\n🔄 FULL MAPPED DATA:\n${JSON.stringify(mapped, null, 2)}\n`;

          // Show validation result for this row
          if (validationResults.receivingLogs[i]) {
            output += `\n✅ VALIDATED (Ready for Database):\n${JSON.stringify(validationResults.receivingLogs[i], null, 2)}\n`;
          } else {
            const error = validationResults.errors.find((e) => e.row === i + 2);
            if (error) {
              output += `\n❌ VALIDATION FAILED:\n`;
              error.errors.issues.forEach((issue) => {
                output += `  - ${issue.path.join(".")}: ${issue.message}\n`;
              });
            }
          }
        }

        setOutput(output);
      } else if (!result.success) {
        setOutput(`✗ Import failed:\n${result.error || "Unknown error"}`);
      }
    } catch (error) {
      setOutput(
        `✗ Error during import:\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setOutput("");

    try {
      const result = await exportReceiveLogsExcel();
      if (result.success) {
        const { fileName, base64 } = result.result!;

        // Create download link
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
        link.download = fileName;
        link.click();

        setOutput(
          `✓ Export successful!\nFile: ${fileName}\nSize: ${(base64.length * 0.75).toFixed(2)} KB`,
        );
      } else {
        setOutput(`✗ Export failed:\n${result.error}`);
      }
    } catch (error) {
      setOutput(
        `✗ Error during export:\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL receiving logs? This action cannot be undone!",
      )
    ) {
      return;
    }

    setLoading(true);
    setOutput("");

    try {
      const result = await deleteAllReceiveLogs();
      if (result.success) {
        setOutput("✓ All receiving logs have been deleted successfully!");
      } else {
        setOutput(`✗ Delete failed:\n${result.error}`);
      }
    } catch (error) {
      setOutput(
        `✗ Error during delete:\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-full mx-auto px-4">
        <div className="card bg-base-100 shadow-xl p-6">
          <h1 className="text-3xl font-bold mb-6 text-base-content">
            Excel Import/Export Tester
          </h1>

          <div className="space-y-4">
            {/* Import Section */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-lg">
                  Import Excel File
                </span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                disabled={loading}
                className="file-input file-input-bordered file-input-primary w-full"
              />
              <label className="label">
                <span className="label-text-alt">
                  Select an Excel file to import receiving logs
                </span>
              </label>
            </div>

            {/* Export Button */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-lg">
                  Export Excel File
                </span>
              </label>
              <button
                onClick={handleExport}
                disabled={loading}
                className="btn btn-success w-full"
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Processing...
                  </>
                ) : (
                  "Export Receiving Logs"
                )}
              </button>
              <label className="label">
                <span className="label-text-alt">
                  Export all receiving logs as Excel file
                </span>
              </label>
            </div>

            {/* Delete All Button */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-lg">
                  Delete All Data
                </span>
              </label>
              <button
                onClick={handleDeleteAll}
                disabled={loading}
                className="btn btn-error w-full"
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Processing...
                  </>
                ) : (
                  "Delete All Receiving Logs"
                )}
              </button>
              <label className="label">
                <span className="label-text-alt">
                  ⚠️ Warning: This will permanently delete all receiving logs
                  from the database
                </span>
              </label>
            </div>

            {/* Output Textarea */}
            <div className="divider">Results</div>
            <div className="form-control">
              <textarea
                value={output}
                readOnly
                rows={40}
                className="textarea textarea-bordered font-mono text-xs bg-base-200 leading-tight overflow-x-auto whitespace-pre"
                placeholder="Results will appear here..."
                style={{ minWidth: "100%" }}
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
