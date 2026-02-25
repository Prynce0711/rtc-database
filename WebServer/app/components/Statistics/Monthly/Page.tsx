"use client";

import { useMemo, useRef, useState } from "react";
import { FiCalendar, FiDownload, FiUpload } from "react-icons/fi";
import type { MonthlyRow } from "./types";

import MonthlyKPI from "./MonthlyKPI";
import MonthlyTable from "./MonthlyTable";
import MonthlyToolbar from "./MonthlyToolbar";
import { SAMPLE_DATA } from "./types";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MonthlyPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [importedData, setImportedData] = useState<MonthlyRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthlyData = importedData ?? SAMPLE_DATA;

  /* ---------- derived ---------- */

  const categories = useMemo(
    () => Array.from(new Set(monthlyData.map((r) => r.category))),
    [monthlyData],
  );

  const filteredData = useMemo(() => {
    let rows = monthlyData;
    if (categoryFilter !== "all") {
      rows = rows.filter((r) => r.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.category.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          String(r.criminal).includes(q) ||
          String(r.civil).includes(q) ||
          String(r.total).includes(q),
      );
    }
    return rows;
  }, [search, categoryFilter, monthlyData]);

  const kpi = useMemo(() => {
    const all = monthlyData;
    return {
      totalCriminal: all.reduce((s, r) => s + r.criminal, 0),
      totalCivil: all.reduce((s, r) => s + r.civil, 0),
      grandTotal: all.reduce((s, r) => s + r.total, 0),
      branches: new Set(all.map((r) => r.branch)).size,
    };
  }, [monthlyData]);

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  /* ---------- helpers ---------- */

  const handleExport = () => {
    // TODO: wire up real export
    console.log("Exporting to Excel…");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // TODO: wire up real import action
      // Example: const result = await uploadMonthlyExcel(file);
      // if (result.success) setImportedData(result.result);
      console.log("Importing file:", file.name);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── HEADER ── */}
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Monthly Reports
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                <FiCalendar className="shrink-0" />
                <span>Statistics overview for {monthLabel}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="month"
                className="input input-bordered input-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
              <button
                className={`btn btn-outline btn-sm gap-2 ${uploading ? "loading" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <FiUpload className="h-4 w-4" />
                {uploading ? "Importing..." : "Import"}
              </button>
              <button
                className="btn btn-primary btn-sm gap-2"
                onClick={handleExport}
              >
                <FiDownload className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── KPI CARDS ── */}
      <MonthlyKPI {...kpi} />

      {/* ── TOOLBAR ── */}
      <MonthlyToolbar
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={categories}
        rowCount={filteredData.length}
      />

      {/* ── TABLE ── */}
      <MonthlyTable data={filteredData} />

      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Report generated for <span className="font-semibold">{monthLabel}</span>
      </p>
    </div>
  );
}
