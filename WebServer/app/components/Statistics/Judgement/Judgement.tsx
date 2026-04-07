"use client";

import { useMemo, useRef, useState } from "react";
import { FiCalendar, FiDownload, FiFileText, FiPlus } from "react-icons/fi";
import * as XLSX from "xlsx";
import RadioButton from "../../Filter/RadioButton";
import JudgementMTC from "./JudgementMTC";
import JudgementRTC from "./JudgementRTC";

type JudgementView = "MTC" | "RTC";

const extractYear = (value: unknown): string | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return String(value.getFullYear());
  }

  const asString = String(value ?? "").trim();
  if (!asString) return null;

  const exactYear = asString.match(/^(19|20)\d{2}$/);
  if (exactYear) return exactYear[0];

  const isoYear = asString.match(/^(19|20)\d{2}/);
  if (isoYear) return isoYear[0];

  const genericYear = asString.match(/(19|20)\d{2}/);
  return genericYear ? genericYear[0] : null;
};

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
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [currentViewData, setCurrentViewData] = useState<
    Record<string, unknown>[]
  >([]);
  const [requestAdd, setRequestAdd] = useState(0);
  const [isChildActive, setIsChildActive] = useState(false);

  const handleSwitchView = (view: string) => {
    setActiveView(view as JudgementView);
    setTimeout(() => setRequestAdd((c) => c + 1), 0);
  };

  const exportDataRef = useRef<Record<string, unknown>[]>([]);
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear().toString();

    years.add(currentYear);
    years.add(selectedYear);

    for (const row of currentViewData) {
      const year = extractYear(row["dateRecorded"]);
      if (year) years.add(year);
    }

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [currentViewData, selectedYear]);

  const handleExport = () => {
    const data = exportDataRef.current.filter(
      (row) => extractYear(row["dateRecorded"]) === selectedYear,
    );
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
                    Judgment day statistics and reports for {selectedYear}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <select
                  className="select select-bordered select-md w-40"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-label="Year filter"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 flex-nowrap">
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
          onSelectedYearChange={setSelectedYear}
          requestAdd={requestAdd}
          onDataReady={(d) => {
            exportDataRef.current = d;
            setCurrentViewData(d);
          }}
          onActivePageChange={setIsChildActive}
          activeView={activeView}
          onSwitchView={handleSwitchView}
        />
      )}
      {activeView === "RTC" && (
        <JudgementRTC
          selectedYear={selectedYear}
          onSelectedYearChange={setSelectedYear}
          requestAdd={requestAdd}
          onDataReady={(d) => {
            exportDataRef.current = d;
            setCurrentViewData(d);
          }}
          onActivePageChange={setIsChildActive}
          activeView={activeView}
          onSwitchView={handleSwitchView}
        />
      )}
    </div>
  );
}
