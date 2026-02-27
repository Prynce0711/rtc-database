import { LogAction } from "@/app/generated/prisma/enums";
import React from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiEdit,
  FiKey,
  FiLink,
  FiLogIn,
  FiLogOut,
  FiMail,
  FiPlusCircle,
  FiShield,
  FiTrash2,
  FiUpload,
  FiUser,
  FiUserCheck,
  FiUserMinus,
  FiUserPlus,
  FiXCircle,
} from "react-icons/fi";
import BaseBadge from "./BaseBadge";

const LogBadges = ({ logAction }: { logAction: LogAction }) => {
  const getBadgeConfig = (
    action: LogAction,
  ): { color: string; text: string; icon: React.ReactNode } => {
    const config: Record<
      LogAction,
      { color: string; text: string; icon: React.ReactNode }
    > = {
      [LogAction.LOGIN_SUCCESS]: {
        color: "badge-success",
        text: "Login Success",
        icon: <FiLogIn className="w-3 h-3" />,
      },
      [LogAction.LOGIN_FAILED]: {
        color: "badge-error",
        text: "Login Failed",
        icon: <FiXCircle className="w-3 h-3" />,
      },
      [LogAction.LOGOUT]: {
        color: "badge-warning",
        text: "Logout",
        icon: <FiLogOut className="w-3 h-3" />,
      },
      [LogAction.CREATE_CASE]: {
        color: "badge-info",
        text: "Create Case",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.UPDATE_CASE]: {
        color: "badge-info",
        text: "Update Case",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_CASE]: {
        color: "badge-error",
        text: "Delete Case",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.IMPORT_CASES]: {
        color: "badge-success",
        text: "Import Cases",
        icon: <FiUpload className="w-3 h-3" />,
      },
      [LogAction.EXPORT_CASES]: {
        color: "badge-info",
        text: "Export Cases",
        icon: <FiDownload className="w-3 h-3" />,
      },
      [LogAction.CREATE_EMPLOYEE]: {
        color: "badge-info",
        text: "Create Employee",
        icon: <FiUserPlus className="w-3 h-3" />,
      },
      [LogAction.UPDATE_EMPLOYEE]: {
        color: "badge-info",
        text: "Update Employee",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_EMPLOYEE]: {
        color: "badge-error",
        text: "Delete Employee",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.IMPORT_EMPLOYEES]: {
        color: "badge-success",
        text: "Import Employees",
        icon: <FiUpload className="w-3 h-3" />,
      },
      [LogAction.EXPORT_EMPLOYEES]: {
        color: "badge-info",
        text: "Export Employees",
        icon: <FiDownload className="w-3 h-3" />,
      },
      [LogAction.CREATE_USER]: {
        color: "badge-success",
        text: "Create User",
        icon: <FiUserPlus className="w-3 h-3" />,
      },
      [LogAction.UPDATE_ROLE]: {
        color: "badge-warning",
        text: "Update Role",
        icon: <FiShield className="w-3 h-3" />,
      },
      [LogAction.DEACTIVATE_USER]: {
        color: "badge-error",
        text: "Deactivate User",
        icon: <FiUserMinus className="w-3 h-3" />,
      },
      [LogAction.REACTIVATE_USER]: {
        color: "badge-success",
        text: "Reactivate User",
        icon: <FiUserCheck className="w-3 h-3" />,
      },
      [LogAction.CHANGE_PASSWORD]: {
        color: "badge-warning",
        text: "Password Changed",
        icon: <FiKey className="w-3 h-3" />,
      },
      [LogAction.SET_INITIAL_PASSWORD]: {
        color: "badge-success",
        text: "Password Set",
        icon: <FiCheckCircle className="w-3 h-3" />,
      },
      [LogAction.SEND_MAGIC_LINK]: {
        color: "badge-info",
        text: "Magic Link Sent",
        icon: <FiMail className="w-3 h-3" />,
      },
      [LogAction.RESET_PASSWORD]: {
        color: "badge-warning",
        text: "Password Reset",
        icon: <FiLink className="w-3 h-3" />,
      },
      [LogAction.UPDATE_PROFILE]: {
        color: "badge-info",
        text: "Profile Updated",
        icon: <FiUser className="w-3 h-3" />,
      },
      [LogAction.DELETE_USER]: {
        color: "badge-error",
        text: "Delete User",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
    };

    return config[action];
  };

  const { color, text, icon } = getBadgeConfig(logAction);

  return <BaseBadge color={color} text={text} icon={icon} />;
};

export default LogBadges;
