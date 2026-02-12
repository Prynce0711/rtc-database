"use client";

import { getCases } from "@/app/components/Case/CasesActions";
import {
  BarChart3,
  Calendar,
  FileText,
  Lock,
  RefreshCw,
  Scale,
  Server,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
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
  const [isVisible, setIsVisible] = useState(false);
  const getCssVar = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await getCases();
        if (res.success) {
          setCases(res.result);
          setTimeout(() => setIsVisible(true), 100);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="card bg-base-100 shadow-2xl border-2 border-primary/30 p-4">
        <p className="font-bold text-base-content mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <span className="text-sm font-semibold text-base-content/70">
              {entry.name}:
            </span>
            <span className="text-xl font-bold" style={{ color: entry.color }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-28 w-28 mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/50" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary shadow-2xl">
                <Server className="h-14 w-14 text-primary-content animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-base-content mb-2">
              Loading Attorney Dashboard
            </h2>
            <p className="text-lg text-base-content/60">
              Fetching case analytics...
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-base-100">
        <div className=" mx-auto px-4 ">
          <div className="space-y-6 ">
            {/* HEADER */}
            <header className={`transform transition-all duration-700 card `}>
              <div className="card-body p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-base-content">
                        Attorney Dashboard
                      </h1>
                      <p className="text-base-content/60 text-base sm:text-lg flex items-center gap-2 mt-1">
                        Legal case monitoring and performance insights
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <div className="relative flex p-1 rounded-full bg-base-200 border border-base-300 flex-1 sm:flex-initial">
                      {/* Sliding Indicator */}
                      <div
                        className="absolute top-1 bottom-1 rounded-full bg-base-100 shadow-md transition-all duration-300"
                        style={{
                          width: "calc(50% - 4px)",
                          left:
                            activeTab === "overview"
                              ? "4px"
                              : "calc(50% + 0px)",
                        }}
                      />

                      {[
                        { id: "overview", label: "Overview", icon: BarChart3 },
                        {
                          id: "analytics",
                          label: "Analytics",
                          icon: TrendingUp,
                        },
                      ].map((tab) => {
                        const Icon = tab.icon;

                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
          relative z-10 flex items-center gap-2 px-4 py-1.5 flex-1
          font-semibold text-sm transition-colors duration-200
          ${
            activeTab === tab.id
              ? "text-primary"
              : "text-base-content/60 hover:text-base-content"
          }
        `}
                          >
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />

                            <span className="hidden sm:inline">
                              {tab.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button className="btn btn-outline btn-primary hover:scale-105 transition-transform">
                      <RefreshCw className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6 sm:space-y-8">
                {/* KPI */}
                <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
                  {[
                    {
                      label: "Total Cases",
                      value: stats.total,
                      subtitle: "All cases",
                      icon: Scale,
                      color: "primary",
                      delay: 0,
                    },
                    {
                      label: "Active",
                      value: stats.active,
                      subtitle: "Not detained",
                      icon: FileText,
                      color: "success",
                      delay: 100,
                    },
                    {
                      label: "Detained",
                      value: stats.detained,
                      subtitle: `${stats.detainedPercentage.toFixed(1)}% of total`,
                      icon: Lock,
                      color: "warning",
                      delay: 200,
                    },
                    {
                      label: "This Month",
                      value: stats.thisMonth,
                      subtitle: "Recent filings",
                      icon: Calendar,
                      color: "info",
                      delay: 300,
                    },
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      className={`transform transition-all duration-700 hover:scale-105 ${
                        isVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      } card shadow-xl hover:shadow-2xl group`}
                      style={{ transitionDelay: `${card.delay}ms` }}
                    >
                      <div className="card-body p-4 sm:p-6 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 opacity-5 transition-all group-hover:opacity-10 group-hover:scale-110">
                          <card.icon className="h-full w-full" />
                        </div>
                        <div className="relative">
                          <div
                            className={`badge badge-${card.color} gap-2 mb-3`}
                          >
                            <span className="font-bold uppercase text-xs">
                              {card.label}
                            </span>
                          </div>
                          <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                            {card.value}
                          </p>
                          <p className="text-sm sm:text-base font-semibold text-base-content/60">
                            {card.subtitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                {/* CHART */}
                <section className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <div className="card-body p-4 sm:p-6 lg:p-8">
                    <div className="mb-6">
                      <h2 className="card-title text-2xl sm:text-3xl font-black">
                        Case Growth Trends
                      </h2>
                      <p className="text-base sm:text-lg font-medium text-base-content/60">
                        Six-month performance overview
                      </p>
                    </div>

                    <div className="card bg-base-200">
                      <div className="card-body p-3 sm:p-4">
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart
                            data={monthlyTrends}
                            margin={{
                              top: 10,
                              right: 10,
                              left: -20,
                              bottom: 0,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="colorCases"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor={getCssVar("--color-primary")}
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={getCssVar("--color-primary")}
                                  stopOpacity={0.05}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={getCssVar("--color-base-content")}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="month"
                              fontSize={12}
                              fontWeight={600}
                              stroke={getCssVar("--color-base-content")}
                            />
                            <YAxis
                              fontSize={12}
                              fontWeight={600}
                              stroke={getCssVar("--color-base-content")}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="cases"
                              stroke={getCssVar("--color-primary")}
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#colorCases)"
                              name="Cases Filed"
                              dot={{
                                r: 4,
                                fill: getCssVar("--color-primary"),

                                stroke: "#fff",
                                strokeWidth: 2,
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </section>

                {/* RECENT CASES */}
                <section className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <RecentCases
                    cases={cases.slice(0, 5)}
                    onViewAll={() => onNavigate?.("cases")}
                  />
                </section>
              </div>
            )}

            {/* ANALYTICS */}
            {activeTab === "analytics" && (
              <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
                {/* DETENTION BREAKDOWN */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <div className="card-body p-4 sm:p-6 lg:p-8">
                    <h2 className="card-title text-2xl sm:text-3xl font-black mb-3">
                      Detention Breakdown
                    </h2>
                    <p className="text-base sm:text-lg font-medium text-base-content/60 mb-6">
                      Status distribution
                    </p>

                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: "Detained",
                              value: stats.detained,
                              fill: getCssVar("--color-warning"),
                            },
                            {
                              name: "Released",
                              value: stats.total - stats.detained,
                              fill: getCssVar("--color-success"),
                            },
                          ]}
                          dataKey="value"
                          outerRadius={110}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          <Cell fill={getCssVar("--color-warning")} />

                          <Cell fill={getCssVar("--color-success")} />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          height={40}
                          iconType="circle"
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="stats bg-warning/10 border-2 border-warning/20 hover:scale-105 transition-transform">
                        <div className="stat p-4 text-center">
                          <div className="stat-title text-sm font-bold text-warning">
                            Detained
                          </div>
                          <div className="stat-value text-3xl text-warning">
                            {stats.detained}
                          </div>
                        </div>
                      </div>
                      <div className="stats bg-success/10 border-2 border-success/20 hover:scale-105 transition-transform">
                        <div className="stat p-4 text-center">
                          <div className="stat-title text-sm font-bold text-success">
                            Released
                          </div>
                          <div className="stat-value text-3xl text-success">
                            {stats.total - stats.detained}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BRANCH DISTRIBUTION */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <div className="card-body p-4 sm:p-6 lg:p-8">
                    <h2 className="card-title text-2xl sm:text-3xl font-black mb-3">
                      Branch Distribution
                    </h2>
                    <p className="text-base sm:text-lg font-medium text-base-content/60 mb-6">
                      Cases by location
                    </p>

                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchPerformance}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={getCssVar("--color-base-content")}
                        />
                        <XAxis
                          dataKey="branch"
                          fontSize={12}
                          fontWeight={600}
                          stroke={getCssVar("--color-base-content")}
                        />
                        <YAxis
                          fontSize={12}
                          fontWeight={600}
                          stroke={getCssVar("--color-base-content")}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="cases"
                          fill={getCssVar("--color-primary")}
                          radius={[8, 8, 0, 0]}
                          name="Cases"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AttorneyDashboard;
