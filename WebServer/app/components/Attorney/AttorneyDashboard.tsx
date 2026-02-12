"use client";

import { getCases } from "@/app/components/Case/CasesActions";
import { BarChart3, RefreshCw, Scale, Server } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Case } from "../../generated/prisma/client";
import DashboardLayout from "../Dashboard/DashboardLayout";
import { RecentCases } from "./AttorneyCard";

interface Props {
  onNavigate?: (view: string) => void;
}

const AttorneyDashboard: React.FC<Props> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">(
    "overview",
  );

  /* ================= FETCH CASES ================= */
  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await getCases();
        if (res.success) setCases(res.result);
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  /* ================= KPI STATS ================= */
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const total = cases.length;
    const detained = cases.filter((c) => c.detained).length;
    const pendingRaffle = cases.filter((c) => !c.raffleDate).length;

    const thisMonth = cases.filter(
      (c) => new Date(c.dateFiled) >= thirtyDaysAgo,
    ).length;

    const lastMonth = cases.filter((c) => {
      const date = new Date(c.dateFiled);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length;

    const growth =
      lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return {
      total,
      detained,
      pendingRaffle,
      active: total - detained,
      thisMonth,
      growth,
      detainedPercentage: total > 0 ? (detained / total) * 100 : 0,
    };
  }, [cases]);

  /* ================= MONTHLY TREND ================= */
  const monthlyTrends = useMemo(() => {
    const monthMap: Record<string, number> = {};

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      monthMap[key] = 0;
    }

    cases.forEach((c) => {
      const key = new Date(c.dateFiled).toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      if (monthMap[key] !== undefined) monthMap[key]++;
    });

    return Object.entries(monthMap).map(([month, value]) => ({
      month,
      cases: value,
    }));
  }, [cases]);

  /* ================= BRANCH PERFORMANCE ================= */
  const branchPerformance = useMemo(() => {
    const branchMap: Record<string, number> = {};

    cases.forEach((c) => {
      if (!c.branch) return;
      branchMap[c.branch] = (branchMap[c.branch] || 0) + 1;
    });

    return Object.entries(branchMap).map(([branch, count]) => ({
      branch,
      cases: count,
    }));
  }, [cases]);

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Server className="h-10 w-10 animate-pulse text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-base-100">
        <div className="max-w-[1800px] mx-auto space-y-8 pb-8">
          {/* HEADER */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
            <div>
              <h1 className="text-5xl font-black text-base-content">
                Attorney Dashboard
              </h1>
              <p className="text-base-content/60 text-xl">
                Legal case monitoring and performance insights
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("overview")}
                className={`btn ${activeTab === "overview" ? "btn-primary" : "btn-ghost"}`}
              >
                <BarChart3 className="h-5 w-5" /> Overview
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`btn ${activeTab === "analytics" ? "btn-primary" : "btn-ghost"}`}
              >
                <Scale className="h-5 w-5" /> Analytics
              </button>
              <button className="btn btn-outline">
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ================= OVERVIEW ================= */}
          {activeTab === "overview" && (
            <>
              {/* KPI */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-center">
                <div className="rounded-2xl bg-base-300 p-6 shadow-lg ">
                  <p className="font-bold uppercase mb-2">Total Cases</p>
                  <p className="text-5xl font-black text-primary ">
                    {stats.total}
                  </p>
                </div>

                <div className="rounded-2xl bg-base-300 p-6 shadow-lg">
                  <p className="font-bold uppercase mb-2">Active</p>
                  <p className="text-5xl font-black text-primary">
                    {stats.active}
                  </p>
                </div>

                <div className="rounded-2xl bg-base-300 p-6 shadow-lg">
                  <p className="font-bold uppercase mb-2">Detained</p>
                  <p className="text-5xl font-black text-primary">
                    {stats.detained}
                  </p>
                </div>

                <div className="rounded-2xl bg-base-300 p-6 shadow-lg">
                  <p className="font-bold uppercase mb-2">This Month</p>
                  <p className="text-5xl font-black text-primary  ">
                    {stats.thisMonth}
                  </p>
                </div>
              </div>

              {/* CHART */}
              <div className="rounded-2xl bg-base-100 p-8 shadow-xl">
                <h2 className="text-3xl font-black ">Case Growth Trends</h2>
                <p className=" text-lg font-medium text-base-content/50 mb-6">
                  1 month performance overview
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyTrends}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="cases"
                      stroke="#4f46e5"
                      fill="#c7d2fe"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* RECENT CASES */}
              <RecentCases
                cases={cases.slice(0, 5)}
                onViewAll={() => onNavigate?.("cases")}
              />
            </>
          )}

          {/* ================= ANALYTICS ================= */}
          {activeTab === "analytics" && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-2xl bg-base-100 p-8 shadow-xl">
                <h2 className="text-3xl font-black">Detention Breakdown</h2>{" "}
                <p className=" text-base text-lg font-medium text-base-content/50  mb-6">
                  Status breakdown
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Detained", value: stats.detained },
                        {
                          name: "Released",
                          value: stats.total - stats.detained,
                        },
                      ]}
                      dataKey="value"
                      outerRadius={110}
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl bg-base-100 p-8 shadow-xl">
                <h2 className="text-3xl font-black ">Branch Distribution</h2>{" "}
                <p className=" text-base text-lg font-medium text-base-content/50  mb-6">
                  Processing completion rates
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={branchPerformance}>
                    <XAxis dataKey="branch" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="cases" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AttorneyDashboard;
