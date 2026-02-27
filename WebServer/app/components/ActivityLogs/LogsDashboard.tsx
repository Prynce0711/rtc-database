"use client";
import { Case, Employee, User } from "@/app/generated/prisma/browser";
import { LogAction } from "@/app/generated/prisma/enums";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiCopy,
  FiDownload,
  FiFilter,
  FiSearch,
  FiTrendingUp,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { getAccounts } from "../AccountManagement/AccountActions";
import { getCases } from "../Case/CasesActions";
import { getEmployees } from "../Employee/EmployeeActions";
import { usePopup } from "../Popup/PopupProvider";
import Table from "../Table/Table";
import { getLogs } from "./LogActions";
import LogBadges from "./LogBadges";
import LogsPopup from "./LogsPopup";
import { CompleteLogData } from "./schema";

type SortConfigType = {
  key:
    | "id"
    | "timestamp"
    | "userId"
    | "ipAddress"
    | "userAgent"
    | "user"
    | "action"
    | "details"
    | "user.name"
    | "user.role";
  order: "asc" | "desc";
} | null;

type ActionCategory = "all" | "auth" | "cases" | "employees" | "users" | "data";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "Just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return "1 week ago";
  if (weeks < 4) return `${weeks} weeks ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getUserInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function matchesCategory(action: string, category: ActionCategory): boolean {
  if (category === "all") return true;
  const a = action.toUpperCase();
  switch (category) {
    case "auth":
      return [
        "LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "LOGOUT",
        "CHANGE_PASSWORD",
        "SET_INITIAL_PASSWORD",
        "RESET_PASSWORD",
      ].includes(a);
    case "cases":
      return [
        "CREATE_CASE",
        "UPDATE_CASE",
        "DELETE_CASE",
        "IMPORT_CASES",
        "EXPORT_CASES",
      ].includes(a);
    case "employees":
      return [
        "CREATE_EMPLOYEE",
        "UPDATE_EMPLOYEE",
        "DELETE_EMPLOYEE",
        "IMPORT_EMPLOYEES",
        "EXPORT_EMPLOYEES",
      ].includes(a);
    case "users":
      return [
        "CREATE_USER",
        "UPDATE_ROLE",
        "DEACTIVATE_USER",
        "REACTIVATE_USER",
        "DELETE_USER",
        "UPDATE_PROFILE",
        "SEND_MAGIC_LINK",
      ].includes(a);
    case "data":
      return [
        "IMPORT_CASES",
        "EXPORT_CASES",
        "IMPORT_EMPLOYEES",
        "EXPORT_EMPLOYEES",
      ].includes(a);
    default:
      return true;
  }
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="bg-base-100 rounded-2xl border border-base-200 p-5 flex items-center gap-4 min-w-0">
    <div
      className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-base-content/50 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-base-content truncate">{value}</p>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const LogsDashboard: React.FC = () => {
  const [logs, setLogs] = useState<CompleteLogData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const statusPopup = usePopup();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<CompleteLogData | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfigType>({
    key: "timestamp",
    order: "desc",
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const result = await getLogs();
      if (!result.success) {
        statusPopup.showError("Failed to fetch logs: " + result.error);
        setIsLoading(false);
        return;
      }

      setLogs(result.result || []);

      const users = await getAccounts();
      if (users.success) {
        setUsers(users.result || []);
      }

      const cases = await getCases();
      if (cases.success) {
        setCases(cases.result || []);
      }

      const employees = await getEmployees();
      if (employees.success) {
        setEmployees(employees.result || []);
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter((l) => new Date(l.timestamp) >= today);
    const uniqueUsers = new Set(logs.map((l) => l.userId).filter(Boolean));
    const actionCounts = logs.reduce(
      (acc, l) => {
        acc[l.action] = (acc[l.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const topAction = Object.entries(actionCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      total: logs.length,
      today: todayLogs.length,
      uniqueUsers: uniqueUsers.size,
      topAction: topAction
        ? topAction[0].replace(/_/g, " ").toLowerCase()
        : "—",
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return logs.filter((log) => {
      // category filter
      if (!matchesCategory(log.action, categoryFilter)) return false;

      // user filter
      if (userFilter !== "all" && log.userId !== userFilter) return false;

      // date range filter
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(log.timestamp) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > to) return false;
      }

      // search query across fields
      if (!q) return true;

      return (
        log.user?.name.toLowerCase().includes(q) ||
        log.action.toLowerCase().replace(/_/g, " ").includes(q) ||
        log.user?.role.toLowerCase().includes(q)
      );
    });
  }, [logs, query, categoryFilter, userFilter, dateFrom, dateTo]);

  const sortedLogs = useMemo(() => {
    if (!sortConfig) return filteredLogs;
    const { key, order } = sortConfig;
    const copy = [...filteredLogs];
    copy.sort((a: any, b: any) => {
      let va, vb;

      // Handle nested properties
      if (key === "user.name") {
        va = a.user?.name ?? "";
        vb = b.user?.name ?? "";
      } else if (key === "user.role") {
        va = a.user?.role ?? "";
        vb = b.user?.role ?? "";
      } else {
        va = a[key];
        vb = b[key];
      }

      // handle dates
      if (key === "timestamp") {
        const da = new Date(va).getTime();
        const db = new Date(vb).getTime();
        return order === "asc" ? da - db : db - da;
      }

      // numeric compare
      if (typeof va === "number" && typeof vb === "number") {
        return order === "asc" ? va - vb : vb - va;
      }

      const sa = (va ?? "").toString().toLowerCase();
      const sb = (vb ?? "").toString().toLowerCase();
      if (sa < sb) return order === "asc" ? -1 : 1;
      if (sa > sb) return order === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }, [filteredLogs, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      const typedKey = key as SortConfigType extends null
        ? never
        : NonNullable<SortConfigType>["key"];
      if (!prev || prev.key !== typedKey)
        return { key: typedKey, order: "asc" as const };
      return {
        key: typedKey,
        order: prev.order === "asc" ? ("desc" as const) : ("asc" as const),
      };
    });
  };

  // ─── Derived: unique users for dropdown ─────────────────────────────────────

  const logUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.userId && l.user?.name) map.set(l.userId, l.user.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const hasActiveFilters =
    categoryFilter !== "all" ||
    userFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    query.trim() !== "";

  const clearAllFilters = () => {
    setCategoryFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  };

  // ─── Loading Skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        <div>
          <div className="h-9 bg-base-300 rounded-lg w-64 mb-2" />
          <div className="h-4 bg-base-300/60 rounded-lg w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-base-200 rounded-2xl border border-base-200"
            />
          ))}
        </div>
        <div className="h-14 bg-base-200 rounded-2xl" />
        <div className="space-y-0 bg-base-200 rounded-2xl overflow-hidden">
          <div className="h-12 bg-base-300" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 border-b border-base-300/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Activity Reports
        </h1>
        <p className="text-sm md:text-base text-base-content/50 mt-1">
          Track and review all user activities and system changes.
        </p>
      </div>

      {/* ─── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiActivity className="w-5 h-5 text-primary" />}
          label="Total Activities"
          value={stats.total.toLocaleString()}
          color="bg-primary/10"
        />
        <StatCard
          icon={<FiCalendar className="w-5 h-5 text-success" />}
          label="Today"
          value={stats.today.toLocaleString()}
          color="bg-success/10"
        />
        <StatCard
          icon={<FiUsers className="w-5 h-5 text-info" />}
          label="Active Users"
          value={stats.uniqueUsers}
          color="bg-info/10"
        />
        <StatCard
          icon={<FiTrendingUp className="w-5 h-5 text-warning" />}
          label="Top Action"
          value={stats.topAction}
          color="bg-warning/10"
        />
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-base-100 rounded-2xl border border-base-200 p-4 space-y-3">
        {/* Row 1: Search + Export */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4" />
            <input
              placeholder="Search by user, action, or role..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input input-bordered input-sm w-full pl-10 h-10 bg-base-200/50 border-base-300 focus:border-primary text-sm"
            />
          </div>

          <div className="flex gap-1.5">
            <button className="btn btn-primary btn-sm gap-1.5 h-10 px-4">
              <FiDownload className="w-3.5 h-3.5" /> Export
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5 h-10 px-4 border border-base-300">
              <FiCopy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>

        {/* Row 2: Filter controls */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-1.5 text-base-content/50 shrink-0">
            <FiFilter className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Filters
            </span>
          </div>

          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="select select-bordered select-sm h-9 bg-base-200/50 border-base-300 text-sm flex-1 sm:flex-none sm:min-w-48"
          >
            <option value="all">All Users</option>
            {logUsers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as ActionCategory)
            }
            className="select select-bordered select-sm h-9 bg-base-200/50 border-base-300 text-sm flex-1 sm:flex-none sm:min-w-40"
          >
            <option value="all">All Categories</option>
            <option value="auth">Authentication</option>
            <option value="cases">Cases</option>
            <option value="employees">Employees</option>
            <option value="users">User Management</option>
            <option value="data">Import / Export</option>
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-base-content/40 shrink-0">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input input-bordered input-sm h-9 bg-base-200/50 border-base-300 text-sm w-full sm:w-auto"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-base-content/40 shrink-0">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input input-bordered input-sm h-9 bg-base-200/50 border-base-300 text-sm w-full sm:w-auto"
            />
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-base-200">
            <span className="text-xs text-base-content/40 font-medium">
              Active:
            </span>
            {userFilter !== "all" && (
              <button
                className="badge badge-sm badge-primary gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setUserFilter("all")}
              >
                {logUsers.find(([id]) => id === userFilter)?.[1] || "User"}{" "}
                <FiX className="w-2.5 h-2.5" />
              </button>
            )}
            {categoryFilter !== "all" && (
              <button
                className="badge badge-sm badge-secondary gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setCategoryFilter("all")}
              >
                {categoryFilter} <FiX className="w-2.5 h-2.5" />
              </button>
            )}
            {dateFrom && (
              <button
                className="badge badge-sm badge-accent gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setDateFrom("")}
              >
                from: {dateFrom} <FiX className="w-2.5 h-2.5" />
              </button>
            )}
            {dateTo && (
              <button
                className="badge badge-sm badge-accent gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setDateTo("")}
              >
                to: {dateTo} <FiX className="w-2.5 h-2.5" />
              </button>
            )}
            {query.trim() && (
              <button
                className="badge badge-sm badge-info gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setQuery("")}
              >
                &quot;{query}&quot; <FiX className="w-2.5 h-2.5" />
              </button>
            )}
            <button
              className="text-xs text-error hover:underline ml-1 font-medium"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ─── Results count ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm text-base-content/50 px-1">
        <span>
          Showing{" "}
          <span className="font-semibold text-base-content">
            {sortedLogs.length}
          </span>{" "}
          of {logs.length} activities
        </span>
      </div>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden">
        {sortedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
            <FiSearch className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No activities found</p>
            <p className="text-sm mt-1">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <Table
            className="p-0 text-sm font-medium"
            headers={[
              {
                key: "user.name",
                label: "User",
                sortable: true,
                className: "text-xs font-semibold uppercase tracking-wider",
                align: "center" as const,
              },
              {
                key: "user.role",
                label: "Role",
                sortable: true,
                className: "text-xs font-semibold uppercase tracking-wider",
                align: "center" as const,
              },
              {
                key: "action",
                label: "Action",
                sortable: true,
                className: "text-xs font-semibold uppercase tracking-wider",
                align: "center" as const,
              },
              {
                key: "timestamp",
                label: "Time",
                sortable: true,
                className: "text-xs font-semibold uppercase tracking-wider",
                align: "center" as const,
              },
            ]}
            data={sortedLogs}
            rowsPerPage={10}
            sortConfig={(sortConfig as any) ?? undefined}
            onSort={(k) => handleSort(k as string)}
            renderRow={(log) => (
              <tr
                key={log.id}
                className="hover:bg-base-200/50 transition-colors duration-150 cursor-pointer group border-b border-base-200/50 last:border-0"
                onClick={() => setSelectedLog(log)}
              >
                <td className="py-3.5 align-middle text-center">
                  <div className="flex items-center justify-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {getUserInitials(log.user?.name)}
                    </div>
                    <span className="font-medium text-sm">
                      {log.user?.name || "Unknown"}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 align-middle text-center">
                  <span className="text-sm text-base-content/60 capitalize">
                    {log.user?.role || "N/A"}
                  </span>
                </td>
                <td className="py-3.5 align-middle text-center">
                  <div className="flex justify-center">
                    <LogBadges logAction={log.action as LogAction} />
                  </div>
                </td>
                <td className="py-3.5 align-middle text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-base-content/70 font-medium">
                      {getRelativeTime(log.timestamp)}
                    </span>
                    <span className="text-[10px] text-base-content/40 group-hover:text-base-content/50 transition-colors">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </div>

      {/* ─── Detail Popup ────────────────────────────────────────────────── */}
      {selectedLog && (
        <LogsPopup
          selectedLog={selectedLog}
          onClose={() => setSelectedLog(null)}
          users={users}
          cases={cases}
          employees={employees}
        />
      )}
    </div>
  );
};

export default LogsDashboard;
