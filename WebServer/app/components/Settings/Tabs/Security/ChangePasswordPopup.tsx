"use client";

import { authClient } from "@/app/lib/authClient";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { FiEye, FiEyeOff, FiKey, FiX } from "react-icons/fi";
import { recordPasswordChange } from "../../../AccountManagement/AccountActions";
import RequirementUI from "../../../UpdatePassword/RequirementUI";
import StrengthMeter from "../../../UpdatePassword/StrengthMeter";

type ChangePasswordPopupProps = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const ChangePasswordPopup = ({
  open,
  onClose,
  onChanged,
}: ChangePasswordPopupProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const strengthChecks = useMemo(
    () => ({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword],
  );

  const checks = {
    ...strengthChecks,
    match: newPassword !== "" && newPassword === confirmPassword,
  };

  const canSubmit =
    currentPassword.trim() !== "" && Object.values(checks).every(Boolean);

  if (!open) {
    return null;
  }

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setSubmitting(false);
    setErrorText(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setErrorText(null);

    const { error } = await authClient.changePassword({
      newPassword,
      currentPassword,
      revokeOtherSessions: true,
    });

    if (error) {
      setSubmitting(false);
      setErrorText(error.message || "Failed to update password.");
      return;
    }

    const logResult = await recordPasswordChange();
    if (!logResult.success) {
      console.error(logResult.error || "Failed to log password change");
    }

    setSubmitting(false);
    onChanged();
    handleClose();
  };

  return (
    <div className="modal modal-open z-70 bg-black/45 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        className="modal-box w-full max-w-xl rounded-2xl border border-base-300/80 bg-base-100 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-base-300/60 px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
              <FiKey size={16} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-base-content">
                Change Password
              </h3>
              <p className="text-sm text-base-content/45">
                Update your account password.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close popup"
            disabled={submitting}
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="space-y-5 px-7 py-6">
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((value) => !value)}
            disabled={submitting}
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((value) => !value)}
            disabled={submitting}
          />

          {newPassword && (
            <StrengthMeter
              strength={Object.values(strengthChecks).filter(Boolean).length}
            />
          )}

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((value) => !value)}
            disabled={submitting}
          />

          <div className="text-xs space-y-1">
            <RequirementUI ok={checks.length} text="Minimum 8 characters" />
            <RequirementUI ok={checks.uppercase} text="One uppercase letter" />
            <RequirementUI ok={checks.number} text="One number" />
            <RequirementUI ok={checks.special} text="One special character" />
            <RequirementUI ok={checks.match} text="Passwords match" />
          </div>

          {errorText && (
            <div role="alert" className="alert alert-error py-2 text-xs">
              <span>{errorText}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-ghost btn-sm rounded-lg"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn btn-primary btn-sm rounded-lg px-5"
            >
              {submitting ? "Saving..." : "Save Password"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PasswordField = ({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled: boolean;
}) => (
  <label className="form-control w-full">
    <span className="label-text mb-1.5 text-xs font-semibold text-base-content/60">
      {label}
    </span>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input input-bordered h-11 w-full rounded-lg border-base-300 bg-base-100 pr-11 text-sm focus:border-primary/50 focus:outline-none"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/35 hover:text-base-content/70"
        aria-label={show ? "Hide password" : "Show password"}
        disabled={disabled}
      >
        {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
      </button>
    </div>
  </label>
);

export default ChangePasswordPopup;
