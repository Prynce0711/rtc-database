"use client";

import { getAccounts } from "@/app/components/AccountManagement/AccountActions";
import { getCases } from "@/app/components/Case/CasesActions";
import { getEmployees } from "@/app/components/Employee/EmployeeActions";
import type { Employee, User } from "@/app/generated/prisma/browser";
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Info,
  Lock,
  RefreshCw,
  Scale,
  Server,
  Shield,
  TrendingDown,
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
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        action: () => router.push("/user/employees"),
      });
    }
    return alertList;
  }, [stats, onNavigate, router]);

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
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];

    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);

    return days;
  }, [currentDate]);

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
      <div
        className="surface-card p-4 animate-scale-in"
        style={{
          boxShadow: "var(--shadow-elevated)",
          borderColor: "var(--surface-border-strong)",
        }}
      >
        <p className="font-bold text-base-content mb-2 text-base">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <span className="text-sm font-semibold text-muted">
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
            <p className="text-lg text-muted">Fetching system analytics...</p>
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
            <header className="surface-card animate-fade-in">
              <div
                className="card-body"
                style={{ padding: "var(--space-card-padding)" }}
              >
                <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                        Administration Dashboard
                      </h1>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base font-medium text-muted">
                      <span className="flex items-center gap-2">
                        <span className="text-base sm:text-lg">
                          Real-time case management and monitoring
                        </span>
                      </span>
                      <span className="hidden sm:inline text-subtle"></span>
                      <span className="text-subtle">
                        Last sync: {new Date().toLocaleTimeString()}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div
                      className="relative flex p-1 bg-base-200 border border-base-300 w-full sm:w-auto"
                      style={{ borderRadius: "var(--radius-pill)" }}
                    >
                      {/* Sliding indicator */}
                      <div
                        className="absolute top-1 bottom-1 bg-base-100 transition-all"
                        style={{
                          borderRadius: "var(--radius-pill)",
                          boxShadow: "var(--shadow-soft)",
                          transitionDuration: "var(--transition-base)",
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
          font-semibold text-sm
          ${
            activeTab === tab.id
              ? "text-primary"
              : "text-muted hover:text-base-content"
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
                      <button
                        className="btn btn-outline btn-primary gap-2 flex-1 sm:flex-initial"
                        style={{
                          borderRadius: "var(--radius-field)",
                          transition: "var(--transition-base)",
                        }}
                      >
                        <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Export</span>
                      </button>
                      <button
                        className="btn btn-primary gap-2 flex-1 sm:flex-initial"
                        style={{
                          borderRadius: "var(--radius-field)",
                          transition: "var(--transition-base)",
                        }}
                      >
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
              <div
                className="animate-fade-in"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-section-gap)",
                }}
              >
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
                      className={`transform hover:scale-105 ${
                        isVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      } card surface-card-hover group`}
                      style={{
                        transitionDelay: `${card.delay}ms`,
                        transition: "all 700ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      <div
                        className="card-body relative overflow-hidden"
                        style={{ padding: "var(--space-card-padding)" }}
                      >
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
                          <p className="text-sm sm:text-base font-semibold text-muted">
                            {card.subtitle}
                          </p>
                          {card.trend !== undefined && card.trend !== 0 && (
                            <div
                              className={`mt-3 inline-flex items-center gap-2 px-3 py-1 text-xs font-bold ${
                                card.trend >= 0
                                  ? "badge-success-soft"
                                  : "badge-error-soft"
                              }`}
                              style={{ borderRadius: "var(--radius-pill)" }}
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

                {/* CHARTS */}

                {/* 🏛 RTC COMMAND CENTER */}
                <section className="grid gap-6 sm:gap-8 lg:grid-cols-3">
                  {/* LEFT COLUMN */}
                  <div className="space-y-6">
                    {/* REAL CALENDAR */}
                    <div className="card surface-card-hover">
                      <div
                        className="card-body"
                        style={{ padding: "var(--space-card-padding)" }}
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="card-title font-black">Calendar</h2>

                          <span className="text-sm font-semibold text-primary">
                            {currentDate.toLocaleString("default", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {/* WEEK DAYS */}
                        <div className="grid grid-cols-7 text-xs font-bold text-center mb-3 text-muted">
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((d) => (
                            <div key={d}>{d}</div>
                          ))}
                        </div>

                        {/* DAYS GRID */}
                        <div className="grid grid-cols-7 gap-2 text-center">
                          {calendarDays.map((day, i) => {
                            const isToday = day === currentDate.getDate();

                            return (
                              <div
                                key={i}
                                className={`
                  aspect-square flex items-center justify-center
                  rounded-xl text-sm font-semibold transition-all

                  ${day ? "cursor-pointer hover:bg-base-200" : "opacity-0"}

                  ${isToday ? "bg-primary text-primary-content shadow-md scale-105" : ""}
                `}
                              >
                                {day}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* EMPLOYEE ANALYTICS */}
                    <div className="card surface-card-hover">
                      <div className="card-body">
                        <h2 className="card-title font-black">
                          Employee Compliance
                        </h2>

                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={[
                              { name: "Total", value: employees.length },
                              {
                                name: "Incomplete",
                                value: stats.employeesMissing,
                              },
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />

                            <Bar
                              dataKey="value"
                              radius={[8, 8, 0, 0]}
                              fill={getCssVar("--color-primary")}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* RECENT ACTIVITY — IMPROVED */}
                  <div className="lg:col-span-2 card surface-card-hover">
                    <div
                      className="card-body"
                      style={{ padding: "var(--space-card-padding)" }}
                    >
                      <div className="flex justify-between items-center">
                        <h2 className="card-title text-xl sm:text-2xl font-black">
                          Recent Activity
                        </h2>

                        <span className="text-xs text-subtle">
                          Last 5 system logs
                        </span>
                      </div>

                      {/* ⭐ 2 COLUMN ACTIVITY GRID */}
                      <div className="grid md:grid-cols-2 gap-4 mt-5">
                        {auditLogs.slice(0, 4).map((log) => (
                          <div
                            key={log.id}
                            className="card hover:scale-[1.02]"
                            style={{
                              background: "var(--surface-inset)",
                              transition: "var(--transition-base)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            <div className="card-body p-4 flex-row items-start gap-4">
                              <div className="avatar placeholder bg-primary">
                                <div className="w-10 h-10 rounded-lg text-primary-content">
                                  <RefreshCw className="h-5 w-5" />
                                </div>
                              </div>

                              <div className="flex-1">
                                <p className="font-bold text-base">
                                  {log.action}
                                </p>

                                <p className="text-sm text-muted">
                                  {log.details}
                                </p>

                                <p className="text-xs text-subtle mt-1">
                                  {log.timestamp.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* RECENT CASES */}
                <section className="card surface-card-hover">
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
              <div
                className="grid lg:grid-cols-2 animate-fade-in"
                style={{ gap: "var(--space-section-gap)" }}
              >
                {/* DETENTION ANALYSIS */}
                <div className="card surface-card animate-slide-up">
                  <div className="card-body">
                    <h2 className="card-title font-black">
                      Detention Status Analysis
                    </h2>

                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Detained", value: stats.detained },
                            {
                              name: "Released",
                              value: stats.totalCases - stats.detained,
                            },
                          ]}
                          dataKey="value"
                          outerRadius={100}
                        >
                          <Cell fill={getCssVar("--color-warning")} />
                          <Cell fill={getCssVar("--color-success")} />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* BRANCH EFFICIENCY */}
                <div className="card surface-card animate-slide-up">
                  <div className="card-body">
                    <h2 className="card-title font-black">
                      Branch Processing Efficiency
                    </h2>

                    <div className="space-y-4 mt-4">
                      {branchPerformance.slice(0, 5).map((branch) => (
                        <div key={branch.branch}>
                          <div className="flex justify-between font-bold">
                            <span>{branch.branch}</span>
                            <span>{branch.efficiency.toFixed(1)}%</span>
                          </div>

                          <progress
                            className="progress progress-primary w-full"
                            value={branch.efficiency}
                            max="100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BRANCH WORKLOAD */}
                <div className="lg:col-span-2 card surface-card animate-slide-up">
                  <div className="card-body">
                    <h2 className="card-title font-black">Branch Workload</h2>

                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={branchPerformance.slice(0, 5)}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="branch" type="category" />
                        <Tooltip content={<CustomTooltip />} />

                        <Bar
                          dataKey="cases"
                          fill={getCssVar("--color-primary")}
                          radius={[0, 8, 8, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CASE FILING TRENDS */}
                <div className="lg:col-span-2 card surface-card animate-slide-up">
                  <div className="card-body">
                    <h2 className="card-title font-black">
                      Case Filing Trends
                    </h2>

                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />

                        <Area
                          type="monotone"
                          dataKey="cases"
                          stroke={getCssVar("--color-primary")}
                          fillOpacity={0.3}
                          fill={getCssVar("--color-primary")}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* DATA QUALITY */}
                <div className="lg:col-span-2 card surface-card animate-slide-up">
                  <div className="card-body">
                    <h2 className="card-title font-black">Data Quality</h2>

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
                        <RadialBar dataKey="value" cornerRadius={10} />
                      </RadialBarChart>
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

export default AdminDashboard;
