import { LogAction } from "@/app/generated/prisma/enums";
import BaseBadge from "./BaseBadge";

const LogBadges = ({ logAction }: { logAction: LogAction }) => {
  const getBadgeConfig = (
    action: LogAction,
  ): { color: string; text: string } => {
    const config: Record<LogAction, { color: string; text: string }> = {
      [LogAction.LOGIN_SUCCESS]: {
        color: "badge-success",
        text: "Login Success",
      },
      [LogAction.LOGIN_FAILED]: { color: "badge-error", text: "Login Failed" },
      [LogAction.LOGOUT]: { color: "badge-warning", text: "Logout" },
      [LogAction.CREATE_CASE]: { color: "badge-info", text: "Create Case" },
      [LogAction.UPDATE_CASE]: { color: "badge-info", text: "Update Case" },
      [LogAction.DELETE_CASE]: { color: "badge-error", text: "Delete Case" },
      [LogAction.IMPORT_CASES]: {
        color: "badge-success",
        text: "Import Cases",
      },
      [LogAction.EXPORT_CASES]: { color: "badge-info", text: "Export Cases" },
      [LogAction.CREATE_EMPLOYEE]: {
        color: "badge-info",
        text: "Create Employee",
      },
      [LogAction.UPDATE_EMPLOYEE]: {
        color: "badge-info",
        text: "Update Employee",
      },
      [LogAction.DELETE_EMPLOYEE]: {
        color: "badge-error",
        text: "Delete Employee",
      },
      [LogAction.IMPORT_EMPLOYEES]: {
        color: "badge-success",
        text: "Import Employees",
      },
      [LogAction.EXPORT_EMPLOYEES]: {
        color: "badge-info",
        text: "Export Employees",
      },
      [LogAction.CREATE_USER]: { color: "badge-success", text: "Create User" },
      [LogAction.UPDATE_ROLE]: { color: "badge-warning", text: "Update Role" },
      [LogAction.DEACTIVATE_USER]: {
        color: "badge-error",
        text: "Deactivate User",
      },
      [LogAction.REACTIVATE_USER]: {
        color: "badge-success",
        text: "Reactivate User",
      },
    };

    return config[action];
  };

  const { color, text } = getBadgeConfig(logAction);

  return <BaseBadge color={color} text={text} />;
};

export default LogBadges;
