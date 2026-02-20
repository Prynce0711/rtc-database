"use client";

import { Status, User } from "@/app/generated/prisma/browser";
import { usePopup } from "../Popup/PopupProvider";
import {
  deactivateAccount,
  reactivateAccount,
  sendMagicEmail,
} from "./AccountActions";

const AccountActionsButton = ({
  user,
  updateUser,
}: {
  user: User;
  updateUser: (user: User) => void;
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

  if (user.status === Status.PENDING)
    return (
      <button
        className="btn btn-sm bg-base-300  items-center justify-center text-center"
        onClick={() => handleResendLink(user)}
      >
        Resend Link
      </button>
    );

  if (user.status === Status.SUSPENDED)
    return (
      <button className="btn btn-sm btn-success items-center justify-center text-center">
        Unlock
      </button>
    );

  if (user.status === Status.DEACTIVATED)
    return (
      <button
        className="btn btn-sm btn-success items-center justify-center text-center"
        onClick={() => handleActivate(user)}
      >
        Reactivate
      </button>
    );

  return (
    <div className="flex gap-2">
      <button className="btn btn-sm bg-base-300  items-center justify-center text-center">
        Lock
      </button>
      <button
        className="btn btn-sm btn-error items-center justify-center text-center"
        onClick={() => handleDeactivate(user)}
      >
        Deactivate
      </button>
    </div>
  );
};

export default AccountActionsButton;
