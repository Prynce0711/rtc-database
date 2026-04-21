"use client";

import { authClient } from "@/app/lib/authClient";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { FiDownload, FiEye, FiEyeOff, FiShield, FiX } from "react-icons/fi";

type Enable2FAPopupProps = {
  open: boolean;
  onClose: () => void;
  onEnabled: () => void;
};

type Enable2FAResponse = {
  totpURI: string;
  backupCodes: string[];
};

const Enable2FAPopup = ({ open, onClose, onEnabled }: Enable2FAPopupProps) => {
  const [step, setStep] = useState<"password" | "setup" | "verify">("password");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<Enable2FAResponse | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("password");
      setPassword("");
      setShowPassword(false);
      setTotpCode("");
      setTrustDevice(true);
      setRevokeOtherSessions(false);
      setSubmitting(false);
      setVerifying(false);
      setErrorText(null);
      setSetupData(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleEnable2FA = async () => {
    if (!password.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    const { data, error } = await authClient.twoFactor.enable({
      password,
      issuer: "RTC Database",
    });

    setSubmitting(false);

    if (error) {
      setErrorText(
        error.message || "Invalid password or failed to enable 2FA.",
      );
      return;
    }

    const result = data as Enable2FAResponse | null;
    if (!result?.totpURI || !Array.isArray(result.backupCodes)) {
      setErrorText("2FA setup completed, but setup details were not returned.");
      return;
    }

    setSetupData(result);
    setStep("setup");
  };

  const handleVerifyTotp = async () => {
    const normalizedCode = totpCode.replace(/\D/g, "").slice(0, 6);

    if (normalizedCode.length !== 6 || verifying) {
      if (normalizedCode.length !== 6) {
        setErrorText("Enter the 6-digit code from your authenticator app.");
      }
      return;
    }

    setErrorText(null);
    setVerifying(true);

    const { error } = await authClient.twoFactor.verifyTotp({
      code: normalizedCode,
      trustDevice,
    });

    setVerifying(false);

    if (error) {
      setErrorText(error.message || "Invalid TOTP code. Please try again.");
      return;
    }

    if (revokeOtherSessions) {
      await authClient.revokeOtherSessions();
    }

    onEnabled();
    onClose();
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes?.length) return;

    const content = [
      "RTC Database - Two-Factor Backup Codes",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Store these codes in a safe place. Each code can only be used once.",
      "",
      ...setupData.backupCodes.map((code, index) => `${index + 1}. ${code}`),
      "",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rtc-database-2fa-backup-codes.txt";
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
        aria-label="Enable two-factor authentication"
        className="modal-box w-full max-w-2xl rounded-2xl border border-base-300/80 bg-base-100 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-base-300/60 px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-info/20 bg-info/10 p-2.5 text-info">
              <FiShield size={16} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-base-content">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-base-content/45">
                Step {step === "password" ? "1" : step === "setup" ? "2" : "3"}{" "}
                of 3
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

        {step === "password" && (
          <div className="space-y-5 px-7 py-6">
            <div className="alert border border-info/15 bg-info/6">
              <span className="text-sm text-base-content/70">
                Enter your password to begin setting up two-factor
                authentication.
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
                onClick={handleEnable2FA}
                disabled={!password.trim() || submitting}
                className="btn btn-info btn-sm rounded-lg px-4"
              >
                {submitting ? "Saving..." : "Next"}
              </button>
            </div>
          </div>
        )}

        {step === "setup" && setupData && (
          <div className="space-y-6 px-7 py-6">
            <div className="alert border border-success/20 bg-success/8">
              <span className="text-sm text-base-content/75">
                Scan this QR code with Google Authenticator, Microsoft
                Authenticator, or Authy.
              </span>
            </div>

            <div className="rounded-2xl border border-base-300/70 bg-base-200/35 p-5">
              <p className="mb-3 text-sm font-semibold text-base-content">
                Authenticator QR Code
              </p>
              <div className="flex justify-center rounded-xl border border-base-300 bg-base-100 p-4">
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG
                    value={setupData.totpURI}
                    size={220}
                    bgColor="#FFFFFF"
                    fgColor="#111827"
                    level="M"
                    includeMargin
                    title="TOTP QR Code"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-warning/25 bg-warning/8 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-base-content">
                  Backup Codes
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
                {setupData.backupCodes.map((code) => (
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
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorText(null);
                    setStep("password");
                  }}
                  className="btn btn-ghost btn-sm rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorText(null);
                    setStep("verify");
                  }}
                  className="btn btn-primary btn-sm rounded-lg px-5"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "verify" && setupData && (
          <div className="space-y-5 px-7 py-6">
            <div className="alert border border-info/15 bg-info/6">
              <span className="text-sm text-base-content/70">
                Enter the 6-digit code from your authenticator app to finish
                enabling 2FA.
              </span>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1.5 text-xs font-semibold text-base-content/60">
                TOTP Code
              </span>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                className="input input-bordered h-11 w-full rounded-lg border-base-300 bg-base-100 text-center font-mono text-lg tracking-[0.35em] focus:border-primary/50 focus:outline-none"
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary mt-0.5"
                checked={trustDevice}
                onChange={() => setTrustDevice((value) => !value)}
              />
              <span className="text-sm text-base-content/80">
                Trust this device for 30 days
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary mt-0.5"
                checked={revokeOtherSessions}
                onChange={() => setRevokeOtherSessions((value) => !value)}
              />
              <span className="text-sm text-base-content/80">
                Revoke other active sessions after enabling 2FA
              </span>
            </label>

            {errorText && (
              <div role="alert" className="alert alert-error/80 py-2 text-xs">
                <span>{errorText}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setErrorText(null);
                  setStep("setup");
                }}
                className="btn btn-ghost btn-sm rounded-lg"
                disabled={verifying}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleVerifyTotp}
                disabled={
                  totpCode.replace(/\D/g, "").slice(0, 6).length !== 6 ||
                  verifying
                }
                className="btn btn-primary btn-sm rounded-lg px-5"
              >
                {verifying ? "Verifying..." : "Finish"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Enable2FAPopup;
