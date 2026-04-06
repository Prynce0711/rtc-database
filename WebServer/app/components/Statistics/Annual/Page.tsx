"use client";

import { useRef, useState } from "react";
import {
  FiCalendar,
  FiDownload,
  FiFileText,
  FiGrid,
  FiPlus,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import Inventory, { type InventoryCourtFilter } from "./Inventory";
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
  const [inventoryCourtFilter, setInventoryCourtFilter] =
    useState<InventoryCourtFilter>("RTC");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [requestAdd, setRequestAdd] = useState(0);
  const [isChildActive, setIsChildActive] = useState(false);

  const handleSwitchView = (view: string) => {
    setActiveView(view as AnnualView);
    // Delay so the new component mounts first, then trigger its add page
    setTimeout(() => setRequestAdd((c) => c + 1), 0);
  };

  // Holds data from the active child for export
  const exportDataRef = useRef<Record<string, unknown>[]>([]);

  const yearLabel = selectedYear;
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

  const inventoryFilterSubtitle =
    inventoryCourtFilter === "RTC"
      ? "Regional Trial Court"
      : "Municipal Trial Court";

  const activeSubtitle =
    activeView === "Inventory"
      ? `${viewSubtitles.Inventory} — ${inventoryFilterSubtitle}`
      : viewSubtitles[activeView];

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
                <p className="flex text-base items-center gap-2 text-base-content/50 mt-1.5">
                  <FiCalendar className="shrink-0 w-4 h-4" />
                  <span>
                    {activeSubtitle} — {yearLabel} — {todayLabel}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                  <select
                    className="select select-bordered select-md w-66"
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

      {/* ── VIEW SELECTOR — Segmented tabs with inventory submenu ── */}
      {!isChildActive && (
        <div className="flex justify-start pb-1 overflow-visible">
          <div className="relative flex p-1.5 rounded-full bg-base-200 border border-base-200 w-fit">
            {views.map((option) => {
              const Icon = option.icon;
              const isActive = activeView === option.value;
              const isInventoryOption = option.value === "Inventory";

              return (
                <div
                  key={option.value}
                  className={`relative ${isInventoryOption ? "group/inventory" : ""}`}
                >
                  <button
                    onClick={() => {
                      if (isInventoryOption) {
                        setActiveView("Inventory");
                        return;
                      }

                      setActiveView(option.value);
                    }}
                    className={[
                      "relative z-10 px-5 py-2.5 rounded-full text-[14px] font-bold transition-colors duration-150 flex items-center gap-2",
                      isActive
                        ? "bg-base-100 text-primary shadow-sm"
                        : "text-base-content/40 hover:text-base-content/70",
                    ].join(" ")}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                    <span className="text-left leading-tight">
                      <span className="block whitespace-nowrap">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="block text-[10px] font-medium opacity-70 whitespace-nowrap">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isInventoryOption && (
                      <span
                        className={[
                          "px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-4.5 text-center",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-base-300 text-base-content/40",
                        ].join(" ")}
                      >
                        {inventoryCourtFilter}
                      </span>
                    )}
                  </button>

                  {isInventoryOption && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 rounded-xl border border-base-300 bg-base-100 shadow-lg p-1 flex items-center gap-1 opacity-0 pointer-events-none -translate-y-1 transition-all duration-150 group-hover/inventory:opacity-100 group-hover/inventory:pointer-events-auto group-hover/inventory:translate-y-0 group-focus-within/inventory:opacity-100 group-focus-within/inventory:pointer-events-auto group-focus-within/inventory:translate-y-0">
                      {(["RTC", "MTC"] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={`btn btn-xs ${inventoryCourtFilter === filter ? "btn-primary" : "btn-outline"}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setInventoryCourtFilter(filter);
                            setActiveView("Inventory");
                          }}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
          courtFilter={inventoryCourtFilter}
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
