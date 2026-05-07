import { LogAction } from "@rtc-database/shared/prisma/enums";
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
      [LogAction.UPDATE_STATUS]: {
        color: "badge-info",
        text: "Update Status",
        icon: <FiUserCheck className="w-3 h-3" />,
      },
      [LogAction.UPDATE_TUTORIAL]: {
        color: "badge-info",
        text: "Tutorial Updated",
        icon: <FiCheckCircle className="w-3 h-3" />,
      },
      [LogAction.UPDATE_SYSTEM_SETTINGS]: {
        color: "badge-warning",
        text: "System Settings",
        icon: <FiShield className="w-3 h-3" />,
      },
      [LogAction.UPDATE_BACKUP_SETTINGS]: {
        color: "badge-warning",
        text: "Backup Settings",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.RUN_BACKUP]: {
        color: "badge-success",
        text: "Run Backup",
        icon: <FiUpload className="w-3 h-3" />,
      },
      [LogAction.RESTORE_BACKUP]: {
        color: "badge-warning",
        text: "Restore Backup",
        icon: <FiDownload className="w-3 h-3" />,
      },
      [LogAction.CREATE_BACKUP_ACCOUNT]: {
        color: "badge-success",
        text: "Create Backup Account",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.UPDATE_BACKUP_ACCOUNT]: {
        color: "badge-info",
        text: "Update Backup Account",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_BACKUP_ACCOUNT]: {
        color: "badge-error",
        text: "Delete Backup Account",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.CREATE_NOTARIAL]: {
        color: "badge-success",
        text: "Create Notarial",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.UPDATE_NOTARIAL]: {
        color: "badge-info",
        text: "Update Notarial",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_NOTARIAL]: {
        color: "badge-error",
        text: "Delete Notarial",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.CREATE_NOTARIAL_COMMISSION]: {
        color: "badge-success",
        text: "Create Commission",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.UPDATE_NOTARIAL_COMMISSION]: {
        color: "badge-info",
        text: "Update Commission",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_NOTARIAL_COMMISSION]: {
        color: "badge-error",
        text: "Delete Commission",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.IMPORT_NOTARIAL_COMMISSION]: {
        color: "badge-success",
        text: "Import Commission",
        icon: <FiUpload className="w-3 h-3" />,
      },
      [LogAction.EXPORT_NOTARIAL_COMMISSION]: {
        color: "badge-info",
        text: "Export Commission",
        icon: <FiDownload className="w-3 h-3" />,
      },
      [LogAction.CREATE_STATISTICS]: {
        color: "badge-success",
        text: "Create Statistics",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.UPDATE_STATISTICS]: {
        color: "badge-info",
        text: "Update Statistics",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_STATISTICS]: {
        color: "badge-error",
        text: "Delete Statistics",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.IMPORT_STATISTICS]: {
        color: "badge-success",
        text: "Import Statistics",
        icon: <FiUpload className="w-3 h-3" />,
      },
      [LogAction.EXPORT_STATISTICS]: {
        color: "badge-info",
        text: "Export Statistics",
        icon: <FiDownload className="w-3 h-3" />,
      },
      [LogAction.CLEAR_STATISTICS]: {
        color: "badge-error",
        text: "Clear Statistics",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.UPLOAD_FILE]: {
        color: "badge-success",
        text: "Upload File",
        icon: <FiUpload className="w-3 h-3" />,
      },
      [LogAction.UPDATE_FILE]: {
        color: "badge-info",
        text: "Update File",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.DELETE_FILE]: {
        color: "badge-error",
        text: "Delete File",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.MOVE_FILE]: {
        color: "badge-info",
        text: "Move File",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.RENAME_FILE]: {
        color: "badge-info",
        text: "Rename File",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.CREATE_FOLDER]: {
        color: "badge-success",
        text: "Create Folder",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.CREATE_CHAT]: {
        color: "badge-success",
        text: "Create Chat",
        icon: <FiPlusCircle className="w-3 h-3" />,
      },
      [LogAction.DELETE_CHAT]: {
        color: "badge-error",
        text: "Delete Chat",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.LEAVE_CHAT]: {
        color: "badge-warning",
        text: "Leave Chat",
        icon: <FiLogOut className="w-3 h-3" />,
      },
      [LogAction.SEND_MESSAGE]: {
        color: "badge-info",
        text: "Send Message",
        icon: <FiMail className="w-3 h-3" />,
      },
      [LogAction.DELETE_MESSAGE]: {
        color: "badge-error",
        text: "Delete Message",
        icon: <FiTrash2 className="w-3 h-3" />,
      },
      [LogAction.UPDATE_SYNC_STATE]: {
        color: "badge-info",
        text: "Update Sync",
        icon: <FiEdit className="w-3 h-3" />,
      },
      [LogAction.RESET_SYNC_STATE]: {
        color: "badge-warning",
        text: "Reset Sync",
        icon: <FiXCircle className="w-3 h-3" />,
      },
    };

    return config[action];
  };

  const { color, text, icon } = getBadgeConfig(logAction);

  return <BaseBadge color={color} text={text} icon={icon} />;
};

export default LogBadges;
