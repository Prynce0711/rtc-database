"use client";

import { authClient } from "@/app/lib/authClient";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiShieldOff, FiX } from "react-icons/fi";

type Disable2FAPopupProps = {
  open: boolean;
  onClose: () => void;
  onDisabled: () => void;
};

const Disable2FAPopup = ({
  open,
  onClose,
  onDisabled,
}: Disable2FAPopupProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setShowPassword(false);
      setSubmitting(false);
      setErrorText(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleDisable2FA = async () => {
    if (!password.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    const { error } = await authClient.twoFactor.disable({
      password,
    });

    setSubmitting(false);

    if (error) {
      setErrorText(
        error.message || "Failed to disable 2FA. Please check your password.",
      );
      return;
    }

    onDisabled();
    onClose();
  };

  return (
    <div className="modal modal-open z-70 bg-black/45 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Disable two-factor authentication"
        className="modal-box w-full max-w-lg rounded-2xl border border-base-300/80 bg-base-100 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-base-300/60 px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-warning/20 bg-warning/10 p-2.5 text-warning">
              <FiShieldOff size={16} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-base-content">
                Disable Two-Factor Authentication
              </h3>
              <p className="text-sm text-base-content/45">
                Password confirmation is required for security.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close popup"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="space-y-5 px-7 py-6">
          <div className="alert border border-warning/20 bg-warning/10">
            <span className="text-sm text-base-content/70">
              After disabling 2FA, your account will only require password
              sign-in.
            </span>
          </div>

          <label className="form-control w-full">
            <span className="label-text mb-1.5 text-xs font-semibold text-base-content/60">
              Account Password
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input input-bordered h-11 w-full rounded-lg border-base-300 bg-base-100 pr-11 text-sm focus:border-primary/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/35 hover:text-base-content/70"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </label>

          {errorText && (
            <div role="alert" className="alert alert-error/80 py-2 text-xs">
              <span>{errorText}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDisable2FA}
              disabled={!password.trim() || submitting}
              className="btn btn-warning btn-sm rounded-lg px-4"
            >
              {submitting ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Disable2FAPopup;
