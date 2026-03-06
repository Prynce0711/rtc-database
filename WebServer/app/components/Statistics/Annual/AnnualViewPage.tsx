"use client";

import { BarChart3, FileText, LayoutList, Trophy } from "lucide-react";
import React, { useMemo } from "react";
import { FiArrowLeft, FiCalendar } from "react-icons/fi";
import { AnyColumnDef, flattenColumns, isGroupColumn } from "./AnnualColumnDef";
import type { AnnualVariant } from "./AnnualTable";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface AnnualViewPageProps {
  title: string;
  subtitle?: string;
  variant: AnnualVariant;
  data: Record<string, unknown>[];
  columns: AnyColumnDef[];
  selectedYear?: string;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AnnualViewPage: React.FC<AnnualViewPageProps> = ({
  title,
  subtitle,
  variant,
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

  /* ---- Variant-specific summary ---- */
  const summary = useMemo(() => {
    if (variant === "court") {
      let pending = 0;
      let disposed = 0;
      let raffled = 0;
      let pendingNow = 0;
      const branchSet = new Set<string>();
      for (const r of data) {
        pending += Number(r.pendingLastYear) || 0;
        raffled += Number(r.RaffledOrAdded) || 0;
        disposed += Number(r.Disposed) || 0;
        pendingNow += Number(r.pendingThisYear) || 0;
        if (r.branch) branchSet.add(String(r.branch));
      }
      return {
        cards: [
          {
            label: "Pending Last Year",
            value: pending,
            pct:
              pending + raffled + disposed + pendingNow > 0
                ? (
                    (pending / (pending + raffled + disposed + pendingNow)) *
                    100
                  ).toFixed(1)
                : "0",
          },
          {
            label: "Raffled / Added",
            value: raffled,
            pct:
              pending + raffled + disposed + pendingNow > 0
                ? (
                    (raffled / (pending + raffled + disposed + pendingNow)) *
                    100
                  ).toFixed(1)
                : "0",
          },
          {
            label: "Disposed",
            value: disposed,
            pct:
              pending + raffled + disposed + pendingNow > 0
                ? (
                    (disposed / (pending + raffled + disposed + pendingNow)) *
                    100
                  ).toFixed(1)
                : "0",
          },
          {
            label: "Pending This Year",
            value: pendingNow,
            pct:
              pending + raffled + disposed + pendingNow > 0
                ? (
                    (pendingNow / (pending + raffled + disposed + pendingNow)) *
                    100
                  ).toFixed(1)
                : "0",
          },
        ],
        grandTotal: pending + raffled + disposed + pendingNow,
        branches: branchSet.size,
      };
    }

    // inventory
    let civilFiled = 0;
    let crimFiled = 0;
    let civilDisposed = 0;
    let crimDisposed = 0;
    const branchSet = new Set<string>();
    for (const r of data) {
      civilFiled += Number(r.civilSmallClaimsFiled) || 0;
      crimFiled += Number(r.criminalCasesFiled) || 0;
      civilDisposed += Number(r.civilSmallClaimsDisposed) || 0;
      crimDisposed += Number(r.criminalCasesDisposed) || 0;
      if (r.branch) branchSet.add(String(r.branch));
    }
    const totalFiled = civilFiled + crimFiled;
    const totalDisposed = civilDisposed + crimDisposed;
    const grandTotal = totalFiled + totalDisposed;
    return {
      cards: [
        {
          label: "Cases Filed",
          value: totalFiled,
          pct:
            grandTotal > 0 ? ((totalFiled / grandTotal) * 100).toFixed(1) : "0",
        },
        {
          label: "Cases Disposed",
          value: totalDisposed,
          pct:
            grandTotal > 0
              ? ((totalDisposed / grandTotal) * 100).toFixed(1)
              : "0",
        },
      ],
      grandTotal,
      branches: branchSet.size,
    };
  }, [data, variant]);

  /* ---- Branch breakdown ---- */
  const branchBreakdown = useMemo((): Record<string, string | number>[] => {
    const map = new Map<string, Record<string, number>>();

    for (const row of data) {
      const branch = String(row.branch ?? "Unknown");
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
      .sort((a, b) => (Number(b._total) || 0) - (Number(a._total) || 0));
  }, [data, leafColumns]);

  /* ---- Numeric leaf columns (for branch table) ---- */
  const numericCols = useMemo(
    () =>
      leafColumns.filter(
        (c) =>
          c.key !== "branch" &&
          c.key !== "region" &&
          c.key !== "province" &&
          c.key !== "court" &&
          c.key !== "cityMunicipality",
      ),
    [leafColumns],
  );

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
                  {title} — Report Details
                </h2>
                <p className="flex items-center gap-2 text-lg text-base-content/50 mt-2">
                  <FiCalendar className="shrink-0" />
                  <span>
                    Viewing data for{" "}
                    <span className="font-bold text-base-content/80">
                      {yearLabel}
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

      {/* ── SUMMARY CARDS ── */}
      <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-center">
        {/* Branches card */}
        <div
          className="transform hover:scale-105 card surface-card-hover group"
          style={{ transition: "all 400ms cubic-bezier(0.4,0,0.2,1)" }}
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
                Branches
              </p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
              {summary.branches.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-muted">
              Active branches
            </p>
          </div>
        </div>

        {summary.cards.map((card, i) => (
          <div
            key={i}
            className="transform hover:scale-105 card surface-card-hover group"
            style={{
              transitionDelay: `${(i + 1) * 100}ms`,
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
                  {card.label}
                </p>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                {card.value.toLocaleString()}
              </p>
              <p className="text-sm sm:text-base font-semibold text-muted">
                {card.pct}% of total
              </p>
            </div>
          </div>
        ))}

        {/* Grand total card */}
        <div
          className="transform hover:scale-105 card bg-primary/10 shadow-lg hover:shadow-xl transition-shadow ring-1 ring-primary/20 group"
          style={{
            transitionDelay: `${(summary.cards.length + 1) * 100}ms`,
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
              {summary.grandTotal.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-primary/50">
              All values combined
            </p>
          </div>
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
              <thead>
                <tr className="bg-base-200/50 border-b border-base-200">
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Rank
                  </th>
                  <th className="py-4 px-4 text-left text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Branch
                  </th>
                  {numericCols.map((col) => (
                    <th
                      key={col.key}
                      className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="py-4 px-4 text-center text-sm font-bold uppercase tracking-wider text-base-content/50">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {branchBreakdown.map((b, i) => {
                  const total = Number(b._total) || 0;
                  const pct =
                    summary.grandTotal > 0
                      ? ((total / summary.grandTotal) * 100).toFixed(1)
                      : "0";
                  return (
                    <tr
                      key={String(b.branch)}
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
                <tr className="bg-primary/80 text-primary-content">
                  <td
                    colSpan={2}
                    className="px-6 py-3.5 text-left font-black text-[15px] uppercase tracking-widest"
                  >
                    Total :
                  </td>
                  {numericCols.map((col, i) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 text-center font-black tabular-nums ${
                        i === numericCols.length - 1 ? "text-2xl" : "text-lg"
                      }`}
                    >
                      {(columnTotals[col.key] ?? 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="px-4 py-3.5 text-center font-black text-lg">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* ── FULL DATA TABLE ── */}
      <section className="space-y-4">
        <h3 className="text-2xl font-bold text-base-content flex items-center gap-2.5">
          <LayoutList className="h-6 w-6 text-primary" />
          All Records
        </h3>

        <div className="bg-base-100 rounded-xl overflow-hidden border border-base-200">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                {/* Primary header row */}
                <tr className="bg-base-200/50 border-b border-base-200 text-base-content/50 text-sm uppercase tracking-wider">
                  <th className="py-4 px-4 text-center font-bold">#</th>
                  {columns.map((col, i) => {
                    if (isGroupColumn(col)) {
                      return (
                        <th
                          key={col.title + i}
                          colSpan={col.children.length}
                          className="py-4 px-4 text-center font-bold border-b border-base-200 bg-base-content/5"
                        >
                          {col.title}
                        </th>
                      );
                    }
                    return (
                      <th
                        key={col.key}
                        rowSpan={hasGroups ? 2 : 1}
                        className={`py-4 px-4 font-bold align-middle ${
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
                  <tr className="bg-base-200/30 text-base-content/50 text-xs uppercase tracking-wider">
                    {columns.flatMap((col, gi) => {
                      if (!isGroupColumn(col)) return [];
                      return col.children.map((child) => (
                        <th
                          key={child.key + gi}
                          className={`py-2 px-4 font-bold ${
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
                  <tr className="bg-primary/80 text-primary-content">
                    <td className="px-6 py-3.5 text-left font-black text-[15px] uppercase tracking-widest">
                      Total :
                    </td>
                    {leafColumns.map((col, i) => {
                      const total = columnTotals[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3.5 font-black tabular-nums ${
                            i === leafColumns.length - 1
                              ? "text-2xl"
                              : "text-lg"
                          } ${
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

      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Report for{" "}
        <span className="font-semibold">
          {title} — {yearLabel}
        </span>
      </p>
    </div>
  );
};

export default AnnualViewPage;
