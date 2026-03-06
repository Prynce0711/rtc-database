"use client";

import React, { useMemo, useState } from "react";

export interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  // Optional dataset: array of records with numeric metrics
  statisticsData?: Array<Record<string, unknown>>;
}

function safeNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function mean(arr: number[]) {
  const vals = arr.filter(Number.isFinite);
  if (!vals.length) return NaN;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function median(arr: number[]) {
  const vals = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!vals.length) return NaN;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
}

function stddev(arr: number[]) {
  const vals = arr.filter(Number.isFinite);
  if (vals.length <= 1) return NaN;
  const m = mean(vals);
  const variance =
    vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  subtitle,
  children,
  className = "",
  statisticsData = [],
}) => {
  const [metric, setMetric] = useState<string>("value");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const availableMetrics = useMemo(() => {
    // collect numeric-looking keys from first few records
    const keys = new Set<string>();
    for (let i = 0; i < Math.min(20, statisticsData.length); i++) {
      const rec = statisticsData[i];
      Object.entries(rec).forEach(([k, v]) => {
        if (typeof v === "number") keys.add(k);
        else if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) keys.add(k);
      });
    }
    return Array.from(keys);
  }, [statisticsData]);

  const filtered = useMemo(() => {
    if (!startDate && !endDate) return statisticsData;
    const s = startDate ? new Date(startDate) : null;
    const e = endDate ? new Date(endDate) : null;
    return statisticsData.filter((r) => {
      const t = r.timestamp ? new Date(r.timestamp) : null;
      if (!t) return true;
      if (s && t < s) return false;
      if (e && t > e) return false;
      return true;
    });
  }, [statisticsData, startDate, endDate]);

  const metricValues = useMemo(() => {
    return filtered
      .map((r) => safeNumber(r[metric] ?? r[metric?.toString?.()]))
      .filter(Number.isFinite);
  }, [filtered, metric]);

  const stats = useMemo(() => {
    return {
      count: metricValues.length,
      mean: mean(metricValues),
      median: median(metricValues),
      stddev: stddev(metricValues),
    };
  }, [metricValues]);

  function exportCSV() {
    if (!filtered.length) return;
    const keys = Array.from(new Set(filtered.flatMap((r) => Object.keys(r))));
    const lines = [keys.join(",")];
    for (const r of filtered) {
      lines.push(keys.map((k) => JSON.stringify(r[k] ?? "")).join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title ? title.replace(/\s+/g, "_") : "statistics"}_export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen">
      <main
        className={`w-full max-w-[1600px] mx-auto ${className}`}
        style={{ padding: "var(--space-page-y) var(--space-page-x)" }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-3xl lg:text-4xl font-bold text-base-content tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-base text-muted">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-sm text-muted">Metric</span>
              <select
                className="select select-sm"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {availableMetrics.length ? (
                  availableMetrics.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                ) : (
                  <option value="value">value</option>
                )}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-sm text-muted">From</span>
              <input
                type="date"
                className="input input-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="text-sm text-muted">To</span>
              <input
                type="date"
                className="input input-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>

            <button className="btn btn-sm" onClick={exportCSV}>
              Export CSV
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4 shadow bg-base-100">
            <div className="text-sm text-muted">Count</div>
            <div className="text-2xl font-semibold">{stats.count}</div>
          </div>
          <div className="card p-4 shadow bg-base-100">
            <div className="text-sm text-muted">Mean</div>
            <div className="text-2xl font-semibold">
              {Number.isNaN(stats.mean) ? "—" : stats.mean.toFixed(3)}
            </div>
          </div>
          <div className="card p-4 shadow bg-base-100">
            <div className="text-sm text-muted">Median</div>
            <div className="text-2xl font-semibold">
              {Number.isNaN(stats.median) ? "—" : stats.median.toFixed(3)}
            </div>
          </div>
          <div className="card p-4 shadow bg-base-100">
            <div className="text-sm text-muted">Std Dev</div>
            <div className="text-2xl font-semibold">
              {Number.isNaN(stats.stddev) ? "—" : stats.stddev.toFixed(3)}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 card p-4 shadow bg-base-100">
            <div className="mb-2 font-semibold">Time Series</div>
            <div className="h-64 bg-base-200 rounded flex items-center justify-center text-sm text-muted">
              Chart placeholder — wire any chart library (Recharts / Chart.js /
              Vega)
            </div>
          </div>

          <div className="card p-4 shadow bg-base-100">
            <div className="mb-2 font-semibold">Distribution (Histogram)</div>
            <div className="h-64 bg-base-200 rounded flex items-center justify-center text-sm text-muted">
              Histogram placeholder — compute buckets from selected metric
            </div>
          </div>
        </section>

        <section className="card p-4 shadow bg-base-100">
          <div className="mb-2 font-semibold">Sample Records</div>
          <div className="overflow-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  {Array.from(new Set(filtered.flatMap((r) => Object.keys(r))))
                    .slice(0, 8)
                    .map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((r, idx) => (
                  <tr key={idx}>
                    {Array.from(
                      new Set(filtered.flatMap((x) => Object.keys(x))),
                    )
                      .slice(0, 8)
                      .map((k) => (
                        <td key={k}>{String(r[k] ?? "")}</td>
                      ))}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-6">
                      No data available for the selected range/metric.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
