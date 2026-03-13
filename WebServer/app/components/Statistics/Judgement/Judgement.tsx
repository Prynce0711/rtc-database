"use client";

import { useRef, useState } from "react";
import {
    FiCalendar,
    FiDownload,
    FiFileText,
    FiPlus,
    FiUpload,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import RadioButton from "../../Filter/RadioButton";
import JudgementMTC from "./JudgementMTC";
import JudgementRTC from "./JudgementRTC";

type JudgementView = "MTC" | "RTC";

const views: {
  label: string;
  value: JudgementView;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    label: "MTC",
    value: "MTC",
    description: "Municipal Trial Court",
    icon: FiFileText,
  },
  {
    label: "RTC",
    value: "RTC",
    description: "Regional Trial Court",
    icon: FiFileText,
  },
];

export default function Judgement() {
  const [activeView, setActiveView] = useState<JudgementView>("MTC");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [uploading, setUploading] = useState(false);
  const [requestAdd, setRequestAdd] = useState(0);
  const [isChildActive, setIsChildActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSwitchView = (view: string) => {
    setActiveView(view as JudgementView);
    setTimeout(() => setRequestAdd((c) => c + 1), 0);
  };

  const exportDataRef = useRef<Record<string, unknown>[]>([]);
  const selectedYear = selectedDate.slice(0, 4);
  const selectedDateLabel = new Date(selectedDate).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleExport = () => {
    const data = exportDataRef.current;
    if (!data || data.length === 0) return;

    const rows = data.map((r) => {
      const row: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(r)) {
        if (key !== "id") row[key] = String(value ?? "");
      }
      return row;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `${activeView} ${selectedYear}`,
    );
    XLSX.writeFile(
      workbook,
      `Judgement-${activeView}-Report-${selectedYear}.xlsx`,
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData =
        XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
      console.log("Imported data:", rawData);
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // yearOptions no longer needed — selection is by full date

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── HEADER ── */}
      {!isChildActive && (
        <header className="card bg-base-100 shadow-xl">
          <div className="card-body p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                  Judgment Day
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                  <FiCalendar className="shrink-0" />
                  <span>
                    Judgment day statistics and reports for {selectedDateLabel}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <input
                  type="date"
                  className="input input-bordered input-md w-72"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-nowrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImport}
                  />
                  <button
                    className={`btn btn-outline btn-info btn-md gap-2 ${uploading ? "loading" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <FiUpload className="h-5 w-5" />
                    {uploading ? "Importing..." : "Import"}
                  </button>
                  <button
                    className="btn btn-outline btn-info btn-md gap-2"
                    onClick={handleExport}
                  >
                    <FiDownload className="h-5 w-5" />
                    Export
                  </button>
                  <button
                    className="btn btn-success btn-md gap-2"
                    onClick={() => setRequestAdd((c) => c + 1)}
                  >
                    <FiPlus className="h-5 w-5" />
                    Add Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* ── VIEW SELECTOR — Segmented tabs ── */}
      {!isChildActive && (
        <div className="flex justify-start overflow-x-auto pb-1">
          <RadioButton
            options={views}
            value={activeView}
            onChange={setActiveView}
          />
        </div>
      )}

      {/* ── ACTIVE TABLE ── */}
      {activeView === "MTC" && (
        <JudgementMTC
          selectedYear={selectedYear}
          requestAdd={requestAdd}
          onDataReady={(d) => {
            exportDataRef.current = d;
          }}
          onActivePageChange={setIsChildActive}
          activeView={activeView}
          onSwitchView={handleSwitchView}
        />
      )}
      {activeView === "RTC" && (
        <JudgementRTC
          selectedYear={selectedYear}
          requestAdd={requestAdd}
          onDataReady={(d) => {
            exportDataRef.current = d;
          }}
          onActivePageChange={setIsChildActive}
          activeView={activeView}
          onSwitchView={handleSwitchView}
        />
      )}
    </div>
  );
}
