"use client";
import React, { useMemo, useState } from "react";
import { FiCopy, FiDownload, FiSearch } from "react-icons/fi";
import Table from "../Table/Table";

const SAMPLE_LOGS = [
  {
    id: "1",
    userName: "Juan Dela Cruz",
    userRole: "Admin",
    action: "Add",
    entityType: "Case",
    entityName: "Estate Settlement",
    description: "Created new case record for client A",
    createdAt: "2026-02-09T10:24:00Z",
  },
  {
    id: "2",
    userName: "Maria Santos",
    userRole: "Staff",
    action: "Edit",
    entityType: "Employee",
    entityName: "R. Reyes",
    description: "Updated contact information",
    createdAt: "2026-02-08T14:12:00Z",
  },
  {
    id: "3",
    userName: "Attorney Gomez",
    userRole: "Attorney",
    action: "Login",
    entityType: "Auth",
    entityName: "",
    description: "Successful login",
    createdAt: "2026-02-07T08:03:00Z",
  },
];

// Renderers replaced with simple, professional text (no colored badges)

const LogsDashboard: React.FC = () => {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<
    null | (typeof SAMPLE_LOGS)[number]
  >(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    order: "asc" | "desc";
  } | null>({ key: "createdAt", order: "desc" });

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return SAMPLE_LOGS.filter((log) => {
      // action filter
      if (actionFilter !== "all" && log.action.toLowerCase() !== actionFilter)
        return false;

      // name filter
      if (
        nameFilter.trim() &&
        !log.userName.toLowerCase().includes(nameFilter.trim().toLowerCase())
      )
        return false;

      // search query across fields
      if (!q) return true;

      return (
        log.userName.toLowerCase().includes(q) ||
        (log.entityName || "").toLowerCase().includes(q) ||
        (log.description || "").toLowerCase().includes(q) ||
        (log.entityType || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.userRole || "").toLowerCase().includes(q)
      );
    });
  }, [query, actionFilter, nameFilter]);

  const sortedLogs = useMemo(() => {
    if (!sortConfig) return filteredLogs;
    const { key, order } = sortConfig;
    const copy = [...filteredLogs];
    copy.sort((a: any, b: any) => {
      const va = a[key];
      const vb = b[key];

      // handle dates
      if (key === "createdAt") {
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

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / 10));

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, order: "asc" };
      return { key, order: prev.order === "asc" ? "desc" : "asc" };
    });
  };

  return (
    <div className="p-8 md:p-12 space-y-8 w-full text-base md:text-lg">
      <div>
        <h1 className="text-4xl md:text-5xl font-semibold">Activity Reports</h1>
        <p className="text-lg md:text-xl text-base-content/60 mt-2">
          Review user activities and system changes across the platform.
        </p>
      </div>
      <div className="space-y-6 w-full">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
            <input
              placeholder="Search by user, entity or description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input input-bordered input-md w-full pl-12 bg-base-100 h-12 text-base md:text-lg"
            />
          </div>

          <div className="flex gap-3 items-center">
            <input
              placeholder="Filter by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="input input-bordered input-md w-56 h-12 text-base md:text-lg"
            />

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="select select-bordered select-sm h-10 text-base"
            >
              <option value="all">All Actions</option>
              <option value="add">Add</option>
              <option value="edit">Edit</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
            </select>

            <div className="flex gap-2">
              <button className="btn btn-primary btn-md gap-2 px-4">
                <FiDownload /> Export
              </button>
              <button className="btn btn-outline btn-md gap-2 px-4">
                <FiCopy /> Copy
              </button>
            </div>
          </div>
        </div>

        <div className="bg-base-100 rounded-xl border border-base-200">
          <Table
            className="p-0 text-base md:text-lg font-medium"
            headers={[
              {
                key: "userName",
                label: "User",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
              },
              {
                key: "userRole",
                label: "Role",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
              },
              {
                key: "action",
                label: "Action",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
              },
              {
                key: "entityType",
                label: "Entity",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
              },
              {
                key: "entityName",
                label: "Entity Name",
                className: "text-base md:text-lg font-semibold",
              },
              {
                key: "description",
                label: "Description",
                className: "text-base md:text-lg font-semibold",
              },
              {
                key: "createdAt",
                label: "Timestamp",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
              },
            ]}
            data={sortedLogs}
            rowsPerPage={10}
            sortConfig={sortConfig ?? undefined}
            onSort={(k) => handleSort(k)}
            renderRow={(log) => (
              <tr
                key={log.id}
                className="hover:bg-base-200 align-middle cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <td className="font-medium py-4 align-middle">
                  {log.userName}
                </td>
                <td className="py-4 align-middle text-base-content/80 font-medium">
                  {log.userRole}
                </td>
                <td className="py-4 align-middle text-base-content/80">
                  {log.action}
                </td>
                <td className="py-4 align-middle">{log.entityType || "-"}</td>
                <td className="py-4 align-middle">{log.entityName || "-"}</td>
                <td
                  className="py-4 align-middle max-w-4xl break-words text-base-content/80"
                  title={log.description}
                >
                  {log.description}
                </td>
                <td className="py-4 align-middle whitespace-nowrap text-base-content/60">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-base md:text-lg text-base-content/60">
            Showing 1 to {filteredLogs.length} of {filteredLogs.length} logs
          </div>
          <div className="btn-group">
            <button
              className="btn btn-md text-base md:text-lg"
              disabled={totalPages < 2}
            >
              «
            </button>
            <button className="btn btn-md text-base md:text-lg">1</button>
            <button
              className="btn btn-md text-base md:text-lg"
              disabled={totalPages < 2}
            >
              »
            </button>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="modal modal-open" onClick={() => setSelectedLog(null)}>
          <div
            className="modal-box max-w-4xl p-0 modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-primary to-info text-primary-content rounded-t-2xl px-6 py-4 relative">
              <button
                className="btn btn-sm btn-ghost absolute right-3 top-3 text-primary-content"
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
              >
                ✕
              </button>
              <h3 className="text-xl md:text-2xl font-semibold">
                Activity Details
              </h3>
              <p className="text-sm md:text-base opacity-90">
                {selectedLog.action} • {selectedLog.entityType}
              </p>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    User
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.userName}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Role
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.userRole}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Entity
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.entityType || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Entity Name
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.entityName || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Action
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.action}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Timestamp
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  Description
                </div>
                <div className="text-base md:text-lg font-medium leading-relaxed">
                  {selectedLog.description || "-"}
                </div>
              </div>
            </div>

            <div className="modal-action px-6 pb-6">
              <button
                className="btn btn-primary"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modal-pop {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-pop {
          animation: modal-pop 160ms ease-out;
        }
      `}</style>
    </div>
  );
};

export default LogsDashboard;
