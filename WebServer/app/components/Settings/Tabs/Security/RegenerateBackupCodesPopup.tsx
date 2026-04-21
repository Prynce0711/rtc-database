"use client";

import { authClient } from "@/app/lib/authClient";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiDownload, FiEye, FiEyeOff, FiRefreshCcw, FiX } from "react-icons/fi";

type RegenerateBackupCodesPopupProps = {
  open: boolean;
  onClose: () => void;
  onRegenerated: () => void;
};

type GenerateBackupCodesResponse = {
  backupCodes: string[];
};

const RegenerateBackupCodesPopup = ({
  open,
  onClose,
  onRegenerated,
}: RegenerateBackupCodesPopupProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setShowPassword(false);
      setSubmitting(false);
      setErrorText(null);
      setBackupCodes(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleRegenerate = async () => {
    if (!password.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    const { data, error } = await authClient.twoFactor.generateBackupCodes({
      password,
    });

    setSubmitting(false);

    if (error) {
      setErrorText(error.message || "Failed to regenerate backup codes.");
      return;
    }

    const result = data as GenerateBackupCodesResponse | null;
    if (!result?.backupCodes || !Array.isArray(result.backupCodes)) {
      setErrorText(
        "Backup code generation completed, but no codes were returned.",
      );
      return;
    }

    setBackupCodes(result.backupCodes);
    onRegenerated();
  };

  const downloadBackupCodes = () => {
    if (!backupCodes?.length) return;

    const content = [
      "RTC Database - Regenerated Two-Factor Backup Codes",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Previous backup codes are now invalid.",
      "Store these codes in a safe place. Each code can only be used once.",
      "",
      ...backupCodes.map((code, index) => `${index + 1}. ${code}`),
      "",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rtc-database-2fa-backup-codes-regenerated.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal modal-open z-70 bg-black/45 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Regenerate backup codes"
        className="modal-box w-full max-w-2xl rounded-2xl border border-base-300/80 bg-base-100 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-base-300/60 px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-warning/20 bg-warning/10 p-2.5 text-warning">
              <FiRefreshCcw size={16} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-base-content">
                Regenerate Backup Codes
              </h3>
              <p className="text-sm text-base-content/45">
                Generate a new set of recovery codes
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

        {!backupCodes && (
          <div className="space-y-5 px-7 py-6">
            <div className="alert border border-warning/20 bg-warning/10">
              <span className="text-sm text-base-content/70">
                This will invalidate your old backup codes and generate new
                ones.
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
                onClick={handleRegenerate}
                disabled={!password.trim() || submitting}
                className="btn btn-warning btn-sm rounded-lg px-4"
              >
                {submitting ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </div>
        )}

        {backupCodes && (
          <div className="space-y-6 px-7 py-6">
            <div className="alert border border-success/20 bg-success/8">
              <span className="text-sm text-base-content/75">
                New backup codes generated successfully. Previous codes are no
                longer valid.
              </span>
            </div>

            <div className="rounded-2xl border border-warning/25 bg-warning/8 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-base-content">
                  New Backup Codes
                </p>
                <button
                  type="button"
                  onClick={downloadBackupCodes}
                  className="btn btn-xs btn-outline rounded-lg gap-1.5"
                >
                  <FiDownload size={12} />
                  Download TXT
                </button>
              </div>
              <p className="mb-3 text-xs text-base-content/60">
                Save these in a secure location. Each code can only be used
                once.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div
                    key={code}
                    className="rounded-lg border border-base-300/80 bg-base-100 px-3 py-2 text-center font-mono text-xs tracking-wide"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary btn-sm rounded-lg px-5"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RegenerateBackupCodesPopup;
