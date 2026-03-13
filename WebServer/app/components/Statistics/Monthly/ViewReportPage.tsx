"use client";

import { BarChart3, Trophy } from "lucide-react";
import React, { useMemo } from "react";
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

import { CATEGORY_BADGE } from "./MonthlyUtils";

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

  /* ---- Grouped data ---- */
  const grouped = useMemo(() => {
    const map = new Map<string, MonthlyRow[]>();
    data.forEach((r) => {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    });
    return map;
  }, [data]);

  /* ---- Totals ---- */
  const totals = useMemo(
    () => ({
      criminal: data.reduce((s, r) => s + r.criminal, 0),
      civil: data.reduce((s, r) => s + r.civil, 0),
      total: data.reduce((s, r) => s + r.total, 0),
    }),
    [data],
  );

  /* ---- Per-category summaries ---- */
  const categorySummaries = useMemo(() => {
    return Array.from(grouped.entries()).map(([category, rows]) => {
      const criminal = rows.reduce((s, r) => s + r.criminal, 0);
      const civil = rows.reduce((s, r) => s + r.civil, 0);
      const total = rows.reduce((s, r) => s + r.total, 0);
      const pct =
        totals.total > 0 ? ((total / totals.total) * 100).toFixed(1) : "0";
      return { category, rows, criminal, civil, total, pct };
    });
  }, [grouped, totals]);

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

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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

      {/* ── KPI CARDS ──
      <MonthlyKPI
        totalCriminal={totals.criminal}
        totalCivil={totals.civil}
        grandTotal={totals.total}
        branches={branchBreakdown.length}
        icons={{
          totalCriminal: Gavel,
          totalCivil: Scale,
          grandTotal: BarChart3,
          branches: LayoutList,
        }}
      /> */}

      {/* ── CATEGORY BREAKDOWN ── */}
      <section className="space-y-4">
        <h3 className="text-2xl font-bold text-base-content flex items-center gap-2.5">
          <BarChart3 className="h-6 w-6 text-primary" />
          Category Breakdown
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {categorySummaries.map(
            ({ category, rows, criminal, civil, total, pct }) => {
              const badge = CATEGORY_BADGE[category] ?? {
                bg: "bg-neutral/10 text-neutral",
                ring: "ring-neutral/20",
              };
              return (
                <div
                  key={category}
                  className="card bg-base-100 border border-base-200 hover:shadow-md transition-all"
                >
                  <div className="card-body p-5 gap-4">
                    {/* Category header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badge.bg}`}
                      >
                        {category}
                      </span>
                      <span className="text-sm font-semibold text-base-content/40 tabular-nums">
                        {pct}%
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-base-content/40 font-medium uppercase tracking-wider">
                          Criminal
                        </p>
                        <p className="text-2xl font-bold text-base-content tabular-nums">
                          {criminal.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-base-content/40 font-medium uppercase tracking-wider">
                          Civil
                        </p>
                        <p className="text-2xl font-bold text-base-content tabular-nums">
                          {civil.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-base-content/40 font-medium uppercase tracking-wider">
                          Total
                        </p>
                        <p className="text-2xl font-black text-base-content tabular-nums">
                          {total.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Branch list */}
                    <div className="border-t border-base-200 pt-3 space-y-1">
                      {rows.map((r) => (
                        <div
                          key={r.branch}
                          className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-base-200/50 transition-colors"
                        >
                          <span className="font-medium text-base-content/70">
                            {r.branch}
                          </span>
                          <div className="flex items-center gap-4 tabular-nums text-base-content/50">
                            <span className="w-14 text-right">
                              {r.criminal.toLocaleString()}
                            </span>
                            <span className="w-14 text-right">
                              {r.civil.toLocaleString()}
                            </span>
                            <span className="font-bold text-base-content w-14 text-right">
                              {r.total.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>

      {/* ── BRANCH PERFORMANCE ── */}
      <section className="space-y-4">
        <h3 className="text-2xl font-bold text-base-content flex items-center gap-2.5">
          <Trophy className="h-6 w-6 text-primary" />
          Branch Performance
        </h3>

        <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="bg-base-200/50 border-b border-base-200">
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Rank
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
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {branchBreakdown.map((b, i) => {
                  const pct =
                    totals.total > 0
                      ? ((b.total / totals.total) * 100).toFixed(1)
                      : "0";
                  return (
                    <tr
                      key={b.branch}
                      className="border-b border-base-200/60 hover:bg-base-200/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-center">
                        {i < 3 ? (
                          <span
                            className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-black ${
                              i === 0
                                ? "bg-warning/20 text-warning"
                                : i === 1
                                  ? "bg-base-300 text-base-content/60"
                                  : "bg-warning/10 text-warning/60"
                            }`}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          <span className="text-sm text-base-content/40 tabular-nums">
                            {i + 1}
                          </span>
                        )}
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-base-content/50 tabular-nums">
                            {pct}%
                          </span>
                          <div className="w-full bg-base-200 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  <td className="px-4 py-3.5 text-center font-black text-lg">
                    100%
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
