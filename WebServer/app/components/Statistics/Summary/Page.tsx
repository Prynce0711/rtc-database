"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { RadioButton, RedirectingUI } from "@rtc-database/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiDownload,
  FiFileText,
  FiGrid,
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
  const session = useSession();

  const canManageStats =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.STATISTICS;

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

  // ── Column resize logic ──────────────────────────────────────────────────
  const COL_KEYS = [
    "num",
    "branch",
    "raffleDate",
    "civilFamily",
    "civilOrdinary",
    "civilRecViaReraffle",
    "civilUnloaded",
    "lrcPetition",
    "lrcSpProc",
    "lrcRecViaReraffle",
    "lrcUnloaded",
    "crimFamily",
    "crimDrugs",
    "crimOrdinary",
    "crimRecViaReraffle",
    "crimUnloaded",
    "total",
  ] as const;

  const DEFAULT_WIDTHS: Record<string, number> = {
    num: 40,
    branch: 120,
    raffleDate: 100,
    civilFamily: 72,
    civilOrdinary: 72,
    civilRecViaReraffle: 110,
    civilUnloaded: 80,
    lrcPetition: 72,
    lrcSpProc: 80,
    lrcRecViaReraffle: 110,
    lrcUnloaded: 80,
    crimFamily: 72,
    crimDrugs: 72,
    crimOrdinary: 80,
    crimRecViaReraffle: 110,
    crimUnloaded: 80,
    total: 72,
  };

  const [colWidths, setColWidths] =
    useState<Record<string, number>>(DEFAULT_WIDTHS);
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const activeResize = useRef<{
    key: string;
    startX: number;
    startW: number;
  } | null>(null);

  const startResize = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = thRefs.current[key];
    if (!th) return;
    activeResize.current = {
      key,
      startX: e.clientX,
      startW: th.getBoundingClientRect().width,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const a = activeResize.current;
      if (!a) return;
      const next = Math.max(48, Math.round(a.startW + (e.clientX - a.startX)));
      const th = thRefs.current[a.key];
      if (th) th.style.width = `${next}px`;
    };
    const onUp = (e: MouseEvent) => {
      const a = activeResize.current;
      if (!a) return;
      const next = Math.max(48, Math.round(a.startW + (e.clientX - a.startX)));
      setColWidths((prev) => ({ ...prev, [a.key]: next }));
      activeResize.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const courtTypeSnapshot = useMemo(() => {
    const snapshot = new Map<SummaryCourtType, { rows: number; total: number }>(
      SUMMARY_COURT_TYPES.map((courtType) => [
        courtType.value,
        { rows: 0, total: 0 },
      ]),
    );

    summaryData.forEach((row) => {
      if (!row.raffleDate.startsWith(activeMonthKey)) return;

      const current = snapshot.get(row.courtType as SummaryCourtType);
      if (!current) return;

      current.rows += 1;
      current.total += toNumber(row.total);
    });

    return snapshot;
  }, [summaryData, activeMonthKey]);

  const courtTypeViews = useMemo(
    () =>
      SUMMARY_COURT_TYPES.map((courtType) => ({
        label: courtType.shortLabel,
        value: courtType.value,
        description: courtType.description,
        icon: FiFileText,
        count: courtTypeSnapshot.get(courtType.value)?.rows ?? 0,
      })),
    [courtTypeSnapshot],
  );

  const activeCourtSnapshot = courtTypeSnapshot.get(activeCourtType) ?? {
    rows: 0,
    total: 0,
  };

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

  if (session.isPending) {
    return <RedirectingUI titleText="Loading summary statistics..." />;
  }

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
      <header className="card border border-base-200 bg-gradient-to-br from-base-100 via-base-100 to-info/5 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="badge badge-outline badge-primary">
                Statistics / Summary
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-base-content sm:text-4xl lg:text-5xl">
                  Summary Reports
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium text-base-content/60 sm:text-base">
                  <FiCalendar className="shrink-0" />
                  <span>Statistics overview for {monthLabel}</span>
                </p>
              </div>
              {errorMessage && (
                <div
                  role="alert"
                  className="alert alert-error py-2 text-sm shadow-sm"
                >
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            <div className="w-full max-w-md space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-base-content/45">
                  Report Period
                </p>
                <div className="join w-full">
                  <select
                    className="select select-bordered join-item w-full"
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
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn btn-outline btn-info btn-md gap-2"
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                >
                  <FiDownload className="h-5 w-5" />
                  Export
                </button>
                {canManageStats && (
                  <button
                    className="btn btn-success btn-md gap-2"
                    onClick={() => setShowAddPage(true)}
                  >
                    <FiPlus className="h-5 w-5" />
                    Add Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="card border border-base-200 bg-base-100">
        <div className="card-body p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45">
                Court Type Scope
              </p>
              <h2 className="text-base font-bold text-base-content">
                Switch summary lens
              </h2>
            </div>
            <span className="badge badge-outline badge-neutral tabular-nums">
              {summaryData.length.toLocaleString()} period rows
            </span>
          </div>

          <div className="overflow-x-auto pb-1">
            <RadioButton
              options={courtTypeViews}
              value={activeCourtType}
              onChange={(value) => {
                setActiveCourtType(value);
                setSelectionMode(null);
                setSelectedIds(new Set());
              }}
              className="min-w-max"
            />
          </div>

          <div className="mt-3 rounded-xl border border-base-200 bg-base-100 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-base-content/60">
                Active scope
              </span>
              <span className="font-bold text-base-content">
                {activeCourtType}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-base-content/50">Rows in period</span>
              <span className="font-semibold tabular-nums text-base-content">
                {activeCourtSnapshot.rows.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-base-content/50">Total in scope</span>
              <span className="font-semibold tabular-nums text-base-content">
                {activeCourtSnapshot.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card border border-base-200 bg-base-100">
        <div className="card-body p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-xl text-base-content/40" />
              <input
                type="text"
                placeholder="Search branch, date, totals..."
                className="input input-bordered w-full pl-11 pr-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={selectionMode !== null}
              />
              {selectionMode === null && search.trim().length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {canManageStats &&
                (selectionMode === "delete" ? (
                  <>
                    <span className="badge badge-error badge-outline tabular-nums">
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
                    <button
                      className="btn btn-ghost btn-md gap-1"
                      onClick={cancelSelection}
                    >
                      <FiX className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
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
                ))}

              <span className="badge badge-neutral badge-outline tabular-nums">
                {filteredData.length} row{filteredData.length !== 1 && "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-base-200 bg-base-100 shadow-sm">
        <table
          className="table table-pin-rows table-xs w-max min-w-full sm:table-sm"
          style={{ tableLayout: "fixed" }}
        >
          <colgroup>
            {selectionMode === "delete" && <col style={{ width: 40 }} />}
            {COL_KEYS.map((key) => (
              <col key={key} style={{ width: colWidths[key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-base-200/80 text-[11px] uppercase tracking-wide text-base-content/70">
              {selectionMode === "delete" && (
                <th
                  rowSpan={2}
                  className="text-center align-middle"
                  style={{ width: 40 }}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th
                rowSpan={2}
                className="text-center align-middle overflow-hidden relative"
                style={{ width: colWidths["num"] }}
                ref={(n) => {
                  thRefs.current["num"] = n;
                }}
              >
                #
                <div
                  className="absolute right-0 top-0 h-full w-4 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "num")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
              <th
                rowSpan={2}
                className="text-center align-middle overflow-hidden relative"
                style={{ width: colWidths["branch"] }}
                ref={(n) => {
                  thRefs.current["branch"] = n;
                }}
              >
                Branch
                <div
                  className="absolute right-0 top-0 h-full w-4 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "branch")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
              <th
                rowSpan={2}
                className="text-center align-middle whitespace-nowrap overflow-hidden relative"
                style={{ width: colWidths["raffleDate"] }}
                ref={(n) => {
                  thRefs.current["raffleDate"] = n;
                }}
              >
                Raffle Date
                <div
                  className="absolute right-0 top-0 h-full w-4 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "raffleDate")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
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
              <th
                rowSpan={2}
                className="text-center align-middle text-warning overflow-hidden relative"
                style={{ width: colWidths["total"] }}
                ref={(n) => {
                  thRefs.current["total"] = n;
                }}
              >
                Total
                <div
                  className="absolute right-0 top-0 h-full w-4 cursor-col-resize hover:bg-primary/10"
                  onMouseDown={(e) => startResize(e, "total")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                </div>
              </th>
            </tr>
            <tr className="bg-base-200/50 text-[11px] uppercase tracking-wide text-base-content/65">
              {(
                [
                  "civilFamily",
                  "civilOrdinary",
                  "civilRecViaReraffle",
                  "civilUnloaded",
                  "lrcPetition",
                  "lrcSpProc",
                  "lrcRecViaReraffle",
                  "lrcUnloaded",
                  "crimFamily",
                  "crimDrugs",
                  "crimOrdinary",
                  "crimRecViaReraffle",
                  "crimUnloaded",
                ] as const
              ).map((key, i) => {
                const labels: Record<string, string> = {
                  civilFamily: "Family",
                  civilOrdinary: "Ordinary",
                  civilRecViaReraffle: "Rec'd Via Re-Raffled",
                  civilUnloaded: "UN Loaded",
                  lrcPetition: "Petition",
                  lrcSpProc: "SP. PROC.",
                  lrcRecViaReraffle: "Rec'd Via Re-Raffled",
                  lrcUnloaded: "UN Loaded",
                  crimFamily: "Family",
                  crimDrugs: "Drugs",
                  crimOrdinary: "Ordinary",
                  crimRecViaReraffle: "Rec'd Via Re-Raffled",
                  crimUnloaded: "UN Loaded",
                };
                return (
                  <th
                    key={key}
                    className="text-center overflow-hidden whitespace-nowrap relative"
                    style={{ width: colWidths[key] }}
                    ref={(n) => {
                      thRefs.current[key] = n;
                    }}
                  >
                    <span className="block overflow-hidden text-ellipsis">
                      {labels[key]}
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-4 cursor-col-resize hover:bg-primary/10"
                      onMouseDown={(e) => startResize(e, key)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="absolute left-1/2 top-1/2 h-4 -translate-x-1/2 -translate-y-1/2 border-r border-base-content/20" />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={selectionMode === "delete" ? 19 : 18}
                  className="py-14 text-center text-base-content/50"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FiBarChart2 className="h-5 w-5" />
                    <span>Loading summary statistics...</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={selectionMode === "delete" ? 19 : 18}
                  className="py-14 text-center text-base-content/45"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FiGrid className="h-5 w-5" />
                    <span>
                      No rows for {activeCourtType} in {monthLabel}.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((row, index) => {
                const isSelected =
                  selectionMode === "delete" &&
                  row.id != null &&
                  selectedIds.has(row.id);

                return (
                  <tr
                    key={
                      row.id ??
                      `${row.courtType}-${row.branch}-${row.raffleDate}`
                    }
                    className={[
                      "transition-colors",
                      isSelected
                        ? "bg-error/10 hover:bg-error/15"
                        : "hover:bg-base-200/40",
                    ].join(" ")}
                  >
                    {selectionMode === "delete" && (
                      <td className="text-center overflow-hidden">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-error"
                          checked={row.id != null && selectedIds.has(row.id)}
                          onChange={() =>
                            row.id != null && toggleSelect(row.id)
                          }
                          disabled={row.id == null}
                        />
                      </td>
                    )}
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {index + 1}
                    </td>
                    <td className="font-semibold overflow-hidden whitespace-nowrap text-ellipsis">
                      {row.branch}
                    </td>
                    <td className="tabular-nums whitespace-nowrap overflow-hidden">
                      {row.raffleDate}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.civilFamily.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.civilOrdinary.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.civilReceivedViaReraffled.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.civilUnloaded.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.lrcPetition.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.lrcSpProc.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.lrcReceivedViaReraffled.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.lrcUnloaded.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.criminalFamily.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.criminalDrugs.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.criminalOrdinary.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.criminalReceivedViaReraffled.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums overflow-hidden whitespace-nowrap">
                      {row.criminalUnloaded.toLocaleString()}
                    </td>
                    <td className="text-center tabular-nums font-black text-base-content overflow-hidden whitespace-nowrap">
                      {row.total.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}

            {filteredData.length > 0 && (
              <tr className="bg-primary text-primary-content font-bold">
                <td
                  colSpan={selectionMode === "delete" ? 4 : 3}
                  className="uppercase tracking-wider"
                >
                  Grand Total
                </td>
                <td className="text-center tabular-nums">-</td>
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
                <td className="text-center text-lg tabular-nums">
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
