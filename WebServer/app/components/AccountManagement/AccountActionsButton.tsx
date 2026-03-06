"use client";

import { Status, User } from "@/app/generated/prisma/browser";
import {
  FiCheckCircle,
  FiLock,
  FiMoreHorizontal,
  FiSend,
  FiTrash2,
  FiUnlock,
  FiXCircle,
} from "react-icons/fi";
import { usePopup } from "../Popup/PopupProvider";
import {
  cancelPendingAccount,
  deactivateAccount,
  reactivateAccount,
  sendMagicEmail,
} from "./AccountActions";

const AccountActionsButton = ({
  user,
  updateUser,
  onRemove,
}: {
  user: User;
  updateUser: (user: User) => void;
  onRemove?: (userId: string) => void;
}) => {
  const statusPopup = usePopup();

  const handleResendLink = async (user: User) => {
    const confirm = await statusPopup.showConfirm(
      `Resend magic link to ${user.email}?`,
    );
    if (!confirm) return;

    const result = await sendMagicEmail(user.email);
    if (!result.success) {
      statusPopup.showError(
        "Failed to resend magic link" +
          (result.error ? `: ${result.error}` : ""),
      );
    } else {
      statusPopup.showSuccess("Magic link resent successfully");
    }
  };

  const handleCancelPending = async (user: User) => {
    const confirm = await statusPopup.showConfirm(
      `Cancel ${user.email}'s invitation? This will remove the pending user.`,
    );
    if (!confirm) return;

    const result = await cancelPendingAccount(user.id);
    if (!result.success) {
      statusPopup.showError(
        "Failed to cancel invitation" +
          (result.error ? `: ${result.error}` : ""),
      );
    } else {
      onRemove?.(user.id);
      statusPopup.showSuccess("Invitation cancelled");
    }
  };

  const handleActivate = async (user: User) => {
    const confirm = await statusPopup.showConfirm(
      `Reactivate ${user.name}'s account?`,
    );
    if (!confirm) return;

    const result = await reactivateAccount([user.id]);
    if (!result.success) {
      statusPopup.showError(
        "Failed to reactivate account" +
          (result.error ? `: ${result.error}` : ""),
      );
    } else {
      updateUser({ ...user, status: Status.ACTIVE });
      statusPopup.showSuccess("Account reactivated successfully");
    }
  };

  const handleDeactivate = async (user: User) => {
    const confirm = await statusPopup.showConfirm(
      `Deactivate ${user.name}'s account?`,
    );
    if (!confirm) return;

    const result = await deactivateAccount([user.id]);
    if (!result.success) {
      statusPopup.showError(
        "Failed to deactivate account" +
          (result.error ? `: ${result.error}` : ""),
      );
    } else {
      updateUser({ ...user, status: Status.DEACTIVATED });
      statusPopup.showSuccess("Account deactivated successfully");
    }
  };

  return (
    <div className="flex justify-center">
      <div className="dropdown dropdown-end dropdown-top">
        <button
          tabIndex={0}
          className="btn btn-ghost btn-xs px-2 text-base-content/40 hover:text-base-content"
          aria-label="Open actions"
        >
          <FiMoreHorizontal size={16} />
        </button>

        <ul
          tabIndex={0}
          className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-xl w-48 border border-base-200"
          style={{ zIndex: 9999 }}
        >
          {user.status === Status.PENDING && (
            <>
              <li>
                <button
                  className="flex items-center gap-3 text-info text-sm py-2"
                  onClick={() => handleResendLink(user)}
                >
                  <FiSend size={14} />
                  Resend Link
                </button>
              </li>
              <li>
                <button
                  className="flex items-center gap-3 text-error text-sm py-2"
                  onClick={() => handleCancelPending(user)}
                >
                  <FiTrash2 size={14} />
                  Cancel Invite
                </button>
              </li>
            </>
          )}

          {user.status === Status.DEACTIVATED && (
            <li>
              <button
                className="flex items-center gap-3 text-success text-sm py-2"
                onClick={() => handleActivate(user)}
              >
                <FiCheckCircle size={14} />
                Reactivate
              </button>
            </li>
          )}

          {user.status === Status.SUSPENDED && (
            <li>
              <button
                className="flex items-center gap-3 text-success text-sm py-2"
                disabled
              >
                <FiUnlock size={14} />
                Unlock
              </button>
            </li>
          )}

          {user.status === Status.ACTIVE && (
            <>
              <li>
                <button
                  className="flex items-center gap-3 text-warning text-sm py-2"
                  disabled
                >
                  <FiLock size={14} />
                  Lock
                </button>
              </li>
              <li>
                <button
                  className="flex items-center gap-3 text-error text-sm py-2"
                  onClick={() => handleDeactivate(user)}
                >
                  <FiXCircle size={14} />
                  Deactivate
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default AccountActionsButton;
