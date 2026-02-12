"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

// ===== Requirement UI Helper =====
const Requirement = ({ ok, text }: { ok: boolean; text: string }) => (
  <motion.p
    className={`flex items-center gap-2 transition-colors duration-300 ${
      ok ? "text-success" : "opacity-60"
    }`}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3 }}
  >
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
    >
      {ok ? "✔" : "•"}
    </motion.span>
    {text}
  </motion.p>
);

const FirstLogin: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState<string>("");

  // ===== Password Requirement Detection =====
  const checks = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: password !== "" && password === confirm,
    };
  }, [password, confirm]);

  // Check for password mismatch
  React.useEffect(() => {
    if (confirm && password && password !== confirm) {
      setError("Passwords do not match");
    } else {
      setError("");
    }
  }, [password, confirm]);

  const strength = Object.values(checks).filter(Boolean).length;

  const strengthLabel = [
    "Very Weak",
    "Weak",
    "Fair",
    "Good",
    "Strong",
    "Excellent",
  ][strength];

  const strengthPercent = (strength / 5) * 100;

  const getStrengthColor = () => {
    if (strength === 0) return "bg-error";
    if (strength <= 2) return "bg-warning";
    if (strength <= 4) return "bg-info";
    return "bg-success";
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, delay: 0.2 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-300 to-base-200 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.img
            src="/SupremeCourtLogo.webp"
            className="w-28 h-28 mx-auto drop-shadow-lg"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          />

          <motion.h1
            className="text-3xl font-bold mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Welcome to RTC System
          </motion.h1>

          <motion.p
            className="text-sm opacity-60 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.4 }}
          >
            Create your password before continuing.
          </motion.p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="bg-base-100 rounded-2xl shadow-2xl p-8 border border-base-300"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <h2 className="text-3xl font-bold text-center mb-8">
            Set Your Password
          </h2>

          <AnimatePresence>
            {error && (
              <motion.div
                className="alert alert-error mb-6"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  x: [0, -10, 10, -10, 10, 0],
                }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.5 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-5">
            {/* New Password */}
            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="label font-semibold">New Password</label>

              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-bordered w-full pr-12 bg-base-200 transition-all duration-300 focus:scale-[1.02]"
                />

                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
                >
                  {showNew ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </motion.div>

            {/* Strength Meter */}
            <AnimatePresence>
              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="relative w-full h-2 bg-base-300 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${getStrengthColor()} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${strengthPercent}%` }}
                      transition={{
                        type: "spring",
                        stiffness: 100,
                        damping: 15,
                      }}
                    />
                  </div>

                  <motion.p
                    className="text-xs mt-2 opacity-70 flex items-center gap-2"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 0.7, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <span className="font-semibold">Strength:</span>
                    <motion.span
                      key={strengthLabel}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`font-medium ${
                        strength <= 2
                          ? "text-warning"
                          : strength <= 4
                            ? "text-info"
                            : "text-success"
                      }`}
                    >
                      {strengthLabel}
                    </motion.span>
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirm Password */}
            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="label font-semibold">Confirm Password</label>

              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input input-bordered w-full pr-12 bg-base-200 transition-all duration-300 focus:scale-[1.02]"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
                >
                  {showConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </motion.div>

            {/* Requirements */}
            <motion.div
              className="text-xs space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Requirement ok={checks.length} text="Minimum 8 characters" />
              <Requirement ok={checks.uppercase} text="One uppercase letter" />
              <Requirement ok={checks.number} text="One number" />
              <Requirement ok={checks.special} text="One special character" />
              <Requirement ok={checks.match} text="Passwords match" />
            </motion.div>

            <motion.button
              type="button"
              className="btn btn-primary w-full mt-6"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Save Password
            </motion.button>
          </form>

          <div className="divider text-xs mt-8">Security Setup</div>

          <p className="text-xs text-center opacity-60">
            You will be redirected to login after saving password.
          </p>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-center mt-8 text-sm opacity-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.7 }}
        >
          © 2026 Regional Trial Court
        </motion.div>
      </div>
    </div>
  );
};

export default FirstLogin;
