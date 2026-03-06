"use client";

import {
  getMunicipalJudgements,
  getRegionalJudgements,
} from "@/app/components/Statistics/Judgement/judgementActions";
import type {
  MTCJudgementRow,
  RTCJudgementRow,
} from "@/app/components/Statistics/Judgement/Schema";
import { getMonthlyStatistics } from "@/app/components/Statistics/Monthly/MonthlyActions";
import type { MonthlyRow } from "@/app/components/Statistics/Monthly/Schema";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  FileText,
  Gavel,
  RefreshCw,
  Scale,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

const COLORS = [
  "#6366f1",
  "#22d3ee",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
];

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-base-300/40 ${className}`} />
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition-shadow duration-200"
    >
      <div className="card-body p-6 flex flex-row items-center gap-5">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}18` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-base-content/40 truncate">
            {label}
          </p>
          <p className="text-3xl font-extrabold text-base-content leading-tight">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-base-content/50 mt-1 truncate">{sub}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────

const StatisticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [mtc, setMtc] = useState<MTCJudgementRow[]>([]);
  const [rtc, setRtc] = useState<RTCJudgementRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [mRes, mtcRes, rtcRes] = await Promise.all([
      getMonthlyStatistics(),
      getMunicipalJudgements(),
      getRegionalJudgements(),
    ]);
    if (mRes.success) setMonthly(mRes.result);
    if (mtcRes.success) setMtc(mtcRes.result);
    if (rtcRes.success) setRtc(rtcRes.result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Aggregate monthly stats ────────────────────────────────────────────────
  const monthlyAgg = useMemo(() => {
    const totalCriminal = monthly.reduce((s, r) => s + r.criminal, 0);
    const totalCivil = monthly.reduce((s, r) => s + r.civil, 0);
    const totalCases = monthly.reduce((s, r) => s + r.total, 0);
    const uniqueMonths = new Set(monthly.map((r) => r.month)).size;
    const uniqueBranches = new Set(monthly.map((r) => r.branch)).size;
    const uniqueCategories = new Set(monthly.map((r) => r.category)).size;

    // Per-month totals for the chart
    const byMonth: Record<
      string,
      { criminal: number; civil: number; total: number }
    > = {};
    monthly.forEach((r) => {
      if (!byMonth[r.month])
        byMonth[r.month] = { criminal: 0, civil: 0, total: 0 };
      byMonth[r.month].criminal += r.criminal;
      byMonth[r.month].civil += r.civil;
      byMonth[r.month].total += r.total;
    });
    const monthlyTrend = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({ month, ...d }));

    // Per-category breakdown
    const byCategory: Record<string, number> = {};
    monthly.forEach((r) => {
      byCategory[r.category] = (byCategory[r.category] || 0) + r.total;
    });
    const categoryBreakdown = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    // Per-branch breakdown for top branches
    const byBranch: Record<
      string,
      { criminal: number; civil: number; total: number }
    > = {};
    monthly.forEach((r) => {
      if (!byBranch[r.branch])
        byBranch[r.branch] = { criminal: 0, civil: 0, total: 0 };
      byBranch[r.branch].criminal += r.criminal;
      byBranch[r.branch].civil += r.civil;
      byBranch[r.branch].total += r.total;
    });
    const branchBreakdown = Object.entries(byBranch)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([branch, d]) => ({ branch, ...d }));

    return {
      totalCriminal,
      totalCivil,
      totalCases,
      uniqueMonths,
      uniqueBranches,
      uniqueCategories,
      monthlyTrend,
      categoryBreakdown,
      branchBreakdown,
    };
  }, [monthly]);

  // ── Aggregate judgement stats ──────────────────────────────────────────────
  const judgementAgg = useMemo(() => {
    const mtcTotalHeard = mtc.reduce((s, r) => s + num(r.totalHeard), 0);
    const mtcTotalDisposed = mtc.reduce((s, r) => s + num(r.totalDisposed), 0);
    const mtcPdlTotal = mtc.reduce((s, r) => s + num(r.pdlTotal), 0);

    const rtcTotalHeard = rtc.reduce((s, r) => s + num(r.totalHeard), 0);
    const rtcCasesDisposed = rtc.reduce((s, r) => s + num(r.casesDisposed), 0);
    const rtcPdlTotal = rtc.reduce((s, r) => s + num(r.pdlTotal), 0);

    // Combine both for overview
    const totalHeard = mtcTotalHeard + rtcTotalHeard;
    const totalDisposed = mtcTotalDisposed + rtcCasesDisposed;
    const totalPDL = mtcPdlTotal + rtcPdlTotal;

    // Build branch comparison data
    const rtcBranches = rtc.slice(0, 8).map((r) => ({
      branch: r.branchNo ?? `Branch ${r.id}`,
      heard: num(r.totalHeard),
      disposed: num(r.casesDisposed),
    }));
    const mtcBranches = mtc.slice(0, 8).map((r) => ({
      branch: r.branchNo ?? `Branch ${r.id}`,
      heard: num(r.totalHeard),
      disposed: num(r.totalDisposed),
    }));

    return {
      mtcCount: mtc.length,
      rtcCount: rtc.length,
      totalHeard,
      totalDisposed,
      totalPDL,
      rtcBranches,
      mtcBranches,
      disposalRate:
        totalHeard > 0 ? ((totalDisposed / totalHeard) * 100).toFixed(1) : "0",
    };
  }, [mtc, rtc]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        <main className="w-full max-w-[1600px] mx-auto p-6 lg:p-10 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Skeleton className="col-span-2 h-80" />
            <Skeleton className="h-80" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="w-full max-w-[1600px] mx-auto p-6 lg:p-10 space-y-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-base-content tracking-tight">
              Statistics Dashboard
            </h1>
            <p className="mt-1 text-base-content/50 text-sm">
              Overview of Monthly Reports, Judgement Day, and Branch Performance
            </p>
          </div>
          <button
            className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content"
            onClick={fetchAll}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </motion.div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<FileText size={26} />}
            label="Total Monthly Records"
            value={fmt(monthly.length)}
            sub={`${monthlyAgg.uniqueMonths} months tracked`}
            color="#6366f1"
            delay={0}
          />
          <KpiCard
            icon={<Scale size={26} />}
            label="Criminal Cases"
            value={fmt(monthlyAgg.totalCriminal)}
            sub={`${monthlyAgg.totalCases > 0 ? ((monthlyAgg.totalCriminal / monthlyAgg.totalCases) * 100).toFixed(1) : 0}% of total`}
            color="#ef4444"
            delay={0.05}
          />
          <KpiCard
            icon={<BarChart3 size={26} />}
            label="Civil Cases"
            value={fmt(monthlyAgg.totalCivil)}
            sub={`${monthlyAgg.totalCases > 0 ? ((monthlyAgg.totalCivil / monthlyAgg.totalCases) * 100).toFixed(1) : 0}% of total`}
            color="#22d3ee"
            delay={0.1}
          />
          <KpiCard
            icon={<TrendingUp size={26} />}
            label="Total Cases Filed"
            value={fmt(monthlyAgg.totalCases)}
            sub={`${monthlyAgg.uniqueBranches} branches, ${monthlyAgg.uniqueCategories} categories`}
            color="#10b981"
            delay={0.15}
          />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Gavel size={26} />}
            label="Cases Heard (All Courts)"
            value={fmt(judgementAgg.totalHeard)}
            sub={`MTC: ${judgementAgg.mtcCount} | RTC: ${judgementAgg.rtcCount} branches`}
            color="#8b5cf6"
            delay={0.2}
          />
          <KpiCard
            icon={<Calendar size={26} />}
            label="Cases Disposed"
            value={fmt(judgementAgg.totalDisposed)}
            sub={`Disposal rate: ${judgementAgg.disposalRate}%`}
            color="#f59e0b"
            delay={0.25}
          />
          <KpiCard
            icon={<Users size={26} />}
            label="Total PDL"
            value={fmt(judgementAgg.totalPDL)}
            sub="Persons Deprived of Liberty"
            color="#f97316"
            delay={0.3}
          />
          <KpiCard
            icon={<FileText size={26} />}
            label="Active Branches"
            value={fmt(monthlyAgg.uniqueBranches)}
            sub={`Across ${monthlyAgg.uniqueMonths} reporting periods`}
            color="#14b8a6"
            delay={0.35}
          />
        </section>

        {/* ── Monthly Trend Chart + Category Pie ─────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="col-span-1 lg:col-span-2 card bg-base-100 shadow-md border border-base-200"
          >
            <div className="card-body p-5">
              <h3 className="text-base font-bold text-base-content/70 uppercase tracking-wider mb-4">
                Monthly Case Trend
              </h3>
              {monthlyAgg.monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={monthlyAgg.monthlyTrend}>
                    <defs>
                      <linearGradient
                        id="gradCriminal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ef4444"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ef4444"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="gradCivil"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 13 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 13 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(0,0,0,0.08)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 14 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="criminal"
                      name="Criminal"
                      stroke="#ef4444"
                      fill="url(#gradCriminal)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="civil"
                      name="Civil"
                      stroke="#6366f1"
                      fill="url(#gradCivil)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-base-content/30 text-sm">
                  No monthly data available
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="card bg-base-100 shadow-md border border-base-200"
          >
            <div className="card-body p-5">
              <h3 className="text-base font-bold text-base-content/70 uppercase tracking-wider mb-4">
                Cases by Category
              </h3>
              {monthlyAgg.categoryBreakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={monthlyAgg.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {monthlyAgg.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", fontSize: 12 }}
                        formatter={(val) => fmt(num(val))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3 max-h-48 overflow-y-auto pr-1">
                    {monthlyAgg.categoryBreakdown.map((c, i) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="truncate flex-1 text-base-content/70">
                          {c.name}
                        </span>
                        <span className="font-semibold text-base-content">
                          {fmt(c.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-80 flex items-center justify-center text-base-content/30 text-sm">
                  No category data
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* ── Branch Performance ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="card bg-base-100 shadow-md border border-base-200"
          >
            <div className="card-body p-5">
              <h3 className="text-base font-bold text-base-content/70 uppercase tracking-wider mb-4">
                Top Branches (Monthly Reports)
              </h3>
              {monthlyAgg.branchBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={monthlyAgg.branchBreakdown}
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                      horizontal={false}
                    />
                    <XAxis type="number" tick={{ fontSize: 13 }} />
                    <YAxis
                      type="category"
                      dataKey="branch"
                      tick={{ fontSize: 13 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "1px solid rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 14 }}
                    />
                    <Bar
                      dataKey="criminal"
                      name="Criminal"
                      fill="#ef4444"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="civil"
                      name="Civil"
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-base-content/30 text-sm">
                  No branch data
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="card bg-base-100 shadow-md border border-base-200"
          >
            <div className="card-body p-5">
              <h3 className="text-base font-bold text-base-content/70 uppercase tracking-wider mb-4">
                Judgement Day — RTC Branches
              </h3>
              {judgementAgg.rtcBranches.length > 0 ? (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={judgementAgg.rtcBranches}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                    />
                    <XAxis dataKey="branch" tick={{ fontSize: 13 }} />
                    <YAxis tick={{ fontSize: 13 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "1px solid rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 14 }}
                    />
                    <Bar
                      dataKey="heard"
                      name="Cases Heard"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="disposed"
                      name="Disposed"
                      fill="#22d3ee"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-base-content/30 text-sm">
                  No RTC judgement data
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* ── MTC Summary Table ──────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="card bg-base-100 shadow-md border border-base-200"
        >
          <div className="card-body p-5">
            <h3 className="text-base font-bold text-base-content/70 uppercase tracking-wider mb-4">
              Judgement Day — MTC Branches Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="table table-md w-full">
                <thead>
                  <tr className="text-sm text-base-content/50 uppercase">
                    <th>Branch</th>
                    <th className="text-right">Civil (V)</th>
                    <th className="text-right">Criminal (V)</th>
                    <th className="text-right">Heard</th>
                    <th className="text-right">Disposed</th>
                    <th className="text-right">PDL Total</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {mtc.length > 0 ? (
                    mtc.map((r) => (
                      <tr key={r.id} className="hover">
                        <td className="font-medium">
                          {r.branchNo ?? `Branch ${r.id}`}
                        </td>
                        <td className="text-right">{fmt(num(r.civilV))}</td>
                        <td className="text-right">{fmt(num(r.criminalV))}</td>
                        <td className="text-right">{fmt(num(r.totalHeard))}</td>
                        <td className="text-right">
                          {fmt(num(r.totalDisposed))}
                        </td>
                        <td className="text-right">{fmt(num(r.pdlTotal))}</td>
                        <td className="text-right font-semibold">
                          {fmt(num(r.total))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center text-base-content/30 py-8"
                      >
                        No MTC judgement data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ── Recent Monthly Records Table ────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="card bg-base-100 shadow-md border border-base-200"
        >
          <div className="card-body p-5">
            <h3 className="text-base font-bold text-base-content/70 uppercase tracking-wider mb-4">
              Recent Monthly Records
            </h3>
            <div className="overflow-x-auto">
              <table className="table table-md w-full">
                <thead>
                  <tr className="text-sm text-base-content/50 uppercase">
                    <th>Month</th>
                    <th>Category</th>
                    <th>Branch</th>
                    <th className="text-right">Criminal</th>
                    <th className="text-right">Civil</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.length > 0 ? (
                    monthly.slice(0, 15).map((r) => (
                      <tr
                        key={r.id ?? `${r.month}-${r.category}-${r.branch}`}
                        className="hover"
                      >
                        <td className="font-medium">{r.month}</td>
                        <td>{r.category}</td>
                        <td>{r.branch}</td>
                        <td className="text-right">{fmt(r.criminal)}</td>
                        <td className="text-right">{fmt(r.civil)}</td>
                        <td className="text-right font-semibold">
                          {fmt(r.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-base-content/30 py-8"
                      >
                        No monthly records available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default StatisticsDashboard;
