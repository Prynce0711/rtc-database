"use client";

import { BarChart3, FileText, LayoutList } from "lucide-react";
import React, { useMemo, useState } from "react";
import { FiArrowLeft, FiCalendar } from "react-icons/fi";

import type { MonthlyRow } from "./Schema";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ViewReportPageProps {
  data: MonthlyRow[];
  month: string;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const ViewReportPage: React.FC<ViewReportPageProps> = ({
  data,
  month,
  onBack,
}) => {
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  /* ---- Totals ---- */
  const totals = useMemo(
    () => ({
      criminal: data.reduce((s, r) => s + r.criminal, 0),
      civil: data.reduce((s, r) => s + r.civil, 0),
      total: data.reduce((s, r) => s + r.total, 0),
    }),
    [data],
  );

  /* ---- Branch breakdown ---- */
  const branchBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { criminal: number; civil: number; total: number }
    >();
    data.forEach((r) => {
      const prev = map.get(r.branch) ?? { criminal: 0, civil: 0, total: 0 };
      map.set(r.branch, {
        criminal: prev.criminal + r.criminal,
        civil: prev.civil + r.civil,
        total: prev.total + r.total,
      });
    });
    return Array.from(map.entries())
      .map(([branch, vals]) => ({ branch, ...vals }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  type BranchSummaryRow = {
    branch: string;
    criminal: number;
    civil: number;
    total: number;
  };
  const [selectedRow, setSelectedRow] = useState<BranchSummaryRow | null>(null);

  const selectedBranchCategories = useMemo(() => {
    if (!selectedRow) return [];
    return data.filter((r) => r.branch === selectedRow.branch);
  }, [selectedRow, data]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  /* ── DETAIL VIEW ── */
  if (selectedRow) {
    const pct =
      totals.total > 0
        ? ((selectedRow.total / totals.total) * 100).toFixed(1)
        : "0";

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setSelectedRow(null)}
            className="flex items-center gap-1.5 text-base-content/40 hover:text-primary transition-colors font-medium"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            <span>Report Details</span>
          </button>
          <span className="text-base-content/20 select-none">›</span>
          <span className="text-base-content/70 font-semibold truncate max-w-[240px]">
            {selectedRow.branch}
          </span>
        </nav>

        {/* Identity card */}
        <div className="card bg-base-100 border border-base-200 overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-primary via-primary/50 to-transparent" />
          <div className="p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-base-content/30 mb-3">
              Monthly Report · {monthLabel}
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-base-content leading-tight">
              {selectedRow.branch}
            </h1>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
            Statistics
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card bg-base-100 border border-base-200">
              <div className="card-body p-4 sm:p-5 gap-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-base-content/35">
                  Criminal Cases
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-base-content leading-none mt-1">
                  {selectedRow.criminal.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="card bg-base-100 border border-base-200">
              <div className="card-body p-4 sm:p-5 gap-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-base-content/35">
                  Civil Cases
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-base-content leading-none mt-1">
                  {selectedRow.civil.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="card bg-primary/5 border border-primary/20">
              <div className="card-body p-4 sm:p-5 gap-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/50">
                  Total Cases
                </p>
                <p className="text-3xl sm:text-4xl font-black tabular-nums text-primary leading-none mt-1">
                  {selectedRow.total.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="card bg-base-100 border border-base-200">
              <div className="card-body p-4 sm:p-5 gap-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-base-content/35">
                  Share of Total
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-base-content leading-none mt-1">
                  {pct}%
                </p>
                <p className="text-xs text-base-content/25 mt-0.5">
                  of all cases
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {selectedBranchCategories.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
              Category Breakdown
            </p>
            <div className="card bg-base-100 border border-base-200 overflow-hidden">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200/50 border-b border-base-200">
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-base-content/50">
                      Category
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-base-content/50">
                      Criminal
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-base-content/50">
                      Civil
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-base-content/50">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBranchCategories.map((r) => (
                    <tr
                      key={r.category}
                      className="border-b border-base-200/60 hover:bg-base-200/30 transition-colors"
                    >
                      <td className="px-5 py-3 font-semibold text-base-content">
                        {r.category}
                      </td>
                      <td className="px-5 py-3 text-center tabular-nums">
                        {r.criminal.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-center tabular-nums">
                        {r.civil.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-center tabular-nums font-bold text-base-content">
                        {r.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── HEADER ── */}
      <header className="card bg-base-100">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
                  Report Details
                </h2>
                <p className="flex items-center gap-2 text-lg text-base-content/50 mt-2">
                  <FiCalendar className="shrink-0" />
                  <span>
                    Viewing data for{" "}
                    <span className="font-bold text-base-content/80">
                      {monthLabel}
                    </span>{" "}
                    — {data.length} record{data.length !== 1 ? "s" : ""}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <button
                className="btn btn-bg-base-300"
                onClick={onBack}
                title="Go back"
              >
                <FiArrowLeft className="h-5 w-5 mr-2" />
                <span>Go back</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── KPI CARDS ── */}
      <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
        {/* Branches */}
        <div
          className="transform hover:scale-105 card surface-card-hover group"
          style={{ transition: "all 400ms cubic-bezier(0.4,0,0.2,1)" }}
        >
          <div
            className="card-body relative overflow-hidden"
            style={{ padding: "var(--space-card-padding)" }}
          >
            <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
              <LayoutList className="h-full w-full" />
            </div>
            <div className="relative">
              <p className="font-extrabold uppercase text-sm tracking-wide text-base-content mb-3">
                Branches
              </p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
              {branchBreakdown.length.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-muted">
              Active branches
            </p>
          </div>
        </div>

        {/* Criminal Cases */}
        <div
          className="transform hover:scale-105 card surface-card-hover group"
          style={{
            transitionDelay: "100ms",
            transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className="card-body relative overflow-hidden"
            style={{ padding: "var(--space-card-padding)" }}
          >
            <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
              <FileText className="h-full w-full" />
            </div>
            <div className="relative">
              <p className="font-extrabold uppercase text-sm tracking-wide text-base-content mb-3">
                Criminal Cases
              </p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
              {totals.criminal.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-muted">
              {totals.total > 0
                ? ((totals.criminal / totals.total) * 100).toFixed(1)
                : "0"}
              % of total
            </p>
          </div>
        </div>

        {/* Civil Cases */}
        <div
          className="transform hover:scale-105 card surface-card-hover group"
          style={{
            transitionDelay: "200ms",
            transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className="card-body relative overflow-hidden"
            style={{ padding: "var(--space-card-padding)" }}
          >
            <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
              <FileText className="h-full w-full" />
            </div>
            <div className="relative">
              <p className="font-extrabold uppercase text-sm tracking-wide text-base-content mb-3">
                Civil Cases
              </p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
              {totals.civil.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-muted">
              {totals.total > 0
                ? ((totals.civil / totals.total) * 100).toFixed(1)
                : "0"}
              % of total
            </p>
          </div>
        </div>

        {/* Grand Total */}
        <div
          className="transform hover:scale-105 card bg-primary/10 shadow-lg hover:shadow-xl transition-shadow ring-1 ring-primary/20 group"
          style={{
            transitionDelay: "300ms",
            transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className="card-body relative overflow-hidden"
            style={{ padding: "var(--space-card-padding)" }}
          >
            <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
              <BarChart3 className="h-full w-full" />
            </div>
            <div className="relative">
              <p className="font-extrabold uppercase text-sm tracking-wide text-primary/70 mb-3">
                Grand Total
              </p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-primary mb-2">
              {totals.total.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-primary/50">
              All cases combined
            </p>
          </div>
        </div>
      </section>

      {/* ── ALL RECORDS ── */}
      <section className="space-y-4">
        <h3 className="text-2xl font-bold text-base-content flex items-center gap-2.5">
          <LayoutList className="h-6 w-6 text-primary" />
          All Records
        </h3>
        <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-base-200/50 border-b border-base-200">
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50 w-12">
                    #
                  </th>
                  <th className="py-4 px-4 text-left text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Branch
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Criminal
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Civil
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {branchBreakdown.map((b, i) => (
                  <tr
                    key={b.branch}
                    className="border-b border-base-200/60 hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedRow(b)}
                  >
                    <td className="px-4 py-3 text-center text-sm text-base-content/40 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-base-content">
                      {b.branch}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {b.criminal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {b.civil.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-bold text-base-content">
                      {b.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary/80 text-primary-content">
                  <td
                    colSpan={2}
                    className="px-6 py-3.5 text-left font-black text-[15px] uppercase tracking-widest"
                  >
                    Total :
                  </td>
                  <td className="px-4 py-3.5 text-center font-black tabular-nums text-lg">
                    {totals.criminal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-center font-black tabular-nums text-lg">
                    {totals.civil.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-center font-black tabular-nums text-2xl">
                    {totals.total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* <section className="space-y-4">
        <h3 className="text-2xl font-bold text-base-content flex items-center gap-2.5">
          <LayoutList className="h-6 w-6 text-primary" />
          All Records
        </h3>

        <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full text-center">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[26%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="bg-base-200/50 border-b border-base-200">
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    #
                  </th>
                  <th className="py-4 px-4 text-left text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Category
                  </th>
                  <th className="py-4 px-4 text-left text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Branch
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Criminal
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Civil
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(
                  ([category, catRows], groupIdx) => {
                    const badge = CATEGORY_BADGE[category] ?? {
                      bg: "bg-neutral/10 text-neutral",
                      ring: "ring-neutral/20",
                    };
                    return (
                      <React.Fragment key={category}>
                        {catRows.map((r, rIdx) => (
                          <tr
                            key={`${category}-${r.branch}`}
                            className="border-b border-base-200/60 hover:bg-base-200/30 transition-colors"
                          >
                            {rIdx === 0 && (
                              <td
                                rowSpan={catRows.length}
                                className="px-4 py-3 text-center text-sm text-base-content/40 tabular-nums border-r border-base-200/60 align-middle"
                              >
                                {groupIdx + 1}
                              </td>
                            )}
                            {rIdx === 0 && (
                              <td
                                rowSpan={catRows.length}
                                className="px-4 py-3 text-left align-middle border-r border-base-200/60"
                              >
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badge.bg}`}
                                >
                                  {category}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-3 text-left font-medium text-base-content">
                              {r.branch}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              {r.criminal.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                              {r.civil.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums font-semibold text-base-content">
                              {r.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}

          
                        {/* <tr className="bg-base-300/60 border-y border-base-300/80">
                          <td
                            colSpan={3}
                            className="px-6 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-base-content/50"
                          >
                            Subtotal — {category}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold tabular-nums text-base-content/80">
                            {catRows
                              .reduce((s, r) => s + r.criminal, 0)
                              .toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold tabular-nums text-base-content/80">
                            {catRows
                              .reduce((s, r) => s + r.civil, 0)
                              .toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-center font-extrabold tabular-nums text-base-content">
                            {catRows
                              .reduce((s, r) => s + r.total, 0)
                              .toLocaleString()}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  },
                )} */}

      {/* Grand total */}
      {/* <tr className="bg-primary/80 text-primary-content">
                  <td
                    colSpan={3}
                    className="px-6 py-3.5 text-left font-black text-sm uppercase tracking-widest"
                  >
                    Grand Total :
                  </td>
                  <td className="px-4 py-3.5 text-center font-black tabular-nums text-lg">
                    {totals.criminal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-center font-black tabular-nums text-lg">
                    {totals.civil.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-center font-black tabular-nums text-2xl">
                    {totals.total.toLocaleString()}
                  </td>
                </tr> */}
      {/* </tbody>
            </table>
          </div>
        </div>
      </section> */}

      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Report for{" "}
        <span className="font-semibold text-base-content/60">{monthLabel}</span>{" "}
        — {data.length} record{data.length !== 1 ? "s" : ""} across{" "}
        {branchBreakdown.length} branch
        {branchBreakdown.length !== 1 ? "es" : ""}
      </p>
    </div>
  );
};

export default ViewReportPage;
