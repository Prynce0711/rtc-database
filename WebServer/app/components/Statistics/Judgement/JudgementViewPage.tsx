"use client";

import React, { useMemo } from "react";
import {
  FiArrowLeft,
  FiCalendar,
  FiHash,
  FiLayers,
  FiTrendingUp,
} from "react-icons/fi";
import {
  AnyColumnDef,
  flattenColumns,
  isGroupColumn,
} from "./JudgementColumnDef";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface JudgementViewPageProps {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  columns: AnyColumnDef[];
  selectedYear?: string;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const JudgementViewPage: React.FC<JudgementViewPageProps> = ({
  title,
  subtitle,
  data,
  columns,
  selectedYear,
  onBack,
}) => {
  const yearLabel = selectedYear ?? new Date().getFullYear().toString();
  const leafColumns = useMemo(() => flattenColumns(columns), [columns]);
  const hasGroups = columns.some(isGroupColumn);

  /* ---- Compute column totals ---- */
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of leafColumns) {
      if (col.computeValue) {
        let sum = 0;
        for (const row of data) sum += col.computeValue(row);
        totals[col.key] = sum;
        continue;
      }
      let sum = 0;
      let hasNumeric = false;
      for (const row of data) {
        const v = row[col.key];
        if (v != null && v !== "") {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            sum += n;
            hasNumeric = true;
          }
        }
      }
      if (hasNumeric) totals[col.key] = sum;
    }
    return totals;
  }, [data, leafColumns]);

  /* ---- Summary cards ---- */
  const summary = useMemo(() => {
    let totalHeard = 0;
    let totalDisposed = 0;
    let totalPDL = 0;
    const branchSet = new Set<string>();
    for (const r of data) {
      totalHeard += Number(r.totalHeard) || 0;
      totalDisposed +=
        (Number(r.totalDisposed) || 0) + (Number(r.casesDisposed) || 0);
      totalPDL += Number(r.pdlTotal) || 0;
      if (r.branchNo) branchSet.add(String(r.branchNo));
    }
    const grandTotal = totalHeard + totalDisposed + totalPDL;
    return {
      cards: [
        {
          label: "Cases Heard / Tried",
          value: totalHeard,
          pct:
            grandTotal > 0 ? ((totalHeard / grandTotal) * 100).toFixed(1) : "0",
        },
        {
          label: "Cases Disposed",
          value: totalDisposed,
          pct:
            grandTotal > 0
              ? ((totalDisposed / grandTotal) * 100).toFixed(1)
              : "0",
        },
        {
          label: "PDL / CICL Total",
          value: totalPDL,
          pct:
            grandTotal > 0 ? ((totalPDL / grandTotal) * 100).toFixed(1) : "0",
        },
      ],
      grandTotal,
      branches: branchSet.size,
    };
  }, [data]);

  /* ---- Branch breakdown ---- */
  const branchBreakdown = useMemo((): Record<string, string | number>[] => {
    const map = new Map<string, Record<string, number>>();

    for (const row of data) {
      const branch = String(row.branchNo ?? "Unknown");
      const prev = map.get(branch) ?? {};
      for (const col of leafColumns) {
        if (col.computeValue) {
          prev[col.key] = (prev[col.key] ?? 0) + col.computeValue(row);
        } else {
          const v = Number(row[col.key]);
          if (!Number.isNaN(v)) prev[col.key] = (prev[col.key] ?? 0) + v;
        }
      }
      map.set(branch, prev);
    }

    return Array.from(map.entries())
      .map(
        ([branch, vals]) =>
          ({ branch, ...vals }) as Record<string, string | number>,
      )
      .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
  }, [data, leafColumns]);

  /* ---- Numeric leaf columns for branch table ---- */
  const numericCols = useMemo(
    () => leafColumns.filter((c) => c.key !== "branchNo"),
    [leafColumns],
  );

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
                title="Back to Judgement Reports"
              >
                <FiArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-base-content">
                  {title} — Report Details
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                  <FiCalendar className="shrink-0" />
                  <span>
                    Viewing data for{" "}
                    <span className="font-bold text-base-content">
                      {yearLabel}
                    </span>{" "}
                    — {data.length} record{data.length !== 1 ? "s" : ""}
                  </span>
                </p>
                {subtitle && (
                  <p className="mt-0.5 text-xs text-base-content/40">
                    {subtitle}
                  </p>
                )}
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
                {summary.branches} branches
              </div>
              <div className="badge badge-lg badge-primary gap-2 py-3 font-bold">
                <FiTrendingUp className="h-3.5 w-3.5" />
                {summary.grandTotal.toLocaleString()} total
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-auto bg-base-200/30 p-4 sm:p-6 space-y-6">
        {/* ── SUMMARY CARDS ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summary.cards.map((card, i) => (
            <div
              key={i}
              className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="card-body p-5 text-center">
                <p className="text-xs uppercase tracking-widest text-base-content/50 font-bold mb-1">
                  {card.label}
                </p>
                <p className="text-4xl font-black text-base-content">
                  {card.value.toLocaleString()}
                </p>
                <p className="text-sm text-base-content/40 mt-1">
                  {card.pct}% of total
                </p>
              </div>
            </div>
          ))}

          {/* Grand total card */}
          <div className="card bg-primary/10 shadow-lg hover:shadow-xl transition-shadow ring-1 ring-primary/20">
            <div className="card-body p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-primary/70 font-bold mb-1">
                Grand Total
              </p>
              <p className="text-4xl font-black text-primary">
                {summary.grandTotal.toLocaleString()}
              </p>
              <p className="text-sm text-primary/50 mt-1">
                All values combined
              </p>
            </div>
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
                <thead>
                  <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                    <th className="py-3 px-4 text-center font-extrabold">
                      Rank
                    </th>
                    <th className="py-3 px-4 text-left font-extrabold">
                      Branch
                    </th>
                    {numericCols.map((col) => (
                      <th
                        key={col.key}
                        className="py-3 px-4 text-center font-extrabold"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-center font-extrabold">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                  {branchBreakdown.map((b, i) => {
                    const total = Number(b.total) || 0;
                    const pct =
                      summary.grandTotal > 0
                        ? ((total / summary.grandTotal) * 100).toFixed(1)
                        : "0";
                    return (
                      <tr
                        key={String(b.branch)}
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
                        {numericCols.map((col) => (
                          <td
                            key={col.key}
                            className="px-4 py-3 text-center tabular-nums text-base"
                          >
                            {(Number(b[col.key]) || 0).toLocaleString()}
                          </td>
                        ))}
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
                <tfoot>
                  <tr className="bg-primary text-primary-content font-bold">
                    <td
                      colSpan={2}
                      className="px-4 py-3 font-black text-sm uppercase tracking-widest"
                    >
                      Total
                    </td>
                    {numericCols.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-center tabular-nums font-black text-base"
                      >
                        {(columnTotals[col.key] ?? 0).toLocaleString()}
                      </td>
                    ))}
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
                <thead>
                  {/* Primary header row */}
                  <tr className="bg-base-300 text-base-content text-xs uppercase tracking-widest">
                    <th className="py-3 px-4 text-center font-extrabold">#</th>
                    {columns.map((col, i) => {
                      if (isGroupColumn(col)) {
                        return (
                          <th
                            key={col.title + i}
                            colSpan={col.children.length}
                            className="py-3 px-4 text-center font-extrabold border-b border-base-200 bg-base-content/5"
                          >
                            {col.title}
                          </th>
                        );
                      }
                      return (
                        <th
                          key={col.key}
                          rowSpan={hasGroups ? 2 : 1}
                          className={`py-3 px-4 font-extrabold align-middle ${
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                                ? "text-right"
                                : "text-left"
                          }`}
                        >
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>

                  {/* Second header row for group children */}
                  {hasGroups && (
                    <tr className="bg-base-300/80 text-base-content text-xs uppercase tracking-widest">
                      {columns.flatMap((col, gi) => {
                        if (!isGroupColumn(col)) return [];
                        return col.children.map((child) => (
                          <th
                            key={child.key + gi}
                            className={`py-2 px-4 font-extrabold ${
                              child.align === "center"
                                ? "text-center"
                                : child.align === "right"
                                  ? "text-right"
                                  : "text-left"
                            }`}
                          >
                            {child.label}
                          </th>
                        ));
                      })}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-base-200">
                  {data.map((row, idx) => (
                    <tr
                      key={(row.id as number) ?? idx}
                      className={`transition-colors duration-100 hover:bg-primary/5 ${
                        idx % 2 === 0 ? "bg-base-100" : "bg-base-200/25"
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-sm font-mono text-base-content/40">
                        {idx + 1}
                      </td>
                      {leafColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 tabular-nums text-base ${
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                                ? "text-right"
                                : ""
                          }`}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Grand total */}
                  {data.length > 0 && (
                    <tr className="bg-primary text-primary-content">
                      <td className="px-4 py-4 font-black text-sm uppercase tracking-widest">
                        Total
                      </td>
                      {leafColumns.map((col) => {
                        const total = columnTotals[col.key];
                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-4 font-black tabular-nums text-base ${
                              col.align === "center"
                                ? "text-center"
                                : col.align === "right"
                                  ? "text-right"
                                  : ""
                            }`}
                          >
                            {total != null ? total.toLocaleString() : ""}
                          </td>
                        );
                      })}
                    </tr>
                  )}
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
            {title} — {yearLabel}
          </span>{" "}
          — {data.length} record{data.length !== 1 ? "s" : ""} across{" "}
          {summary.branches} branch
          {summary.branches !== 1 ? "es" : ""}
        </p>
        <button className="btn btn-ghost gap-2" onClick={onBack}>
          <FiArrowLeft className="h-5 w-5" />
          Back to Reports
        </button>
      </div>
    </div>
  );
};

export default JudgementViewPage;
