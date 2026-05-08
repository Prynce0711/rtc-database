"use client";

import { useSession } from "@/app/lib/authClient";
import { RadioButton, RedirectingUI } from "@rtc-database/shared";
import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiDownload, FiFileText } from "react-icons/fi";
import * as XLSX from "xlsx";
import { getLiveMonthlyCaseStatistics } from "./MonthlyActions";
import type { MonthlyRow } from "./Schema";

import MonthlyTable from "./MonthlyTable";
// import MonthlyToolbar from "./MonthlyToolbar";

type MonthlyCategoryView =
  | "Cases Disposed"
  | "New Cases Filed"
  | "Pending Cases";

const categoryViews: {
  label: string;
  value: MonthlyCategoryView;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    label: "New Cases Filed",
    value: "New Cases Filed",
    description: "Newly filed case statistics",
    icon: FiFileText,
  },
  {
    label: "Cases Disposed",
    value: "Cases Disposed",
    description: "Disposed case statistics",
    icon: FiFileText,
  },
  {
    label: "Pending Cases",
    value: "Pending Cases",
    description: "Pending case statistics",
    icon: FiFileText,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MonthlyPage() {
  const session = useSession();

  // const [selectedMonth, setSelectedMonth] = useState(
  //   new Date().toISOString().slice(0, 7),
  // );

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0"),
  );

  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const selectedDate = `${selectedYear}-${selectedMonth}`;
  const isSelectedDateValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedDate);

  const [search] = useState("");
  const [activeCategoryView, setActiveCategoryView] =
    useState<MonthlyCategoryView>("New Cases Filed");
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  /* ---- Calculate from live cases whenever selectedMonth changes ---- */

  useEffect(() => {
    if (!isSelectedDateValid) {
      return;
    }

    let cancelled = false;

    getLiveMonthlyCaseStatistics(selectedDate).then((res) => {
      if (!cancelled) {
        setMonthlyData(res.success ? res.result : []);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isSelectedDateValid, selectedDate]);

  const selectedMonthData = useMemo(
    () =>
      isSelectedDateValid
        ? monthlyData.filter((r) => r.month === selectedDate)
        : [],
    [isSelectedDateValid, monthlyData, selectedDate],
  );

  /* ---------- derived ---------- */

  const byCategory = selectedMonthData.filter(
    (r) => r.category === activeCategoryView,
  );
  const filteredData = !search.trim()
    ? byCategory
    : byCategory.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.category.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q) ||
          String(r.criminal).includes(q) ||
          String(r.civil).includes(q) ||
          String(r.total).includes(q)
        );
      });

  const monthLabel = isSelectedDateValid
    ? new Date(selectedDate + "-01").toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Select a valid year";

  /* ---------- helpers ---------- */

  const handleExport = () => {
    if (filteredData.length === 0) return;

    const rows = filteredData.map((r) => ({
      Category: r.category,
      Branch: r.branch,
      Criminal: r.criminal,
      Civil: r.civil,
      Total: r.total,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, monthLabel);
    XLSX.writeFile(workbook, `Monthly-Report-${selectedDate}.xlsx`);
  };

  if (session.isPending) {
    return <RedirectingUI titleText="Loading monthly statistics..." />;
  }

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
                  <span>Statistics overview for </span>
                  <span className="font-bold text-base-content/80">
                    {monthLabel}
                  </span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="join">
                  {/* MONTH */}
                  <select
                    className="select select-bordered join-item w-44"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {[
                      { value: "01", label: "January" },
                      { value: "02", label: "February" },
                      { value: "03", label: "March" },
                      { value: "04", label: "April" },
                      { value: "05", label: "May" },
                      { value: "06", label: "June" },
                      { value: "07", label: "July" },
                      { value: "08", label: "August" },
                      { value: "09", label: "September" },
                      { value: "10", label: "October" },
                      { value: "11", label: "November" },
                      { value: "12", label: "December" },
                    ].map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  {/* YEAR */}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="input input-bordered join-item w-28"
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                  />
                </div>

                <div className="flex items-center gap-2 flex-nowrap">
                  <button
                    className="btn btn-outline btn-info btn-md gap-2"
                    onClick={handleExport}
                    disabled={!isSelectedDateValid || filteredData.length === 0}
                  >
                    <FiDownload className="h-5 w-5" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
      </header>

      {/* ── CATEGORY VIEW SELECTOR ── */}
      <div className="flex justify-start overflow-x-auto pb-1">
        <RadioButton
          options={categoryViews}
          value={activeCategoryView}
          onChange={setActiveCategoryView}
        />
      </div>

      {/* ── TOOLBAR ── */}
      {/* <MonthlyToolbar
        search={search}
        onSearchChange={setSearch}
        rowCount={filteredData.length}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onConfirmSelection={canManageStats ? confirmSelection : undefined}
        onCancelSelection={canManageStats ? cancelSelection : undefined}
      /> */}

      {/* ── TABLE ── */}
      <MonthlyTable data={filteredData} />

      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Report generated for <span className="font-semibold">{monthLabel}</span>
      </p>
    </div>
  );
}
