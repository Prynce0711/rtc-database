"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiDownload,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import type { SummaryRow } from "./Schema";
import SumAddReport from "./SumAddReport";
import {
  deleteSummaryStatistic,
  getSummaryStatistics,
  upsertSummaryStatistics,
} from "./SummaryActions";
import {
  SUMMARY_COURT_TYPES,
  SUMMARY_MONTH_OPTIONS,
  type SummaryCourtType,
} from "./SummaryConstants";

type SelectionMode = "delete" | null;

const CURRENT_DATE = new Date();
const CURRENT_YEAR = String(CURRENT_DATE.getFullYear());
const CURRENT_MONTH = String(CURRENT_DATE.getMonth() + 1).padStart(2, "0");

const toMonthLabel = (year: string, month: string): string =>
  new Date(`${year}-${month}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const isYearPart = (value: string): boolean => /^\d{4}$/.test(value);

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseBranchNumber = (branch: string): number | null => {
  const match = branch.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const compareBranchLabel = (left: string, right: string): number => {
  const leftNumber = parseBranchNumber(left);
  const rightNumber = parseBranchNumber(right);

  if (
    leftNumber !== null &&
    rightNumber !== null &&
    leftNumber !== rightNumber
  ) {
    return leftNumber - rightNumber;
  }

  if (leftNumber !== null && rightNumber === null) return -1;
  if (leftNumber === null && rightNumber !== null) return 1;

  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const TOTAL_FIELDS: Array<
  Exclude<
    keyof SummaryRow,
    "id" | "courtType" | "reportYear" | "raffleDate" | "branch"
  >
> = [
  "civilFamily",
  "civilOrdinary",
  "civilReceivedViaReraffled",
  "civilUnloaded",
  "lrcPetition",
  "lrcSpProc",
  "lrcReceivedViaReraffled",
  "lrcUnloaded",
  "criminalFamily",
  "criminalDrugs",
  "criminalOrdinary",
  "criminalReceivedViaReraffled",
  "criminalUnloaded",
  "total",
];

export default function SummaryPage() {
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [search, setSearch] = useState("");
  const [activeCourtType, setActiveCourtType] = useState<SummaryCourtType>(
    SUMMARY_COURT_TYPES[0]?.value ?? "STATUTORY FAMILY COURTS",
  );

  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showAddPage, setShowAddPage] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const effectiveYear = isYearPart(selectedYear) ? selectedYear : CURRENT_YEAR;
  const activeMonthKey = `${effectiveYear}-${selectedMonth}`;
  const monthLabel = toMonthLabel(effectiveYear, selectedMonth);

  const yearOptions = useMemo(() => {
    const years = new Set<string>([CURRENT_YEAR, effectiveYear]);
    summaryData.forEach((row) => years.add(String(row.reportYear)));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [summaryData, effectiveYear]);

  const reloadData = async (
    month: string = selectedMonth,
    year: string = effectiveYear,
  ) => {
    setLoading(true);
    setErrorMessage(null);
    const result = await getSummaryStatistics(month, Number(year));
    if (result.success) {
      setSummaryData(result.result);
    } else {
      setErrorMessage(result.error ?? "Failed to load summary statistics");
    }
    setLoading(false);
  };

  useEffect(() => {
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, effectiveYear]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return summaryData
      .filter((row) => {
        if (row.courtType !== activeCourtType) return false;
        if (!row.raffleDate.startsWith(activeMonthKey)) return false;

        if (!q) return true;

        return (
          row.branch.toLowerCase().includes(q) ||
          row.raffleDate.toLowerCase().includes(q) ||
          String(row.total).includes(q) ||
          String(row.civilFamily).includes(q) ||
          String(row.criminalFamily).includes(q)
        );
      })
      .sort(
        (left, right) =>
          compareBranchLabel(left.branch, right.branch) ||
          left.raffleDate.localeCompare(right.raffleDate) ||
          (left.id ?? Number.MAX_SAFE_INTEGER) -
            (right.id ?? Number.MAX_SAFE_INTEGER),
      );
  }, [summaryData, activeCourtType, activeMonthKey, search]);

  const totals = useMemo(() => {
    const aggregate = Object.fromEntries(
      TOTAL_FIELDS.map((field) => [field, 0]),
    ) as Record<(typeof TOTAL_FIELDS)[number], number>;

    filteredData.forEach((row) => {
      TOTAL_FIELDS.forEach((field) => {
        aggregate[field] += toNumber(row[field]);
      });
    });

    return aggregate;
  }, [filteredData]);

  const allSelected =
    selectionMode === "delete" &&
    filteredData.length > 0 &&
    filteredData.every((row) => row.id != null && selectedIds.has(row.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = filteredData
      .map((row) => row.id)
      .filter((id): id is number => id != null);
    setSelectedIds((previous) => {
      const all = ids.every((id) => previous.has(id));
      return all ? new Set<number>() : new Set(ids);
    });
  };

  const cancelSelection = () => {
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const confirmDelete = async () => {
    if (selectionMode !== "delete" || selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected row${selectedIds.size !== 1 ? "s" : ""}?`,
    );
    if (!confirmed) return;

    await Promise.all(
      Array.from(selectedIds).map((id) => deleteSummaryStatistic(id)),
    );

    cancelSelection();
    await reloadData();
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;

    const rows = filteredData.map((row) => ({
      "Court Type": row.courtType,
      "Report Year": row.reportYear,
      Branch: row.branch,
      "Raffle Date": row.raffleDate,
      "Civil Family": row.civilFamily,
      "Civil Ordinary": row.civilOrdinary,
      "Civil Rec'd Via Re-Raffled": row.civilReceivedViaReraffled,
      "Civil UN Loaded": row.civilUnloaded,
      "LRC Petition": row.lrcPetition,
      "LRC SP. PROC.": row.lrcSpProc,
      "LRC Rec'd Via Re-Raffled": row.lrcReceivedViaReraffled,
      "LRC UN Loaded": row.lrcUnloaded,
      "Criminal Family": row.criminalFamily,
      "Criminal Drugs": row.criminalDrugs,
      "Criminal Ordinary": row.criminalOrdinary,
      "Criminal Rec'd Via Re-Raffled": row.criminalReceivedViaReraffled,
      "Criminal UN Loaded": row.criminalUnloaded,
      Total: row.total,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `${activeCourtType.slice(0, 18)}-${selectedMonth}`,
    );
    XLSX.writeFile(
      workbook,
      `Summary-${activeCourtType}-${effectiveYear}-${selectedMonth}.xlsx`,
    );
  };

  if (showAddPage) {
    return (
      <SumAddReport
        month={selectedMonth}
        year={effectiveYear}
        initialCourtType={activeCourtType}
        initialData={summaryData}
        onBack={() => {
          setShowAddPage(false);
        }}
        onSave={async (rows, context) => {
          const result = await upsertSummaryStatistics(rows);
          if (!result.success) {
            throw new Error(
              result.error ?? "Failed to save summary statistics",
            );
          }

          setSelectedMonth(context.month);
          setSelectedYear(context.year);
          setActiveCourtType(context.courtType);
          setSelectionMode(null);
          setSelectedIds(new Set());

          await reloadData(context.month, context.year);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                Summary Reports
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                <FiCalendar className="shrink-0" />
                <span>Statistics overview for {monthLabel}</span>
              </p>
              {errorMessage && (
                <p className="mt-2 text-sm font-medium text-error">
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="join">
                <select
                  className="select select-bordered join-item w-44"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                >
                  {SUMMARY_MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  list="summary-year-page-options"
                  className="input input-bordered join-item w-28"
                  value={selectedYear}
                  onChange={(event) =>
                    setSelectedYear(
                      event.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  placeholder={CURRENT_YEAR}
                />
                <datalist id="summary-year-page-options">
                  {yearOptions.map((yearOption) => (
                    <option key={yearOption} value={yearOption}>
                      {yearOption}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="flex items-center gap-2 flex-nowrap">
                <button
                  className="btn btn-outline btn-info btn-md gap-2"
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
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

      <div className="card bg-base-100 border border-base-200">
        <div className="card-body p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {SUMMARY_COURT_TYPES.map((courtType) => {
              const active = courtType.value === activeCourtType;
              return (
                <button
                  key={courtType.value}
                  className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => {
                    setActiveCourtType(courtType.value);
                    setSelectionMode(null);
                    setSelectedIds(new Set());
                  }}
                  title={courtType.description}
                >
                  {courtType.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
          <input
            type="text"
            placeholder="Search branch, date, totals..."
            className="input input-bordered w-full pl-11"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={selectionMode !== null}
          />
        </div>

        {selectionMode === "delete" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/40 tabular-nums">
              {selectedIds.size} selected
            </span>
            <button
              className="btn btn-error btn-md gap-2"
              disabled={selectedIds.size === 0}
              onClick={confirmDelete}
            >
              <FiTrash2 className="h-4 w-4" />
              Apply Delete
            </button>
            <button className="btn btn-ghost btn-md" onClick={cancelSelection}>
              <FiX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            className="btn btn-outline btn-md gap-2 text-error hover:bg-error/10"
            onClick={() => {
              setSelectionMode("delete");
              setSelectedIds(new Set());
            }}
            disabled={filteredData.length === 0}
          >
            <FiTrash2 className="h-4 w-4" />
            Delete Rows
          </button>
        )}

        <span className="ml-auto text-sm text-base-content/50 tabular-nums font-medium">
          {filteredData.length} row{filteredData.length !== 1 && "s"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
        <table className="table table-xs sm:table-sm w-max min-w-full">
          <thead>
            <tr className="bg-base-200/70">
              {selectionMode === "delete" && (
                <th rowSpan={2} className="text-center align-middle">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th rowSpan={2} className="text-center align-middle">
                #
              </th>
              <th rowSpan={2} className="text-center align-middle">
                Branch
              </th>
              <th rowSpan={2} className="text-center align-middle">
                Raffle Date
              </th>
              <th colSpan={4} className="text-center text-primary">
                Civil
              </th>
              <th colSpan={4} className="text-center text-info">
                LRC / PET. / SPC.
              </th>
              <th colSpan={5} className="text-center text-success">
                Criminal
              </th>
              <th rowSpan={2} className="text-center align-middle text-warning">
                Total
              </th>
            </tr>
            <tr className="bg-base-200/40">
              <th className="text-center">Family</th>
              <th className="text-center">Ordinary</th>
              <th className="text-center">Rec&apos;d Via Re-Raffled</th>
              <th className="text-center">UN Loaded</th>
              <th className="text-center">Petition</th>
              <th className="text-center">SP. PROC.</th>
              <th className="text-center">Rec&apos;d Via Re-Raffled</th>
              <th className="text-center">UN Loaded</th>
              <th className="text-center">Family</th>
              <th className="text-center">Drugs</th>
              <th className="text-center">Ordinary</th>
              <th className="text-center">Rec&apos;d Via Re-Raffled</th>
              <th className="text-center">UN Loaded</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={selectionMode === "delete" ? 19 : 18}
                  className="py-12 text-center text-base-content/50"
                >
                  Loading summary statistics...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={selectionMode === "delete" ? 19 : 18}
                  className="py-12 text-center text-base-content/45"
                >
                  No rows for {activeCourtType} in {monthLabel}.
                </td>
              </tr>
            ) : (
              filteredData.map((row, index) => (
                <tr
                  key={
                    row.id ?? `${row.courtType}-${row.branch}-${row.raffleDate}`
                  }
                >
                  {selectionMode === "delete" && (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-error"
                        checked={row.id != null && selectedIds.has(row.id)}
                        onChange={() => row.id != null && toggleSelect(row.id)}
                        disabled={row.id == null}
                      />
                    </td>
                  )}
                  <td className="text-center tabular-nums">{index + 1}</td>
                  <td className="font-medium">{row.branch}</td>
                  <td className="tabular-nums">{row.raffleDate}</td>
                  <td className="text-center tabular-nums">
                    {row.civilFamily.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.civilOrdinary.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.civilReceivedViaReraffled.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.civilUnloaded.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.lrcPetition.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.lrcSpProc.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.lrcReceivedViaReraffled.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.lrcUnloaded.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.criminalFamily.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.criminalDrugs.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.criminalOrdinary.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.criminalReceivedViaReraffled.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums">
                    {row.criminalUnloaded.toLocaleString()}
                  </td>
                  <td className="text-center tabular-nums font-bold">
                    {row.total.toLocaleString()}
                  </td>
                </tr>
              ))
            )}

            {filteredData.length > 0 && (
              <tr className="bg-primary/80 text-primary-content font-bold">
                <td
                  colSpan={selectionMode === "delete" ? 4 : 3}
                  className="uppercase tracking-wider"
                >
                  Grand Total
                </td>
                <td className="tabular-nums text-center">-</td>
                <td className="text-center tabular-nums">
                  {totals.civilFamily.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.civilOrdinary.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.civilReceivedViaReraffled.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.civilUnloaded.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.lrcPetition.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.lrcSpProc.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.lrcReceivedViaReraffled.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.lrcUnloaded.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.criminalFamily.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.criminalDrugs.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.criminalOrdinary.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.criminalReceivedViaReraffled.toLocaleString()}
                </td>
                <td className="text-center tabular-nums">
                  {totals.criminalUnloaded.toLocaleString()}
                </td>
                <td className="text-center tabular-nums text-lg">
                  {totals.total.toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
