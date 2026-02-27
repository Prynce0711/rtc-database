import { Case, Employee } from "@/app/generated/prisma/client";
import { LogAction } from "@/app/generated/prisma/enums";
import { User } from "better-auth";
import {
  FiCalendar,
  FiClock,
  FiFileText,
  FiShield,
  FiUser,
} from "react-icons/fi";
import ModalBase from "../Popup/ModalBase";
import LogBadges from "./LogBadges";
import { CompleteLogData } from "./schema";

const LogsPopup = ({
  selectedLog,
  onClose,
  users,
  cases,
  employees,
}: {
  selectedLog: CompleteLogData;
  onClose: () => void;
  users: User[];
  cases: Case[];
  employees: Employee[];
}) => {
  return (
    <ModalBase onClose={onClose}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-base-200 relative">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-base-content/50 hover:text-base-content"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FiFileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-base-content">
              Activity Details
            </h3>
            <div className="mt-1">
              <LogBadges logAction={selectedLog.action as LogAction} />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5 bg-base-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center shrink-0 mt-0.5">
              <FiUser className="w-4 h-4 text-base-content/50" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider">
                User
              </p>
              <p className="text-sm font-semibold text-base-content">
                {selectedLog.user?.name || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center shrink-0 mt-0.5">
              <FiShield className="w-4 h-4 text-base-content/50" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider">
                Role
              </p>
              <p className="text-sm font-semibold text-base-content capitalize">
                {selectedLog.user?.role || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center shrink-0 mt-0.5">
              <FiClock className="w-4 h-4 text-base-content/50" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider">
                Timestamp
              </p>
              <p className="text-sm font-semibold text-base-content">
                {new Date(selectedLog.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center shrink-0 mt-0.5">
              <FiCalendar className="w-4 h-4 text-base-content/50" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider">
                Action
              </p>
              <div className="mt-0.5">
                <LogBadges logAction={selectedLog.action as LogAction} />
              </div>
            </div>
          </div>
        </div>

        {selectedLog.details && (
          <div className="bg-base-200/50 p-4 rounded-xl border border-base-200">
            <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider mb-2">
              Summary
            </p>
            <p className="text-sm font-medium text-base-content leading-relaxed">
              {createDetailText(selectedLog, users, cases, employees)}
            </p>
          </div>
        )}

        {selectedLog.details && (
          <div className="bg-base-200/50 p-4 rounded-xl border border-base-200">
            <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-wider mb-2">
              Raw Details
            </p>
            <pre className="bg-base-300/50 p-3 rounded-lg overflow-auto max-h-48 text-xs font-mono text-base-content/70 leading-relaxed">
              {JSON.stringify(selectedLog.details, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-base-200 bg-base-100 rounded-b-2xl">
        <button className="btn btn-sm btn-primary" onClick={() => onClose()}>
          Close
        </button>
      </div>
    </ModalBase>
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
