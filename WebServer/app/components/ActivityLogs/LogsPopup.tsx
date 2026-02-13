import { Case, Employee } from "@/app/generated/prisma/client";
import { LogAction } from "@/app/generated/prisma/enums";
import { User } from "better-auth";
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
      <div className="bg-linear-to-r from-primary to-info text-primary-content rounded-t-2xl px-6 py-4 relative">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-primary-content hover:bg-white/20"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <h3 className="text-xl md:text-2xl font-semibold">Activity Details</h3>
        <div className="text-sm md:text-base opacity-90 mt-2">
          <LogBadges logAction={selectedLog.action as LogAction} />
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 bg-base-100">
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
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-base-content/60 mb-2">
              Summary
            </div>
            <div className="text-base md:text-lg font-medium leading-relaxed">
              {createDetailText(selectedLog, users, cases, employees)}
            </div>
          </div>
        )}

        {selectedLog.details && (
          <div className="bg-base-200 p-4 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-base-content/60 mb-2">
              Raw Details
            </div>
            <div className="text-sm leading-relaxed">
              <pre className="bg-base-300 p-4 rounded-lg overflow-auto max-h-48 text-xs">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-6 bg-base-100 rounded-b-2xl">
        <button className="btn btn-primary" onClick={() => onClose()}>
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
    default:
      return JSON.stringify(details);
  }
}

export default LogsPopup;
