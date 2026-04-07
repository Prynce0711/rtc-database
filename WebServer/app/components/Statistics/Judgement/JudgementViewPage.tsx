"use client";

import { BarChart3, FileText, LayoutList } from "lucide-react";
import React, { useMemo, useState } from "react";
import { FiArrowLeft, FiCalendar } from "react-icons/fi";
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

  const [selectedRow, setSelectedRow] = useState<Record<
    string,
    unknown
  > | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  /* ── DETAIL VIEW ── */
  if (selectedRow) {
    const rowTitle = selectedRow.branchNo
      ? `Branch No. ${selectedRow.branchNo}`
      : "Record Detail";

    const identityKeys = new Set(["branchNo"]);
    const metricCols = leafColumns.filter((c) => !identityKeys.has(c.key));

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
            {rowTitle}
          </span>
        </nav>

        {/* Identity card */}
        <div className="card bg-base-100 border border-base-200 overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-primary via-primary/50 to-transparent" />
          <div className="p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-base-content/30 mb-3">
              {title} · {yearLabel}
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-base-content leading-tight">
              {rowTitle}
            </h1>
          </div>
        </div>

        {/* Metrics */}
        {metricCols.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
              Statistics
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {metricCols.map((col, i) => {
                const isHighlight = i === metricCols.length - 1;
                return (
                  <div
                    key={col.key}
                    className={`card border transition-all ${
                      isHighlight
                        ? "bg-primary/5 border-primary/20 col-span-2 sm:col-span-1"
                        : "bg-base-100 border-base-200"
                    }`}
                  >
                    <div className="card-body p-4 sm:p-5 gap-1">
                      <p
                        className={`text-[10px] font-black uppercase tracking-[0.18em] leading-snug ${
                          isHighlight
                            ? "text-primary/50"
                            : "text-base-content/35"
                        }`}
                      >
                        {col.label}
                      </p>
                      <p
                        className={`font-black tabular-nums leading-none mt-1 ${
                          isHighlight
                            ? "text-3xl sm:text-4xl text-primary"
                            : "text-2xl sm:text-3xl text-base-content"
                        }`}
                      >
                        {col.render(selectedRow) ?? "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
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
                {subtitle && (
                  <p className="mt-0.5 text-xs text-base-content/40">
                    {subtitle}
                  </p>
                )}
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
      <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 text-center">
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
              {summary.branches.toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-muted">
              Active branches
            </p>
          </div>
        </div>

        {/* Dynamic summary cards */}
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

        {/* Grand Total */}
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
                {/* Primary header row */}
                <tr className="bg-base-200/50 border-b border-base-200 text-base-content/50 text-sm uppercase tracking-wider">
                  <th
                    rowSpan={hasGroups ? 2 : 1}
                    className="py-4 px-4 text-center font-bold align-middle"
                  >
                    #
                  </th>
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
                    className={`transition-colors duration-100 hover:bg-primary/5 cursor-pointer ${
                      idx % 2 === 0 ? "bg-base-100" : "bg-base-200/25"
                    }`}
                    onClick={() => setSelectedRow(row)}
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

export default JudgementViewPage;
