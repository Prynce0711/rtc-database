"use client";

import { getAccounts } from "@/app/components/AccountManagement/AccountActions";
import { getCases } from "@/app/components/Case/CasesActions";
import { getEmployees } from "@/app/components/Employee/EmployeeActions";
import type { Employee, User } from "@/app/generated/prisma/browser";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  Download,
  FileText,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
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
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Case } from "../../generated/prisma/client";
import { RecentCases } from "./AdminCard";
import DashboardLayout from "./DashboardLayout";

interface Props {
  onNavigate?: (view: string) => void;
}

interface Alert {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  count?: number;
  action?: () => void;
}

interface AuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  timestamp: Date;
  type: "create" | "update" | "delete" | "export" | "login";
}

const AdminDashboard: React.FC<Props> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">(
    "overview",
  );
  const [isVisible, setIsVisible] = useState(false);
  const getCssVar = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  useEffect(() => {
    async function fetchAll() {
      try {
        const [c, e, a] = await Promise.all([
          getCases(),
          getEmployees(),
          getAccounts(),
        ]);
        if (c.success) setCases(c.result);
        if (e.success) setEmployees(e.result);
        if (a.success) setAccounts(a.result);
        setTimeout(() => setIsVisible(true), 100);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const totalCases = cases.length;
    const detained = cases.filter((c) => c.detained).length;
    const pendingRaffle = cases.filter((c) => !c.raffleDate).length;
    const casesThisMonth = cases.filter(
      (c) => new Date(c.dateFiled) >= thirtyDaysAgo,
    ).length;
    const casesLastMonth = cases.filter((c) => {
      const date = new Date(c.dateFiled);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length;

    const activeAccounts = accounts.filter((a) => a.status === "ACTIVE").length;
    const inactiveAccounts = accounts.filter(
      (a) => a.status === "INACTIVE",
    ).length;
    const caseGrowth =
      casesLastMonth > 0
        ? ((casesThisMonth - casesLastMonth) / casesLastMonth) * 100
        : 0;

    return {
      totalCases,
      detained,
      pendingRaffle,
      activeCases:
        totalCases -
        cases.filter((c) => c.raffleDate && new Date(c.raffleDate) < now)
          .length,
      employees: employees.length,
      employeesMissing: employees.filter(
        (e) => !e.bloodType || !e.contactPerson,
      ).length,
      accounts: accounts.length,
      activeAccounts,
      inactiveAccounts,
      casesThisMonth,
      caseGrowth,
      detainedPercentage: totalCases > 0 ? (detained / totalCases) * 100 : 0,
    };
  }, [cases, employees, accounts]);

  const alerts = useMemo((): Alert[] => {
    const alertList: Alert[] = [];
    if (stats.pendingRaffle > 0) {
      alertList.push({
        id: "pending-raffle",
        type: "error",
        title: "Cases Missing Raffle Date",
        message: `${stats.pendingRaffle} cases require immediate raffle date assignment`,
        count: stats.pendingRaffle,
        action: () => onNavigate?.("cases"),
      });
    }
    if (stats.employeesMissing > 0) {
      alertList.push({
        id: "employee-compliance",
        type: "warning",
        title: "Incomplete Employee Records",
        message: `${stats.employeesMissing} employees missing information`,
        count: stats.employeesMissing,
        action: () => onNavigate?.("employees"),
      });
    }
    return alertList;
  }, [stats, onNavigate]);

  const auditLogs = useMemo((): AuditLog[] => {
    const logs: AuditLog[] = [];
    cases.slice(0, 5).forEach((c, i) => {
      logs.push({
        id: `log-${i}`,
        action: "Case Created",
        user: "Admin User",
        details: `Case ${c.caseNumber} filed`,
        timestamp: new Date(c.dateFiled),
        type: "create",
      });
    });
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [cases]);

  const branchPerformance = useMemo(() => {
    const branchMap: Record<
      string,
      { cases: number; detained: number; pending: number }
    > = {};
    cases.forEach((c) => {
      if (!c.branch) return;
      if (!branchMap[c.branch]) {
        branchMap[c.branch] = { cases: 0, detained: 0, pending: 0 };
      }
      branchMap[c.branch].cases++;
      if (c.detained) branchMap[c.branch].detained++;
      if (!c.raffleDate) branchMap[c.branch].pending++;
    });
    return Object.entries(branchMap)
      .map(([branch, data]) => ({
        branch,
        ...data,
        efficiency:
          data.cases > 0 ? ((data.cases - data.pending) / data.cases) * 100 : 0,
      }))
      .sort((a, b) => b.cases - a.cases);
  }, [cases]);

  const monthlyTrends = useMemo(() => {
    const monthMap: Record<string, { cases: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      monthMap[key] = { cases: 0 };
    }
    cases.forEach((c) => {
      const key = new Date(c.dateFiled).toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      if (monthMap[key]) monthMap[key].cases++;
    });
    return Object.entries(monthMap).map(([month, data]) => ({
      month,
      ...data,
    }));
  }, [cases]);

  const dataQuality = useMemo(() => {
    const totalRecords = cases.length + employees.length + accounts.length;
    const incompleteRecords =
      cases.filter((c) => !c.branch || !c.raffleDate).length +
      stats.employeesMissing +
      accounts.filter((a) => !a.email).length;
    return {
      total: totalRecords,
      complete: totalRecords - incompleteRecords,
      incomplete: incompleteRecords,
      quality:
        totalRecords > 0
          ? ((totalRecords - incompleteRecords) / totalRecords) * 100
          : 0,
    };
  }, [cases, employees, accounts, stats.employeesMissing]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="card bg-base-100 shadow-2xl border-2 border-primary/30 p-4 animate-in fade-in zoom-in-95 duration-200">
        <p className="font-bold text-base-content mb-2 text-base">{label}</p>
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
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="text-center">
            <div className="relative mx-auto h-28 w-28 mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/50" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary shadow-2xl">
                <Server className="h-14 w-14 text-primary-content animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-base-content mb-2">
              Loading Dashboard
            </h2>
            <p className="text-lg text-base-content/60">
              Fetching system analytics...
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
      <div className="min-h-screen">
        <div className="mx-auto w-full">
          <div className="space-y-6">
            {/* HEADER */}
            <header className={`bg-base-100 `}>
              <div className="card-body p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                        Administration Dashboard
                      </h1>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base font-medium text-base-content/60">
                      <span className="flex items-center gap-2">
                        <span className="text-base sm:text-lg">
                          Real-time case management and monitoring
                        </span>
                      </span>
                      <span className="hidden sm:inline text-base-content/40"></span>
                      <span className="text-base-content/50">
                        Last sync: {new Date().toLocaleTimeString()}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="relative flex p-1 rounded-full bg-base-200 border border-base-300 w-full sm:w-auto">
                      {/* Sliding indicator */}
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

                            <span className="sm:hidden text-xs">
                              {tab.label.slice(0, 4)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button className="btn btn-outline btn-primary gap-2 flex-1 sm:flex-initial hover:scale-105 transition-transform">
                        <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Export</span>
                      </button>
                      <button className="btn btn-primary gap-2 flex-1 sm:flex-initial hover:scale-105 transition-transform">
                        <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* ALERTS */}
            {alerts.length > 0 && (
              <section className={`space-y-3`}>
                {alerts.map((alert, idx) => (
                  <div
                    key={alert.id}
                    className={`alert ${alert.type === "error" ? "alert-error" : alert.type === "warning" ? "alert-warning" : "alert-info"} shadow-lg animate-in slide-in-from-left duration-500`}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex-shrink-0">
                      {alert.type === "error" && (
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                      {alert.type === "warning" && (
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                      {alert.type === "info" && (
                        <Info className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base sm:text-lg">
                        {alert.title}
                        {alert.count && (
                          <span className="ml-2 text-sm">({alert.count})</span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm">{alert.message}</p>
                    </div>
                    {alert.action && (
                      <button
                        onClick={alert.action}
                        className="btn btn-sm hover:scale-105 transition-transform"
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-6 sm:space-y-8">
                {/* PRIMARY KPI CARDS */}
                <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
                  {[
                    {
                      label: "Total Cases",
                      value: stats.totalCases,
                      subtitle: `${stats.casesThisMonth} filed this month`,
                      icon: Scale,
                      color: "primary",
                      trend: stats.caseGrowth,
                      delay: 0,
                    },
                    {
                      label: "Active Cases",
                      value: stats.activeCases,
                      subtitle: `${stats.pendingRaffle} pending raffle`,
                      icon: FileText,
                      color: "primary",
                      delay: 100,
                    },
                    {
                      label: "In Detention",
                      value: stats.detained,
                      subtitle: `${stats.detainedPercentage.toFixed(1)}% of total`,
                      icon: Lock,
                      color: "primary",
                      delay: 200,
                    },
                    {
                      label: "Active Users",
                      value: stats.activeAccounts,
                      subtitle: `${stats.inactiveAccounts} inactive`,
                      icon: Shield,
                      color: "primary",
                      delay: 300,
                    },
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      className={`transform transition-all duration-700 hover:scale-105 ${
                        isVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      } card  shadow-xl hover:shadow-2xl group`}
                      style={{ transitionDelay: `${card.delay}ms` }}
                    >
                      <div className="card-body p-4 sm:p-6 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                          <card.icon className="h-full w-full" />
                        </div>
                        <div className="relative">
                          <div className={` badge-primary gap-2 mb-3`}>
                            <span className="font-bold uppercase text-lg">
                              {card.label}
                            </span>
                          </div>
                          <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                            {card.value}
                          </p>
                          <p className="text-sm sm:text-base font-semibold text-base-content/60">
                            {card.subtitle}
                          </p>
                          {card.trend !== undefined && card.trend !== 0 && (
                            <div
                              className={`mt-3 inline-flex items-center gap-2 badge ${
                                card.trend >= 0
                                  ? "badge-success"
                                  : "badge-error"
                              }`}
                            >
                              {card.trend >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              <span className="font-bold text-xs">
                                {card.trend >= 0 ? "+" : ""}
                                {card.trend.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                {/* SECONDARY METRICS */}
                <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
                  {[
                    {
                      label: "Employees",
                      value: stats.employees,
                      subtitle: `${stats.employeesMissing} incomplete`,
                      icon: Users,
                    },
                    {
                      label: "Branches",
                      value: branchPerformance.length,
                      subtitle: "Active locations",
                      icon: Building2,
                    },
                    {
                      label: "Data Quality",
                      value: `${dataQuality.quality.toFixed(0)}%`,
                      subtitle: `${dataQuality.incomplete} incomplete`,
                      icon: BarChart3,
                    },
                    {
                      label: "This Month",
                      value: stats.casesThisMonth,
                      subtitle: `${stats.caseGrowth >= 0 ? "+" : ""}${stats.caseGrowth.toFixed(1)}%`,
                      icon: Calendar,
                    },
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      className="stats shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                    >
                      <div className="stat p-4 sm:p-6 gap-2">
                        <div className="stat-title text-xs sm:text-sm font-bold uppercase">
                          {card.label}
                        </div>
                        <div className="stat-value text-2xl sm:text-3xl">
                          {card.value}
                        </div>
                        <div className="stat-desc text-xs sm:text-sm font-semibold">
                          {card.subtitle}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                {/* CHARTS */}
                <section className="grid gap-6 sm:gap-8 lg:grid-cols-3">
                  {/* TRENDS */}
                  <div className="lg:col-span-2 card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body p-4 sm:p-6 lg:p-8">
                      <div className="mb-6">
                        <h2 className="card-title text-2xl sm:text-3xl font-black">
                          Case Filing Trends
                        </h2>
                        <p className="text-base sm:text-lg font-medium text-base-content/60">
                          Six-month case volume analysis
                        </p>
                      </div>

                      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
                        {[
                          {
                            label: "Total Filed",
                            value: monthlyTrends.reduce(
                              (sum, m) => sum + m.cases,
                              0,
                            ),
                            color: "primary",
                            desc: "Last 6 months",
                          },
                          {
                            label: "Monthly Avg",
                            value: (
                              monthlyTrends.reduce(
                                (sum, m) => sum + m.cases,
                                0,
                              ) / monthlyTrends.length
                            ).toFixed(0),
                            color: "success",
                            desc: "Cases/month",
                          },
                          {
                            label: "Monthly Change",
                            value: `${stats.caseGrowth >= 0 ? "+" : ""}${stats.caseGrowth.toFixed(1)}%`,
                            color: stats.caseGrowth >= 0 ? "success" : "error",
                            desc: "vs. last month",
                          },
                        ].map((metric, idx) => (
                          <div
                            key={idx}
                            className={`card bg-${metric.color}/10 border-2 border-${metric.color}/20 hover:scale-105 transition-transform`}
                          >
                            <div className="card-body p-3 sm:p-4">
                              <p
                                className={`text-xs font-bold uppercase text-${metric.color}`}
                              >
                                {metric.label}
                              </p>
                              <p
                                className={`text-2xl sm:text-3xl font-bold text-${metric.color}`}
                              >
                                {metric.value}
                              </p>
                              <p className="text-xs sm:text-sm font-semibold text-base-content/60">
                                {metric.desc}
                              </p>
                            </div>
                          </div>
                        ))}
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
                                tickLine={false}
                                stroke={getCssVar("--color-base-content")}
                              />
                              <YAxis
                                fontSize={12}
                                fontWeight={600}
                                tickLine={false}
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
                                  fill: "oklch(var(--p))",
                                  stroke: "#fff",
                                  strokeWidth: 2,
                                }}
                                activeDot={{
                                  r: 7,
                                  fill: "oklch(var(--p))",
                                  stroke: "#fff",
                                  strokeWidth: 3,
                                }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DATA QUALITY */}
                  <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body p-4 sm:p-6 lg:p-8">
                      <div className="mb-6">
                        <h2 className="card-title text-2xl sm:text-3xl font-black">
                          Data Quality
                        </h2>
                        <p className="text-base sm:text-lg font-medium text-base-content/60">
                          System completeness
                        </p>
                      </div>

                      <ResponsiveContainer width="100%" height={220}>
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="100%"
                          data={[
                            {
                              name: "Quality",
                              value: dataQuality.quality,
                              fill: getCssVar("--color-success"),
                            },
                          ]}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <RadialBar
                            minAngle={15}
                            background={{ fill: getCssVar("--color-base-200") }}
                            clockWise
                            dataKey="value"
                            cornerRadius={10}
                          />

                          <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={getCssVar("--color-base-content")}
                            className="text-4xl font-bold"
                          >
                            {dataQuality.quality.toFixed(0)}%
                          </text>
                        </RadialBarChart>
                      </ResponsiveContainer>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6">
                        <div className="stats bg-success/10 border-2 border-success/20 hover:scale-105 transition-transform">
                          <div className="stat p-3 sm:p-4 text-center">
                            <div className="stat-title text-xs font-bold text-success">
                              Complete
                            </div>
                            <div className="stat-value text-2xl sm:text-3xl text-success">
                              {dataQuality.complete}
                            </div>
                          </div>
                        </div>
                        <div className="stats bg-error/10 border-2 border-error/20 hover:scale-105 transition-transform">
                          <div className="stat p-3 sm:p-4 text-center">
                            <div className="stat-title text-xs font-bold text-error">
                              Incomplete
                            </div>
                            <div className="stat-value text-2xl sm:text-3xl text-error">
                              {dataQuality.incomplete}
                            </div>
                          </div>
                        </div>
                      </div>

                      {dataQuality.incomplete > 0 && (
                        <button className="btn btn-primary btn-block mt-4 hover:scale-105 transition-transform">
                          Review Incomplete Records
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* BRANCH & ACTIVITY */}
                <section className="grid gap-6 sm:gap-8 lg:grid-cols-3">
                  {/* BRANCH WORKLOAD */}
                  <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body p-4 sm:p-6 lg:p-8">
                      <h2 className="card-title text-xl sm:text-2xl font-black">
                        Branch Workload
                      </h2>
                      <p className="text-sm sm:text-base font-medium text-base-content/60">
                        Case distribution
                      </p>

                      <ResponsiveContainer width="100%" height={700}>
                        <BarChart
                          data={branchPerformance.slice(0, 5)}
                          layout="vertical"
                          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={getCssVar("--color-base-content")}
                          />
                          <XAxis
                            type="number"
                            fontSize={11}
                            fontWeight={600}
                            stroke={getCssVar("--color-base-content")}
                          />
                          <YAxis
                            type="category"
                            dataKey="branch"
                            fontSize={12}
                            fontWeight={700}
                            width={100}
                            stroke={getCssVar("--color-base-content")}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="cases"
                            fill={getCssVar("--color-primary")}
                            radius={[0, 8, 8, 0]}
                            name="Total Cases"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* RECENT ACTIVITY */}
                  <div className="lg:col-span-2 card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body p-4 sm:p-6 lg:p-8">
                      <h2 className="card-title text-xl sm:text-2xl font-black">
                        Recent Activity
                      </h2>
                      <p className="text-sm sm:text-base font-medium text-base-content/60">
                        Latest system events
                      </p>

                      <div className="space-y-3 sm:space-y-4 mt-4">
                        {auditLogs.slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className="card bg-base-200 hover:bg-base-300 hover:scale-[1.02] transition-all"
                          >
                            <div className="card-body p-3 sm:p-4 flex-row items-start gap-3 sm:gap-4">
                              <div
                                className={`avatar placeholder ${
                                  log.type === "create"
                                    ? "bg-success"
                                    : log.type === "update"
                                      ? "bg-info"
                                      : log.type === "delete"
                                        ? "bg-error"
                                        : log.type === "export"
                                          ? "bg-secondary"
                                          : "bg-neutral"
                                }`}
                              >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg text-base-100">
                                  {log.type === "create" && (
                                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                                  )}
                                  {log.type === "update" && (
                                    <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
                                  )}
                                  {log.type === "delete" && (
                                    <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                                  )}
                                  {log.type === "export" && (
                                    <Download className="h-5 w-5 sm:h-6 sm:w-6" />
                                  )}
                                  {log.type === "login" && (
                                    <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base sm:text-lg font-bold text-base-content">
                                  {log.action}
                                </p>
                                <p className="mt-1 text-sm sm:text-base font-medium text-base-content/70">
                                  {log.details}
                                </p>
                                <p className="mt-2 text-xs sm:text-sm font-semibold text-base-content/50">
                                  {log.user} • {log.timestamp.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button className="btn btn-outline btn-primary btn-block mt-6  transition-transform">
                        View All Activity
                      </button>
                    </div>
                  </div>
                </section>

                {/* RECENT CASES */}
                <section className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <RecentCases
                    cases={cases}
                    view="table"
                    onViewAll={() => onNavigate?.("cases")}
                  />
                </section>
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
                {/* DETENTION ANALYSIS */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <div className="card-body p-4 sm:p-6 lg:p-8">
                    <h2 className="card-title text-xl sm:text-2xl font-black">
                      Detention Status Analysis
                    </h2>
                    <p className="text-sm sm:text-base font-medium text-base-content/60">
                      Current distribution
                    </p>

                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: "In Detention",
                              value: stats.detained,
                              fill: "oklch(var(--wa))",
                            },
                            {
                              name: "Released/Free",
                              value: stats.totalCases - stats.detained,
                              fill: getCssVar("--color-success"),
                            },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          dataKey="value"
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
                          <div className="stat-value text-3xl sm:text-4xl text-warning">
                            {stats.detained}
                          </div>
                        </div>
                      </div>
                      <div className="stats bg-success/10 border-2 border-success/20 hover:scale-105 transition-transform">
                        <div className="stat p-4 text-center">
                          <div className="stat-title text-sm font-bold text-success">
                            Released
                          </div>
                          <div className="stat-value text-3xl sm:text-4xl text-success">
                            {stats.totalCases - stats.detained}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BRANCH EFFICIENCY */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                  <div className="card-body p-4 sm:p-6 lg:p-8">
                    <h2 className="card-title text-xl sm:text-2xl font-black">
                      Branch Processing Efficiency
                    </h2>
                    <p className="text-sm sm:text-base font-medium text-base-content/60">
                      Completion rates
                    </p>

                    <div className="space-y-5 sm:space-y-6 mt-6">
                      {branchPerformance.slice(0, 5).map((branch) => (
                        <div
                          key={branch.branch}
                          className="hover:scale-[1.02] transition-transform"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-base sm:text-lg font-bold">
                              {branch.branch}
                            </span>
                            <span className="text-lg sm:text-xl font-bold text-primary">
                              {branch.efficiency.toFixed(1)}%
                            </span>
                          </div>
                          <progress
                            className="progress progress-primary w-full h-3 sm:h-4"
                            value={branch.efficiency}
                            max="100"
                          />
                          <div className="mt-2 flex justify-between text-xs sm:text-sm font-semibold text-base-content/60">
                            <span>{branch.cases} total cases</span>
                            <span>{branch.pending} pending</span>
                          </div>
                        </div>
                      ))}
                    </div>
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

export default AdminDashboard;
