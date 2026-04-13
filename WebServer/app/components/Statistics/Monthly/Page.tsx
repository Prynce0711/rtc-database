"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiDownload, FiFileText, FiPlus } from "react-icons/fi";
import * as XLSX from "xlsx";
import { RadioButton } from "@rtc-database/shared";
import {
  deleteMonthlyStatistic,
  getMonthlyStatistics,
  upsertMonthlyStatistics,
} from "./MonthlyActions";
import type { MonthlyRow } from "./Schema";

import AddReportPage from "./AddReportPage";

import MonthlyTable from "./MonthlyTable";
import MonthlyToolbar from "./MonthlyToolbar";
import ViewReportPage from "./ViewReportPage";

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
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [search, setSearch] = useState("");
  const [activeCategoryView, setActiveCategoryView] =
    useState<MonthlyCategoryView>("New Cases Filed");
  const [importedData, setImportedData] = useState<MonthlyRow[] | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [showViewPage, setShowViewPage] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allIds = filteredData.filter((r) => r.id != null).map((r) => r.id!);
    setSelectedIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  };

  const cancelSelection = () => {
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const confirmSelection = async () => {
    if (selectedIds.size === 0) return;

    if (selectionMode === "delete") {
      const confirmed = window.confirm(
        `Delete ${selectedIds.size} selected row(s)?`,
      );
      if (!confirmed) return;
      await Promise.all(
        Array.from(selectedIds).map((id) => deleteMonthlyStatistic(id)),
      );
      const fresh = await getMonthlyStatistics(selectedMonth);
      if (fresh.success) setImportedData(fresh.result);
    } else if (selectionMode === "edit") {
      const selected = filteredData.filter(
        (r) => r.id != null && selectedIds.has(r.id),
      );
      setEditMode(true);
      setShowAddPage(true);
      // Store selected data for AddReportPage — done via editMode + initialData filtering
      setImportedData(() => {
        // Keep only selected rows for edit context
        return selected;
      });
    }

    cancelSelection();
  };

  /* ---- Load from DB whenever selectedMonth changes ---- */
  useEffect(() => {
    getMonthlyStatistics(selectedMonth).then((res) => {
      if (res.success) setImportedData(res.result);
    });
  }, [selectedMonth]);

  const monthlyData = useMemo(() => {
    const all = importedData ?? [];
    return all.filter((r) => r.month === selectedMonth);
  }, [importedData, selectedMonth]);

  /* ---------- derived ---------- */

  const filteredData = useMemo(() => {
    let rows = monthlyData;
    rows = rows.filter((r) => r.category === activeCategoryView);
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
  }, [search, activeCategoryView, monthlyData]);

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

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
    XLSX.writeFile(workbook, `Monthly-Report-${selectedMonth}.xlsx`);
  };

  if (showAddPage) {
    return (
      <AddReportPage
        month={selectedMonth}
        initialCategory={activeCategoryView}
        initialData={editMode ? monthlyData : undefined}
        onBack={() => {
          setShowAddPage(false);
          setEditMode(false);
        }}
        onSave={async (newRows) => {
          const res = await upsertMonthlyStatistics(newRows);
          if (res.success) {
            const savedMonth = newRows[0]?.month ?? selectedMonth;
            const fresh = await getMonthlyStatistics(savedMonth);
            if (fresh.success) {
              setImportedData(fresh.result);
              setSelectedMonth(savedMonth);
            }
          } else {
            console.error("Save failed:", res.error);
          }
          setShowAddPage(false);
          setEditMode(false);
        }}
      />
    );
  }

  if (showViewPage) {
    return (
      <ViewReportPage
        data={filteredData}
        month={selectedMonth}
        onBack={() => setShowViewPage(false)}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── HEADER ── */}
      {!showAddPage && !showViewPage && (
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
                <input
                  type="month"
                  className="input input-bordered input-md w-66"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
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
                    onClick={() => setShowAddPage(true)}
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

      {/* ── CATEGORY VIEW SELECTOR ── */}
      <div className="flex justify-start overflow-x-auto pb-1">
        <RadioButton
          options={categoryViews}
          value={activeCategoryView}
          onChange={setActiveCategoryView}
        />
      </div>

      {/* ── TOOLBAR ── */}
      <MonthlyToolbar
        search={search}
        onSearchChange={setSearch}
        rowCount={filteredData.length}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onStartEdit={() => {
          if (filteredData.length > 0) {
            setSelectionMode("edit");
            setSelectedIds(new Set());
          }
        }}
        onStartDelete={() => {
          if (filteredData.length > 0) {
            setSelectionMode("delete");
            setSelectedIds(new Set());
          }
        }}
        onConfirmSelection={confirmSelection}
        onCancelSelection={cancelSelection}
      />

      {/* ── TABLE ── */}
      <MonthlyTable
        data={filteredData}
        onViewData={selectionMode ? undefined : () => setShowViewPage(true)}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
      />

      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Report generated for <span className="font-semibold">{monthLabel}</span>
      </p>
    </div>
  );
}
