"use client";

import { getAccounts } from "@/app/components/AccountManagement/AccountActions";
import { getCases } from "@/app/components/Case/CasesActions";
import { getEmployees } from "@/app/components/Employee/EmployeeActions";
import type { Employee, User } from "@/app/generated/prisma/browser";
import {
  BarChart3,
  Download,
  Lock,
  Plus,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
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

// Enhanced color system with brand identity
const THEME = {
  primary: {
    50: "#f0f4ff",
    100: "#e0e9ff",
    500: "#4f46e5",
    600: "#4338ca",
    700: "#3730a3",
  },
  accent: {
    amber: "#f59e0b",
    emerald: "#10b981",
    rose: "#f43f5e",
    cyan: "#06b6d4",
    violet: "#8b5cf6",
  },
  status: {
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
  chart: ["#4f46e5", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"],
};

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  category: "system" | "compliance" | "security" | "operational";
  title: string;
  message: string;
  count?: number;
  action?: () => void;
  timestamp: Date;
}

interface AuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  timestamp: Date;
  type: "create" | "update" | "delete" | "export" | "login";
}

const EnhancedAdminDashboard: React.FC<Props> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<
    "7d" | "30d" | "90d" | "1y"
  >("30d");
  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "compliance"
  >("overview");

  /* ================= FETCH DATA ================= */
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
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  /* ================= ENHANCED KPI STATS ================= */
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

    // Calculate trends
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

  /* ================= SYSTEM ALERTS ================= */
  const alerts = useMemo((): Alert[] => {
    const alertList: Alert[] = [];
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Critical: Cases missing raffle date
    if (stats.pendingRaffle > 0) {
      alertList.push({
        id: "pending-raffle",
        type: "critical",
        category: "operational",
        title: "Cases Missing Raffle Date",
        message: `${stats.pendingRaffle} cases require immediate raffle date assignment`,
        count: stats.pendingRaffle,
        action: () => onNavigate?.("cases"),
        timestamp: now,
      });
    }

    // Compliance: Employees with missing info
    if (stats.employeesMissing > 0) {
      alertList.push({
        id: "employee-compliance",
        type: "warning",
        category: "compliance",
        title: "Incomplete Employee Records",
        message: `${stats.employeesMissing} employees missing medical or emergency contact information`,
        count: stats.employeesMissing,
        action: () => onNavigate?.("employees"),
        timestamp: now,
      });
    }

    // Security: Inactive accounts
    const longInactiveAccounts = accounts.filter((a) => {
      if (!a.lastLogin) return true;
      return new Date(a.lastLogin) < sixtyDaysAgo;
    }).length;

    if (longInactiveAccounts > 0) {
      alertList.push({
        id: "inactive-accounts",
        type: "warning",
        category: "security",
        title: "Long-Inactive Accounts",
        message: `${longInactiveAccounts} accounts inactive for 60+ days`,
        count: longInactiveAccounts,
        action: () => onNavigate?.("accounts"),
        timestamp: now,
      });
    }

    // Operational: Cases without branch assignment
    const casesNoBranch = cases.filter(
      (c) => !c.branch || c.branch.trim() === "",
    ).length;
    if (casesNoBranch > 0) {
      alertList.push({
        id: "cases-no-branch",
        type: "warning",
        category: "operational",
        title: "Cases Without Branch",
        message: `${casesNoBranch} cases need branch assignment`,
        count: casesNoBranch,
        action: () => onNavigate?.("cases"),
        timestamp: now,
      });
    }

    // System: High detention rate
    if (stats.detainedPercentage > 30) {
      alertList.push({
        id: "high-detention",
        type: "info",
        category: "system",
        title: "High Detention Rate",
        message: `${stats.detainedPercentage.toFixed(1)}% of cases involve detention`,
        timestamp: now,
      });
    }

    return alertList.sort((a, b) => {
      const priority = { critical: 3, warning: 2, info: 1 };
      return priority[b.type] - priority[a.type];
    });
  }, [stats, cases, accounts, onNavigate]);

  /* ================= AUDIT LOGS (MOCK DATA) ================= */
  const auditLogs = useMemo((): AuditLog[] => {
    const logs: AuditLog[] = [];
    const now = new Date();

    // Generate sample logs from recent cases
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

  /* ================= BRANCH PERFORMANCE ================= */
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

  /* ================= MONTHLY TRENDS ================= */
  const monthlyTrends = useMemo(() => {
    const monthMap: Record<
      string,
      { cases: number; employees: number; accounts: number }
    > = {};

    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      monthMap[key] = { cases: 0, employees: 0, accounts: 0 };
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

  /* ================= USER ROLE DISTRIBUTION ================= */
  const roleDistribution = useMemo(() => {
    const roleMap: Record<string, number> = {};
    accounts.forEach((a) => {
      roleMap[a.role] = (roleMap[a.role] || 0) + 1;
    });
    return Object.entries(roleMap).map(([role, count]) => ({
      role,
      count,
      percentage: (count / accounts.length) * 100,
    }));
  }, [accounts]);

  /* ================= WORKLOAD DISTRIBUTION ================= */
  const workloadDistribution = useMemo(() => {
    const avgCasesPerBranch = cases.length / branchPerformance.length;
    return branchPerformance.map((branch) => ({
      ...branch,
      load:
        avgCasesPerBranch > 0 ? (branch.cases / avgCasesPerBranch) * 100 : 0,
    }));
  }, [cases, branchPerformance]);

  /* ================= DATA QUALITY METRICS ================= */
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

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400 opacity-75" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600">
                <Server className="h-10 w-10 text-white" />
              </div>
            </div>
            <p className="mt-6 text-xl font-bold text-gray-900">
              Loading Dashboard
            </p>
            <p className="mt-2 text-base text-gray-500">
              Fetching system analytics...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen  bg-base-100">
        <div className="w-full max-w-[2000px] mx-auto">
          <div className="space-y-8 pb-8">
            {/* ================= ENHANCED HEADER ================= */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
              <div>
                <h1 className="text-5xl font-black tracking-tight text-base-content ">
                  Administrator Dashboard
                </h1>
                <p className="mt-1 flex items-center gap-3 text-base font-medium text-base-content/70">
                  <span className="text-xl">
                    Real-time system monitoring and analytics
                  </span>
                  <span className="text-base-content/40">•</span>
                  <span className="text-base-content/60">
                    Last sync: {new Date().toLocaleTimeString()}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Tab Navigation */}
                <div className="flex rounded-xl border-2 border-base-300 bg-base-200 p-1.5">
                  {[
                    { id: "overview", label: "Overview", icon: BarChart3 },
                    { id: "analytics", label: "Analytics", icon: TrendingUp },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 rounded-lg px-5 py-3 text-base font-bold transition-all ${
                        activeTab === tab.id
                          ? "bg-base-100 text-primary shadow-md"
                          : "text-base-content/70 hover:text-base-content"
                      }`}
                    >
                      <tab.icon className="h-5 w-5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3">
                  <button className="btn btn-lg btn-outline">
                    <Download className="h-5 w-5" />
                    Export
                  </button>
                  <button className="btn btn-lg btn-primary">
                    <RefreshCw className="h-5 w-5" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* ================= OVERVIEW TAB ================= */}
            {activeTab === "overview" && (
              <>
                {/* KPI CARDS - Enhanced Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-center">
                  <div className="group relative overflow-hidden rounded-2xl border-base bg-base-300  p-6 shadow-lg transition-all hover:scale-[1.03] hover:shadow-2xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-base font-bold  uppercase tracking-wide ">
                          Total Cases
                        </p>
                        <p className="mt-3 text-5xl font-black text-primary">
                          {stats.totalCases}
                        </p>
                        <p className="mt-3 text-base font-semibold text-base-content/50">
                          {stats.casesThisMonth} this month
                        </p>
                        {stats.caseGrowth !== 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            {stats.caseGrowth >= 0 ? (
                              <TrendingUp className="h-5 w-5 text-success" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-error" />
                            )}
                            <span
                              className={`text-base font-bold ${stats.caseGrowth >= 0 ? "text-success" : "text-error"}`}
                            >
                              {stats.caseGrowth >= 0 ? "+" : ""}
                              {stats.caseGrowth.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-2xl  border-base bg-base-300  p-6 shadow-lg transition-all hover:scale-[1.03] hover:shadow-2xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-base font-bold uppercase tracking-wide ">
                          Active Cases
                        </p>
                        <p className="mt-3 text-5xl font-black text-primary">
                          {stats.activeCases}
                        </p>
                        <p className="mt-3 text-base font-semibold text-base-content/50">
                          {stats.pendingRaffle} pending raffle
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-2xl   border-base bg-base-300  p-6 shadow-lg transition-all hover:scale-[1.03] hover:shadow-2xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-base font-bold uppercase tracking-wide ">
                          Detained
                        </p>
                        <p className="mt-3 text-5xl font-black text-primary">
                          {stats.detained}
                        </p>
                        <p className="mt-3 text-base font-semibold text-base-content/50">
                          {stats.detainedPercentage.toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-2xl border-base bg-base-300  p-6 shadow-lg transition-all hover:scale-[1.03] hover:shadow-2xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-base font-bold uppercase tracking-wide text-base">
                          Active Accounts
                        </p>
                        <p className="mt-3 text-5xl font-black text-primary">
                          {stats.activeAccounts}
                        </p>
                        <p className="mt-3 text-base font-semibold text-base-content/50">
                          {stats.inactiveAccounts} inactive
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECONDARY KPI ROW */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 ">
                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-6 shadow-lg text-center ">
                    <div
                      className="flex items-center justify-center
 "
                    >
                      <div>
                        <p className="text-base font-bold text-base-content/60">
                          Employees
                        </p>
                        <p className="mt-2 text-4xl font-black text-base-content">
                          {stats.employees}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-base font-semibold text-base-content/50">
                      {stats.employeesMissing} missing info
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-6 shadow-lg text-center">
                    <div
                      className="flex items-center justify-center
"
                    >
                      <div>
                        <p className="text-base font-bold text-base-content/60">
                          Branches
                        </p>
                        <p className="mt-2 text-4xl font-black text-base-content">
                          {branchPerformance.length}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-base font-semibold text-base-content/50">
                      Active locations
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-6 shadow-lg text-center">
                    <div className="flex items-center justify-center">
                      <div>
                        <p className="text-base font-bold text-base-content/60">
                          Data Quality
                        </p>
                        <p className="mt-2 text-4xl font-black text-base-content">
                          {dataQuality.quality.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-base font-semibold text-base-content/50">
                      {dataQuality.incomplete} incomplete
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-6 shadow-lg text-center">
                    <div className="flex items-center justify-center">
                      <div>
                        <p className="text-base font-bold text-base-content/60">
                          This Month
                        </p>
                        <p className="mt-2 text-4xl font-black text-base-content">
                          {stats.casesThisMonth}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 flex items-center justify-center gap-2 text-base font-bold">
                      {stats.caseGrowth >= 0 ? (
                        <>
                          <TrendingUp className="h-5 w-5 text-success" />
                          <span className="text-success">
                            +{stats.caseGrowth.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-5 w-5 text-error" />
                          <span className="text-error">
                            {stats.caseGrowth.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* PERFORMANCE CHARTS */}
                <div className="grid gap-8 lg:grid-cols-3">
                  {/* Monthly Trend */}
                  <div className="rounded-2xl border-2 border-base-300 border-base-100 bg-base-100 p-8 shadow-xl lg:col-span-2">
                    <div className="mb-8 flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-base-content">
                          Growth Trends
                        </h2>
                        <p className=" text-lg font-medium text-base-content/50">
                          1 month performance overview
                        </p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={monthlyTrends}>
                        <defs>
                          <linearGradient
                            id="colorCases"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={THEME.primary[100]}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={THEME.primary[100]}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="month"
                          stroke="#9ca3af"
                          fontSize={14}
                          fontWeight={600}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={14}
                          fontWeight={600}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "2px solid #e5e7eb",
                            borderRadius: "1rem",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cases"
                          stroke={THEME.primary[100]}
                          strokeWidth={4}
                          fillOpacity={1}
                          fill="url(#colorCases)"
                          name="Cases"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Data Quality Radial */}
                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-8 shadow-xl">
                    <div className="mb-6">
                      <h2 className="text-3xl font-black text-base-content">
                        Data Quality
                      </h2>
                      <p className=" text-lg font-medium text-base-content/50">
                        System-wide completeness
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="60%"
                        outerRadius="100%"
                        data={[
                          {
                            name: "Quality",
                            value: dataQuality.quality,
                            fill: THEME.status.success,
                          },
                        ]}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <RadialBar
                          minAngle={15}
                          background
                          clockWise
                          dataKey="value"
                          cornerRadius={15}
                        />
                        <text
                          x="50%"
                          y="50%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-5xl font-black fill-base-content"
                        >
                          {dataQuality.quality.toFixed(0)}%
                        </text>
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl bg-emerald-50 p-4">
                        <p className="text-lg font-bold text-emerald-600">
                          COMPLETE
                        </p>
                        <p className="mt-1 text-2xl font-black text-emerald-900">
                          {dataQuality.complete}
                        </p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-4">
                        <p className="text-lg font-bold text-rose-600">
                          INCOMPLETE
                        </p>
                        <p className="mt-1 text-2xl font-black text-rose-900">
                          {dataQuality.incomplete}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BRANCH PERFORMANCE & ACTIVITY */}
                <div className="grid gap-8 lg:grid-cols-3">
                  {/* Branch Performance */}
                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-8 shadow-xl">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-base-content">
                          Branch Workload
                        </h2>
                        <p className="text-lg font-medium text-base-content/50">
                          Case distribution
                        </p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={620}>
                      <BarChart
                        data={branchPerformance.slice(0, 5)}
                        layout="vertical"
                      >
                        <XAxis
                          type="number"
                          stroke="#9ca3af"
                          fontSize={14}
                          fontWeight={600}
                        />
                        <YAxis
                          type="category"
                          dataKey="branch"
                          stroke="#9ca3af"
                          fontSize={18}
                          fontWeight={600}
                          width={100}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "2px solid #e5e7eb",
                            borderRadius: "1rem",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        />
                        <Bar
                          dataKey="cases"
                          className="fill-base-content bg-base-300"
                          radius={[0, 12, 12, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Recent Activity */}
                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-8 shadow-xl lg:col-span-2">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-base-content">
                          Recent Activity
                        </h2>
                        <p className=" text-lg font-medium text-base-content/50">
                          Latest system events
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {auditLogs.slice(0, 5).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 rounded-xl border-2  bg-base-100 p-4 transition-all border-base-300 hover:border-base-300 hover:bg-base-300 hover:shadow-md"
                        >
                          <div
                            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                              log.type === "create"
                                ? "bg-emerald-100"
                                : log.type === "update"
                                  ? "bg-blue-100"
                                  : log.type === "delete"
                                    ? "bg-rose-100"
                                    : log.type === "export"
                                      ? "bg-violet-100"
                                      : "bg-gray-100"
                            }`}
                          >
                            {log.type === "create" && (
                              <Plus className="h-6 w-6 text-emerald-600" />
                            )}
                            {log.type === "update" && (
                              <RefreshCw className="h-6 w-6 text-blue-600" />
                            )}
                            {log.type === "delete" && (
                              <XCircle className="h-6 w-6 text-rose-600" />
                            )}
                            {log.type === "export" && (
                              <Download className="h-6 w-6 text-violet-600" />
                            )}
                            {log.type === "login" && (
                              <Lock className="h-6 w-6 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xl font-black text-base-content">
                              {log.action}
                            </p>
                            <p className="mt-1 text-base text-lg font-medium text-base-content/60">
                              {log.details}
                            </p>
                            <p className="mt-2 text-sm font-medium text-base-content/50">
                              {log.user} • {log.timestamp.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RECENT CASES TABLE */}
                <div className="rounded-2xl border-2 border-base-300 bg-base-300 shadow-xl">
                  <RecentCases
                    cases={cases}
                    onViewAll={() => onNavigate?.("cases")}
                  />
                </div>
              </>
            )}

            {/* ================= ANALYTICS TAB ================= */}
            {activeTab === "analytics" && (
              <>
                <div className="grid gap-8 lg:grid-cols-2">
                  {/* Charts content similar structure with larger text */}
                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-8 shadow-xl">
                    <div className="mb-8">
                      <h2 className="text-3xl font-black text-base-content">
                        Detention Analysis
                      </h2>
                      <p className=" text-base text-lg font-medium text-base-content/50">
                        Status breakdown
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Detained", value: stats.detained },
                            {
                              name: "Released",
                              value: stats.totalCases - stats.detained,
                            },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={110}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill={THEME.status.warning} />
                          <Cell fill={THEME.status.success} />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "2px solid #e5e7eb",
                            borderRadius: "1rem",
                            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={40}
                          iconType="circle"
                          wrapperStyle={{ fontSize: "14px", fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Branch Efficiency */}
                  <div className="rounded-2xl border-2 border-base-300 bg-base-100 p-8 shadow-xl">
                    <div className="mb-8">
                      <h2 className="text-3xl font-black text-base-content">
                        Branch Efficiency
                      </h2>
                      <p className="text-lg font-medium text-base-content/50">
                        Processing completion rates
                      </p>
                    </div>
                    <div className="space-y-6">
                      {branchPerformance.slice(0, 5).map((branch, index) => (
                        <div key={branch.branch}>
                          <div className="mb-2 flex items-center justify-between text-base">
                            <span className="font-black text-xl text-base-content">
                              {branch.branch}
                            </span>
                            <span className="text-2xl font-black text-base-content">
                              {branch.efficiency.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${branch.efficiency}%` }}
                            />
                          </div>
                          <div className="mt-2 flex justify-between text-lg  text-sm font-bold text-base-content/50">
                            <span>{branch.cases} cases</span>
                            <span>{branch.pending} pending</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User Role Distribution & Workload similar updates */}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EnhancedAdminDashboard;
