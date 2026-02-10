"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiSearch,
} from "react-icons/fi";

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string | Date;
}

const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "add":
        return "badge badge-success";
      case "delete":
        return "badge badge-error";
      case "edit":
        return "badge badge-warning";
      case "login":
        return "badge badge-info";
      case "logout":
        return "badge badge-neutral";
      default:
        return "badge";
    }
  };

  return (
    <span
      className={`${getActionColor(action)} badge-sm gap-2 lowercase px-2 py-1`}
      aria-label={`action-${action}`}
    >
      {action}
    </span>
  );
};

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "badge badge-primary";
      case "staff":
        return "badge badge-secondary";
      case "attorney":
        return "badge badge-accent";
      default:
        return "badge";
    }
  };

  return (
    <span
      className={`${getRoleColor(role)} badge-sm gap-2 px-2 py-1`}
      aria-label={`role-${role}`}
    >
      {role}
    </span>
  );
};

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showModal, setShowModal] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const response = await fetch("/api/activity-logs");
        if (!response.ok) throw new Error("Failed to fetch logs");
        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error("Error fetching logs:", error);
        alert("Failed to load activity logs");
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, []);

  // debounce search input
  useEffect(() => {
    if (searchDebounceRef.current)
      window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => {
      if (searchDebounceRef.current)
        window.clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = [...logs];

    // Search filter (debounced)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.userName?.toLowerCase().includes(q) ||
          log.entityName?.toLowerCase().includes(q) ||
          log.description?.toLowerCase().includes(q) ||
          log.entityType?.toLowerCase().includes(q),
      );
    }

    // Action filter
    if (filterAction !== "all") {
      filtered = filtered.filter(
        (log) => log.action?.toLowerCase() === filterAction.toLowerCase(),
      );
    }

    // Role filter
    if (filterRole !== "all") {
      filtered = filtered.filter(
        (log) => log.userRole?.toLowerCase() === filterRole.toLowerCase(),
      );
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((log) => new Date(log.createdAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((log) => new Date(log.createdAt) <= toDate);
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [logs, debouncedSearch, filterAction, filterRole, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / rowsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, currentPage]);

  const handleExport = () => {
    // Export CSV by default for professionals; keep JSON as fallback
    if (filteredLogs.length === 0) return;

    const headers: (keyof ActivityLog)[] = [
      "id",
      "userName",
      "userRole",
      "action",
      "entityType",
      "entityName",
      "description",
      "ipAddress",
      "userAgent",
      "createdAt",
    ];

    const csv = [headers.join(",")].concat(
      filteredLogs.map((r) =>
        headers
          .map((h) => {
            const v = r[h] ?? "";
            const s = String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(","),
      ),
    );

    const blob = new Blob([csv.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const openDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedLog(null);
    setShowModal(false);
  };

  const handleClearFilters = () => {
    setSearch("");
    setFilterAction("all");
    setFilterRole("all");
    setDateFrom("");
    setDateTo("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Activity Logs</h1>
        <p className="text-base-content/60 mt-1">
          Track all user activities including logins, data modifications, and
          more
        </p>
      </div>

      {/* Filters */}
      <div className="bg-base-100 rounded-xl shadow p-4 space-y-4">
        {/* Search and Export */}
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              placeholder="Search by user, entity, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input-bordered input-sm w-full pl-10"
            />
          </div>
          <button
            onClick={handleExport}
            className="btn btn-primary btn-sm gap-2"
          >
            <FiDownload /> Export
          </button>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="select select-bordered select-sm"
          >
            <option value="all">All Actions</option>
            <option value="add">Add</option>
            <option value="edit">Edit</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="select select-bordered select-sm"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="attorney">Attorney</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input input-bordered input-sm"
            placeholder="From Date"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input input-bordered input-sm"
            placeholder="To Date"
          />

          <button
            onClick={handleClearFilters}
            className="btn btn-ghost btn-sm gap-2"
          >
            <FiFilter /> Clear
          </button>
        </div>

        {/* Results count */}
        <div className="text-sm text-base-content/60 flex items-center gap-3">
          <span>
            Showing{" "}
            {paginatedLogs.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}{" "}
            to {Math.min(currentPage * rowsPerPage, filteredLogs.length)} of{" "}
            {filteredLogs.length} logs
          </span>
          <span className="badge badge-outline badge-sm">
            {filteredLogs.length} total
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-base-100 rounded-xl shadow">
        {paginatedLogs.length === 0 ? (
          <div className="p-8 text-center text-base-content/60">
            No activity logs found
          </div>
        ) : (
          <table className="table table-zebra table-compact w-full text-sm">
            <thead className="bg-base-200">
              <tr>
                <th className="text-base-content/80">User</th>
                <th className="text-base-content/80">Role</th>
                <th className="text-base-content/80">Action</th>
                <th className="text-base-content/80">Entity</th>
                <th className="text-base-content/80">Entity Name</th>
                <th className="text-base-content/80">Description</th>
                <th className="text-base-content/80">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-base-200">
                  <td>
                    <span className="font-medium">{log.userName}</span>
                  </td>
                  <td>
                    <RoleBadge role={log.userRole || "Unknown"} />
                  </td>
                  <td>
                    <ActionBadge action={log.action || "Unknown"} />
                  </td>
                  <td>
                    <span className="text-sm">{log.entityType || "-"}</span>
                  </td>
                  <td>
                    <span className="text-sm">{log.entityName || "-"}</span>
                  </td>
                  <td>
                    <span
                      className="text-sm text-base-content/70 max-w-xs truncate block"
                      title={log.description || "-"}
                    >
                      {log.description || "-"}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mt-6 p-2">
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-circle"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <FiChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className={`btn btn-sm min-w-9.5 font-semibold transition-all rounded-lg ${
                  currentPage === i + 1 ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}

            <button
              className="btn btn-sm btn-circle"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
