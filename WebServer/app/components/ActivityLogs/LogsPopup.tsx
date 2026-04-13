import { Case, Employee, User } from "@/app/generated/prisma/browser";
import { LogAction } from "@/app/generated/prisma/enums";
import {
  DetailField,
  DetailSection,
  formatLongDate,
  NavButton,
} from "@rtc-database/shared";
import { useMemo, useState } from "react";
import LogBadges from "./LogBadges";
import { CompleteLogData } from "./schema";

const LogsPopup = ({
  selectedLog,
  onClose,
  onSelectLog,
  logs,
  users,
  cases,
  employees,
}: {
  selectedLog: CompleteLogData;
  onClose: () => void;
  onSelectLog?: (log: CompleteLogData) => void;
  logs?: CompleteLogData[];
  users: User[];
  cases: Case[];
  employees: Employee[];
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "additional">(
    "details",
  );

  const index = useMemo(() => {
    if (!logs) return -1;
    return logs.findIndex((l) => l.id === selectedLog.id);
  }, [logs, selectedLog.id]);

  const prevLog = useMemo(() => {
    if (!logs || index <= 0) return null;
    return logs[index - 1] ?? null;
  }, [logs, index]);

  const nextLog = useMemo(() => {
    if (!logs || index === -1 || index >= logs.length - 1) return null;
    return logs[index + 1] ?? null;
  }, [logs, index]);

  const summaryText = useMemo(() => {
    return createDetailText(selectedLog, users, cases, employees);
  }, [selectedLog, users, cases, employees]);

  const canPrevNext = !!logs && !!onSelectLog;

  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      {/* ══════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-[13px] font-semibold text-base-content/40 hover:text-base-content transition-colors duration-150 shrink-0"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9.5 2.5L4.5 7.5L9.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none">
            <span>Activity Reports</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold">
              #{selectedLog.id}
            </span>
          </div>

          {/* Prev / Next compact */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => prevLog && onSelectLog?.(prevLog)}
              disabled={!canPrevNext || !prevLog}
              title={prevLog ? `Previous: #${prevLog.id}` : "No previous log"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/35 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 2L4 7L9 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-9 text-center">
              #{selectedLog.id}
            </span>

            <button
              onClick={() => nextLog && onSelectLog?.(nextLog)}
              disabled={!canPrevNext || !nextLog}
              title={nextLog ? `Next: #${nextLog.id}` : "No next log"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/35 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 2L10 7L5 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════ */}
      <main className="max-w-5xl mx-auto px-8 py-14 space-y-10">
        {/* ── Hero Block ───────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Activity Record
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            Activity #{selectedLog.id}
          </h1>

          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-[15px] text-base-content/45 font-medium">
              Logged {formatLongDate(selectedLog.timestamp)}
            </p>
            <LogBadges logAction={selectedLog.action as LogAction} />
          </div>
        </div>

        <div className="h-px bg-base-200" />

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-end border-b border-base-200 gap-1">
          {(["details", "additional"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-5 pb-3 pt-1 text-[13px] font-bold capitalize tracking-wide border-b-2 -mb-px transition-all duration-150 whitespace-nowrap",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/30 hover:text-base-content/55",
              ].join(" ")}
            >
              {tab === "details" ? "Activity Details" : "Raw Details"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB — DETAILS
        ══════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection label="Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField
                  label="User"
                  value={selectedLog.user?.name ?? "N/A"}
                />
                <DetailField
                  label="Email"
                  value={selectedLog.user?.email ?? "N/A"}
                />
                <DetailField
                  label="Role"
                  value={selectedLog.user?.role ?? "N/A"}
                />
                <DetailField label="Action" value={selectedLog.action} mono />
                <DetailField
                  label="Timestamp"
                  value={new Date(selectedLog.timestamp).toLocaleString()}
                  mono
                />
                <DetailField
                  label="IP Address"
                  value={selectedLog.ipAddress}
                  mono
                />
                <DetailField
                  label="User Agent"
                  value={selectedLog.userAgent}
                  mono
                />
              </div>
            </DetailSection>

            <DetailSection label="Summary">
              <div className="px-5 py-4 rounded-xl border bg-base-200/70 border-base-200 space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
                    Badge
                  </span>
                  <div className="mt-2">
                    <LogBadges logAction={selectedLog.action as LogAction} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
                    Description
                  </span>
                  <p className="mt-2 text-[15px] font-semibold text-base-content leading-relaxed">
                    {summaryText}
                  </p>
                </div>
              </div>
            </DetailSection>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — RAW
        ══════════════════════════════════════════ */}
        {activeTab === "additional" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection label="Raw Details">
              <div className="px-5 py-4 rounded-xl border bg-base-200/70 border-base-200">
                <pre className="bg-base-300/50 p-3 rounded-lg overflow-auto max-h-105 text-xs font-mono text-base-content/70 leading-relaxed">
                  {JSON.stringify(selectedLog.details ?? null, null, 2)}
                </pre>
              </div>
            </DetailSection>
          </div>
        )}

        {/* ── Prev / Next bottom nav ────────────────────────── */}
        {canPrevNext && (
          <>
            <div className="h-px bg-base-200" />
            <div className="flex items-stretch justify-between gap-3">
              <NavButton
                direction="prev"
                label={prevLog ? `#${prevLog.id}` : "—"}
                sublabel={prevLog ? String(prevLog.action) : undefined}
                onClick={() => prevLog && onSelectLog?.(prevLog)}
                disabled={!prevLog}
              />
              <NavButton
                direction="next"
                label={nextLog ? `#${nextLog.id}` : "—"}
                sublabel={nextLog ? String(nextLog.action) : undefined}
                onClick={() => nextLog && onSelectLog?.(nextLog)}
                disabled={!nextLog}
              />
            </div>
          </>
        )}

        <div className="h-px bg-base-200" />
        <div className="flex items-center justify-between py-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20 select-none">
            Activity Reports
          </p>
          <p className="text-[11px] text-base-content/20 font-semibold select-none">
            Logged {new Date(selectedLog.timestamp).toLocaleString()}
          </p>
        </div>
      </main>
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
      return `Case created: ${caseItem?.caseNumber || `#${detailsObj.id}`}"`;
    }
    case LogAction.DELETE_CASE: {
      const caseItem = cases.find((c) => c.id === detailsObj.id);
      return `Case deleted: ${caseItem?.caseNumber || `#${detailsObj.id}`}"`;
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
    case LogAction.CHANGE_PASSWORD:
      return "User changed their password";
    case LogAction.SET_INITIAL_PASSWORD:
      return "User set their initial password";
    case LogAction.RESET_PASSWORD:
      return "Password was reset";
    case LogAction.SEND_MAGIC_LINK:
      return `Magic link sent to: ${detailsObj.email}`;
    case LogAction.UPDATE_PROFILE: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `Profile updated for: ${user?.email || detailsObj.id}`;
    }
    case LogAction.DELETE_USER: {
      const user = users.find((u) => u.id === detailsObj.id);
      return `User permanently deleted: ${user?.email || detailsObj.id}`;
    }
    default:
      return JSON.stringify(details);
  }
}

export default LogsPopup;
