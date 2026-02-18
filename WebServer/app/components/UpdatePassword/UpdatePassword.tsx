"use client";

import { authClient, useSession } from "@/app/lib/authClient";
import { isDarkMode } from "@/app/lib/utils";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiCopy, FiEye, FiEyeOff } from "react-icons/fi";
import { setInitialPassword } from "../AccountManagement/AccountActions";
import { usePopup } from "../Popup/PopupProvider";
import RequirementUI from "./RequirementUI";
import StrengthMeter from "./StrengthMeter";

export enum UpdatePasswordType {
  FIRST_LOGIN = "FIRST_LOGIN",
  CHANGE_PASSWORD = "CHANGE_PASSWORD",
}

const UpdatePassword: React.FC<{ type: UpdatePasswordType }> = ({ type }) => {
  const router = useRouter();
  const overlayControls = useAnimationControls();
  const statusPopup = usePopup();
  const session = useSession();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(isDarkMode());
  const [darkMode, setDarkMode] = useState(isDarkMode());
  // NEW STATES
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [modalShowPass, setModalShowPass] = useState(false);
  const [confirmedSave, setConfirmedSave] = useState(false);
  const [copied, setCopied] = useState(false);

  // ===== Password Requirement Detection =====
  const strengthChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const matchCheck = password !== "" && password === confirm;

  const checks = { ...strengthChecks, match: matchCheck };
  const isValid = Object.values(checks).every(Boolean);
  useEffect(() => {
    const handleThemeChange = () => {
      setDarkMode(isDarkMode());
    };
    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);
  useEffect(() => {
    const handleThemeChange = () => {
      setDarkMode(isDarkMode());
    };
    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);
  // Check mismatch
  useEffect(() => {
    if (confirm && password && password !== confirm) {
      setError("Passwords do not match");
    } else {
      setError("");
    }
  }, [password, confirm]);

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, delay: 0.2 },
    },
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmSave = async () => {
    setShowReviewModal(false);
    statusPopup.showLoading("Updating password...");

    if (!session?.data?.user) {
      statusPopup.showError("You are not logged in.");
      return;
    }

    if (type === UpdatePasswordType.CHANGE_PASSWORD) {
      const { data, error } = await authClient.changePassword({
        newPassword: password, // required
        currentPassword: UpdatePasswordType.CHANGE_PASSWORD ? current : "", // required
        revokeOtherSessions: true,
      });

      if (error) {
        statusPopup.showError(error.message || "Failed to update password");
        return;
      }
    } else {
      const result = await setInitialPassword(password);
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to set password");
        return;
      }
    }

    statusPopup.hidePopup();
    router.push("/");
  };

  return (
    <>
      {/* 🔐 IMPROVED REVIEW MODAL */}
      {showReviewModal && (
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-base-100 rounded-3xl shadow-2xl p-10 w-full max-w-xl border border-base-300"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="mb-6 text-center">
                <h3 className="text-4xl font-bold mb-4">
                  Review your password
                </h3>
                <p className="text-lg opacity-60">
                  This password will only be shown once. <br /> Save it securely
                  before continuing.
                </p>
              </div>

              {/* Password Display */}
              <div className="relative mb-6">
                <div className="bg-base-200 rounded-xl p-5 pr-24">
                  <p className="font-mono text-sm break-all">
                    {modalShowPass ? password : "••••••••••••"}
                  </p>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalShowPass(!modalShowPass)}
                    className="p-2 hover:bg-base-300 rounded-lg transition-colors"
                    aria-label={
                      modalShowPass ? "Hide password" : "Show password"
                    }
                  >
                    {modalShowPass ? (
                      <FiEyeOff className="w-4 h-4" />
                    ) : (
                      <FiEye className="w-4 h-4" />
                    )}
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="p-2 hover:bg-base-300 rounded-lg transition-colors"
                      aria-label="Copy password"
                    >
                      {copied ? (
                        <FiCheck className="w-4 h-4 text-success" />
                      ) : (
                        <FiCopy className="w-4 h-4" />
                      )}
                    </button>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {copied && (
                        <motion.div
                          className="absolute -top-9 left-1/2 -translate-x-1/2 bg-success text-success-content px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shadow-lg"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.15 }}
                        >
                          Copied!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 mb-6 cursor-pointer group">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary mt-0.5"
                  checked={confirmedSave}
                  onChange={() => setConfirmedSave(!confirmedSave)}
                />
                <span className="text-sm select-none">
                  I confirm that I have saved this password securely
                </span>
              </label>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  disabled={!confirmedSave}
                  onClick={handleConfirmSave}
                  className="btn btn-primary btn-lg flex-1"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* MAIN PAGE */}
      <div className="min-h-screen flex items-center justify-center px-4 py-12 relative  bg-black/90">
        <Image
          src="/ha.jpg"
          alt="Background"
          fill
          className={`object-cover ${darkMode ? "opacity-20" : "opacity-30"} pointer-events-none`}
          priority
        />

        <div className="max-w-md w-full relative z-10 mt-16">
          {/* full-screen overlay used during transition */}
          <motion.div
            className="fixed inset-0 z-20 bg-base-100"
            initial={{ opacity: 0 }}
            animate={overlayControls}
            style={{ pointerEvents: "none" }}
          />

          {/* Logo and Header */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative group"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  delay: 0.1,
                }}
              >
                <motion.div
                  className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/30 transition-all duration-300"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.3, 0.2],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <img
                  src="/SupremeCourtLogo.webp"
                  alt="Supreme Court of the Philippines"
                  className="w-32 h-32 object-contain relative z-10 drop-shadow-lg"
                />
              </motion.div>
            </div>

            <motion.h1
              className="text-4xl font-bold text-white mb-2 tracking-tight"
              style={{
                textShadow:
                  "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Regional Trial Court
            </motion.h1>

            <motion.p
              className="text-lg text-white/90 font-semibold"
              style={{
                textShadow:
                  "2px 2px 6px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.5)",
              }}
              className="text-lg text-white/90 font-semibold"
              style={{
                textShadow:
                  "2px 2px 6px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.5)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Republic of the Philippines
            </motion.p>

            <motion.p
              className="text-sm text-white/90 italic mt-2 font-medium"
              style={{
                textShadow:
                  "1px 1px 5px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.4)",
              }}
              className="text-sm text-white/90 italic mt-2 font-medium"
              style={{
                textShadow:
                  "1px 1px 5px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.4)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ delay: 0.5 }}
            >
              &quot;Batas at Bayan&quot;
            </motion.p>
          </motion.div>

          {/* Card */}
          <motion.div
            className="
relative z-10
rounded-2xl
p-8
bg-linear-to-b from-white/90 to-white/60
border border-white/20
shadow-xl
"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <h2 className="text-2xl font-bold text-center mb-4">
              {type === UpdatePasswordType.FIRST_LOGIN
                ? "Create Your Password"
                : "Change Password"}
            </h2>
            <p className="text-xs text-center text-warning font-medium mb-8">
              {type === UpdatePasswordType.FIRST_LOGIN
                ? "Set a strong password for your account."
                : "For security compliance, passwords cannot be retrieved or reset without administrator verification."}
            </p>

            <AnimatePresence>
              {error && (
                <motion.div
                  className="alert alert-error mb-6"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-5">
              {/* Current Password - Only for CHANGE_PASSWORD */}
              {type === UpdatePasswordType.CHANGE_PASSWORD && (
                <div>
                  <label className="label font-semibold">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      className="input input-bordered w-full pr-12 bg-base-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                    >
                      {showCurrent ? (
                        <FiEyeOff className="w-5 h-5" />
                      ) : (
                        <FiEye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="label font-semibold">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input input-bordered w-full pr-12 bg-base-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                  >
                    {showNew ? (
                      <FiEyeOff className="w-5 h-5" />
                    ) : (
                      <FiEye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Strength Meter */}
              {password && (
                <StrengthMeter
                  strength={
                    Object.values(strengthChecks).filter(Boolean).length
                  }
                />
              )}

              {/* Confirm Password */}
              <div>
                <label className="label font-semibold">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input input-bordered w-full pr-12 bg-base-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                  >
                    {showConfirm ? (
                      <FiEyeOff className="w-5 h-5" />
                    ) : (
                      <FiEye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Requirements */}
              <div className="text-xs space-y-1">
                <RequirementUI ok={checks.length} text="Minimum 8 characters" />
                <RequirementUI
                  ok={checks.uppercase}
                  text="One uppercase letter"
                />
                <RequirementUI ok={checks.number} text="One number" />
                <RequirementUI
                  ok={checks.special}
                  text="One special character"
                />
                <RequirementUI ok={checks.match} text="Passwords match" />
              </div>

              <button
                type="button"
                disabled={!isValid}
                onClick={() => setShowReviewModal(true)}
                className="btn btn-primary w-full mt-6"
              >
                Save Password
              </button>
            </form>

            <div className="divider text-xs text-base-content/70 mt-8">
              {type === UpdatePasswordType.FIRST_LOGIN
                ? "Account Setup"
                : "Security Setup"}
            </div>

            <p className="text-xs text-center opacity-60">
              {type === UpdatePasswordType.FIRST_LOGIN
                ? "Complete your account setup to get started."
                : "You will be redirected to login after saving password."}
            </p>
          </motion.div>

          {/* Footer */}
          <motion.div className="text-xs text-center text-base-content/80 mt-3">
            © 2026 Regional Trial Court
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default UpdatePassword;
