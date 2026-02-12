"use client";
import { Case, Employee, User } from "@/app/generated/prisma/browser";
import { LogAction } from "@/app/generated/prisma/enums";
import React, { useEffect, useMemo, useState } from "react";
import { FiCopy, FiDownload, FiSearch } from "react-icons/fi";
import { getAccounts } from "../AccountManagement/AccountActions";
import { getCases } from "../Case/CasesActions";
import { getEmployees } from "../Employee/EmployeeActions";
import { usePopup } from "../Popup/PopupProvider";
import Table from "../Table/Table";
import { getLogs } from "./LogActions";
import LogBadges from "./LogBadges";
import { CompleteLogData } from "./schema";

type SortConfigType = {
  key: string;
  order: "asc" | "desc";
} | null;

const LogsDashboard: React.FC = () => {
  const [logs, setLogs] = useState<CompleteLogData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const statusPopup = usePopup();

  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<LogAction | "all">("all");
  const [nameFilter, setNameFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<CompleteLogData | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfigType>({
    key: "timestamp",
    order: "desc",
  });

  useEffect(() => {
    const fetchData = async () => {
      const result = await getLogs();
      if (!result.success) {
        statusPopup.showError("Failed to fetch logs: " + result.error);
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
    };

    fetchData();
  }, []);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return logs.filter((log) => {
      // action filter
      if (actionFilter !== "all" && log.action.toLowerCase() !== actionFilter)
        return false;

      // name filter
      if (
        nameFilter.trim() &&
        !log.user?.name.toLowerCase().includes(nameFilter.trim().toLowerCase())
      )
        return false;

      // search query across fields
      if (!q) return true;

      return (
        log.user?.name.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.user?.role.toLowerCase().includes(q)
      );
    });
  }, [logs, query, actionFilter, nameFilter]);

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
      if (!prev || prev.key !== key) return { key, order: "asc" };
      return { key, order: prev.order === "asc" ? "desc" : "asc" };
    });
  };

  return (
    <div className="space-y-8 w-full text-base md:text-lg">
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
              onChange={(e) =>
                setActionFilter(e.target.value as LogAction | "all")
              }
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
                key: "user.name",
                label: "User",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
                align: "left" as const,
              },
              {
                key: "user.role",
                label: "Role",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
                align: "left" as const,
              },
              {
                key: "action",
                label: "Action",
                sortable: true,
                className: "text-base md:text-lg font-semibold",
                align: "left" as const,
              },
              {
                key: "timestamp",
                label: "Timestamp",
                sortable: true,
                className: "text-base md:text-lg font-semibold text-right pr-4",
                align: "right" as const,
              },
            ]}
            data={sortedLogs}
            rowsPerPage={10}
            sortConfig={sortConfig ?? undefined}
            onSort={(k) => handleSort(k as string)}
            renderRow={(log) => (
              <tr
                key={log.id}
                className="hover:bg-base-200 align-middle cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <td className="font-medium py-4 align-middle text-left">
                  {log.user?.name || "N/A"}
                </td>
                <td className="py-4 align-middle text-base-content/80 font-medium text-left">
                  {log.user?.role || "N/A"}
                </td>
                <td className="py-4 align-middle text-base-content/80 text-left">
                  <LogBadges logAction={log.action as LogAction} />
                </td>
                <td className="py-4 align-middle whitespace-nowrap text-base-content/60 pr-4 text-right">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
              </tr>
            )}
          />
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
              <p className="text-sm md:text-base opacity-90 mt-2">
                <LogBadges logAction={selectedLog.action as LogAction} />
              </p>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    User
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.user?.name || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Role
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {selectedLog.user?.role || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Action
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    <LogBadges logAction={selectedLog.action as LogAction} />
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Timestamp
                  </div>
                  <div className="text-base md:text-lg font-medium">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Summary
                  </div>
                  <div className="text-base md:text-lg font-medium leading-relaxed">
                    {createDetailText(selectedLog, users, cases, employees)}
                  </div>
                </div>
              )}

              {selectedLog.details && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Raw Details
                  </div>
                  <div className="text-base md:text-lg font-medium leading-relaxed">
                    <pre className="bg-base-200 p-4 rounded overflow-auto max-h-48">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
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

function createDetailText(
  log: CompleteLogData,
  users: User[],
  cases: Case[],
  employees: Employee[],
): string {
  const { action, details } = log;

  if (!details) {
    switch (action) {
      case LogAction.LOGOUT:
        return "User logged out";
      case LogAction.EXPORT_CASES:
        return "Exported all cases to file";
      case LogAction.EXPORT_EMPLOYEES:
        return "Exported all employees to file";
      default:
        return "No additional details";
    }
  }

  const detailsObj = details as any;

  switch (action) {
    case LogAction.CREATE_CASE: {
      const caseItem = cases.find((c) => c.id === detailsObj.id);
      return `Case created: ${caseItem?.caseNumber || `#${detailsObj.id}`} - "${caseItem?.name || "Unknown"}"`;
    }
    case LogAction.DELETE_CASE: {
      const caseItem = cases.find((c) => c.id === detailsObj.id);
      return `Case deleted: ${caseItem?.caseNumber || `#${detailsObj.id}`} - "${caseItem?.name || "Unknown"}"`;
    }
    case LogAction.CREATE_EMPLOYEE: {
      const employee = employees.find((e) => e.id === detailsObj.id);
      return `Employee created: ${employee?.employeeName || `#${detailsObj.id}`}`;
    }
    case LogAction.DELETE_EMPLOYEE: {
      const employee = employees.find((e) => e.id === detailsObj.id);
      return `Employee deleted: ${employee?.employeeName || `#${detailsObj.id}`}`;
    }
    case LogAction.CREATE_USER: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `User created: ${user?.email || detailsObj.id}`;
    }
    case LogAction.DEACTIVATE_USER: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `User deactivated: ${user?.email || detailsObj.id}`;
    }
    case LogAction.REACTIVATE_USER: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `User reactivated: ${user?.email || detailsObj.id}`;
    }
    case LogAction.LOGIN_SUCCESS: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `User logged in successfully: ${user?.email || detailsObj.id}`;
    }
    case LogAction.LOGIN_FAILED:
      return `Login failed: Email: ${detailsObj.email}`;
    case LogAction.UPDATE_ROLE: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `Role updated for ${user?.email || "user"}: ${detailsObj.from} → ${detailsObj.to}`;
    }
    case LogAction.UPDATE_CASE: {
      const caseItem = cases.find((c) => c.id === detailsObj.id);
      const changes: string[] = [];
      const from = detailsObj.from || {};
      const to = detailsObj.to || {};

      const caseFields = [
        "name",
        "charge",
        "court",
        "detained",
        "bond",
        "consolidation",
        "branch",
        "assistantBranch",
      ];
      caseFields.forEach((field) => {
        if (from[field] !== to[field]) {
          changes.push(
            `${field}: "${from[field] || "—"}" → "${to[field] || "—"}"`,
          );
        }
      });

      return `Case updated: ${caseItem?.caseNumber || `#${detailsObj.id}`} - ${
        changes.length > 0 ? changes.join(", ") : "No changes"
      }`;
    }
    case LogAction.UPDATE_EMPLOYEE: {
      const employee = employees.find((e) => e.id === detailsObj.id);
      const changes: string[] = [];
      const from = detailsObj.from || {};
      const to = detailsObj.to || {};

      const employeeFields = [
        "employeeName",
        "position",
        "branch",
        "bloodType",
        "height",
        "weight",
        "tinNumber",
        "gsisNumber",
      ];
      employeeFields.forEach((field) => {
        if (from[field] !== to[field]) {
          changes.push(
            `${field}: "${from[field] || "—"}" → "${to[field] || "—"}"`,
          );
        }
      });

      return `Employee updated: ${employee?.employeeName || `#${detailsObj.id}`} - ${
        changes.length > 0 ? changes.join(", ") : "No changes"
      }`;
    }
    case LogAction.IMPORT_CASES: {
      const importedCases = cases.filter((c) =>
        detailsObj.userIds?.includes(c.id),
      );
      const displayed = importedCases.slice(0, 3);
      const remaining = importedCases.length - displayed.length;
      const caseNames = displayed.map((c) => c.caseNumber).join(", ");
      const summary = remaining > 0 ? `, and ${remaining} more` : "";
      return `Imported ${detailsObj.userIds?.length || 0} cases: ${caseNames}${summary}`;
    }
    case LogAction.IMPORT_EMPLOYEES: {
      const importedEmployees = employees.filter((e) =>
        detailsObj.userIds?.includes(e.id),
      );
      const displayed = importedEmployees.slice(0, 3);
      const remaining = importedEmployees.length - displayed.length;
      const employeeNames = displayed.map((e) => e.employeeName).join(", ");
      const summary = remaining > 0 ? `, and ${remaining} more` : "";
      return `Imported ${detailsObj.userIds?.length || 0} employees: ${employeeNames}${summary}`;
    }
    default:
      return JSON.stringify(details);
  }
}

export default LogsDashboard;
