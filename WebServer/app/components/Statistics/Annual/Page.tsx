"use client";

import { useRef, useState } from "react";
import {
  FiCalendar,
  FiDownload,
  FiFileText,
  FiGrid,
  FiPlus,
  FiUpload,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import Inventory from "./Inventory";
import MTC from "./MTC";
import RTC from "./RTC";

type AnnualView = "MTC" | "RTC" | "Inventory";

const views: {
  label: string;
  value: AnnualView;
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
  {
    label: "Inventory",
    value: "Inventory",
    description: "Court Document Inventory",
    icon: FiGrid,
  },
];

const COURT_EXPORT_HEADERS = [
  "Branch",
  "Pending Last Year",
  "Raffled/Added",
  "Disposed",
  "Pending Year Now",
  "% of Disposition",
];
const INVENTORY_EXPORT_HEADERS = [
  "Region",
  "Province",
  "Court",
  "City/Municipality",
  "Branch",
  "Civil/Small Claims Filed",
  "Criminal Cases Filed",
  "Civil/Small Claims Disposed",
  "Criminal Cases Disposed",
];

export default function AnnualPage() {
  const [activeView, setActiveView] = useState<AnnualView>("MTC");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [uploading, setUploading] = useState(false);
  const [requestAdd, setRequestAdd] = useState(0);
  const [isChildActive, setIsChildActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSwitchView = (view: string) => {
    setActiveView(view as AnnualView);
    // Delay so the new component mounts first, then trigger its add page
    setTimeout(() => setRequestAdd((c) => c + 1), 0);
  };

  // Holds data from the active child for export
  const exportDataRef = useRef<Record<string, unknown>[]>([]);

  const yearLabel = selectedYear;
  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const todayLabel = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const viewSubtitles: Record<AnnualView, string> = {
    MTC: "Municipal Trial Court — Track all received documents and case filings",
    RTC: "Regional Trial Court — Track all received documents and case filings",
    Inventory:
      "Court Document Inventory — Overview of document counts and status",
  };

  const handleExport = () => {
    const data = exportDataRef.current;
    if (!data || data.length === 0) return;

    let rows: Record<string, string | number>[];
    if (activeView === "Inventory") {
      rows = data.map((r) => ({
        Region: String(r.region ?? ""),
        Province: String(r.province ?? ""),
        Court: String(r.court ?? ""),
        "City/Municipality": String(r.cityMunicipality ?? ""),
        Branch: String(r.branch ?? ""),
        "Civil/Small Claims Filed": String(r.civilSmallClaimsFiled ?? ""),
        "Criminal Cases Filed": String(r.criminalCasesFiled ?? ""),
        "Civil/Small Claims Disposed": String(r.civilSmallClaimsDisposed ?? ""),
        "Criminal Cases Disposed": String(r.criminalCasesDisposed ?? ""),
      }));
    } else {
      rows = data.map((r) => ({
        Branch: String(r.branch ?? ""),
        "Pending Last Year": String(r.pendingLastYear ?? ""),
        "Raffled/Added": String(r.RaffledOrAdded ?? ""),
        Disposed: String(r.Disposed ?? ""),
        "Pending Year Now": String(r.pendingThisYear ?? ""),
        "% of Disposition": String(r.percentageOfDisposition ?? ""),
      }));
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const headers =
      activeView === "Inventory"
        ? INVENTORY_EXPORT_HEADERS
        : COURT_EXPORT_HEADERS;
    worksheet["!cols"] = headers.map((h) => ({
      wch: Math.max(h.length + 4, 16),
    }));
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `${activeView} ${yearLabel}`,
    );
    XLSX.writeFile(workbook, `Annual-${activeView}-Report-${yearLabel}.xlsx`);
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

  // Generate year options (10 years back, 2 years forward)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 13 }, (_, i) =>
    (currentYear - 10 + i).toString(),
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── HEADER ── */}
      {!isChildActive && (
        <header className="card bg-base-100 shadow-xl">
          <div className="card-body p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                  <span>Annual Reports</span>
                  <span className="text-base-content/30">/</span>
                  <span className="text-base-content/70 font-medium">
                    {activeView} Receiving Log
                  </span>
                </div>
                <h2 className="text-5xl font-bold text-base-content">
                  {views.find((v) => v.value === activeView)?.description ??
                    activeView}
                </h2>
                <p className="flex text-lg items-center gap-2 text-base text-base-content/50 mt-1.5">
                  <FiCalendar className="shrink-0 w-4 h-4" />
                  <span>
                    {viewSubtitles[activeView]} — {yearLabel} — {todayLabel}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                  <select
                    className="select select-bordered select-md w-72"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
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
        <div className="flex justify-start">
          <div className="inline-flex bg-base-200/60 rounded-xl p-1.5 gap-1 border border-base-300/40">
            {views.map(({ label, value, description, icon: Icon }) => {
              const isActive = activeView === value;
              return (
                <button
                  key={value}
                  onClick={() => setActiveView(value)}
                  className={`relative flex items-center gap-3 px-7 py-4 rounded-xl text-base font-bold transition-all duration-200 cursor-pointer select-none ${isActive ? "bg-primary text-primary-content shadow-md shadow-primary/25 scale-[1.02]" : "text-base-content/60 hover:text-base-content hover:bg-base-100/80"}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <div className="flex flex-col items-start leading-tight">
                    <span className="tracking-wide">{label}</span>
                    <span
                      className={`text-[11px] font-medium ${isActive ? "text-primary-content/70" : "text-base-content/40"}`}
                    >
                      {description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ACTIVE TABLE ── */}
      {activeView === "MTC" && (
        <MTC
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
        <RTC
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
      {activeView === "Inventory" && (
        <Inventory
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
