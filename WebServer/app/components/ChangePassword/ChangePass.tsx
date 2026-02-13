"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

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

const ChangePassword: React.FC = () => {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");

  // ===== PASSWORD VALIDATION =====
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
  const strengthPercent = (strength / 5) * 100;

  const strengthLabel = [
    "Very Weak",
    "Weak",
    "Fair",
    "Good",
    "Strong",
    "Excellent",
  ][strength];

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
        {/* full-screen overlay used during transition */}
        <motion.div
          className="fixed inset-0 z-20 bg-base-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
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
            className="text-4xl font-bold text-base-content mb-2 tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Regional Trial Court
          </motion.h1>

          <motion.p
            className="text-lg text-base-content/90 font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Republic of the Philippines
          </motion.p>

          <motion.p
            className="text-sm text-base-content/60 italic mt-2 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.5 }}
          >
            "Batas at Bayan"
          </motion.p>
        </motion.div>

        {/* CARD */}
        <motion.div
          className="bg-base-100 rounded-2xl shadow-2xl p-8 border border-base-300"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <h2 className="text-2xl font-bold text-center mb-2">
            Change Password
          </h2>
          <p className="text-sm text-base-content/60 text-center mb-8">
            Update your credentials securely
          </p>
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
            {/* CURRENT PASSWORD */}
            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="label font-semibold">Current Password</label>

              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="input input-bordered w-full pr-12 bg-base-200 transition-all duration-300 focus:scale-[1.02]"
                />

                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
                >
                  {showCurrent ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </motion.div>

            {/* NEW PASSWORD */}
            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
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
                ></button>
              </div>
            </motion.div>

            {/* STRENGTH METER */}
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

            {/* CONFIRM PASSWORD */}
            <motion.div
              className="form-control"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
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
                ></button>
              </div>
            </motion.div>

            {/* REQUIREMENTS */}
            <motion.div
              className="text-xs space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
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
              transition={{ delay: 0.7 }}
            >
              Update Password
            </motion.button>
          </form>

          <div className="divider text-xs mt-8">Secure Action</div>

          <p className="text-xs text-center opacity-60">
            Your password change will require re-authentication.
          </p>
        </motion.div>

        {/* FOOTER */}
        <motion.div
          className="text-center mt-8 text-sm opacity-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.8 }}
        >
          © 2026 Regional Trial Court
        </motion.div>
      </div>
    </div>
  );
};

export default ChangePassword;
