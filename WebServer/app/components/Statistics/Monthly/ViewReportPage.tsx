"use client";

import React, { useMemo } from "react";
import {
  FiArrowLeft,
  FiCalendar,
  FiHash,
  FiLayers,
  FiPieChart,
  FiTrendingUp,
} from "react-icons/fi";
import type { MonthlyRow } from "./types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ViewReportPageProps {
  data: MonthlyRow[];
  month: string;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Badge helper                                                       */
/* ------------------------------------------------------------------ */

const CATEGORY_BADGE: Record<
  string,
  { dot: string; bg: string; ring: string }
> = {
  "New Cases Filed": {
    dot: "bg-info",
    bg: "bg-info/10 text-info",
    ring: "ring-info/20",
  },
  "Cases Disposed": {
    dot: "bg-success",
    bg: "bg-success/10 text-success",
    ring: "ring-success/20",
  },
  "Pending Cases": {
    dot: "bg-warning",
    bg: "bg-warning/10 text-warning",
    ring: "ring-warning/20",
  },
};

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
    <div className="space-y-0 flex flex-col h-full min-h-[calc(100vh-6rem)]">
      {/* ── HEADER ── */}
      <header className="card bg-base-100 shadow-xl rounded-b-none">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                className="btn btn-ghost btn-circle"
                onClick={onBack}
                title="Back to Monthly Reports"
              >
                <FiArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-base-content">
                  Report Details
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                  <FiCalendar className="shrink-0" />
                  <span>
                    Viewing data for{" "}
                    <span className="font-bold text-base-content">
                      {monthLabel}
                    </span>{" "}
                    — {data.length} record{data.length !== 1 ? "s" : ""}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="badge badge-lg badge-outline gap-2 py-3">
                <FiHash className="h-3.5 w-3.5" />
                {data.length} rows
              </div>
              <div className="badge badge-lg badge-outline gap-2 py-3">
                <FiLayers className="h-3.5 w-3.5" />
                {grouped.size} categories
              </div>
              <div className="badge badge-lg badge-primary gap-2 py-3 font-bold">
                <FiTrendingUp className="h-3.5 w-3.5" />
                {totals.total.toLocaleString()} total
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-auto bg-base-200/30 p-4 sm:p-6 space-y-6">
        {/* ── SUMMARY CARDS ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
            <div className="card-body p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-base-content/50 font-bold mb-1">
                Criminal Cases
              </p>
              <p className="text-4xl font-black text-base-content">
                {totals.criminal.toLocaleString()}
              </p>
              <p className="text-sm text-base-content/40 mt-1">
                {totals.total > 0
                  ? `${((totals.criminal / totals.total) * 100).toFixed(1)}%`
                  : "0%"}{" "}
                of total
              </p>
            </div>
          </div>
          <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
            <div className="card-body p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-base-content/50 font-bold mb-1">
                Civil Cases
              </p>
              <p className="text-4xl font-black text-base-content">
                {totals.civil.toLocaleString()}
              </p>
              <p className="text-sm text-base-content/40 mt-1">
                {totals.total > 0
                  ? `${((totals.civil / totals.total) * 100).toFixed(1)}%`
                  : "0%"}{" "}
                of total
              </p>
            </div>
          </div>
          <div className="card bg-primary/10 shadow-lg hover:shadow-xl transition-shadow ring-1 ring-primary/20">
            <div className="card-body p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-primary/70 font-bold mb-1">
                Grand Total
              </p>
              <p className="text-4xl font-black text-primary">
                {totals.total.toLocaleString()}
              </p>
              <p className="text-sm text-primary/50 mt-1">All cases combined</p>
            </div>
          </div>
        </section>

        {/* ── CATEGORY BREAKDOWN CARDS ── */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
            <FiPieChart className="h-5 w-5 text-primary" />
            Category Breakdown
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {categorySummaries.map(
              ({ category, rows, criminal, civil, total, pct }) => {
                const badge = CATEGORY_BADGE[category] ?? {
                  dot: "bg-neutral",
                  bg: "bg-neutral/10 text-neutral",
                  ring: "ring-neutral/20",
                };
                return (
                  <div
                    key={category}
                    className={`card bg-base-100 shadow-md hover:shadow-lg transition-all ring-1 ${badge.ring}`}
                  >
                    <div className="card-body p-5 gap-4">
                      {/* Category header */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${badge.bg}`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${badge.dot}`}
                          />
                          {category}
                        </span>
                        <span className="text-sm font-semibold text-base-content/40">
                          {pct}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-base-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${badge.dot}`}
                          style={{
                            width: `${totals.total > 0 ? (total / totals.total) * 100 : 0}%`,
                          }}
                        />
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-base-content/40 font-medium">
                            Criminal
                          </p>
                          <p className="text-xl font-bold text-base-content">
                            {criminal.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/40 font-medium">
                            Civil
                          </p>
                          <p className="text-xl font-bold text-base-content">
                            {civil.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/40 font-medium">
                            Total
                          </p>
                          <p className="text-xl font-black text-base-content">
                            {total.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Branch list */}
                      <div className="divider my-0" />
                      <div className="space-y-1.5">
                        {rows.map((r) => (
                          <div
                            key={r.branch}
                            className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-base-200/60 transition-colors"
                          >
                            <span className="font-medium text-base-content/80">
                              {r.branch}
                            </span>
                            <div className="flex items-center gap-4 tabular-nums">
                              <span className="text-base-content/50 w-12 text-right">
                                {r.criminal}
                              </span>
                              <span className="text-base-content/50 w-12 text-right">
                                {r.civil}
                              </span>
                              <span className="font-bold text-base-content w-12 text-right">
                                {r.total}
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
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
            <FiLayers className="h-5 w-5 text-primary" />
            Branch Performance
          </h2>

          <div className="card bg-base-100 shadow-lg border border-base-300/50 overflow-hidden">
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
                  <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                    <th className="py-3 px-4 text-center font-extrabold">
                      Rank
                    </th>
                    <th className="py-3 px-4 text-left font-extrabold">
                      Branch
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold">
                      Criminal
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold">
                      Civil
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold">
                      Total
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                  {branchBreakdown.map((b, i) => {
                    const pct =
                      totals.total > 0
                        ? ((b.total / totals.total) * 100).toFixed(1)
                        : "0";
                    return (
                      <tr
                        key={b.branch}
                        className="hover:bg-primary/5 transition-colors"
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
                            <span className="text-sm text-base-content/40 font-mono">
                              {i + 1}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-base text-base-content">
                          {b.branch}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-base">
                          {b.criminal.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-base">
                          {b.civil.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-base font-bold">
                          {b.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-base-content/60">
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

                {/* Footer total */}
                <tfoot>
                  <tr className="bg-primary text-primary-content font-bold">
                    <td
                      colSpan={2}
                      className="px-4 py-3 font-black text-sm uppercase tracking-widest"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-black text-base">
                      {totals.criminal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-black text-base">
                      {totals.civil.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-black text-base">
                      {totals.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-sm">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* ── FULL DATA TABLE ── */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
            <FiHash className="h-5 w-5 text-primary" />
            All Records
          </h2>

          <div className="card bg-base-100 shadow-lg border border-base-300/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <colgroup>
                  <col className="w-[6%]" />
                  <col className="w-[26%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                    <th className="py-3 px-4 text-center font-extrabold">#</th>
                    <th className="py-3 px-4 text-left font-extrabold">
                      Category
                    </th>
                    <th className="py-3 px-4 text-left font-extrabold">
                      Branch
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold">
                      Criminal
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold">
                      Civil
                    </th>
                    <th className="py-3 px-4 text-center font-extrabold bg-base-content/5">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                  {Array.from(grouped.entries()).map(
                    ([category, catRows], groupIdx) => {
                      const badge = CATEGORY_BADGE[category] ?? {
                        dot: "bg-neutral",
                        bg: "bg-neutral/10 text-neutral",
                        ring: "ring-neutral/20",
                      };
                      return (
                        <React.Fragment key={category}>
                          {catRows.map((r, rIdx) => (
                            <tr
                              key={`${category}-${r.branch}`}
                              className={`transition-colors duration-100 hover:bg-primary/5 ${
                                groupIdx % 2 === 0
                                  ? "bg-base-100"
                                  : "bg-base-200/25"
                              }`}
                            >
                              {/* Merged category */}
                              {rIdx === 0 && (
                                <td
                                  rowSpan={catRows.length}
                                  className="px-4 py-3 text-center text-sm font-mono text-base-content/40 border-r border-base-200/60 align-middle"
                                >
                                  {groupIdx + 1}
                                </td>
                              )}
                              {rIdx === 0 && (
                                <td
                                  rowSpan={catRows.length}
                                  className="px-4 py-3 align-middle border-r border-base-200/60"
                                >
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${badge.bg}`}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${badge.dot}`}
                                    />
                                    {category}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 font-medium text-base text-base-content">
                                {r.branch}
                              </td>
                              <td className="px-4 py-3 text-center tabular-nums text-base">
                                {r.criminal.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center tabular-nums text-base">
                                {r.civil.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center tabular-nums text-base font-semibold bg-base-content/[0.02]">
                                {r.total.toLocaleString()}
                              </td>
                            </tr>
                          ))}

                          {/* Subtotal */}
                          <tr className="bg-base-200/60">
                            <td
                              colSpan={3}
                              className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-base-content/50"
                            >
                              Subtotal — {category}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold tabular-nums text-base text-base-content/80">
                              {catRows
                                .reduce((s, r) => s + r.criminal, 0)
                                .toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold tabular-nums text-base text-base-content/80">
                              {catRows
                                .reduce((s, r) => s + r.civil, 0)
                                .toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-center font-extrabold tabular-nums text-base bg-base-300/40">
                              {catRows
                                .reduce((s, r) => s + r.total, 0)
                                .toLocaleString()}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    },
                  )}

                  {/* Grand total */}
                  <tr className="bg-primary text-primary-content">
                    <td
                      colSpan={3}
                      className="px-4 py-4 font-black text-sm uppercase tracking-widest"
                    >
                      Grand Total
                    </td>
                    <td className="px-4 py-4 text-center font-black tabular-nums text-base">
                      {totals.criminal.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center font-black tabular-nums text-base">
                      {totals.civil.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center font-black tabular-nums text-base bg-primary-focus/20">
                      {totals.total.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-base-300 bg-base-100 rounded-b-xl shadow-xl">
        <p className="text-xs text-base-content/40">
          Report for{" "}
          <span className="font-semibold text-base-content/60">
            {monthLabel}
          </span>{" "}
          — {data.length} record{data.length !== 1 ? "s" : ""} across{" "}
          {branchBreakdown.length} branch
          {branchBreakdown.length !== 1 ? "es" : ""}
        </p>
        <button className="btn btn-ghost gap-2" onClick={onBack}>
          <FiArrowLeft className="h-5 w-5" />
          Back to Reports
        </button>
      </div>
    </div>
  );
};

export default ViewReportPage;
